-- Manager scope on rows that have no association.
--
-- mgr_assoc_scope let a manager assigned to some associations see every row
-- whose association_id is null. For four tables that left other
-- associations' data reachable (all four are empty on production, so no
-- backfill is needed):
--   payment_methods          owner, last 4, processor token
--   physical_mail_deliveries addresses, letter HTML
--   payable_checks           vendor check amounts
--   automation_flows         company-wide flows were editable by a scoped
--                            manager
-- Now, for a scoped manager:
--   payment_methods, physical_mail_deliveries: a row without an association
--     is visible only through its owner (an occupancy in one of the
--     manager's associations);
--   payable_checks: through its bill (bill_id is required; the bill's own
--     policies decide);
--   automation_flows: company-wide flows stay readable, but only an unscoped
--     manager (or a company admin) can create, change or delete one.
-- Unscoped callers pass the first branch as before. Policies are altered in
-- place or added as restrictive (no DROP).

alter policy mgr_assoc_scope on public.payment_methods
  using (((select public.manager_is_scoped()) is not true)
         or association_id in (select public.my_managed_association_ids())
         or (association_id is null and owner_id in (select rls_private.my_managed_owner_ids())))
  with check (((select public.manager_is_scoped()) is not true)
         or association_id in (select public.my_managed_association_ids())
         or (association_id is null and owner_id in (select rls_private.my_managed_owner_ids())));

alter policy mgr_assoc_scope on public.physical_mail_deliveries
  using (((select public.manager_is_scoped()) is not true)
         or association_id in (select public.my_managed_association_ids())
         or (association_id is null and owner_id in (select rls_private.my_managed_owner_ids())))
  with check (((select public.manager_is_scoped()) is not true)
         or association_id in (select public.my_managed_association_ids())
         or (association_id is null and owner_id in (select rls_private.my_managed_owner_ids())));

alter policy mgr_assoc_scope on public.payable_checks
  using (((select public.manager_is_scoped()) is not true)
         or association_id in (select public.my_managed_association_ids())
         or (association_id is null and bill_id in (select b.id from public.payable_bills b)))
  with check (((select public.manager_is_scoped()) is not true)
         or association_id in (select public.my_managed_association_ids())
         or (association_id is null and bill_id in (select b.id from public.payable_bills b)));

-- automation_flows: reads unchanged (company-wide flows visible); writes of
-- company-wide flows need an unscoped caller.
alter policy mgr_assoc_scope on public.automation_flows
  using (((select public.manager_is_scoped()) is not true)
         or association_id is null
         or association_id in (select public.my_managed_association_ids()))
  with check (((select public.manager_is_scoped()) is not true)
         or association_id in (select public.my_managed_association_ids()));

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'automation_flows' and policyname = 'mgr_assoc_scope_update') then
    create policy mgr_assoc_scope_update on public.automation_flows as restrictive for update to authenticated
      using (((select public.manager_is_scoped()) is not true)
             or association_id in (select public.my_managed_association_ids()))
      with check (((select public.manager_is_scoped()) is not true)
             or association_id in (select public.my_managed_association_ids()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'automation_flows' and policyname = 'mgr_assoc_scope_delete') then
    create policy mgr_assoc_scope_delete on public.automation_flows as restrictive for delete to authenticated
      using (((select public.manager_is_scoped()) is not true)
             or association_id in (select public.my_managed_association_ids()));
  end if;
end
$$;
