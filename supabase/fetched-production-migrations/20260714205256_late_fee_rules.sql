-- Automatic late-fee assessment (AppFolio parity).
alter table public.associations
  add column if not exists late_fee_enabled boolean not null default false,
  add column if not exists late_fee_amount numeric,
  add column if not exists late_fee_is_percent boolean not null default false,
  add column if not exists late_fee_grace_days integer not null default 10;

comment on column public.associations.late_fee_amount is
  'Flat dollar amount, or percent (0-100) of the unpaid balance when late_fee_is_percent.';

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

  v_fee := case
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
end;
$$;

revoke execute on function public.assess_late_fee(uuid) from public;
revoke execute on function public.assess_late_fee(uuid) from anon;
revoke execute on function public.assess_late_fee(uuid) from authenticated;
grant execute on function public.assess_late_fee(uuid) to service_role;
;
