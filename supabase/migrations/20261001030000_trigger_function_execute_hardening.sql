-- Security advisor sweep (2026-09-30).
-- Trigger functions are never meant to be called through /rest/v1/rpc, yet
-- 47 were executable by anon and 57 by authenticated (Postgres grants EXECUTE
-- to PUBLIC by default). Direct calls fail ("trigger functions can only be
-- called as triggers"), but revoke anyway: EXECUTE is not checked when a
-- trigger fires, so every trigger keeps working.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- A staff check has no meaning for signed-out callers.
revoke execute on function public.is_messaging_staff() from public, anon;
grant execute on function public.is_messaging_staff() to authenticated, service_role;

-- Mutable search_path (advisor 0011).
alter function public.service_request_response_window set search_path = pg_catalog, public;
