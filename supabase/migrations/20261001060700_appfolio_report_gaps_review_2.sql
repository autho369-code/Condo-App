-- #100 review 2.
--  1. Budget comparison groups by association id (names aren't unique); two
--     associations with the same name get distinct column labels.
--  2. Receivables Activity / Resident Financial Activity show the PRIMARY
--     homeowner of a co-owned unit (occupancies.is_primary), like the other
--     reports.

create or replace function public.report_data_budget_association_comparison(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  with prm as (select * from public.rpt_prm(p_params)),
  assocs as (
    select a.id,
           case when count(*) over (partition by a.name) > 1 then a.name || ' (' || left(a.id::text, 8) || ')' else a.name end as label,
           coalesce(nullif(p_params->>'fiscal_year', '')::int, public.association_fiscal_year_of(a.id, prm.dt)) as y
      from public.associations a cross join prm
     where a.portfolio_id = p_portfolio_id and a.archived_at is null and (prm.aid is null or a.id = prm.aid)
  ),
  budgets as (
    select s.id as association_id, s.label, g.number, g.name as account, sum(coalesce(bl.annual_total, 0)) as budget
      from assocs s
      join public.budget_lines bl on bl.association_id = s.id and bl.fiscal_year = s.y
      join public.gl_accounts g on g.id = bl.gl_account_id
     group by s.id, s.label, g.number, g.name
  ),
  with_budget as (select distinct association_id, label from budgets),
  accts as (select distinct number, account from budgets),
  grid as (
    select ac.number, ac.account, wb.label, coalesce(b.budget, 0) as budget
      from accts ac cross join with_budget wb
      left join budgets b on b.association_id = wb.association_id and b.number is not distinct from ac.number and b.account = ac.account
  )
  select coalesce(jsonb_agg(row_obj order by number, account), '[]'::jsonb) from (
    select number, account,
           jsonb_build_object('account_number', number, 'account', account)
             || jsonb_object_agg(label, round(budget, 2))
             || jsonb_build_object('total', round(sum(budget), 2)) as row_obj
      from grid group by number, account
  ) t;
$$;

do $$
declare
  f text;
  def text;
begin
  foreach f in array array['report_data_receivables_activity', 'report_data_resident_financial_activity'] loop
    def := pg_get_functiondef(format('public.%I(uuid, jsonb)', f)::regprocedure);
    if def !~ 'order by oc\.created_at limit 1' then
      raise exception 'appfolio_report_gaps_review_2: % drifted', f;
    end if;
    def := replace(def, 'order by oc.created_at limit 1', 'order by oc.is_primary desc nulls last, oc.created_at limit 1');
    execute def;
  end loop;
end $$;
