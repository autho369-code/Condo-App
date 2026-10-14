-- Inventory and reactivation decisions (Mirsad, 2026-10-14).
--
-- 8. Company admins use inventory like staff. inventory_items and
--    inventory_movements admitted only staff (is_any_staff); the policies now
--    compare the row's company with my_access_portfolio() (staff OR company
--    admin, their own company; once per query), and record_inventory_movement
--    accepts a company admin too. Nothing else is widened: the inventory
--    reports keep their own rules.
-- 9. "Used on work order #N" is resolved in the app (lib/rpcs/inventory.ts)
--    within the item's company and refuses an ambiguous number; the database
--    function already takes the work order id and checks it.
-- 10. Late fees after a suspended company is reactivated: late fees run twice
--    a day (pg_cron cron_assess_late_fees at 11:10 UTC and the Vercel route
--    /api/billing/assess-late-fees at 15:00 UTC), and the held AutoPay
--    charges run at 14:00 UTC, so on the reactivation day an AutoPay owner
--    could get a late fee before AutoPay paid. portfolios.reactivated_at
--    records when a suspension was lifted (set by
--    portfolios_guard_platform_columns whenever suspended_at goes from set to
--    empty, so the operator page's service-client update and
--    reactivate_portfolio both record it; signed-in users can't write it
--    directly). cron_assess_late_fees then skips a charge (a) for 24 hours
--    after that, when its unit has an active AutoPay mandate that is due
--    (next run date reached, not skipped), which covers both runs on the
--    reactivation day; and (b) in every company, not only after a
--    reactivation, while its unit has money genuinely in flight: a Stripe
--    payment 'processing' that was created in the last 14 days (ACH takes
--    days to clear), or an AutoPay payment (a stripe_autopay_runs row with the
--    same id) still 'pending' and created in the last day. An unpaid portal
--    checkout is not money in flight, and the age bounds keep a stuck row (a
--    lost webhook, a crashed AutoPay run) from holding late fees forever.
--    Whatever isn't paid is assessed on a later run.
--
-- Function bodies are the live bodies (pg_get_functiondef, 2026-10-14) with
-- only the marked changes.

-- 8. ------------------------------------------------------------------------
alter policy inventory_items_staff_select on public.inventory_items
  using ((select public.is_platform_operator())
         or coalesce(portfolio_id = (select public.my_access_portfolio()), false));

alter policy inventory_items_staff_insert on public.inventory_items
  with check (coalesce(coalesce(portfolio_id, (select public.my_access_portfolio()))
                       = (select public.my_access_portfolio()), false));

alter policy inventory_items_staff_update on public.inventory_items
  using (coalesce(portfolio_id = (select public.my_access_portfolio()), false))
  with check (coalesce(portfolio_id = (select public.my_access_portfolio()), false));

alter policy inventory_movements_staff_select on public.inventory_movements
  using ((select public.is_platform_operator())
         or coalesce(portfolio_id = (select public.my_access_portfolio()), false));

create or replace function public.record_inventory_movement(p_item_id uuid, p_kind text, p_quantity numeric, p_direction text, p_work_order_id uuid, p_unit_cost numeric, p_note text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  it public.inventory_items;
  wo record;
  v_assoc uuid;
  v_change numeric;
  v_after numeric;
  v_id uuid;
begin
  -- Changed: company admins record inventory too.
  if not (public.is_any_staff() or public.is_company_admin()) then
    raise exception 'Only company staff can record inventory' using errcode = '42501';
  end if;
  select * into it from public.inventory_items where id = p_item_id and archived_at is null for update;
  if it.id is null or it.portfolio_id is distinct from public.current_portfolio_id() then
    raise exception 'Inventory item not found' using errcode = '42501';
  end if;
  p_quantity := round(p_quantity, 2);
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Enter a quantity greater than zero' using errcode = '22023';
  end if;
  if p_kind = 'received' then
    v_change := p_quantity;
  elsif p_kind = 'used' then
    v_change := -p_quantity;
  elsif p_kind = 'adjusted' then
    if p_direction not in ('add', 'remove') then
      raise exception 'Choose whether the adjustment adds or removes stock' using errcode = '22023';
    end if;
    v_change := case when p_direction = 'add' then p_quantity else -p_quantity end;
  else
    raise exception 'Unknown inventory movement' using errcode = '22023';
  end if;

  if p_work_order_id is not null then
    if p_kind <> 'used' then
      raise exception 'Only stock used can be tied to a work order' using errcode = '22023';
    end if;
    select w.id, w.association_id, w.portfolio_id into wo from public.work_orders w where w.id = p_work_order_id;
    if wo.id is null or wo.portfolio_id is distinct from it.portfolio_id
       or (wo.association_id is not null and not public.can_manage_association(wo.association_id)) then
      raise exception 'Work order not found' using errcode = '42501';
    end if;
    v_assoc := wo.association_id;
  end if;

  v_after := coalesce(it.quantity_on_hand, 0) + v_change;
  if v_after < 0 then
    -- (Same message; the dash is written as chr(8212) so applying it keeps it.)
    raise exception using errcode = '22023',
      message = format('Only %s on hand %s you cannot use or remove more than that', coalesce(it.quantity_on_hand, 0), chr(8212));
  end if;

  perform set_config('app.inventory_movement', 'on', true);
  update public.inventory_items
     set quantity_on_hand = v_after,
         unit_cost = case when p_kind = 'received' and p_unit_cost is not null and p_unit_cost >= 0 then p_unit_cost else unit_cost end
   where id = it.id;
  perform set_config('app.inventory_movement', 'off', true);

  insert into public.inventory_movements (portfolio_id, item_id, kind, quantity_change, quantity_after, unit_cost,
                                          work_order_id, association_id, note, created_by)
  values (it.portfolio_id, it.id, p_kind, v_change, v_after,
          case when p_kind = 'received' and p_unit_cost is not null and p_unit_cost >= 0 then p_unit_cost else it.unit_cost end,
          p_work_order_id, v_assoc, nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  returning id into v_id;
  return v_id;
end $function$;

-- 10. -----------------------------------------------------------------------
alter table public.portfolios add column if not exists reactivated_at timestamptz;

comment on column public.portfolios.reactivated_at is
  'When the company''s last suspension was lifted. Set by portfolios_guard_platform_columns; not writable by signed-in users. cron_assess_late_fees holds late fees on units with due AutoPay for 24 hours after it.';

-- Late fees look up a unit's in-flight payments for every overdue charge.
create index if not exists payment_intents_unit_inflight_idx
  on public.payment_intents (unit_id) where status in ('pending', 'processing');

create or replace function public.portfolios_guard_platform_columns()
 returns trigger
 language plpgsql
 set search_path to 'pg_catalog', 'public'
as $function$
begin
  -- Changed: the reactivation time is recorded here (below), never written
  -- directly by a signed-in user.
  if current_user in ('authenticated', 'anon')
     and new.reactivated_at is distinct from old.reactivated_at then
    raise exception 'The reactivation time is recorded automatically' using errcode = '42501';
  end if;
  -- Changed: lifting a suspension records when (cron_assess_late_fees holds
  -- late fees on due AutoPay units for a day after it). Who may lift it is
  -- checked further down.
  if old.suspended_at is not null and new.suspended_at is null then
    new.reactivated_at := now();
  end if;
  -- Changed: written only by the management-fee scheduler and the definer
  -- RPCs set_management_fee_schedule / run_management_fees (they run as their
  -- owner, not as the signed-in user), never directly by a signed-in user.
  if current_user in ('authenticated', 'anon')
     and (new.management_fee_auto_last_month is distinct from old.management_fee_auto_last_month
          or new.management_fee_auto_last_run is distinct from old.management_fee_auto_last_run) then
    raise exception 'The management fee schedule records its own runs' using errcode = '42501';
  end if;
  if current_user in ('authenticated', 'anon')
     and (new.management_fee_auto_enabled is distinct from old.management_fee_auto_enabled
          or new.management_fee_auto_day is distinct from old.management_fee_auto_day
          or new.management_fee_vendor_id is distinct from old.management_fee_vendor_id
          or new.management_fee_gl_account_id is distinct from old.management_fee_gl_account_id) then
    raise exception 'The management fee schedule can only be changed on the management fees page'
      using errcode = '42501';
  end if;
  -- Changed: the custom domain check (service client) records verification.
  -- A domain change clears it (portfolios_guard_domain_verification, which
  -- fires first); only platform support can change the domain itself (below).
  if current_user in ('authenticated', 'anon')
     and new.custom_domain_verified_at is distinct from old.custom_domain_verified_at
     and not (new.custom_domain is distinct from old.custom_domain
              and new.custom_domain_verified_at is null) then
    raise exception 'The custom domain check sets this automatically' using errcode = '42501';
  end if;
  if auth.uid() is null or (public.is_platform_operator() and public.is_platform_admin()) then
    return new;
  end if;
  if new.tier is distinct from old.tier
     or new.entitlements is distinct from old.entitlements
     or new.archived_at is distinct from old.archived_at
     or new.suspended_at is distinct from old.suspended_at
     or new.suspension_reason is distinct from old.suspension_reason
     or new.slug is distinct from old.slug
     or new.custom_domain is distinct from old.custom_domain
     or new.created_by is distinct from old.created_by then
    raise exception 'Plan, status and account identity can only be changed by platform support';
  end if;
  return new;
end $function$;

create or replace function public.cron_assess_late_fees()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  a record;
  c record;
  v_fee uuid;
  v_assoc_count integer := 0;
  v_candidates integer := 0;
  v_assessed integer := 0;
  v_skipped integer := 0;
  v_failed integer := 0;
  v_autopay_held integer := 0;
  v_details text[] := '{}';
begin
  for a in
    -- Changed: table alias x (equivalent), for the suspension check below.
    select x.id, x.name, coalesce(x.late_fee_grace_days, 0) as grace, public.association_local_date(x.id) as today,
           -- Changed: whether the company's last suspension was lifted in the
           -- last 24 hours.
           coalesce((select pf.reactivated_at > now() - interval '24 hours'
                       from public.portfolios pf where pf.id = x.portfolio_id), false) as just_reactivated
      from public.associations x
     where x.late_fee_enabled and coalesce(x.late_fee_amount, 0) > 0 and x.archived_at is null
       -- Changed: no automatic late fees while the company is suspended (its
       -- owners can't sign in to pay and AutoPay is paused).
       and not exists (select 1 from public.portfolios pf
                        where pf.id = x.portfolio_id and pf.suspended_at is not null)
     order by x.name
  loop
    v_assoc_count := v_assoc_count + 1;
    for c in
      select ch.id, ch.unit_id
        from public.charges ch
        join public.units u on u.id = ch.unit_id
        join public.buildings b on b.id = u.building_id
       where b.association_id = a.id
         and ch.charge_type = 'assessment'
         and ch.due_date + a.grace < a.today
         and not exists (select 1 from public.late_fee_assessments l where l.charge_id = ch.id)
         and ch.amount - coalesce((select sum(pa.amount_applied) from public.payment_applications pa where pa.charge_id = ch.id), 0) > 0.005
       order by ch.due_date, ch.id
    loop
      -- Changed (Mirsad, 2026-10-14): late fees run at 11:10 UTC (here) and
      -- 15:00 UTC (Vercel), the held AutoPay charges at 14:00 UTC. For 24 hours
      -- after a reactivation (both runs that day), a unit whose AutoPay
      -- mandate is due gets no late fee yet. And in every company, a unit with
      -- money in flight gets none: a payment processing for under 14 days (ACH
      -- takes days) or an AutoPay payment pending for under a day. An unpaid
      -- portal checkout doesn't count, and the age bounds keep a stuck row
      -- from holding fees forever. A later run assesses what's unpaid.
      if (a.just_reactivated and exists (
            select 1 from public.autopay_mandates am
             where am.unit_id = c.unit_id
               and am.status = 'active'
               and am.canceled_at is null
               and (am.end_date is null or am.end_date >= a.today)
               and am.next_run_date <= a.today
               and (am.skip_until is null or am.skip_until < a.today)))
         or exists (
            select 1 from public.payment_intents pi
             where pi.unit_id = c.unit_id
               and pi.status in ('pending', 'processing')
               and ((pi.status = 'processing' and pi.created_at > now() - interval '14 days')
                    or (pi.status = 'pending' and pi.created_at > now() - interval '1 day'
                        -- AutoPay creates its payment_intents row with the run's id.
                        and exists (select 1 from public.stripe_autopay_runs r where r.id = pi.id)))) then
        v_autopay_held := v_autopay_held + 1;
        continue;
      end if;
      v_candidates := v_candidates + 1;
      begin
        v_fee := public.assess_late_fee(c.id);
        if v_fee is not null then v_assessed := v_assessed + 1; else v_skipped := v_skipped + 1; end if;
      exception when others then
        v_failed := v_failed + 1;
        if cardinality(v_details) < 50 then
          v_details := v_details || (a.name || ' charge ' || c.id || ': ' || sqlerrm);
        end if;
      end;
    end loop;
  end loop;

  return jsonb_build_object(
    'associations', v_assoc_count, 'candidates', v_candidates, 'assessed', v_assessed,
    'skipped', v_skipped, 'failed', v_failed, 'autopay_held', v_autopay_held,
    'details', to_jsonb(v_details));
end;
$function$;
