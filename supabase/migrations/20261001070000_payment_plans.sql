-- Homeowner payment plans (AppFolio: payment plans + "Payment Plans" report).
-- Staff agree an installment schedule with a delinquent homeowner. Progress
-- is computed from the unit's actual payments made since the plan started
-- (credits excluded), oldest installment first, so nothing has to be matched
-- by hand. While a plan is active, the unit's open collection case is put on
-- hold; cancelling the plan releases it.

create table if not exists public.payment_plans (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid not null references public.associations(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  owner_id uuid references public.owners(id) on delete set null,
  total_amount numeric(12, 2) not null check (total_amount > 0),
  installment_count integer not null check (installment_count between 1 and 60),
  frequency text not null default 'monthly' check (frequency in ('weekly', 'biweekly', 'monthly')),
  first_due_date date not null,
  start_date date not null default current_date,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  notes text,
  cancel_reason text,
  cancelled_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists payment_plans_one_active_per_unit on public.payment_plans (unit_id) where status = 'active';
create index if not exists payment_plans_portfolio_idx on public.payment_plans (portfolio_id, status);

create table if not exists public.payment_plan_installments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.payment_plans(id) on delete cascade,
  installment_number integer not null,
  due_date date not null,
  amount numeric(12, 2) not null check (amount > 0),
  unique (plan_id, installment_number)
);

alter table public.payment_plans enable row level security;
alter table public.payment_plan_installments enable row level security;
revoke all on public.payment_plans, public.payment_plan_installments from anon;

drop policy if exists payment_plans_staff_read on public.payment_plans;
create policy payment_plans_staff_read on public.payment_plans for select to authenticated
  using (public.can_manage_association(association_id));
drop policy if exists payment_plans_owner_read on public.payment_plans;
create policy payment_plans_owner_read on public.payment_plans for select to authenticated
  using (unit_id in (select public.current_resident_unit_ids()));
drop policy if exists payment_plan_installments_read on public.payment_plan_installments;
create policy payment_plan_installments_read on public.payment_plan_installments for select to authenticated
  using (exists (select 1 from public.payment_plans p where p.id = payment_plan_installments.plan_id
                   and (public.can_manage_association(p.association_id) or p.unit_id in (select public.current_resident_unit_ids()))));

-- ------------------------------------------------------------ progress
-- One row per installment: what was due, how much of it is covered by the
-- payments made since the plan started, and its status.
create or replace function public.payment_plan_schedule(p_plan_id uuid)
returns table (installment_number integer, due_date date, amount numeric, covered numeric, status text)
language sql stable security definer set search_path = pg_catalog, public as $$
  with plan as (
    select p.* from public.payment_plans p
     where p.id = p_plan_id
       and (public.can_manage_association(p.association_id) or p.unit_id in (select public.current_resident_unit_ids())
            or coalesce(auth.role(), '') = 'service_role')
  ),
  paid as (
    select coalesce(sum(pm.amount), 0) as total
      from plan join public.payments pm on pm.unit_id = plan.unit_id
     where pm.payment_date >= plan.start_date and coalesce(pm.method, '') <> 'credit'
  ),
  sched as (
    select i.installment_number, i.due_date, i.amount,
           sum(i.amount) over (order by i.installment_number) as cumulative
      from public.payment_plan_installments i join plan on plan.id = i.plan_id
  )
  select s.installment_number, s.due_date, s.amount,
         round(greatest(0, least(s.amount, paid.total - (s.cumulative - s.amount))), 2) as covered,
         case when paid.total >= s.cumulative then 'paid'
              when s.due_date < current_date then 'behind'
              when s.due_date <= current_date + 7 then 'due'
              else 'upcoming' end as status
    from sched s cross join paid
   order by s.installment_number;
$$;

-- ------------------------------------------------------------ create / cancel
create or replace function public.create_payment_plan(
  p_unit_id uuid, p_total numeric, p_installments integer, p_frequency text, p_first_due date, p_notes text)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_assoc uuid;
  v_pid uuid;
  v_owner uuid;
  v_plan uuid;
  v_each numeric;
  v_case record;
  i integer;
begin
  select b.association_id, a.portfolio_id into v_assoc, v_pid
    from public.units u join public.buildings b on b.id = u.building_id join public.associations a on a.id = b.association_id
   where u.id = p_unit_id;
  if v_assoc is null or not public.can_manage_association(v_assoc) or not public.is_any_staff() then
    raise exception 'You do not manage this unit' using errcode = '42501';
  end if;
  if p_total is null or round(p_total, 2) <= 0 then
    raise exception 'Enter the amount the plan covers' using errcode = '22023';
  end if;
  if p_installments is null or p_installments not between 1 and 60 then
    raise exception 'Choose between 1 and 60 installments' using errcode = '22023';
  end if;
  if coalesce(p_frequency, '') not in ('weekly', 'biweekly', 'monthly') then
    raise exception 'Choose weekly, every two weeks or monthly' using errcode = '22023';
  end if;
  if p_first_due is null or p_first_due < current_date - 31 or p_first_due > current_date + 366 then
    raise exception 'Choose a first due date within the next year' using errcode = '22023';
  end if;
  if exists (select 1 from public.payment_plans where unit_id = p_unit_id and status = 'active') then
    raise exception 'This unit already has an active payment plan' using errcode = '23505';
  end if;

  select oc.owner_id into v_owner from public.occupancies oc
   where oc.unit_id = p_unit_id and oc.status = 'current' order by oc.is_primary desc nulls last, oc.created_at limit 1;

  insert into public.payment_plans (portfolio_id, association_id, unit_id, owner_id, total_amount, installment_count,
                                    frequency, first_due_date, notes, created_by)
  values (v_pid, v_assoc, p_unit_id, v_owner, round(p_total, 2), p_installments, p_frequency, p_first_due,
          nullif(btrim(coalesce(p_notes, '')), ''), auth.uid())
  returning id into v_plan;

  -- Equal installments; the last one absorbs the rounding.
  v_each := trunc(round(p_total, 2) / p_installments, 2);
  for i in 1..p_installments loop
    insert into public.payment_plan_installments (plan_id, installment_number, due_date, amount)
    values (v_plan, i,
            case p_frequency
              when 'monthly' then (p_first_due + make_interval(months => i - 1))::date
              when 'biweekly' then p_first_due + (i - 1) * 14
              else p_first_due + (i - 1) * 7 end,
            case when i = p_installments then round(p_total, 2) - v_each * (p_installments - 1) else v_each end);
  end loop;

  -- Pause collections for this unit while the plan runs.
  for v_case in select id from public.delinquency_cases where unit_id = p_unit_id and status = 'open' loop
    perform public.set_delinquency_case_hold(v_case.id, true, 'Payment plan agreed — collections paused while the plan is current');
  end loop;

  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (v_pid, 'payment_plan', v_plan, 'payment_plan_created', auth.uid(), (select email from auth.users where id = auth.uid()),
          jsonb_build_object('unit_id', p_unit_id, 'total', round(p_total, 2), 'installments', p_installments, 'frequency', p_frequency));
  return v_plan;
end $$;

create or replace function public.cancel_payment_plan(p_plan_id uuid, p_reason text)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  pl public.payment_plans;
  v_case record;
begin
  select * into pl from public.payment_plans where id = p_plan_id for update;
  if pl.id is null or not public.can_manage_association(pl.association_id) or not public.is_any_staff() then
    raise exception 'Payment plan not found' using errcode = '42501';
  end if;
  if pl.status <> 'active' then
    raise exception 'This payment plan is no longer active' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Say why the plan is being cancelled' using errcode = '22023';
  end if;
  update public.payment_plans
     set status = 'cancelled', cancel_reason = btrim(p_reason), cancelled_at = now(), updated_at = now()
   where id = pl.id;
  for v_case in select id from public.delinquency_cases where unit_id = pl.unit_id and status = 'on_hold'
                  and hold_reason like 'Payment plan agreed%' loop
    perform public.set_delinquency_case_hold(v_case.id, false, null);
  end loop;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (pl.portfolio_id, 'payment_plan', pl.id, 'payment_plan_cancelled', auth.uid(), (select email from auth.users where id = auth.uid()),
          jsonb_build_object('reason', btrim(p_reason)));
end $$;

revoke all on function public.payment_plan_schedule(uuid) from public, anon;
grant execute on function public.payment_plan_schedule(uuid) to authenticated, service_role;
revoke all on function public.create_payment_plan(uuid, numeric, integer, text, date, text) from public, anon;
grant execute on function public.create_payment_plan(uuid, numeric, integer, text, date, text) to authenticated, service_role;
revoke all on function public.cancel_payment_plan(uuid, text) from public, anon;
grant execute on function public.cancel_payment_plan(uuid, text) to authenticated, service_role;

-- ------------------------------------------------------------ report
create or replace function public.report_data_payment_plans(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params)),
    plans as (
      select p.*, a.name as association, u.unit_number, o.full_name as homeowner,
             (select coalesce(sum(pm.amount), 0) from public.payments pm
               where pm.unit_id = p.unit_id and pm.payment_date >= p.start_date and coalesce(pm.method, '') <> 'credit') as paid
        from public.payment_plans p
        cross join prm
        join public.associations a on a.id = p.association_id
        join public.units u on u.id = p.unit_id
        left join public.owners o on o.id = p.owner_id
       where p.portfolio_id = p_portfolio_id and (prm.aid is null or p.association_id = prm.aid)
    )
    select pl.association, pl.unit_number as unit, pl.homeowner, pl.start_date, pl.frequency, pl.installment_count as installments,
           round(pl.total_amount, 2) as plan_amount,
           round(least(pl.paid, pl.total_amount), 2) as paid_to_date,
           round(greatest(pl.total_amount - pl.paid, 0), 2) as remaining,
           (select count(*) from public.payment_plan_installments i where i.plan_id = pl.id
              and (select sum(i2.amount) from public.payment_plan_installments i2 where i2.plan_id = pl.id and i2.installment_number <= i.installment_number) <= pl.paid) as installments_paid,
           (select min(i.due_date) from public.payment_plan_installments i where i.plan_id = pl.id
              and (select sum(i2.amount) from public.payment_plan_installments i2 where i2.plan_id = pl.id and i2.installment_number <= i.installment_number) > pl.paid) as next_due,
           case when pl.status = 'cancelled' then 'Cancelled'
                when pl.paid >= pl.total_amount then 'Paid off'
                when exists (select 1 from public.payment_plan_installments i where i.plan_id = pl.id and i.due_date < current_date
                               and (select sum(i2.amount) from public.payment_plan_installments i2 where i2.plan_id = pl.id and i2.installment_number <= i.installment_number) > pl.paid)
                  then 'Behind'
                else 'Current' end as status
      from plans pl
     order by pl.association, pl.unit_number, pl.start_date desc
  ) r;
$$;
do $$
begin
  alter function public.report_data_payment_plans(uuid, jsonb) owner to postgres;
  revoke all on function public.report_data_payment_plans(uuid, jsonb) from public, anon, authenticated;
  grant execute on function public.report_data_payment_plans(uuid, jsonb) to service_role;
end $$;

do $$
declare def text;
begin
  def := pg_get_functiondef('public.report_data_dispatch(uuid, text, jsonb)'::regprocedure);
  if def !~ 'case p_slug' then
    raise exception 'payment_plans: report_data_dispatch drifted';
  end if;
  def := regexp_replace(def, 'case p_slug',
    'case p_slug' || chr(10) ||
    '    when ''payment_plans'' then return public.report_data_payment_plans(p_portfolio_id, p_params);');
  execute def;
end $$;

insert into public.report_definitions (slug, name, category, description, parameter_schema, default_filters, output_formats, is_system, active)
values
  ('payment_plans', 'Payment Plans', 'accounting', 'Homeowner payment plans: amount, paid to date, remaining, next due and status.', '{}', '{}', '{pdf,csv}', true, true);
