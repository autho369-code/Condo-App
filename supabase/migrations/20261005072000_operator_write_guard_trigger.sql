-- 20261005070000/071000 limit operator writes with RLS, but SECURITY DEFINER
-- functions run as their owner and skip RLS: an RPC that authorizes "any
-- operator" (e.g. save_delinquency_compliance, delinquency policy setup, case
-- events) still let support/readonly operators change data.
--
-- Triggers fire whatever the calling path, and auth.uid() is still the caller
-- inside a SECURITY DEFINER function. Add a statement-level BEFORE trigger to
-- the same tables that rejects writes by non-admin operators (support
-- operators keep support requests and their audit rows). Staff, owners, board,
-- vendors, cron jobs and the service role are not operators and pass.
--
-- Same exclusions as 071000. Idempotent.

create or replace function public.operator_write_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if not public.operator_may_write(coalesce(tg_argv[0], 'false')::boolean) then
    raise exception 'Only Portier platform admins can change this data'
      using errcode = '42501';
  end if;
  return null;
end $$;
revoke all on function public.operator_write_guard() from public, anon, authenticated;

do $$
declare
  t text;
  support_ok boolean;
begin
  for t in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
       and c.relname not in ('login_attempts', 'user_sessions', 'form_submissions', 'profiles',
                             'report_favorites', 'saved_report_views', 'platform_impersonation_log')
     order by c.relname
  loop
    support_ok := t in ('platform_requests', 'platform_request_private', 'audit_logs');
    if not exists (select 1 from pg_trigger where tgname = 'operator_write_guard' and tgrelid = ('public.' || quote_ident(t))::regclass) then
      execute format(
        'create trigger operator_write_guard before insert or update or delete on public.%I for each statement execute function public.operator_write_guard(%L)',
        t, support_ok::text);
    end if;
  end loop;
end $$;
