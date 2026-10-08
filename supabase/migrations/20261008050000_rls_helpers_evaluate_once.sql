-- Speed: row-level security re-ran its identity checks for EVERY ROW.
--
-- can_view_association_row (the restrictive mgr_assoc_scope policy on most
-- tables), can_access_portfolio and can_manage_finance were SECURITY DEFINER
-- functions with their own search_path, so Postgres could not inline them:
-- each row of each table in a query called them, and each call looked up the
-- caller's profile again (is_staff, current_portfolio_id, ...). Twelve aged
-- receivables took ~540 ms; pages built from several such views timed out
-- (statement timeout 8 s) and requests were killed at 25 s.
--
-- These versions are plain SQL (no SECURITY DEFINER, no SET), so the planner
-- inlines them into the policy, and every identity helper is wrapped in a
-- scalar subquery, which Postgres evaluates ONCE per query (an InitPlan).
-- The logic is unchanged: the same helpers, the same conditions. The
-- identity helpers they call stay SECURITY DEFINER, and the one direct table
-- read (association_managers) moves into a SECURITY DEFINER set-returning
-- helper, so nothing reads a table under the caller's own RLS that did not
-- before. Names are schema-qualified (no search_path is needed, and a SET
-- clause would stop inlining).
-- Additive only: no DROP, no DELETE. Grants on the replaced functions are kept.

create or replace function public.current_manager_association_ids()
returns setof uuid
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select am.association_id from public.association_managers am where am.user_id = auth.uid()
$function$;

revoke all on function public.current_manager_association_ids() from public, anon;
grant execute on function public.current_manager_association_ids() to authenticated, service_role;

create or replace function public.can_view_association_row(p_assoc uuid)
returns boolean
language sql
stable
as $function$
  select case
    when (select public.manager_is_scoped()) then
      p_assoc is null or p_assoc in (select public.current_manager_association_ids())
    else true
  end
$function$;

create or replace function public.can_access_portfolio(p_id uuid)
returns boolean
language sql
stable
as $function$
  select p_id is not null
    and (
      (select public.is_platform_operator())
      or (((select public.is_any_staff()) or (select public.is_company_admin()))
          and p_id = (select public.current_portfolio_id()))
    )
$function$;

create or replace function public.can_manage_finance(p_id uuid)
returns boolean
language sql
stable
as $function$
  select p_id is not null
    and (
      (select public.is_platform_operator())
      or ((select public.is_finance_staff()) and p_id = (select public.current_portfolio_id()))
    )
$function$;
