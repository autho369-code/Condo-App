-- Automatic late-fee assessment (AppFolio parity).
-- Per-association rules + one-fee-per-overdue-charge guarantee + the posting
-- function the daily cron (/api/billing/assess-late-fees) calls.
-- NOT yet applied to the live database.

-- ── Association-level rules ─────────────────────────────────────────────────
alter table public.associations
  add column if not exists late_fee_enabled boolean not null default false,
  add column if not exists late_fee_amount numeric,
  add column if not exists late_fee_is_percent boolean not null default false,
  add column if not exists late_fee_grace_days integer not null default 10;

comment on column public.associations.late_fee_amount is
  'Flat dollar amount, or percent (0-100) of the unpaid balance when late_fee_is_percent.';

-- ── One assessment row per overdue charge ──────────────────────────────────
create table if not exists public.late_fee_assessments (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.associations(id) on delete cascade,
  charge_id uuid not null unique references public.charges(id) on delete cascade,
  fee_charge_id uuid references public.charges(id) on delete set null,
  assessed_at timestamptz not null default now()
);

create index if not exists late_fee_assessments_association_idx
  on public.late_fee_assessments (association_id);

alter table public.late_fee_assessments enable row level security;

-- Staff manage rows for associations in their portfolio (can_access_portfolio
-- already includes platform operators).
drop policy if exists late_fee_assessments_staff_all on public.late_fee_assessments;
create policy late_fee_assessments_staff_all on public.late_fee_assessments
  for all
  using (exists (
    select 1 from public.associations a
    where a.id = association_id and public.can_access_portfolio(a.portfolio_id)
  ))
  with check (exists (
    select 1 from public.associations a
    where a.id = association_id and public.can_access_portfolio(a.portfolio_id)
  ));

-- Owners can see assessments on their own charges (same visibility rule as
-- the charges_resident_read policy on public.charges).
drop policy if exists late_fee_assessments_resident_read on public.late_fee_assessments;
create policy late_fee_assessments_resident_read on public.late_fee_assessments
  for select
  using (
    public.is_portal_resident()
    and exists (
      select 1 from public.charges c
      where c.id = charge_id
        and c.unit_id in (select public.current_resident_unit_ids())
    )
  );

-- ── Posting function ────────────────────────────────────────────────────────
-- Manual charges are posted by public.post_ad_hoc_charge, which inserts into
-- public.charges (charge_type + gl_account_id derived from the charge
-- category) so the standard table triggers (credit auto-application, webhooks)
-- fire. That RPC gates on can_manage_finance(), which fails for the cron's
-- service-role client (auth.uid() is null), so this function performs the
-- IDENTICAL insert for late fees, re-validates the rule server-side, and
-- records the late_fee_assessments row in the same transaction. Execution is
-- revoked from everything except service_role — it is the cron's entry point.
create or replace function public.assess_late_fee(p_charge_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_charge public.charges;
  v_assoc  public.associations;
  v_cat    public.charge_categories;
  v_balance numeric;
  v_fee     numeric;
  v_fee_charge public.charges;
begin
  select * into v_charge from public.charges where id = p_charge_id;
  if not found then raise exception 'charge not found'; end if;

  select a.* into v_assoc
    from public.associations a
    join public.buildings b on b.association_id = a.id
    join public.units u on u.building_id = b.id
   where u.id = v_charge.unit_id;
  if not found then raise exception 'association not found for charge'; end if;

  -- Authenticated callers (if execute is ever granted) must be finance staff
  -- for this portfolio; the service-role cron has auth.uid() null and is
  -- gated by the execute grant below + requireCronSecret at the route.
  if auth.uid() is not null and not public.can_manage_finance(v_assoc.portfolio_id) then
    raise exception 'permission denied';
  end if;

  -- Rule checks (return null = nothing to assess; the cron counts as skipped)
  if not v_assoc.late_fee_enabled or coalesce(v_assoc.late_fee_amount, 0) <= 0 then
    return null;
  end if;
  if v_charge.charge_type <> 'assessment' then
    return null; -- dues only; never fee-on-fee
  end if;
  if v_charge.due_date + coalesce(v_assoc.late_fee_grace_days, 10) >= current_date then
    return null; -- still within the grace window
  end if;
  if exists (select 1 from public.late_fee_assessments where charge_id = p_charge_id) then
    return null; -- already assessed (unique constraint is the hard backstop)
  end if;

  -- Unpaid balance, same formula as public.v_charge_balances.balance_due
  v_balance := coalesce(v_charge.amount, 0) - coalesce(
    (select sum(pa.amount_applied) from public.payment_applications pa
      where pa.charge_id = p_charge_id), 0);
  if v_balance <= 0 then return null; end if;

  v_fee := case
    when v_assoc.late_fee_is_percent then round(v_balance * v_assoc.late_fee_amount / 100.0, 2)
    else v_assoc.late_fee_amount
  end;
  if v_fee is null or v_fee <= 0 then return null; end if;

  -- Category/GL exactly like the manual path: derive from the portfolio's
  -- late-fee charge category when one exists.
  select * into v_cat
    from public.charge_categories
   where portfolio_id = v_assoc.portfolio_id
     and charge_type = 'late_fee'
     and active
     and archived_at is null
   order by sort_order
   limit 1;
  if v_cat.id is null then
    return null; -- no late-fee charge category configured: never post uncategorized money
  end if;

  -- Same insert shape as public.post_ad_hoc_charge — fires the same triggers.
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
end;
$$;

revoke execute on function public.assess_late_fee(uuid) from public;
revoke execute on function public.assess_late_fee(uuid) from anon;
revoke execute on function public.assess_late_fee(uuid) from authenticated;
grant execute on function public.assess_late_fee(uuid) to service_role;
