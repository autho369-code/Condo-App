-- Company admins are portfolio admins for their OWN portfolio. They must be able
-- to invite staff/managers and manage portfolio settings. Previously only
-- is_full_access_staff (hoa_role='manager') or platform operators passed, so a
-- company_admin could not invite managers (invite_staff raised "must be portfolio admin")
-- and was bounced out of the whole /company-admin area by requirePortfolioAdmin.
create or replace function public.can_admin_portfolio(p_id uuid)
 returns boolean language sql stable security definer
 set search_path to 'pg_catalog','public'
as $function$
  select p_id is not null
    and (
      public.is_platform_operator()
      or ((public.is_full_access_staff() or public.is_company_admin()) and p_id = public.current_portfolio_id())
    );
$function$;
