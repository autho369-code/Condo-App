-- Vendor portal hardening (additive, idempotent; no drops).
--
-- 1. One-time form tokens for vendors. The vendor work-order "Post an update"
--    form now claims a public.form_submissions token (lib/forms/submission.ts)
--    so a double click or a resent form can't log the same update / status
--    change twice. form_submissions only let staff and owners insert, so
--    vendors need their own narrowly scoped insert policy.
--    APPLY BEFORE DEPLOYING the app change, or vendor updates fail with an
--    RLS error on form_submissions.
--
-- 2. Vendors could DELETE inspection findings (inspection_items_vendor_rw is
--    FOR ALL), erasing evidence from inspections assigned to them. Findings
--    are the audit record; only staff may remove them. Vendors keep
--    select/insert/update through the existing policy.
--
-- 3. Access & site notes (association_vendor_private.maintenance_notes: gate
--    codes, lockbox and entry instructions) stayed readable by a vendor
--    forever once they had ANY work order at the property, including
--    cancelled, closed and archived ones. Limit them to properties where the
--    vendor has a live job (same "closed" set the attachment upload uses).

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'form_submissions'
       and policyname = 'form_submissions_vendor_insert'
  ) then
    create policy form_submissions_vendor_insert on public.form_submissions
      for insert to authenticated
      with check (
        created_by = (select auth.uid())
        and kind = 'vendor_work_order_update'
        and public.current_vendor_id() is not null
      );
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'inspection_items'
       and policyname = 'inspection_items_staff_delete'
  ) then
    create policy inspection_items_staff_delete on public.inspection_items
      as restrictive
      for delete to authenticated
      using (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator());
  end if;

  if exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'association_vendor_private'
       and policyname = 'association_vendor_private_vendor_read'
  ) then
    alter policy association_vendor_private_vendor_read on public.association_vendor_private
      using (
        public.current_vendor_id() is not null
        and association_id in (
          select wo.association_id
            from public.work_orders wo
           where wo.vendor_id = public.current_vendor_id()
             and wo.association_id is not null
             and wo.archived_at is null
             and wo.status::text not in ('completed', 'closed', 'cancelled', 'billed')
        )
      );
  end if;
end $$;
