-- 20261005071000 let support operators write audit_logs through RLS, and the
-- table's permissive "System insert audit logs" policy is WITH CHECK (true),
-- so a support operator could forge audit history through PostgREST. Make the
-- operator restriction admin-only on audit_logs. Side-effect audit rows
-- written by triggers and SECURITY DEFINER functions are unaffected (they run
-- as the function owner; the statement guard skips audit tables).
alter policy operator_writes_need_admin_insert on public.audit_logs
  with check (public.operator_may_write(false));
alter policy operator_writes_need_admin_update on public.audit_logs
  using (public.operator_may_write(false)) with check (public.operator_may_write(false));
alter policy operator_writes_need_admin_delete on public.audit_logs
  using (public.operator_may_write(false));
