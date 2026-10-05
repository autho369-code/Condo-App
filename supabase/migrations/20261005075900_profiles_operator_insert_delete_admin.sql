-- 20261005074000 let non-admin operators insert/delete their own profiles
-- row. guard_profile_insert_delete() trusts every platform operator, so a
-- support/readonly operator could delete and recreate their profile with
-- arbitrary portfolio/role/account-control values (e.g. company admin). Only
-- operator admins may insert or delete profiles as operators; self-service
-- stays limited to updates, which guard_profile_privilege_changes() checks.
alter policy operator_writes_own_rows_insert on public.profiles
  with check (public.operator_may_write(false));
alter policy operator_writes_own_rows_delete on public.profiles
  using (public.operator_may_write(false));
