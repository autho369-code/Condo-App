-- Company admins were invisible to 10 staff RLS policies that gate on
-- is_any_staff() (literally hoa_role='manager') with no company-admin path.
-- Verified live as admin@ (impersonated session): owners 0/5 visible,
-- documents 0/5, portfolios 0/1 (own row!), profiles 1/8 (self only) —
-- so the company-admin Owners page was empty, ARC oversight showed blank
-- homeowner names, and the Managers directory couldn't list managers.
-- can_access_portfolio()/can_access_association() were already fixed
-- (20260627010000) but these policies never call those helpers.
--
-- Fix: OR is_company_admin() into each policy, preserving each policy's
-- existing scoping shape exactly (company admins remain bound to their own
-- portfolio wherever the policy scopes by current_portfolio_id()).

alter policy "documents_staff_all" on public.documents
  using (is_any_staff() or is_company_admin())
  with check (is_any_staff() or is_company_admin());

alter policy "Staff manage rules" on public.house_rules
  using (is_any_staff() or is_company_admin() or is_platform_operator());

alter policy "Staff can manage insurance" on public.insurance_policies
  using (is_any_staff() or is_company_admin() or is_platform_operator());

alter policy "inv_staff_all" on public.inventory_items
  using (is_any_staff() or is_company_admin() or is_platform_operator())
  with check (is_any_staff() or is_company_admin() or is_platform_operator());

alter policy "Staff manage history" on public.maintenance_task_history
  using (is_any_staff() or is_company_admin() or is_platform_operator());

alter policy "Staff manage tasks" on public.maintenance_tasks
  using (is_any_staff() or is_company_admin() or is_platform_operator());

alter policy "owners_staff_all" on public.owners
  using (is_platform_operator() or ((is_any_staff() or is_company_admin()) and ((portfolio_id is null) or (portfolio_id = current_portfolio_id()))))
  with check (is_platform_operator() or ((is_any_staff() or is_company_admin()) and ((portfolio_id is null) or (portfolio_id = current_portfolio_id()))));

alter policy "portfolios_staff_read" on public.portfolios
  using ((is_any_staff() or is_company_admin()) and (id = current_portfolio_id()));

alter policy "profiles_staff_directory_read" on public.profiles
  using ((is_any_staff() or is_company_admin()) and (portfolio_id is not null) and (portfolio_id = current_portfolio_id()));

alter policy "Staff manage cases" on public.violation_cases
  using (is_any_staff() or is_company_admin() or is_platform_operator());
