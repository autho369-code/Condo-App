-- #100 review fixes for the new AppFolio reports.
--  1. Budget comparison: associations can have their own GL accounts with the
--     same number and name; group by account number + name so one
--     association's budget can't be overwritten by another's zero.
--  2. Budget forecast / comparison: the default fiscal year is the one that
--     contains the report date for EACH association (fiscal years that don't
--     start in January), not the calendar year.
--  3. Receivables Activity: homeowner credits are non-cash adjustments, not
--     receipts — excluded, as in the payment and deposit registers.
--  4. Users: invited staff carry their role in mvp_role (e.g. accountant);
--     show it before the legacy profiles.role.

-- The fiscal year (labelled by the year it ends) that contains p_date.
create or replace function public.association_fiscal_year_of(p_association_id uuid, p_date date)
returns integer language sql stable security definer set search_path = pg_catalog, public as $$
  select case
           when coalesce(nullif(a.fiscal_year_start, 0), 1) = 1 then extract(year from p_date)::int
           when extract(month from p_date)::int >= a.fiscal_year_start then extract(year from p_date)::int + 1
           else extract(year from p_date)::int
         end
    from public.associations a where a.id = p_association_id;
$$;
revoke all on function public.association_fiscal_year_of(uuid, date) from public, anon;
grant execute on function public.association_fiscal_year_of(uuid, date) to authenticated, service_role;

create or replace function public.report_data_annual_budget_forecast(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params)),
    assoc_fy as (
      select a.id, a.name,
             coalesce(nullif(p_params->>'fiscal_year', '')::int, public.association_fiscal_year_of(a.id, prm.dt)) as y
        from public.associations a cross join prm
       where a.portfolio_id = p_portfolio_id and a.archived_at is null and (prm.aid is null or a.id = prm.aid)
    ),
    lines as (
      select bl.association_id, af.name as association, bl.gl_account_id, g.number, g.name as account, g.account_type::text as account_type,
             bl.monthly_amounts, coalesce(bl.annual_total, 0) as annual_budget, w.period_start, w.period_end,
             greatest(0, least(12, public.fiscal_month_index(w.period_start, least(prm.dt, w.period_end)))) as months_elapsed,
             prm.dt
        from assoc_fy af
        cross join prm
        join public.budget_lines bl on bl.association_id = af.id and bl.fiscal_year = af.y
        join public.gl_accounts g on g.id = bl.gl_account_id
        cross join lateral public.association_fiscal_window(af.id, af.y) w
    )
    select l.association, l.number as account_number, l.account, l.account_type,
           round(l.annual_budget, 2) as annual_budget,
           round(coalesce(act.amount, 0), 2) as actual_to_date,
           round(coalesce(rem.amount, 0), 2) as remaining_budget,
           round(coalesce(act.amount, 0) + coalesce(rem.amount, 0), 2) as forecast,
           round(coalesce(act.amount, 0) + coalesce(rem.amount, 0) - l.annual_budget, 2) as forecast_variance
      from lines l
      left join lateral (select sum(m) as amount from unnest(l.monthly_amounts[l.months_elapsed + 1:12]) as m) rem on true
      left join lateral (
        select sum(public.gl_normal_amount(l.account_type, jl.debit_amount, jl.credit_amount)) as amount
          from public.journal_lines jl
          join public.journal_entries je on je.id = jl.entry_id and je.posted
         where jl.association_id = l.association_id and jl.gl_account_id = l.gl_account_id
           and je.entry_date between l.period_start and least(l.dt, l.period_end)
      ) act on true
     order by l.association, l.number
  ) r;
$$;

create or replace function public.report_data_budget_association_comparison(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  with prm as (select * from public.rpt_prm(p_params)),
  assocs as (
    select a.id, a.name,
           coalesce(nullif(p_params->>'fiscal_year', '')::int, public.association_fiscal_year_of(a.id, prm.dt)) as y
      from public.associations a cross join prm
     where a.portfolio_id = p_portfolio_id and a.archived_at is null and (prm.aid is null or a.id = prm.aid)
  ),
  budgets as (
    select s.name as association, g.number, g.name as account, sum(coalesce(bl.annual_total, 0)) as budget
      from assocs s
      join public.budget_lines bl on bl.association_id = s.id and bl.fiscal_year = s.y
      join public.gl_accounts g on g.id = bl.gl_account_id
     group by s.name, g.number, g.name
  ),
  with_budget as (select distinct association from budgets),
  accts as (select distinct number, account from budgets),
  grid as (
    select ac.number, ac.account, wb.association, coalesce(b.budget, 0) as budget
      from accts ac cross join with_budget wb
      left join budgets b on b.association = wb.association and b.number is not distinct from ac.number and b.account = ac.account
  )
  select coalesce(jsonb_agg(row_obj order by number, account), '[]'::jsonb) from (
    select number, account,
           jsonb_build_object('account_number', number, 'account', account)
             || jsonb_object_agg(association, round(budget, 2))
             || jsonb_build_object('total', round(sum(budget), 2)) as row_obj
      from grid group by number, account
  ) t;
$$;

create or replace function public.report_data_receivables_activity(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select p.payment_date, a.name as association, u.unit_number as unit,
           (select o.full_name from public.occupancies oc join public.owners o on o.id = oc.owner_id
             where oc.unit_id = u.id and oc.status = 'current' order by oc.created_at limit 1) as homeowner,
           coalesce(p.method, 'other') as method,
           case when p.processor is not null then 'Online' else 'Entered by staff' end as channel,
           coalesce(pr.full_name, pr.email) as entered_by,
           round(p.amount, 2) as amount, p.reference
      from public.payments p
      cross join prm
      join public.units u on u.id = p.unit_id
      join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id and a.portfolio_id = p_portfolio_id
      left join public.profiles pr on pr.id = p.created_by
     where (prm.aid is null or a.id = prm.aid) and p.payment_date between prm.df and prm.dt
       and coalesce(p.method, '') <> 'credit'
     order by p.payment_date desc, a.name, u.unit_number
  ) r;
$$;

create or replace function public.report_data_users(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    select coalesce(p.full_name, p.display_name) as name, p.email,
           initcap(replace(p.hoa_role::text, '_', ' ')) as user_type,
           coalesce(rl.name, initcap(replace(nullif(p.mvp_role::text, ''), '_', ' ')), initcap(p.role::text)) as role,
           case when p.disabled_at is not null then 'Disabled' else 'Active' end as status,
           p.mfa_enrolled_at is not null as two_factor_enabled,
           p.last_login_at, p.created_at
      from public.profiles p
      left join public.user_roles rl on rl.id = p.role_id
     where p.portfolio_id = p_portfolio_id
       and p.hoa_role::text in ('manager', 'company_admin')
     order by p.disabled_at nulls first, coalesce(p.full_name, p.display_name, p.email)
  ) r;
$$;
