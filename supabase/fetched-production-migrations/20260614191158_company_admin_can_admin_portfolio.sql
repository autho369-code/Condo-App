-- Company admins are portfolio admins for their own portfolio: allow them to
-- invite staff / manage portfolio (invite_staff and other guards use this).
create or replace function public.can_admin_portfolio(p_id uuid)
 returns boolean language sql stable security definer
 set search_path to 'pg_catalog','public'
as $function$
  select p_id is not null
    and (
      public.is_platform_operator()
      or ((public.is_full_access_staff() or public.is_company_admin()) and p_id = public.current_portfolio_id())
    );
$function$;;
