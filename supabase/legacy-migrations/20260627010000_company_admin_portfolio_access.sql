-- Company admins can access their own portfolio's operational data.
--
-- can_access_portfolio() previously admitted only platform operators and
-- is_any_staff() (which is literally hoa_role='manager'). Company admins
-- (hoa_role='company_admin') failed the check, so every association-scoped table
-- guarded by can_access_association()/can_access_portfolio() — violations,
-- architectural_requests, work_orders, etc. — read EMPTY for them. The entire
-- company-admin oversight section was inaccessible to actual company admins.
--
-- Admit company admins for their OWN portfolio. The staff RLS policies these gate
-- are FOR ALL, so this grants read+write within the company admin's portfolio,
-- which matches the role's intent (they already administer the portfolio, invite
-- managers, and edit settings). Platform-operator and cross-portfolio behavior are
-- unchanged. Idempotent (CREATE OR REPLACE) per project convention.

create or replace function public.can_access_portfolio(p_id uuid)
  returns boolean
  language sql
  stable security definer
  set search_path to 'pg_catalog', 'public'
as $function$
  select p_id is not null
    and (
      public.is_platform_operator()
      or ((public.is_any_staff() or public.is_company_admin()) and p_id = public.current_portfolio_id())
    );
$function$;
