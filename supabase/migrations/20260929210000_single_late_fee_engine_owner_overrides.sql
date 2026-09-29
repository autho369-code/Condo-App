-- One late-fee engine, plus per-owner late-fee overrides.
--
-- Two engines were running: the Vercel cron (/api/billing/assess-late-fees ->
-- assess_late_fee, which honours each association's late-fee settings and
-- records late_fee_assessments) and a legacy pg_cron job (apply_late_fees)
-- that charged the portfolio default on every overdue assessment, ignoring
-- late_fee_enabled and never recording what it charged. The legacy job is
-- unscheduled and apply_late_fees() now delegates to assess_late_fee().

do $$
begin
  if exists (select 1 from cron.job where jobname = 'apply-late-fees-daily') then
    perform cron.unschedule('apply-late-fees-daily');
  end if;
end $$;

-- Per-owner overrides live on the ownership record (occupancy).
alter table public.occupancies
  add column if not exists late_fee_exempt boolean not null default false,
  add column if not exists late_fee_override_amount numeric(12, 2) check (late_fee_override_amount is null or late_fee_override_amount >= 0),
  add column if not exists late_fee_override_is_percent boolean not null default false,
  add column if not exists late_fee_override_until date,
  add column if not exists late_fee_override_reason text check (late_fee_override_reason is null or length(late_fee_override_reason) <= 500);
alter table public.occupancies drop constraint if exists occupancies_late_fee_override_pct_check;
alter table public.occupancies add constraint occupancies_late_fee_override_pct_check
  check (not late_fee_override_is_percent or late_fee_override_amount is null or late_fee_override_amount <= 100);

-- The override in force for a unit today: exemption wins, then a custom fee.
create or replace function public.unit_late_fee_override(p_unit_id uuid)
returns table(exempt boolean, amount numeric, is_percent boolean)
language sql stable security definer set search_path = pg_catalog, public as $$
  select bool_or(o.late_fee_exempt),
         (array_agg(o.late_fee_override_amount order by o.is_primary desc, o.move_in_date desc nulls last)
            filter (where o.late_fee_override_amount is not null))[1],
         (array_agg(o.late_fee_override_is_percent order by o.is_primary desc, o.move_in_date desc nulls last)
            filter (where o.late_fee_override_amount is not null))[1]
    from public.occupancies o
   where o.unit_id = p_unit_id
     and o.status = 'current'::public.occupancy_status
     and o.occupancy_type::text = 'owner'
     and (o.late_fee_override_until is null or o.late_fee_override_until >= current_date)
     and (o.late_fee_exempt or o.late_fee_override_amount is not null);
$$;

create or replace function public.assess_late_fee(p_charge_id uuid)
returns uuid
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_charge public.charges;
  v_assoc  public.associations;
  v_cat    public.charge_categories;
  v_balance numeric;
  v_fee     numeric;
  v_fee_charge public.charges;
  v_ovr record;
begin
  select * into v_charge from public.charges where id = p_charge_id;
  if not found then raise exception 'charge not found'; end if;

  select a.* into v_assoc
    from public.associations a
    join public.buildings b on b.association_id = a.id
    join public.units u on u.building_id = b.id
   where u.id = v_charge.unit_id;
  if not found then raise exception 'association not found for charge'; end if;

  if auth.uid() is not null and not public.can_manage_finance(v_assoc.portfolio_id) then
    raise exception 'permission denied';
  end if;

  if not v_assoc.late_fee_enabled or coalesce(v_assoc.late_fee_amount, 0) <= 0 then
    return null;
  end if;
  if v_charge.charge_type <> 'assessment' then
    return null;
  end if;
  if v_charge.due_date + coalesce(v_assoc.late_fee_grace_days, 10) >= current_date then
    return null;
  end if;
  if exists (select 1 from public.late_fee_assessments where charge_id = p_charge_id) then
    return null;
  end if;

  v_balance := coalesce(v_charge.amount, 0) - coalesce(
    (select sum(pa.amount_applied) from public.payment_applications pa
      where pa.charge_id = p_charge_id), 0);
  if v_balance <= 0 then return null; end if;

  select * into v_ovr from public.unit_late_fee_override(v_charge.unit_id);
  if coalesce(v_ovr.exempt, false) then
    return null;
  end if;

  v_fee := case
    when v_ovr.amount is not null and v_ovr.is_percent then round(v_balance * v_ovr.amount / 100.0, 2)
    when v_ovr.amount is not null then v_ovr.amount
    when v_assoc.late_fee_is_percent then round(v_balance * v_assoc.late_fee_amount / 100.0, 2)
    else v_assoc.late_fee_amount
  end;
  if v_fee is null or v_fee <= 0 then return null; end if;

  select * into v_cat
    from public.charge_categories
   where portfolio_id = v_assoc.portfolio_id
     and charge_type = 'late_fee'
     and active
     and archived_at is null
   order by sort_order
   limit 1;
  if v_cat.id is null then
    return null;
  end if;

  insert into public.charges (
    unit_id, charge_category_id, charge_type, description, amount, due_date, gl_account_id, created_by
  ) values (
    v_charge.unit_id, v_cat.id, 'late_fee',
    'Late fee — ' || coalesce(v_charge.description, 'assessment')
      || ' (due ' || to_char(v_charge.due_date, 'YYYY-MM-DD') || ')',
    v_fee, current_date, v_cat.gl_account_id, auth.uid()
  ) returning * into v_fee_charge;

  insert into public.late_fee_assessments (association_id, charge_id, fee_charge_id)
  values (v_assoc.id, p_charge_id, v_fee_charge.id);

  return v_fee_charge.id;
end $$;

-- Legacy entry point: same rules as the app's cron, never a second engine.
create or replace function public.apply_late_fees()
returns integer
language plpgsql security definer set search_path = pg_catalog, public as $$
declare r record; n integer := 0;
begin
  for r in
    select c.id
      from public.charges c
      join public.units u on u.id = c.unit_id
      join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id
     where a.late_fee_enabled and a.archived_at is null
       and c.charge_type = 'assessment'
       and c.due_date < current_date - coalesce(a.late_fee_grace_days, 10)
       and not exists (select 1 from public.late_fee_assessments l where l.charge_id = c.id)
  loop
    if public.assess_late_fee(r.id) is not null then n := n + 1; end if;
  end loop;
  return n;
end $$;

create or replace function public.set_owner_late_fee_override(
  p_occupancy_id uuid, p_exempt boolean, p_amount numeric, p_is_percent boolean, p_until date, p_reason text)
returns void
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare o record; v_portfolio uuid;
begin
  select occ.*, a.portfolio_id as pid into o
    from public.occupancies occ join public.associations a on a.id = occ.association_id
   where occ.id = p_occupancy_id for update of occ;
  if not found or not public.can_manage_finance(o.pid) or not public.can_access_association(o.association_id) then
    raise exception 'Ownership record not found' using errcode = 'P0002';
  end if;
  if p_amount is not null and (p_amount < 0 or (coalesce(p_is_percent, false) and p_amount > 100)) then
    raise exception 'Enter a fee of $0 or more, or a percentage up to 100' using errcode = '22023';
  end if;
  if (coalesce(p_exempt, false) or p_amount is not null) and length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Give a reason for the late-fee exception' using errcode = '22023';
  end if;
  if p_until is not null and p_until < current_date then
    raise exception 'The end date must be today or later' using errcode = '22023';
  end if;
  update public.occupancies set
    late_fee_exempt = coalesce(p_exempt, false),
    late_fee_override_amount = case when coalesce(p_exempt, false) then null else p_amount end,
    late_fee_override_is_percent = case when coalesce(p_exempt, false) or p_amount is null then false else coalesce(p_is_percent, false) end,
    late_fee_override_until = case when coalesce(p_exempt, false) or p_amount is not null then p_until end,
    late_fee_override_reason = case when coalesce(p_exempt, false) or p_amount is not null then nullif(btrim(p_reason), '') end,
    updated_at = now()
  where id = p_occupancy_id;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (o.pid, 'owner', o.owner_id, 'late_fee_override_updated', auth.uid(), (select email from auth.users where id = auth.uid()),
          jsonb_build_object('occupancy_id', p_occupancy_id, 'unit_id', o.unit_id,
            'before', jsonb_build_object('exempt', o.late_fee_exempt, 'amount', o.late_fee_override_amount, 'is_percent', o.late_fee_override_is_percent, 'until', o.late_fee_override_until),
            'after', jsonb_build_object('exempt', coalesce(p_exempt, false), 'amount', p_amount, 'is_percent', p_is_percent, 'until', p_until, 'reason', p_reason)));
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.unit_late_fee_override(uuid)', 'public.apply_late_fees()'] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
alter function public.set_owner_late_fee_override(uuid, boolean, numeric, boolean, date, text) owner to postgres;
revoke all on function public.set_owner_late_fee_override(uuid, boolean, numeric, boolean, date, text) from public, anon;
grant execute on function public.set_owner_late_fee_override(uuid, boolean, numeric, boolean, date, text) to authenticated, service_role;
