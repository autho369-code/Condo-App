-- #95 review: the trigger-function sweep only covered functions that existed
-- when it ran; the defaults still handed every NEW function to anon (via the
-- built-in PUBLIC grant plus an explicit anon default). Close both paths:
--
-- 1. New functions created by postgres are no longer executable by PUBLIC or
--    anon. The global form is required — a schema-scoped default cannot
--    remove the built-in PUBLIC grant. authenticated/service_role keep their
--    schema defaults, so new RPCs for signed-in users work as before. An RPC
--    meant for signed-out callers must now `grant execute ... to anon`
--    explicitly (today only tenant_branding, which keeps its grant).
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon;

-- 2. New trigger functions are never RPCs: an event trigger revokes direct
--    execution as soon as one is created (EXECUTE is not checked when a
--    trigger fires, so the trigger itself keeps working).
create or replace function public.app_revoke_trigger_function_execute()
returns event_trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare c record;
begin
  for c in select objid from pg_event_trigger_ddl_commands()
            where object_type = 'function' and schema_name = 'public' loop
    if exists (select 1 from pg_proc p where p.oid = c.objid and p.prorettype = 'trigger'::regtype) then
      execute format('revoke execute on function %s from public, anon, authenticated', c.objid::regprocedure);
    end if;
  end loop;
end $$;
revoke execute on function public.app_revoke_trigger_function_execute() from public, anon, authenticated;

drop event trigger if exists app_revoke_trigger_function_execute;
create event trigger app_revoke_trigger_function_execute on ddl_command_end
  when tag in ('CREATE FUNCTION')
  execute function public.app_revoke_trigger_function_execute();
