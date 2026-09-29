-- Interest on delinquent balances (AppFolio "Interest Information").
-- On each association's posting day, charges simple monthly interest on the
-- unit's overdue principal (charges past due by more than the grace days,
-- less payments applied), excluding prior interest so it never compounds.
-- Idempotent: one assessment per unit per month. Service role only (cron).

create table if not exists public.interest_assessments (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.associations(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  period_month date not null,
  principal numeric(14,2) not null,
  annual_rate numeric(6,3) not null,
  amount numeric(14,2) not null check (amount > 0),
  charge_id uuid not null unique references public.charges(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (unit_id, period_month)
);
alter table public.interest_assessments enable row level security;
drop policy if exists interest_assessments_staff_read on public.interest_assessments;
create policy interest_assessments_staff_read on public.interest_assessments for select to authenticated
  using (public.can_manage_association(association_id));
revoke all on public.interest_assessments from anon, authenticated;
grant select on public.interest_assessments to authenticated;

create or replace function public.assess_association_interest(p_as_of date default current_date)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  a record;
  u record;
  v_period date := date_trunc('month', p_as_of)::date;
  v_cat uuid;
  v_charge uuid;
  v_amount numeric;
  n_assoc integer := 0;
  n_charges integer := 0;
begin
  for a in
    select id, portfolio_id, name, annual_interest_rate, coalesce(interest_grace_days, 0) grace_days,
           coalesce(interest_grace_balance, 0) grace_balance, interest_income_gl_account_id
      from public.associations
     where archived_at is null
       and coalesce(annual_interest_rate, 0) > 0
       and coalesce(interest_post_day_of_month, 1) = extract(day from p_as_of)::integer
  loop
    n_assoc := n_assoc + 1;
    select id into v_cat from public.charge_categories c
     where c.portfolio_id = a.portfolio_id and c.active and c.archived_at is null
       and (upper(coalesce(c.code, '')) = 'INTEREST' or c.name ilike '%interest%')
     order by c.sort_order limit 1;

    for u in
      select un.id unit_id,
             sum(greatest(ch.amount - coalesce((select sum(pa.amount_applied) from public.payment_applications pa where pa.charge_id = ch.id), 0), 0)) principal
        from public.units un
        join public.buildings b on b.id = un.building_id
        join public.charges ch on ch.unit_id = un.id
       where b.association_id = a.id and un.archived_at is null
         and ch.due_date < p_as_of - a.grace_days
         and not exists (select 1 from public.interest_assessments ia where ia.charge_id = ch.id)
       group by un.id
    loop
      continue when u.principal <= a.grace_balance or u.principal <= 0;
      continue when exists (select 1 from public.interest_assessments ia where ia.unit_id = u.unit_id and ia.period_month = v_period);
      v_amount := round(u.principal * a.annual_interest_rate / 100.0 / 12.0, 2);
      continue when v_amount <= 0;

      insert into public.charges (unit_id, charge_category_id, charge_type, description, amount, due_date, gl_account_id)
      values (u.unit_id, v_cat, 'other',
              'Interest on past-due balance (' || to_char(a.annual_interest_rate, 'FM990.###') || '% APR, ' || to_char(v_period, 'Mon YYYY') || ')',
              v_amount, p_as_of + 15, a.interest_income_gl_account_id)
      returning id into v_charge;
      insert into public.interest_assessments (association_id, unit_id, period_month, principal, annual_rate, amount, charge_id)
      values (a.id, u.unit_id, v_period, round(u.principal, 2), a.annual_interest_rate, v_amount, v_charge);
      n_charges := n_charges + 1;
    end loop;
  end loop;
  return jsonb_build_object('as_of', p_as_of, 'associations', n_assoc, 'charges', n_charges);
end;
$$;
alter function public.assess_association_interest(date) owner to postgres;
revoke all on function public.assess_association_interest(date) from public, anon, authenticated;
grant execute on function public.assess_association_interest(date) to service_role;
