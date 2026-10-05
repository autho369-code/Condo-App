-- Staff writes must keep association_id inside the caller's own company.
--
-- The permissive staff policies on these tables only check portfolio_id
-- (can_access_portfolio(portfolio_id)). A manager could therefore insert a row
-- carrying their OWN portfolio_id and ANOTHER company's association_id:
--   * communications_log announcements are then readable by that
--     association's owners/tenants (communications_resident_read /
--     communications_tenant_read only check association_id);
--   * calendar_events are readable by that association's residents and board,
--     and the SECURITY DEFINER notify triggers email/text its maintenance
--     contact;
--   * tenants / sms_conversations rows get attached to a foreign association.
-- (The restrictive mgr_assoc_scope policy only narrows *scoped* managers and
-- returns true for everyone else.)
--
-- Additive, idempotent: a RESTRICTIVE policy per table that applies to staff
-- and company admins only (platform operators, residents, board, tenants,
-- vendors and the service role are unaffected).

do $$
declare
  t text;
begin
  foreach t in array array['communications_log', 'calendar_events', 'tenants', 'sms_conversations']
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = 'staff_association_in_company_insert'
    ) then
      execute format($p$
        create policy staff_association_in_company_insert on public.%I
          as restrictive for insert to authenticated
          with check (
            association_id is null
            or public.is_platform_operator()
            or not (public.is_any_staff() or public.is_company_admin())
            or public.can_access_association(association_id)
          )
      $p$, t);
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = 'staff_association_in_company_update'
    ) then
      execute format($p$
        create policy staff_association_in_company_update on public.%I
          as restrictive for update to authenticated
          using (true)
          with check (
            association_id is null
            or public.is_platform_operator()
            or not (public.is_any_staff() or public.is_company_admin())
            or public.can_access_association(association_id)
          )
      $p$, t);
    end if;
  end loop;
end
$$;
