-- 20261005071000/072000 left a few tables out of the operator write guard
-- because people write their own rows there just by using the app. But their
-- existing policies (profiles_platform_all, login_attempts_platform_all,
-- user_sessions_platform_all, ...) let ANY active operator write ANY row.
-- Non-admin operators may now write only their own rows; the impersonation
-- log is admin-only. Admins, staff and everyone else are unaffected.
-- Additive and idempotent.
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('profiles',                   'id = auth.uid()'),
      ('login_attempts',             'auth_user_id = auth.uid()'),
      ('user_sessions',              'auth_user_id = auth.uid()'),
      ('form_submissions',           'created_by = auth.uid()'),
      ('report_favorites',           'user_id = auth.uid()'),
      ('saved_report_views',         'created_by = auth.uid()'),
      ('platform_impersonation_log', 'false')
    ) as t(tbl, own_row)
  loop
    if to_regclass('public.' || r.tbl) is null then
      continue;
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = r.tbl and policyname = 'operator_writes_own_rows_insert') then
      execute format('create policy operator_writes_own_rows_insert on public.%I as restrictive for insert to authenticated with check (public.operator_may_write(false) or (%s))', r.tbl, r.own_row);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = r.tbl and policyname = 'operator_writes_own_rows_update') then
      execute format('create policy operator_writes_own_rows_update on public.%I as restrictive for update to authenticated using (public.operator_may_write(false) or (%s)) with check (public.operator_may_write(false) or (%s))', r.tbl, r.own_row, r.own_row);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = r.tbl and policyname = 'operator_writes_own_rows_delete') then
      execute format('create policy operator_writes_own_rows_delete on public.%I as restrictive for delete to authenticated using (public.operator_may_write(false) or (%s))', r.tbl, r.own_row);
    end if;
  end loop;
end $$;
