-- Speed: row-level security checks run once per query, not once per row.
--
-- Most policies call PL/pgSQL helpers such as operator_may_write(false),
-- is_platform_operator() or can_access_portfolio(portfolio_id). Postgres
-- calls a function in a policy again for every row it checks, and each
-- helper runs its own queries, so a 500-row list ran thousands of extra
-- queries. A scalar subquery around a call that does not depend on the
-- row, "( SELECT f() )", is run once per statement instead.
--
-- This migration rewrites every public policy in place, with the same
-- meaning:
--   * zero-argument helpers (and auth.uid() etc.) become "( SELECT f() )";
--   * operator_may_write(true|false) becomes "( SELECT operator_may_write(..) )";
--   * the helpers that take a row value are split into a once-per-query
--     part and a plain comparison against the row:
--       can_access_portfolio(x)     -> x = my_access_portfolio()   or (operator and x is not null)
--       can_manage_finance(x)       -> x = my_finance_portfolio()  or (operator and x is not null)
--       can_admin_portfolio(x)      -> x = my_admin_portfolio()    or (operator and x is not null)
--       can_access_association(x)   -> x in my_accessible_association_ids()
--       can_view_association_row(x) -> not scoped or x is null or x in my_managed_association_ids()
--     The originals stay; functions, triggers and RPCs still call them.
--
-- Roles, commands and permissive/restrictive settings are unchanged
-- (ALTER POLICY only replaces the expressions). Equivalence for every
-- policy and every role was checked before applying; see
-- scripts/sql/rls-hoist-equivalence.sql.
--
-- New policies should use the "( SELECT f() )" forms directly.

-- 1. Once-per-query parts of the per-row helpers ---------------------------

create or replace function public.my_access_portfolio()
returns uuid
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
begin
  -- The portfolio a manager or company admin works in (null for everyone else).
  -- can_access_portfolio(x) = x = this, or the caller is a platform operator.
  return (select case when public.is_any_staff() or public.is_company_admin()
                      then public.current_portfolio_id() end);
end
$$;

create or replace function public.my_finance_portfolio()
returns uuid
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
begin
  -- can_manage_finance(x) = x = this, or the caller is a platform operator.
  return (select case when public.is_finance_staff()
                      then public.current_portfolio_id() end);
end
$$;

create or replace function public.my_admin_portfolio()
returns uuid
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
begin
  -- can_admin_portfolio(x) = x = this, or the caller is a platform operator.
  return (select case when public.is_company_admin()
                      then public.current_portfolio_id() end);
end
$$;

create or replace function public.my_accessible_association_ids()
returns setof uuid
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
begin
  -- Every association can_access_association() lets the caller see.
  return query
  select a.id from public.associations a
   where public.can_access_portfolio(a.portfolio_id);
end
$$;

create or replace function public.my_managed_association_ids()
returns setof uuid
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
begin
  -- The associations a scoped manager is assigned to.
  return query
  select am.association_id from public.association_managers am
   where am.user_id = auth.uid() and am.association_id is not null;
end
$$;

revoke all on function public.my_access_portfolio() from public, anon;
revoke all on function public.my_finance_portfolio() from public, anon;
revoke all on function public.my_admin_portfolio() from public, anon;
revoke all on function public.my_accessible_association_ids() from public, anon;
revoke all on function public.my_managed_association_ids() from public, anon;
grant execute on function public.my_access_portfolio() to authenticated, service_role;
grant execute on function public.my_finance_portfolio() to authenticated, service_role;
grant execute on function public.my_admin_portfolio() to authenticated, service_role;
grant execute on function public.my_accessible_association_ids() to authenticated, service_role;
grant execute on function public.my_managed_association_ids() to authenticated, service_role;

-- 2. The rewrite ------------------------------------------------------------

create or replace function pg_temp.rls_hoist(expr text)
returns text
language plpgsql
as $$
declare
  e text := expr;
  fn record;
  col constant text := '([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)';
  pre constant text := '(?<![A-Za-z0-9_."])(?:public\.)?';
begin
  if e is null then
    return null;
  end if;

  -- Zero-argument scalar helpers that are not already in a subquery.
  for fn in
    select n.nspname, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'auth')
       and p.pronargs = 0 and not p.proretset and p.prokind = 'f'
       and p.provolatile in ('s', 'i')
     order by length(p.proname) desc
  loop
    if fn.nspname = 'auth' then
      e := regexp_replace(e, '(?<!SELECT )(?<![A-Za-z0-9_."])auth\.' || fn.proname || '\(\)',
                          '( SELECT auth.' || fn.proname || '() AS ' || fn.proname || ')', 'g');
    else
      e := regexp_replace(e, '(?<!SELECT )(?<!SELECT public\.)' || pre || fn.proname || '\(\)',
                          '( SELECT public.' || fn.proname || '() AS ' || fn.proname || ')', 'g');
    end if;
  end loop;

  e := regexp_replace(e, '(?<!SELECT )(?<!SELECT public\.)' || pre || 'operator_may_write\((true|false)\)',
                      '( SELECT public.operator_may_write(\1) AS operator_may_write)', 'g');

  e := regexp_replace(e, pre || 'can_access_portfolio\(' || col || '\)',
                      '(\1 = ( SELECT public.my_access_portfolio() AS my_access_portfolio) OR (( SELECT public.is_platform_operator() AS is_platform_operator) AND \1 IS NOT NULL))', 'g');
  e := regexp_replace(e, pre || 'can_manage_finance\(' || col || '\)',
                      '(\1 = ( SELECT public.my_finance_portfolio() AS my_finance_portfolio) OR (( SELECT public.is_platform_operator() AS is_platform_operator) AND \1 IS NOT NULL))', 'g');
  e := regexp_replace(e, pre || 'can_admin_portfolio\(' || col || '\)',
                      '(\1 = ( SELECT public.my_admin_portfolio() AS my_admin_portfolio) OR (( SELECT public.is_platform_operator_safe() AS is_platform_operator_safe) AND \1 IS NOT NULL))', 'g');
  e := regexp_replace(e, pre || 'can_access_association\(' || col || '\)',
                      '(\1 IN ( SELECT public.my_accessible_association_ids() AS my_accessible_association_ids))', 'g');
  e := regexp_replace(e, pre || 'can_view_association_row\(' || col || '\)',
                      '((( SELECT public.manager_is_scoped() AS manager_is_scoped) IS NOT TRUE) OR \1 IS NULL OR (\1 IN ( SELECT public.my_managed_association_ids() AS my_managed_association_ids)))', 'g');
  return e;
end
$$;

do $$
declare
  pol record;
  new_qual text;
  new_check text;
  changed int := 0;
begin
  for pol in
    select p.schemaname, p.tablename, p.policyname, p.qual, p.with_check
      from pg_policies p
     where p.schemaname = 'public'
  loop
    new_qual := pg_temp.rls_hoist(pol.qual);
    new_check := pg_temp.rls_hoist(pol.with_check);
    continue when new_qual is not distinct from pol.qual
              and new_check is not distinct from pol.with_check;
    execute format('alter policy %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename)
         || coalesce(' using (' || new_qual || ')', '')
         || coalesce(' with check (' || new_check || ')', '');
    changed := changed + 1;
  end loop;
  raise notice 'rls_checks_once_per_query: % policies rewritten', changed;
end
$$;
