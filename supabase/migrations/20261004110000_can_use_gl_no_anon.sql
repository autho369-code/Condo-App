-- can_use_gl() was executable by PUBLIC and anon (Supabase security advisor:
-- anon_security_definer_function_executable). It only answers for the
-- signed-in user and its sole caller is the enforce_gl_use_permission
-- trigger, which runs as the function owner. Signed-out callers have no use
-- for it; signed-in staff keep EXECUTE.
revoke execute on function public.can_use_gl(uuid) from public;
revoke execute on function public.can_use_gl(uuid) from anon;
grant execute on function public.can_use_gl(uuid) to authenticated, service_role;
