-- Row-level security policies are for signed-in users only, and shared
-- (platform) rows are the ones with no company.
--
-- 1. maintenance_templates had "Anyone can read templates" (FOR SELECT USING
--    (true), roles {public}) from the baseline. Because it is permissive, it
--    let anyone holding the public API key, signed out or from another
--    company, read every template, including any a company makes for itself.
--    On 2026-10-12 the 65 templates were all Portier369's shared starter
--    templates (20 system rows with no group, 45 in the three groups with no
--    company), so nothing private had leaked. The policy is switched off here
--    (USING false) rather than dropped; dropping it is on Mirsad's cleanup
--    list in docs/TODO.md.
--
-- 2. mt_read is rewritten to cover what that policy gave staff: shared groups
--    (portfolio_id is null) for managers, matching mtg_read_system on the
--    groups (company admins never reach the maintenance pages).
--    Its is_system branch now also needs group_id is null: is_system is an
--    ordinary column staff can set on a template in their own group, which
--    would have shown that template to every company. Staff can't create a
--    template without a group (mt_write needs the group in their company).
--
-- 3. report_definitions read: same hole. report_defs_admin_all lets
--    full-access staff write rows in their own company, including
--    is_system = true, and the read policy showed every is_system row to
--    every company. Shared report definitions are the ones with no company
--    (all 162 system rows on 2026-10-12 have portfolio_id null), so the
--    is_system branch is dropped from the read policy.
--
-- 4. Every other public-schema policy written without a TO clause (roles
--    {public}: 91 more policies on 40 tables on 2026-10-12) also applied to
--    the anon role. Checked on production: each needs auth.uid() or a
--    my_/is_/can_/current_ helper, or is hard-wired to false; the only one
--    that could match a signed-out caller was mt_read (its is_system branch
--    tests a column only), handled above. They now apply to authenticated
--    only. Signed-out access goes through explicit "to anon" policies
--    (marketing_leads insert) or the service client.
--
-- The block ends by checking that no public-schema policy still applies to
-- every role.

set local lock_timeout = '5s';

do $$
begin
  if exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'maintenance_templates'
       and policyname = 'Anyone can read templates'
  ) then
    alter policy "Anyone can read templates" on public.maintenance_templates
      to authenticated
      using (false);
  end if;
end
$$;

alter policy mt_read on public.maintenance_templates
  to authenticated
  using (
    (is_system and group_id is null)
    or (select public.is_platform_operator())
    or exists (
      select 1
        from public.maintenance_template_groups g
       where g.id = maintenance_templates.group_id
         and (
           (g.portfolio_id is null and (select public.is_any_staff()))
           or coalesce(g.portfolio_id = (select public.my_access_portfolio()), false)
         )
    )
  );

alter policy report_defs_authenticated_read on public.report_definitions
  to authenticated
  using (
    portfolio_id is null
    or coalesce(portfolio_id = (select public.my_access_portfolio()), false)
    or ((select public.is_platform_operator()) and portfolio_id is not null)
  );

do $$
declare
  r record;
  n int := 0;
begin
  for r in
    select tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and roles = '{public}'::name[]
  loop
    execute format('alter policy %I on public.%I to authenticated', r.policyname, r.tablename);
    n := n + 1;
  end loop;
  raise notice 'policies moved to authenticated: %', n;

  if exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and 'public' = any (roles)
  ) then
    raise exception 'A public-schema policy still applies to every role';
  end if;
end
$$;
