-- Smaller items still open from the 2026-10-31 Elephant-Goldfish review
-- (docs/reviews/2026-10-31-egm/drift_product_rules.md).

-- 1. AutoPay: a run is claimable from the association's local date, not the
--    database's own date (America/Chicago, 20261005091000): a Pacific
--    association's run was claimable from 10 PM the night before, and an
--    Eastern one's not until 1 AM, while the cron route uses the local day
--    (Product Rules: rules the API enforces belong in the database too).
create or replace function public.claim_stripe_autopay_run(p_mandate_id uuid, p_scheduled_for date)
returns table(run_id uuid, idempotency_key text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_mandate public.autopay_mandates%rowtype;
  v_method public.payment_methods%rowtype;
  v_association public.associations%rowtype;
  v_run public.stripe_autopay_runs%rowtype;
  v_run_id uuid := gen_random_uuid();
begin
  select * into v_mandate
  from public.autopay_mandates
  where id = p_mandate_id
  for update;

  if not found
     or v_mandate.status::text <> 'active'
     or v_mandate.next_run_date is distinct from p_scheduled_for
     or p_scheduled_for > public.association_local_date(v_mandate.association_id, now()) then
    return;
  end if;

  -- No AutoPay charge while the company is suspended (the run is not claimed
  -- and the mandate keeps its date, so it runs after reactivation).
  if exists (select 1 from public.portfolios pf
              where pf.id = v_mandate.portfolio_id and pf.suspended_at is not null) then
    return;
  end if;

  select * into v_method from public.payment_methods where id = v_mandate.payment_method_id;
  select * into v_association from public.associations where id = v_mandate.association_id;

  if v_method.id is null
     or v_association.id is null
     or v_method.owner_id is distinct from v_mandate.owner_id
     or v_method.portfolio_id is distinct from v_mandate.portfolio_id
     or v_method.association_id is distinct from v_mandate.association_id
     or v_method.processor::text <> 'stripe'
     or v_method.processor_account_id is distinct from v_association.stripe_account_id
     or not coalesce(v_association.stripe_charges_enabled, false)
     or not coalesce(v_association.stripe_payouts_enabled, false)
     or v_association.stripe_deauthorized_at is not null then
    raise exception 'AutoPay mandate is not bound to a payment-ready association Stripe account';
  end if;

  insert into public.stripe_autopay_runs(
    id, mandate_id, scheduled_for, processor_account_id, idempotency_key
  ) values (
    v_run_id,
    p_mandate_id,
    p_scheduled_for,
    v_association.stripe_account_id,
    'autopay-run-' || v_run_id::text
  )
  on conflict (mandate_id, scheduled_for) do nothing
  returning * into v_run;

  if found then
    run_id := v_run.id;
    idempotency_key := v_run.idempotency_key;
    return next;
    return;
  end if;

  update public.stripe_autopay_runs
  set status = 'claimed',
      attempts = attempts + 1,
      claimed_at = now(),
      updated_at = now(),
      failure_reason = null
  where mandate_id = p_mandate_id
    and scheduled_for = p_scheduled_for
    and attempts < 3
    and (
      (status = 'claimed' and claimed_at < now() - interval '10 minutes')
      or (status = 'intent_created' and updated_at < now() - interval '10 minutes')
      or (status = 'failed' and processor_payment_intent_id is null)
    )
  returning * into v_run;

  if found then
    run_id := v_run.id;
    idempotency_key := v_run.idempotency_key;
    return next;
  end if;
end;
$function$;

-- 2. When an owner stops being an owner of a unit, their parking, parking
--    charge and pets on it end. The trigger ran only on a status change from
--    current to past. It now also covers: deleting a current or future owner
--    occupancy, adding one that is already past, a future one moving to past,
--    and staff correcting the owner, unit or type of one (the old owner's
--    items end). Product Rules: a trigger, so every writer is covered.
create or replace function public.end_owner_unit_items_when_occupancy_ends()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  r public.occupancies%rowtype;
  v_day date;
  v_charge_ids uuid[];
begin
  if tg_op = 'INSERT' then
    if not (new.status = 'past' and new.occupancy_type = 'owner' and new.owner_id is not null) then
      return null;
    end if;
    r := new;
  else
    -- OLD was a live owner occupancy that is gone or no longer the same one.
    if not (old.status in ('current', 'future') and old.occupancy_type = 'owner' and old.owner_id is not null) then
      return null;
    end if;
    if tg_op = 'UPDATE'
       and new.status in ('current', 'future')
       and new.occupancy_type = 'owner'
       and new.owner_id is not distinct from old.owner_id
       and new.unit_id is not distinct from old.unit_id then
      return null;
    end if;
    r := old;
    if tg_op = 'UPDATE' and new.status = 'past' then
      r.move_out_date := new.move_out_date;
    end if;
  end if;

  -- Still (or soon again) an owner of this unit through another occupancy: keep.
  if exists (
    select 1 from public.occupancies o
     where o.id <> r.id
       and o.unit_id = r.unit_id
       and o.owner_id = r.owner_id
       and o.occupancy_type = 'owner'
       and o.status in ('current', 'future')
  ) then
    return null;
  end if;

  v_day := coalesce(r.move_out_date, public.association_local_date(r.association_id));

  with ended as (
    update public.parking_assignments pa
       set status = 'ended',
           end_date = greatest(v_day, pa.start_date),
           updated_at = now()
     where pa.unit_id = r.unit_id
       and pa.owner_id = r.owner_id
       and pa.status = 'active'
    returning pa.recurring_charge_id
  )
  select array_agg(recurring_charge_id) filter (where recurring_charge_id is not null)
    into v_charge_ids
    from ended;

  if v_charge_ids is not null then
    update public.unit_recurring_charges urc
       set active = false,
           end_date = greatest(v_day, urc.start_date)
     where urc.id = any (v_charge_ids)
       and urc.unit_id = r.unit_id
       and urc.active;
  end if;

  update public.unit_pets p
     set archived_at = now()
   where p.unit_id = r.unit_id
     and p.owner_id = r.owner_id
     and p.archived_at is null;

  return null;
end
$function$;

create or replace trigger trg_occupancies_end_owner_unit_items
  after insert or update of status, owner_id, unit_id, occupancy_type or delete on public.occupancies
  for each row execute function public.end_owner_unit_items_when_occupancy_ends();

-- 3. Four policies read an RLS table inline (Product Rules: no inline
--    subqueries over RLS tables inside policies). Each now reads through an
--    rls_private SECURITY INVOKER helper, as the rule asks: the caller's own
--    rules on the parent table still apply, so who sees what is unchanged.
--    The vendor work-update rule reuses vendor_postable_work_order_ids (from
--    20261031114852), which also refuses archived work orders, as the vendor
--    page already does. Policies are changed with ALTER POLICY, not dropped
--    (Product Rules). (The restrictive mgr_assoc_scope on line items still
--    reads purchase_orders inline; not changed here.)
create or replace function rls_private.finance_purchase_order_ids()
returns setof uuid
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
begin
  return query
  select p.id from public.purchase_orders p
   where p.portfolio_id = (select public.my_finance_portfolio())
      or ((select public.is_platform_operator()) and p.portfolio_id is not null);
end
$$;
revoke execute on function rls_private.finance_purchase_order_ids() from public, anon;
grant execute on function rls_private.finance_purchase_order_ids() to authenticated;

alter policy po_line_items_staff_all on public.purchase_order_line_items
  to authenticated
  using (purchase_order_id in (select rls_private.finance_purchase_order_ids()))
  with check (purchase_order_id in (select rls_private.finance_purchase_order_ids()));

--    Vendors the caller can see (their company's, by the vendors rules); for
--    a manager limited to some associations, only the company-wide ones and
--    those associations' own.
create or replace function rls_private.my_company_vendor_ids()
returns setof uuid
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
begin
  return query
  select v.id from public.vendors v
   where ((select public.manager_is_scoped()) is not true
          or v.association_id is null
          or v.association_id in (select public.my_managed_association_ids()));
end
$$;
revoke execute on function rls_private.my_company_vendor_ids() from public, anon;
grant execute on function rls_private.my_company_vendor_ids() to authenticated;

--    As before, every staff caller's vendor must be one of their company's
--    (the old inline read of vendors ran under the caller's own rules).
alter policy mgr_assoc_scope on public.document_requests
  using (
    (vendor_id is null or vendor_id in (select rls_private.my_company_vendor_ids()))
    and (owner_id is null
         or (select public.manager_is_scoped()) is not true
         or owner_id in (select rls_private.my_managed_owner_ids()))
  );

create or replace function rls_private.resident_arc_request_ids()
returns setof uuid
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
begin
  return query
  select r.id from public.architectural_requests r
   where r.owner_id in (select public.current_owner_ids());
end
$$;
revoke execute on function rls_private.resident_arc_request_ids() from public, anon;
grant execute on function rls_private.resident_arc_request_ids() to authenticated;

alter policy arch_msg_resident_insert on public.architectural_request_messages
  to authenticated
  with check (
    author_role = 'owner'
    and (select public.is_portal_resident())
    and request_id in (select rls_private.resident_arc_request_ids())
  );

alter policy wo_updates_vendor_insert on public.work_order_updates
  to authenticated
  with check (
    created_by = (select auth.uid())
    and work_order_id in (select rls_private.vendor_postable_work_order_ids())
    and (new_status is null or new_status::text = rls_private.vendor_work_order_status(work_order_id))
  );
