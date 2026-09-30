-- Review fix: residents and tenants saw every non-staff upload on their
-- work orders, including a vendor's quote or invoice PDF. They now see only
-- their own uploads and vendor PHOTOS (before/after images). Vendor documents
-- and all staff files stay with staff, the board and the assigned vendor.
-- content_type comes from the stored object's metadata (set server-side when
-- the upload is recorded), not from the client.
drop policy if exists maintenance_attachments_parent_read on public.maintenance_attachments;
create policy maintenance_attachments_parent_read on public.maintenance_attachments
  for select to authenticated
  using (
    (
      (maintenance_attachments.work_order_id is null
       and maintenance_attachments.service_request_id is not null
       and exists (select 1 from public.service_requests s where s.id = maintenance_attachments.service_request_id))
      or (maintenance_attachments.work_order_id is not null
          and exists (select 1 from public.work_orders w where w.id = maintenance_attachments.work_order_id))
    )
    and (maintenance_attachments.uploader_role = 'resident'
         or (maintenance_attachments.uploader_role = 'vendor' and coalesce(maintenance_attachments.content_type, '') like 'image/%')
         or public.is_any_staff() or public.is_company_admin() or public.is_platform_operator()
         or public.is_board_user() or public.current_vendor_id() is not null)
  );
