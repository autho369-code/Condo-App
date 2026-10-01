-- 1. Lock boxes: the restrictive policies lock_boxes_staff_only /
--    lock_box_assignments_staff_only call is_self_service_caller() as the
--    caller, but 20260930200000_self_service_column_guards revoked EXECUTE from
--    authenticated, so every select/insert failed with "permission denied for
--    function is_self_service_caller". It is SECURITY DEFINER and only reports
--    whether the caller is a non-staff user, so granting it is safe.
grant execute on function public.is_self_service_caller() to authenticated;

-- 2. communications_log only let company admins insert/read, so Send Email
--    (owners + tenants, the default audience) failed for every manager. Staff
--    may log and read their portfolio's sends; the restrictive
--    mgr_assoc_scope policy still limits them to associations they can view.
drop policy if exists communications_log_staff_insert on public.communications_log;
create policy communications_log_staff_insert on public.communications_log
  for insert to authenticated
  with check (public.is_any_staff() and public.can_access_portfolio(portfolio_id));

drop policy if exists communications_log_staff_read on public.communications_log;
create policy communications_log_staff_read on public.communications_log
  for select to authenticated
  using (public.is_any_staff() and public.can_access_portfolio(portfolio_id));
