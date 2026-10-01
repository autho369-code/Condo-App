-- Suspending a company (portfolios.suspended_at) only blocked new profile
-- inserts and the public API: managers, owners, board members and vendors
-- kept full access. is_current_identity_enabled() gates every role helper
-- (is_staff, can_access_portfolio, current_board_association_ids, …), so
-- treating members of a suspended company as disabled here enforces the
-- suspension in RLS. Active platform operators are exempt (checked against
-- platform_operators directly: is_platform_operator() calls this function).
create or replace function public.is_current_identity_enabled()
 returns boolean
 language sql
 stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$
  select auth.uid() is not null
     and not exists (
       select 1
       from public.profiles p
       where p.id = auth.uid()
         and p.disabled_at is not null
     )
     and (
       exists (
         select 1 from public.platform_operators po
         where po.auth_user_id = auth.uid() and po.active
       )
       or not exists (
         select 1 from public.profiles p
         join public.portfolios pf on pf.id = p.portfolio_id
         where p.id = auth.uid() and pf.suspended_at is not null
         union all
         select 1 from public.owners o
         join public.portfolios pf on pf.id = o.portfolio_id
         where o.auth_user_id = auth.uid() and pf.suspended_at is not null
         union all
         select 1 from public.vendors v
         join public.portfolios pf on pf.id = v.portfolio_id
         where v.auth_user_id = auth.uid() and pf.suspended_at is not null
       )
     );
$function$;

-- Staff helpers (is_staff, is_company_admin, …) only check disabled_at, but
-- every staff data policy goes through can_access_portfolio /
-- can_access_association, which require p_id = current_portfolio_id().
-- Returning no portfolio for a suspended company cuts that path too.
create or replace function public.current_portfolio_id()
 returns uuid
 language sql
 stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$
  select p.portfolio_id
  from public.profiles p
  join public.portfolios pf on pf.id = p.portfolio_id
  where p.id = auth.uid()
    and p.disabled_at is null
    and pf.suspended_at is null;
$function$;
