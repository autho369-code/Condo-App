-- Performance advisor sweep (2026-10-01).
--
-- 1. auth_rls_initplan: 98 policies called auth.uid() / auth.jwt() /
--    auth.role() / auth.email() / current_setting('request.jwt.claims')
--    directly, so Postgres re-evaluated them for EVERY row scanned. Wrapping
--    each call as (select auth.uid()) lets the planner evaluate it once per
--    query (an initPlan). Same result, computed once. ALTER POLICY keeps each
--    policy's name, command, roles and permissive/restrictive mode.
do $$
declare
  p record;
  v_using text;
  v_check text;
  wrap constant text := '(?<!SELECT )(auth\.(uid|jwt|role|email)\(\)|current_setting\(''request\.jwt\.claims''::text, true\))';
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (coalesce(qual, '') ~ wrap or coalesce(with_check, '') ~ wrap)
  loop
    v_using := case when p.qual is not null then regexp_replace(p.qual, wrap, '(select \1)', 'g') end;
    v_check := case when p.with_check is not null then regexp_replace(p.with_check, wrap, '(select \1)', 'g') end;
    if v_using is not null and v_check is not null then
      execute format('alter policy %I on %I.%I using (%s) with check (%s)', p.policyname, p.schemaname, p.tablename, v_using, v_check);
    elsif v_using is not null then
      execute format('alter policy %I on %I.%I using (%s)', p.policyname, p.schemaname, p.tablename, v_using);
    else
      execute format('alter policy %I on %I.%I with check (%s)', p.policyname, p.schemaname, p.tablename, v_check);
    end if;
  end loop;
end $$;

-- 2. duplicate_index: six pairs of identical indexes (none backs a
--    constraint). Keep one of each.
drop index if exists public.buildings_active_idx;          -- = buildings_association_idx
drop index if exists public.idx_agreements_owner;          -- = idx_mgmt_agreements_owner
drop index if exists public.idx_tag_assignments_entity;    -- = tag_assignments_entity_idx
drop index if exists public.idx_user_invitations_email;    -- = idx_user_invitations_email_lower
drop index if exists public.tenancies_active_idx;          -- = tenancies_unit_idx
drop index if exists public.units_active_idx;              -- = units_building_idx
