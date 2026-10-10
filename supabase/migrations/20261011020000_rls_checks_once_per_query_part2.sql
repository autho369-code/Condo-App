-- Speed, part 2 of 20261011010000_rls_checks_once_per_query.
--
-- 1. The part-1 comparisons "x = ( SELECT my_access_portfolio() )" give
--    null, not false, for a caller with no portfolio (owners, vendors).
--    In "<that> AND can_read_gl(id)" a null left side makes Postgres run
--    the right side on every row anyway (gl_accounts: 130 ms for a vendor
--    who sees nothing). COALESCE(.., false) gives the same RLS answer and
--    lets the AND stop early. Same for "x IN ( SELECT my_accessible_association_ids() )".
-- 2. Five more helpers that take a row value get a once-per-query form:
--      can_read_gl(x)              -> gl_read_all() or x in my_readable_gl_ids()
--      can_access_unit(x)          -> x in my_accessible_unit_ids()
--      can_manage_association(x)   -> x in my_manageable_association_ids()
--      can_edit_association_mvp(x) -> (operator and x is not null) or x in my_editable_association_ids()
--      can_write_vendor_row(x)     -> x is not null or not scoped or company admin (inlined)
--    The originals stay for functions, triggers and RPCs.
--
-- Checked before applying with scripts/sql/rls-hoist-equivalence.sql
-- (every changed policy x every caller, plus each helper over every id).

create or replace function public.gl_read_all()
returns boolean
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
begin
  -- The part of can_read_gl() that does not depend on the account.
  return (select public.is_platform_operator()
              or public.is_company_admin()
              or public.is_finance_staff()
              or public.is_full_access_staff());
end
$$;

create or replace function public.my_readable_gl_ids()
returns setof uuid
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
begin
  -- GL accounts the caller's role is given read or full access to.
  return query
  select grp.gl_account_id
    from public.profiles p
    join public.gl_account_role_permissions grp on grp.role_id = p.role_id
   where p.id = auth.uid()
     and grp.permission in ('read', 'full')
     and grp.gl_account_id is not null;
end
$$;

create or replace function public.my_accessible_unit_ids()
returns setof uuid
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
begin
  -- Every unit can_access_unit() lets the caller see.
  return query
  select u.id
    from public.units u
    join public.buildings b on b.id = u.building_id
   where b.association_id in (select public.my_accessible_association_ids());
end
$$;

create or replace function public.my_manageable_association_ids()
returns setof uuid
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
begin
  return query
  select a.id from public.associations a where public.can_manage_association(a.id);
end
$$;

create or replace function public.my_editable_association_ids()
returns setof uuid
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
begin
  return query
  select a.id from public.associations a where public.can_edit_association_mvp(a.id);
end
$$;

revoke all on function public.gl_read_all() from public, anon;
revoke all on function public.my_readable_gl_ids() from public, anon;
revoke all on function public.my_accessible_unit_ids() from public, anon;
revoke all on function public.my_manageable_association_ids() from public, anon;
revoke all on function public.my_editable_association_ids() from public, anon;
grant execute on function public.gl_read_all() to authenticated, service_role;
grant execute on function public.my_readable_gl_ids() to authenticated, service_role;
grant execute on function public.my_accessible_unit_ids() to authenticated, service_role;
grant execute on function public.my_manageable_association_ids() to authenticated, service_role;
grant execute on function public.my_editable_association_ids() to authenticated, service_role;

create or replace function pg_temp.rls_hoist2(expr text)
returns text
language plpgsql
as $$
declare
  e text := expr;
  col constant text := '([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)';
  pre constant text := '(?<![A-Za-z0-9_."])(?:public\.)?';
begin
  if e is null then
    return null;
  end if;

  -- 1. Part-1 forms, as Postgres prints them, never null.
  e := regexp_replace(e,
    '(?<!COALESCE)\(' || col || ' = \( SELECT (?:public\.)?(my_access_portfolio|my_finance_portfolio|my_admin_portfolio)\(\) AS \2\)\)',
    'COALESCE((\1 = ( SELECT public.\2() AS \2)), false)', 'g');
  e := regexp_replace(e,
    '(?<!COALESCE)\(' || col || ' IN \( SELECT (?:public\.)?my_accessible_association_ids\(\) AS my_accessible_association_ids\)\)',
    'COALESCE((\1 IN ( SELECT public.my_accessible_association_ids() AS my_accessible_association_ids)), false)', 'g');

  -- 2. More helpers.
  e := regexp_replace(e, pre || 'can_read_gl\(' || col || '\)',
    '(( SELECT public.gl_read_all() AS gl_read_all) OR COALESCE((\1 IN ( SELECT public.my_readable_gl_ids() AS my_readable_gl_ids)), false))', 'g');
  e := regexp_replace(e, pre || 'can_access_unit\(' || col || '\)',
    'COALESCE((\1 IN ( SELECT public.my_accessible_unit_ids() AS my_accessible_unit_ids)), false)', 'g');
  e := regexp_replace(e, pre || 'can_manage_association\(' || col || '\)',
    'COALESCE((\1 IN ( SELECT public.my_manageable_association_ids() AS my_manageable_association_ids)), false)', 'g');
  e := regexp_replace(e, pre || 'can_edit_association_mvp\(' || col || '\)',
    '((( SELECT public.is_platform_operator() AS is_platform_operator) AND \1 IS NOT NULL) OR COALESCE((\1 IN ( SELECT public.my_editable_association_ids() AS my_editable_association_ids)), false))', 'g');
  e := regexp_replace(e, pre || 'can_write_vendor_row\(' || col || '\)',
    '(\1 IS NOT NULL OR (NOT ( SELECT public.manager_is_scoped() AS manager_is_scoped)) OR ( SELECT public.is_company_admin() AS is_company_admin))', 'g');
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
    new_qual := pg_temp.rls_hoist2(pol.qual);
    new_check := pg_temp.rls_hoist2(pol.with_check);
    continue when new_qual is not distinct from pol.qual
              and new_check is not distinct from pol.with_check;
    execute format('alter policy %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename)
         || coalesce(' using (' || new_qual || ')', '')
         || coalesce(' with check (' || new_check || ')', '');
    changed := changed + 1;
  end loop;
  raise notice 'rls_checks_once_per_query_part2: % policies rewritten', changed;
end
$$;
