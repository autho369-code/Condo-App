-- Codex review of #194: 20261005010001 left portfolios out. portfolios_platform_all
-- let any active Portier369 operator (support and readonly included) write
-- every company row, and portfolios_guard_platform_columns exempted every
-- operator from its plan/status guard, so a non-admin operator could still
-- change a company's tier, archive, suspend or reactivate it directly.
-- Writes now need an operator with the admin role; every operator keeps read
-- access. The app writes portfolios as an operator only through the service
-- role, and provision_portfolio / suspend_portfolio already require an
-- operator admin. Client company staff keep portfolios_admin_update, still
-- bounded by the guard below.

do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'portfolios' and policyname = 'portfolios_platform_all') then
    alter policy portfolios_platform_all on public.portfolios
      using (public.is_platform_operator() and public.is_platform_admin())
      with check (public.is_platform_operator() and public.is_platform_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'portfolios' and policyname = 'portfolios_platform_read') then
    create policy portfolios_platform_read on public.portfolios
      for select to authenticated
      using (public.is_platform_operator());
  end if;
end $$;

-- Same guard, but only an operator admin (or a system context) may change
-- plan, status and account identity columns.
create or replace function public.portfolios_guard_platform_columns()
 returns trigger
 language plpgsql
 set search_path to 'pg_catalog', 'public'
as $function$
begin
  if auth.uid() is null or (public.is_platform_operator() and public.is_platform_admin()) then
    return new;
  end if;
  if new.tier is distinct from old.tier
     or new.entitlements is distinct from old.entitlements
     or new.archived_at is distinct from old.archived_at
     or new.suspended_at is distinct from old.suspended_at
     or new.suspension_reason is distinct from old.suspension_reason
     or new.slug is distinct from old.slug
     or new.created_by is distinct from old.created_by then
    raise exception 'Plan, status and account identity can only be changed by Portier369 support';
  end if;
  return new;
end $function$;
