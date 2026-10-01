-- AppFolio report parity (left-nav audit 2026-10-01, docs/appfolio-left-nav-audit.md).
--
-- 1. Five AppFolio reports Portier didn't have:
--      Annual Budget - Forecast · Budget - Property (Association) Comparison ·
--      Receivables Activity · Resident Financial Activity · Users
-- 2. Report definitions with no data source and no AppFolio equivalent are
--    deactivated so nothing on the Reports page fails when run.
-- Same conventions as the other report_data_* functions: rpt_prm() filters
-- (association_id, date_from, date_to), service-role only, one dispatcher line.

-- ------------------------------------------------------------ Annual Budget - Forecast
-- Per association and GL account for a fiscal year: budget, actual to date,
-- budget still to come, forecast (actual to date + remaining budgeted months)
-- and forecast variance against the annual budget.
create or replace function public.report_data_annual_budget_forecast(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params)),
    fy as (select coalesce(nullif(p_params->>'fiscal_year', '')::int, extract(year from prm.dt)::int) as y, prm.aid, prm.dt from prm),
    lines as (
      select bl.association_id, a.name as association, bl.gl_account_id, g.number, g.name as account, g.account_type::text as account_type,
             bl.monthly_amounts, coalesce(bl.annual_total, 0) as annual_budget, w.period_start, w.period_end,
             greatest(0, least(12, public.fiscal_month_index(w.period_start, least(fy.dt, w.period_end)))) as months_elapsed
        from public.budget_lines bl
        cross join fy
        join public.associations a on a.id = bl.association_id and a.portfolio_id = p_portfolio_id and a.archived_at is null
        join public.gl_accounts g on g.id = bl.gl_account_id
        cross join lateral public.association_fiscal_window(bl.association_id, fy.y) w
       where bl.fiscal_year = fy.y and (fy.aid is null or bl.association_id = fy.aid)
    )
    select l.association, l.number as account_number, l.account, l.account_type,
           round(l.annual_budget, 2) as annual_budget,
           round(coalesce(act.amount, 0), 2) as actual_to_date,
           round(coalesce((select sum(m) from unnest(l.monthly_amounts[l.months_elapsed + 1:12]) as m), 0), 2) as remaining_budget,
           round(coalesce(act.amount, 0) + coalesce((select sum(m) from unnest(l.monthly_amounts[l.months_elapsed + 1:12]) as m), 0), 2) as forecast,
           round(coalesce(act.amount, 0) + coalesce((select sum(m) from unnest(l.monthly_amounts[l.months_elapsed + 1:12]) as m), 0) - l.annual_budget, 2) as forecast_variance
      from lines l
      left join lateral (
        select sum(public.gl_normal_amount(l.account_type, jl.debit_amount, jl.credit_amount)) as amount
          from public.journal_lines jl
          join public.journal_entries je on je.id = jl.entry_id and je.posted
         where jl.association_id = l.association_id and jl.gl_account_id = l.gl_account_id
           and je.entry_date between l.period_start and least((select dt from fy), l.period_end)
      ) act on true
     order by l.association, l.number
  ) r;
$$;

-- ------------------------------------------------------------ Budget - Association Comparison
-- One row per GL account; one column per association with its annual budget.
create or replace function public.report_data_budget_association_comparison(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  with prm as (select * from public.rpt_prm(p_params)),
  fy as (select coalesce(nullif(p_params->>'fiscal_year', '')::int, extract(year from prm.dt)::int) as y, prm.aid from prm),
  assocs as (
    select a.id, a.name from public.associations a cross join fy
     where a.portfolio_id = p_portfolio_id and a.archived_at is null and (fy.aid is null or a.id = fy.aid)
       and exists (select 1 from public.budget_lines bl where bl.association_id = a.id and bl.fiscal_year = fy.y)
  ),
  accts as (
    select distinct g.id, g.number, g.name
      from public.budget_lines bl cross join fy
      join assocs on assocs.id = bl.association_id
      join public.gl_accounts g on g.id = bl.gl_account_id
     where bl.fiscal_year = fy.y
  ),
  grid as (
    select ac.number, ac.name as account, s.name as association,
           coalesce((select sum(bl.annual_total) from public.budget_lines bl, fy
                      where bl.association_id = s.id and bl.gl_account_id = ac.id and bl.fiscal_year = fy.y), 0) as budget
      from accts ac cross join assocs s
  )
  select coalesce(jsonb_agg(row_obj order by number), '[]'::jsonb) from (
    select number,
           jsonb_build_object('account_number', number, 'account', account)
             || jsonb_object_agg(association, round(budget, 2))
             || jsonb_build_object('total', round(sum(budget), 2)) as row_obj
      from grid group by number, account
  ) t;
$$;

-- ------------------------------------------------------------ Receivables Activity
-- Every homeowner receipt in the period: how it was paid (online or entered
-- by staff), by whom, for which unit.
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
     order by p.payment_date desc, a.name, u.unit_number
  ) r;
$$;

-- ------------------------------------------------------------ Resident Financial Activity
-- Per unit: balance before the period, charges, payments and credits in the
-- period, and the ending balance.
create or replace function public.report_data_resident_financial_activity(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params)),
    units as (
      select u.id, u.unit_number, a.name as association
        from public.units u
        join public.buildings b on b.id = u.building_id
        join public.associations a on a.id = b.association_id and a.portfolio_id = p_portfolio_id and a.archived_at is null
        cross join prm
       where u.archived_at is null and (prm.aid is null or a.id = prm.aid)
    ),
    ch as (
      select c.unit_id,
             sum(c.amount) filter (where c.due_date < prm.df) as before_amt,
             sum(c.amount) filter (where c.due_date between prm.df and prm.dt) as period_amt
        from public.charges c cross join prm where c.unit_id in (select id from units) group by c.unit_id
    ),
    pay as (
      select p.unit_id,
             sum(p.amount) filter (where p.payment_date < prm.df) as before_amt,
             sum(p.amount) filter (where p.payment_date between prm.df and prm.dt and coalesce(p.method, '') <> 'credit') as paid_amt,
             sum(p.amount) filter (where p.payment_date between prm.df and prm.dt and p.method = 'credit') as credit_amt
        from public.payments p cross join prm where p.unit_id in (select id from units) group by p.unit_id
    )
    select u.association, u.unit_number as unit,
           (select o.full_name from public.occupancies oc join public.owners o on o.id = oc.owner_id
             where oc.unit_id = u.id and oc.status = 'current' order by oc.created_at limit 1) as homeowner,
           round(coalesce(ch.before_amt, 0) - coalesce(pay.before_amt, 0), 2) as beginning_balance,
           round(coalesce(ch.period_amt, 0), 2) as charges,
           round(coalesce(pay.paid_amt, 0), 2) as payments,
           round(coalesce(pay.credit_amt, 0), 2) as credits,
           round(coalesce(ch.before_amt, 0) + coalesce(ch.period_amt, 0) - coalesce(pay.before_amt, 0)
                 - coalesce(pay.paid_amt, 0) - coalesce(pay.credit_amt, 0), 2) as ending_balance
      from units u left join ch on ch.unit_id = u.id left join pay on pay.unit_id = u.id
     where coalesce(ch.before_amt, 0) <> 0 or coalesce(ch.period_amt, 0) <> 0
        or coalesce(pay.before_amt, 0) <> 0 or coalesce(pay.paid_amt, 0) <> 0 or coalesce(pay.credit_amt, 0) <> 0
     order by u.association, u.unit_number
  ) r;
$$;

-- ------------------------------------------------------------ Users
-- Staff accounts of the company: role, sign-in and security status.
create or replace function public.report_data_users(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    select coalesce(p.full_name, p.display_name) as name, p.email,
           initcap(replace(p.hoa_role::text, '_', ' ')) as user_type,
           coalesce(rl.name, initcap(p.role::text)) as role,
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

do $$
declare f text;
begin
  foreach f in array array['report_data_annual_budget_forecast', 'report_data_budget_association_comparison',
                           'report_data_receivables_activity', 'report_data_resident_financial_activity', 'report_data_users'] loop
    execute format('alter function public.%I(uuid, jsonb) owner to postgres', f);
    execute format('revoke all on function public.%I(uuid, jsonb) from public, anon, authenticated', f);
    execute format('grant execute on function public.%I(uuid, jsonb) to service_role', f);
  end loop;
end $$;

-- ------------------------------------------------------------ dispatcher
do $$
declare def text;
begin
  def := pg_get_functiondef('public.report_data_dispatch(uuid, text, jsonb)'::regprocedure);
  if def !~ 'case p_slug' then
    raise exception 'appfolio_report_gaps: report_data_dispatch drifted';
  end if;
  def := regexp_replace(def, 'case p_slug',
    'case p_slug' || chr(10) ||
    '    when ''annual_budget_forecast'' then return public.report_data_annual_budget_forecast(p_portfolio_id, p_params);' || chr(10) ||
    '    when ''budget_association_comparison'' then return public.report_data_budget_association_comparison(p_portfolio_id, p_params);' || chr(10) ||
    '    when ''receivables_activity'' then return public.report_data_receivables_activity(p_portfolio_id, p_params);' || chr(10) ||
    '    when ''resident_financial_activity'' then return public.report_data_resident_financial_activity(p_portfolio_id, p_params);' || chr(10) ||
    '    when ''users'' then return public.report_data_users(p_portfolio_id, p_params);');
  execute def;
end $$;

-- ------------------------------------------------------------ catalog
insert into public.report_definitions (slug, name, category, description, parameter_schema, default_filters, output_formats, is_system, active)
select v.slug, v.name, v.category::public.report_category, v.description, '{}'::jsonb, '{}'::jsonb, array['pdf', 'csv']::public.report_format[], true, true
  from (values
    ('annual_budget_forecast', 'Annual Budget - Forecast', 'accounting',
     'Annual budget, actual to date, remaining budget and year-end forecast by GL account.'),
    ('budget_association_comparison', 'Budget - Association Comparison', 'accounting',
     'Annual budget by GL account, one column per association.'),
    ('receivables_activity', 'Receivables Activity', 'accounting',
     'Every homeowner receipt in the period: payment method, online or entered by staff, and who entered it.'),
    ('resident_financial_activity', 'Resident Financial Activity', 'accounting',
     'Per unit: beginning balance, charges, payments, credits and ending balance for the period.'),
    ('users', 'Users', 'people',
     'Staff user accounts: role, status, two-factor and last sign-in.')
  ) as v(slug, name, category, description)
 where not exists (select 1 from public.report_definitions d where d.slug = v.slug and d.portfolio_id is null);

-- Definitions with no data source and no AppFolio HOA equivalent (rental leasing,
-- rental-owner tax, internal settings) — hidden so nothing on the list fails.
update public.report_definitions
   set active = false, updated_at = now()
 where portfolio_id is null
   and slug in ('application_settings', 'inspection_reasons', 'market_metrics', 'pricing_metrics', 'unit_availability',
                'owner_tax_detail', 'owner_tax_summary', 'owner_1099_detail', 'owner_1099_summary', 'board_packet', 'import_validation');
