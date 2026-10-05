-- Audit trails are written as a side effect of other changes (e.g.
-- log_platform_operator_change writes permission_audit_log when an operator's
-- role changes, which made an admin's self-demotion fail). They are not data an
-- operator edits, and direct writes stay limited by the RLS policies from
-- 20261005071000. The statement guard now lets them through (no trigger is
-- dropped; the function skips these tables).
create or replace function public.operator_write_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_table_schema = 'public' and tg_table_name in ('audit_logs', 'permission_audit_log') then
    return null;
  end if;
  if not public.operator_may_write(coalesce(tg_argv[0], 'false')::boolean) then
    raise exception 'Only Portier platform admins can change this data'
      using errcode = '42501';
  end if;
  return null;
end $$;
revoke all on function public.operator_write_guard() from public, anon, authenticated;
