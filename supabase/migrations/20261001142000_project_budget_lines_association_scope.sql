-- Budget lines follow the same association scope as everything else: managers assigned to
-- specific associations only see lines of projects in those associations.

drop policy if exists capital_project_budget_lines_staff_read on public.capital_project_budget_lines;
create policy capital_project_budget_lines_staff_read on public.capital_project_budget_lines
  for select to authenticated using (exists (
    select 1 from public.capital_projects p
     where p.id = capital_project_budget_lines.project_id
       and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator())
       and public.can_access_portfolio(p.portfolio_id)
       and public.can_view_association_row(p.association_id)));
