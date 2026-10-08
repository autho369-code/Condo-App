-- Speed: every security check re-planned its helper queries on every row.
--
-- The RLS helpers (is_platform_operator, can_access_portfolio,
-- can_view_association_row, is_any_staff, ...) are SECURITY DEFINER
-- LANGUAGE sql functions, and most call other helpers. When a SQL function
-- calls another SQL function, Postgres re-plans the inner function's query
-- on every call. is_current_identity_enabled() cost ~43 us called directly
-- but ~888 us nested; is_platform_operator() ~1 ms per call and
-- can_access_portfolio() ~1 ms, once per row of every table a page reads.
-- Pages built from receivable views (/charges, /command-center,
-- /accounting) hit the 8 s statement timeout and were killed at 25 s.
--
-- PL/pgSQL functions keep their query plans for the session, so this
-- converts each such helper to PL/pgSQL with its SQL body UNCHANGED:
--
--   return (select s.x from (<original body>) s(x) limit 1);
--
-- which returns the first row's first column, exactly what a SQL function
-- returning a scalar does (null when there is no row). Everything else is
-- kept: arguments and defaults, return type, STABLE/IMMUTABLE, SECURITY
-- DEFINER, the SET search_path clause, the owner and the grants (CREATE OR
-- REPLACE keeps owner, grants and comments). #variable_conflict use_column
-- keeps SQL's rule that a column wins over a same-named parameter.
--
-- Measured on production inside a rolled-back transaction (2026-10-08):
-- counting 30 tables/views as each role, before -> after:
--   manager 2.9 s -> 0.6 s, company admin 3.8 s -> 0.8 s, board 14.9 s ->
--   4.5 s, owner 7.5 s -> 1.6 s, vendor 5.8 s -> 1.2 s, operator 2.6 s ->
--   0.4 s; row counts identical for every role and every table.
--
-- Scope: public, LANGUAGE sql, SECURITY DEFINER, STABLE or IMMUTABLE,
-- scalar (not set-returning) functions; 204 at the time of writing.
-- Skipped (different shape, left as they are): app_portal_url,
-- app_ownership_bounds (OUT parameters), report_data_units_by_owner
-- (several statements). Re-running is a no-op: converted functions are no
-- longer LANGUAGE sql.
-- Additive only: no DROP, no DELETE.

do $mig$
declare
  f record;
  body text;
  cfg text;
begin
  for f in
    select p.proname,
           pg_get_function_arguments(p.oid) as args,
           pg_get_function_result(p.oid) as ret,
           p.provolatile,
           p.proconfig,
           p.prosrc
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public'
       and p.prolang = (select l.oid from pg_catalog.pg_language l where l.lanname = 'sql')
       and p.prosecdef
       and p.provolatile in ('s', 'i')
       and not p.proretset
       and p.prokind = 'f'
       and p.proname not in ('app_portal_url', 'app_ownership_bounds', 'report_data_units_by_owner')
  loop
    body := regexp_replace(f.prosrc, '[\s;]+$', '');
    if position(';' in body) > 0 then
      raise exception 'Function % has more than one statement; convert it by hand', f.proname;
    end if;
    cfg := coalesce((
      select string_agg('set ' || split_part(c, '=', 1) || ' = ' || substr(c, length(split_part(c, '=', 1)) + 2), ' ')
        from unnest(f.proconfig) c
    ), '');
    execute format(
      'create or replace function public.%I(%s) returns %s language plpgsql %s security definer %s as %L',
      f.proname, f.args, f.ret,
      case f.provolatile when 's' then 'stable' else 'immutable' end,
      cfg,
      E'#variable_conflict use_column\nbegin\n  return (select s.x from (\n' || body || E'\n  ) s(x) limit 1);\nend'
    );
  end loop;
end
$mig$;
