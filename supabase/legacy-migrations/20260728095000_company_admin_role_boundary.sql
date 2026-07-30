-- Restore the explicit Company Administrator / Property Manager boundary.
-- Production browser evidence on 2026-07-28 confirmed that a profile with
-- hoa_role='manager' could render /company-admin/overview because both the app
-- guard and can_admin_portfolio treated full-access managers as company admins.

create or replace function public.is_company_admin()
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.disabled_at is null
      and p.hoa_role = 'company_admin'
  );
$function$;

create or replace function public.can_admin_portfolio(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select p_id is not null
    and (
      public.is_platform_operator_safe()
      or (
        public.is_company_admin()
        and p_id = public.current_portfolio_id()
      )
    );
$function$;

revoke all on function public.is_company_admin() from public, anon;
grant execute on function public.is_company_admin() to authenticated, service_role;
revoke all on function public.can_admin_portfolio(uuid) from public, anon;
grant execute on function public.can_admin_portfolio(uuid) to authenticated, service_role;
