-- Projects list: committed spend for every staff member who can see the
-- project, not only finance staff.
--
-- /projects read capital_project_financials, a security_invoker view that
-- sums payable_bills. Bills are readable only by finance staff, so a manager
-- with a non-finance role saw "$0" spent on every project, while the
-- project's own page (project_budget_vs_actual, security definer) showed the
-- real figure. This function gives the list the same totals as the project
-- page: same access checks, and the same bills (approved or paid, not
-- archived, on the project's linked work orders, in the project's own
-- association). It returns only per-project totals, never bill rows.

create or replace function public.capital_project_spend_totals()
returns table(project_id uuid, work_order_count integer, committed_spend numeric)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  -- Access is worked out once per call, not once per project. Same rules as
  -- project_budget_vs_actual: staff, company admin or platform operator;
  -- the caller's own company (any company for an operator); a scoped
  -- manager only their assigned associations. The company filter also sits
  -- inside the two totals so they never add up other companies' rows.
  v_op boolean := coalesce(public.is_platform_operator(), false);
  v_pf uuid := public.my_access_portfolio();
  v_scoped boolean := coalesce(public.manager_is_scoped(), false);
begin
  if not (v_op or v_pf is not null) then
    return;
  end if;

  return query
  select p.id,
         coalesce(links.n, 0)::integer,
         coalesce(spend.amount, 0)::numeric(16, 2)
    from public.capital_projects p
    left join (
      select link.project_id, count(distinct link.work_order_id) as n
        from public.capital_project_work_orders link
        join public.capital_projects lp on lp.id = link.project_id
       where v_op or lp.portfolio_id = v_pf
       group by link.project_id
    ) links on links.project_id = p.id
    left join (
      select link.project_id, sum(b.amount) as amount
        from public.capital_project_work_orders link
        join public.capital_projects lp on lp.id = link.project_id
        join public.payable_bills b on b.work_order_id = link.work_order_id
       where (v_op or lp.portfolio_id = v_pf)
         and b.archived_at is null
         and b.association_id = lp.association_id
         and b.status::text in ('approved', 'paid')
       group by link.project_id
    ) spend on spend.project_id = p.id
   where p.portfolio_id is not null
     and (v_op or p.portfolio_id = v_pf)
     and (not v_scoped
          or p.association_id is null
          or p.association_id in (select am.association_id
                                    from public.association_managers am
                                   where am.user_id = auth.uid()));
end
$function$;

revoke all on function public.capital_project_spend_totals() from public, anon;
grant execute on function public.capital_project_spend_totals() to authenticated;
