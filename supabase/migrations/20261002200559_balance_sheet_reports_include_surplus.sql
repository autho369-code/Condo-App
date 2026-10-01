-- The SQL balance-sheet reports (comparative, association comparison, fund)
-- summed only asset/liability/equity accounts. No closing entries are posted,
-- so income less expenses never reached equity and the reports never
-- balanced. Each now adds an "Accumulated surplus" equity line: credits less
-- debits on income and expense accounts through the as-of date (per
-- association / per fund where the report is split that way).

create or replace function public.report_data_balance_sheet_comparative(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$
  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.number), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select g.number, g.name, g.account_type::text as account_type,
             coalesce(sum(public.rpt_sign(g.account_type::text, jl.debit_amount, jl.credit_amount)) filter (where je.entry_date <= prm.dt),0) as current_balance,
             coalesce(sum(public.rpt_sign(g.account_type::text, jl.debit_amount, jl.credit_amount)) filter (where je.entry_date <= prm.cmp),0) as prior_balance,
             coalesce(sum(public.rpt_sign(g.account_type::text, jl.debit_amount, jl.credit_amount)) filter (where je.entry_date <= prm.dt),0) - coalesce(sum(public.rpt_sign(g.account_type::text, jl.debit_amount, jl.credit_amount)) filter (where je.entry_date <= prm.cmp),0) as change
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
      join public.gl_accounts g on g.id = jl.gl_account_id
      cross join prm
      where (prm.aid is null or jl.association_id = prm.aid) and g.account_type::text in ('asset','cash','accounts_receivable','fixed_asset','liability','accounts_payable','equity')
      group by g.id
    union all
    select 39999, 'Accumulated Surplus (income less expenses)', 'equity',
             coalesce(sum(jl.credit_amount - jl.debit_amount) filter (where je.entry_date <= prm.dt),0),
             coalesce(sum(jl.credit_amount - jl.debit_amount) filter (where je.entry_date <= prm.cmp),0),
             coalesce(sum(jl.credit_amount - jl.debit_amount) filter (where je.entry_date <= prm.dt),0) - coalesce(sum(jl.credit_amount - jl.debit_amount) filter (where je.entry_date <= prm.cmp),0)
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
      join public.gl_accounts g on g.id = jl.gl_account_id
      cross join prm
      where (prm.aid is null or jl.association_id = prm.aid)
        and g.account_type::text in ('income','other_income','expense','cost_of_goods_sold','other_expense','non_operating')
      group by prm.dt, prm.cmp
  ) r;
$function$;

create or replace function public.report_data_balance_sheet_association_comparison(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$
  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.number, r.association), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select g.number, g.name, a.name as association, g.account_type::text as account_type,
             sum(public.rpt_sign(g.account_type::text, jl.debit_amount, jl.credit_amount)) as balance
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
      join public.gl_accounts g on g.id = jl.gl_account_id
      cross join prm
      left join public.associations a on a.id = jl.association_id
      where (prm.aid is null or jl.association_id = prm.aid) and g.account_type::text in ('asset','cash','accounts_receivable','fixed_asset','liability','accounts_payable','equity') and je.entry_date <= prm.dt
      group by g.id, a.id
    union all
    select 39999, 'Accumulated Surplus (income less expenses)', a.name, 'equity', sum(jl.credit_amount - jl.debit_amount)
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
      join public.gl_accounts g on g.id = jl.gl_account_id
      cross join prm
      left join public.associations a on a.id = jl.association_id
      where (prm.aid is null or jl.association_id = prm.aid) and je.entry_date <= prm.dt
        and g.account_type::text in ('income','other_income','expense','cost_of_goods_sold','other_expense','non_operating')
      group by a.id, a.name
  ) r;
$function$;

create or replace function public.report_data_fund_balance_sheet(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$
  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.fund, r.number), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select coalesce(g.fund_account::text, 'unassigned') as fund, g.number, g.name, g.account_type::text as account_type, sum(public.rpt_sign(g.account_type::text, jl.debit_amount, jl.credit_amount)) as balance
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
      join public.gl_accounts g on g.id = jl.gl_account_id
      cross join prm
      where (prm.aid is null or jl.association_id = prm.aid) and g.account_type::text in ('asset','cash','accounts_receivable','fixed_asset','liability','accounts_payable','equity') and je.entry_date <= prm.dt
      group by g.fund_account, g.id
    union all
    select coalesce(g.fund_account::text, 'unassigned'), 39999, 'Accumulated Surplus (income less expenses)', 'equity', sum(jl.credit_amount - jl.debit_amount)
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
      join public.gl_accounts g on g.id = jl.gl_account_id
      cross join prm
      where (prm.aid is null or jl.association_id = prm.aid) and je.entry_date <= prm.dt
        and g.account_type::text in ('income','other_income','expense','cost_of_goods_sold','other_expense','non_operating')
      group by g.fund_account
  ) r;
$function$;
