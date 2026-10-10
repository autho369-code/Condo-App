-- Equivalence check for 20261011010000_rls_checks_once_per_query.sql.
--
-- Run BEFORE the migration is applied, as one statement batch:
--   1. the line below that saves the current policies,
--   2. the whole migration file,
--   3. the DO block below.
-- The DO block always ends with an exception, so everything (the migration,
-- the test fixtures) is rolled back. The exception text is the result:
-- "RLS HOIST OK" or "RLS HOIST MISMATCH" with the first differences.
--
-- For every policy the migration changed and every test caller, it counts
-- rows of the policy's table where the old and new expression disagree
-- about letting the row through (null counts as "no", as in RLS). It also
-- compares each split helper with its rewrite over every portfolio and
-- association id, a random id and null.

create temp table rls_hoist_old on commit drop as
  select schemaname, tablename, policyname, qual, with_check from pg_policies where schemaname = 'public';

-- <the migration goes here>

do $$
declare
  callers uuid[];
  who uuid;
  pol record;
  part text;
  old_e text;
  new_e text;
  diffs bigint;
  checked int := 0;
  problems text[] := '{}';
  x uuid;
  a boolean;
  b boolean;
  probe_assoc uuid := (select id from public.associations order by created_at limit 1);
  probe_pf uuid := (select portfolio_id from public.associations order by created_at limit 1);
begin
  -- Fixtures (rolled back): one scoped manager, one support operator.
  insert into public.association_managers (user_id, association_id, portfolio_id)
  values ('3e703092-2400-40b8-b904-e2990f2f6325', probe_assoc, probe_pf);
  insert into public.platform_operators (auth_user_id, email, role)
  values ('8b510e8c-6cd9-40d4-b50a-23b0289ac51e', 'support-fixture@example.invalid', 'support');

  callers := array(
    select id from public.profiles where disabled_at is null
    union select auth_user_id from public.platform_operators
    union select gen_random_uuid()
  ) || array[null::uuid];

  foreach who in array callers loop
    perform set_config('request.jwt.claims',
      case when who is null then '' else json_build_object('sub', who, 'role', 'authenticated')::text end, true);
    perform set_config('request.jwt.claim.sub', coalesce(who::text, ''), true);

    -- Whole policies on the real rows.
    for pol in
      select o.tablename, o.policyname, o.qual oq, o.with_check oc, n.qual nq, n.with_check nc
        from rls_hoist_old o
        join pg_policies n on n.schemaname = o.schemaname and n.tablename = o.tablename and n.policyname = o.policyname
       where o.qual is distinct from n.qual or o.with_check is distinct from n.with_check
    loop
      foreach part in array array['using', 'check'] loop
        old_e := case part when 'using' then pol.oq else pol.oc end;
        new_e := case part when 'using' then pol.nq else pol.nc end;
        continue when old_e is null and new_e is null;
        execute format('select count(*) from public.%I where coalesce((%s), false) is distinct from coalesce((%s), false)',
                       pol.tablename, old_e, new_e) into diffs;
        checked := checked + 1;
        if diffs > 0 then
          problems := problems || format('%s.%s %s caller %s: %s rows', pol.tablename, pol.policyname, part, who, diffs);
        end if;
      end loop;
    end loop;

    -- Split helpers over every id.
    for x in
      select id from public.portfolios
      union select gen_random_uuid()
      union select null::uuid
    loop
      a := coalesce(public.can_access_portfolio(x), false);
      b := coalesce((x = (select public.my_access_portfolio()) or ((select public.is_platform_operator()) and x is not null)), false);
      if a <> b then problems := problems || format('can_access_portfolio(%s) caller %s', x, who); end if;
      a := coalesce(public.can_manage_finance(x), false);
      b := coalesce((x = (select public.my_finance_portfolio()) or ((select public.is_platform_operator()) and x is not null)), false);
      if a <> b then problems := problems || format('can_manage_finance(%s) caller %s', x, who); end if;
      a := coalesce(public.can_admin_portfolio(x), false);
      b := coalesce((x = (select public.my_admin_portfolio()) or ((select public.is_platform_operator_safe()) and x is not null)), false);
      if a <> b then problems := problems || format('can_admin_portfolio(%s) caller %s', x, who); end if;
      checked := checked + 3;
    end loop;
    for x in
      select id from public.associations
      union select gen_random_uuid()
      union select null::uuid
    loop
      a := coalesce(public.can_access_association(x), false);
      b := coalesce(x in (select public.my_accessible_association_ids()), false);
      if a <> b then problems := problems || format('can_access_association(%s) caller %s', x, who); end if;
      a := coalesce(public.can_view_association_row(x), false);
      b := coalesce(((select public.manager_is_scoped()) is not true) or x is null
                    or x in (select public.my_managed_association_ids()), false);
      if a <> b then problems := problems || format('can_view_association_row(%s) caller %s', x, who); end if;
      checked := checked + 2;
    end loop;
  end loop;

  if cardinality(problems) = 0 then
    raise exception 'RLS HOIST OK: % checks, % callers, % policies changed, rolled back',
      checked, cardinality(callers),
      (select count(*) from rls_hoist_old o join pg_policies n using (schemaname, tablename, policyname)
        where o.qual is distinct from n.qual or o.with_check is distinct from n.with_check);
  else
    raise exception 'RLS HOIST MISMATCH (% of % checks): %', cardinality(problems), checked,
      array_to_string(problems[1:20], ' | ');
  end if;
end
$$;
