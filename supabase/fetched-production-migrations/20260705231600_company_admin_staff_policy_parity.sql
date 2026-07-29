-- Company admins were invisible to 10 staff RLS policies gating on is_any_staff().
-- See supabase/migrations/20260705000003_company_admin_staff_policy_parity.sql

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
  using (is_any_staff() or is_company_admin() or is_platform_operator());;
