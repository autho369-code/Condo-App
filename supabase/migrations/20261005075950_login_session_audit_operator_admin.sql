-- login_attempts and user_sessions are sign-in/session audit written by the
-- server with the service client (auth hook, loginWithPassword,
-- /api/auth/mfa-complete); clients never need to write them. The own-row
-- exception from 20261005074000 let a support/readonly operator rewrite or
-- erase their own security history through PostgREST. Operator writes are
-- admin-only on both; reads are unchanged.
alter policy operator_writes_own_rows_insert on public.login_attempts with check (public.operator_may_write(false));
alter policy operator_writes_own_rows_update on public.login_attempts using (public.operator_may_write(false)) with check (public.operator_may_write(false));
alter policy operator_writes_own_rows_delete on public.login_attempts using (public.operator_may_write(false));
alter policy operator_writes_own_rows_insert on public.user_sessions with check (public.operator_may_write(false));
alter policy operator_writes_own_rows_update on public.user_sessions using (public.operator_may_write(false)) with check (public.operator_may_write(false));
alter policy operator_writes_own_rows_delete on public.user_sessions using (public.operator_may_write(false));
