-- Extends 20261005070000_operator_writes_need_admin to EVERY public table with
-- row level security. That migration only covered tables whose policies name
-- is_platform_operator() directly; operator access also arrives through
-- helpers (can_access_portfolio, can_access_association, ...) and mixed
-- policies (e.g. autopay_mandates, budget_lines, inventory_items,
-- board_comments, inspections, inspection_items), which stayed writable by
-- support/readonly operators.
--
-- Same rule: an operator may write only as an admin; support operators may
-- also work support requests (platform_requests, their private notes, and the
-- audit rows those actions write). On tables already limited to operator
-- admins the extra policy changes nothing.
--
-- Excluded: rows a person writes about themselves just by using the app —
-- login_attempts, user_sessions, form_submissions (double-submit tokens),
-- profiles (own row), report_favorites, saved_report_views — and the
-- impersonation audit log, whose writes are gated by the impersonation flow.
--
-- Additive and idempotent: no existing policy is changed or dropped.
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

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'operator_writes_need_admin_insert') then
      execute format('create policy operator_writes_need_admin_insert on public.%I as restrictive for insert to authenticated with check (public.operator_may_write(%L))', t, support_ok);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'operator_writes_need_admin_update') then
      execute format('create policy operator_writes_need_admin_update on public.%I as restrictive for update to authenticated using (public.operator_may_write(%L)) with check (public.operator_may_write(%L))', t, support_ok, support_ok);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'operator_writes_need_admin_delete') then
      execute format('create policy operator_writes_need_admin_delete on public.%I as restrictive for delete to authenticated using (public.operator_may_write(%L))', t, support_ok);
    end if;
  end loop;
end $$;
