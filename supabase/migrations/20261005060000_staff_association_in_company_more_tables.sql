-- Same gap as 20261005040001, on the remaining staff tables that carry an
-- association_id: their permissive staff policies only check portfolio_id,
-- so a manager could save a row with their OWN portfolio_id and ANOTHER
-- company's association_id (then visible to that association's residents,
-- board or vendors, and picked up by its triggers/generators).
--
-- Additive, idempotent: one RESTRICTIVE insert and update policy per table,
-- applying to staff and company admins only (platform operators, residents,
-- board, tenants, vendors and the service role are unaffected). Existing rows
-- were checked: none carry an association from another company.

do $$
declare
  t text;
begin
  foreach t in array array[
    'approval_requests', 'automation_flows', 'income_recertifications', 'inspections',
    'purchase_orders', 'recurring_work_orders', 'service_requests', 'surveys', 'parking_spaces'
  ]
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
