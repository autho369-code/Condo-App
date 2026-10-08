-- Speed, part 2: the set-returning security helpers (current_board_
-- association_ids, current_resident_association_ids, current_resident_unit_
-- ids, current_tenant_*, ...) are still SECURITY DEFINER LANGUAGE sql. Like
-- the scalar helpers fixed in 20261008050000, a SQL function called from
-- another function is re-planned on every call, so is_board_user() (which
-- calls current_board_association_ids()) cost ~1.5 ms per row and board and
-- owner pages stayed slow.
--
-- This converts each one to PL/pgSQL with its SQL body UNCHANGED:
--
--   return query <original body>;
--
-- which returns exactly the rows the SQL function returned. Arguments and
-- defaults, return type, STABLE/IMMUTABLE, SECURITY DEFINER, the SET
-- search_path clause, owner, grants and comments are all kept (CREATE OR
-- REPLACE). #variable_conflict use_column keeps SQL's rule that a column
-- wins over a same-named parameter.
--
-- Measured on production inside a rolled-back transaction (2026-10-08),
-- counting 30 tables/views as each role, before -> after: board 3.2 s ->
-- 1.75 s, owner 1.6 s -> 0.94 s, vendor 1.3 s -> 0.69 s, manager 0.56 s ->
-- 0.33 s; row counts identical for every role and every table, and each
-- converted helper called directly as every role without error.
--
-- Scope: only the identity helpers that return SETOF uuid (7 at the time
-- of writing: current_board_association_ids, current_resident_association_
-- ids, current_resident_unit_ids, current_tenant_association_ids,
-- current_tenant_ids, current_tenant_unit_ids, current_vendor_bill_
-- association_ids). Table-returning functions (tenant_branding, report and
-- fee functions) are left as they are: RETURN QUERY is stricter about
-- column types than a SQL function, and they are not the slow path.
-- Re-running is a no-op (converted functions are no longer LANGUAGE sql).
-- Additive only: no DROP, no DELETE.

do $mig$
declare
  f record;
  body text;
  cfg text;
  done int := 0;
  helpers text[] := array[
    'current_board_association_ids', 'current_resident_association_ids',
    'current_resident_unit_ids', 'current_tenant_association_ids',
    'current_tenant_ids', 'current_tenant_unit_ids',
    'current_vendor_bill_association_ids'
  ];
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
       and p.proretset
       and p.prokind = 'f'
       and pg_catalog.pg_get_function_result(p.oid) = 'SETOF uuid'
       and p.proname = any(helpers)
  loop
    done := done + 1;
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
      E'#variable_conflict use_column\nbegin\n  return query\n' || body || E';\nend'
    );
  end loop;
  -- All 7 on a fresh run; 0 when already converted (a re-run). Anything else
  -- means the helpers changed: stop instead of guessing.
  if done not in (0, array_length(helpers, 1)) then
    raise exception 'Expected % SETOF uuid SQL helpers, found %', array_length(helpers, 1), done;
  end if;
end
$mig$;
