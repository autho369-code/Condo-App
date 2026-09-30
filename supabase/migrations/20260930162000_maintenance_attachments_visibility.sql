-- Review fix: work-order files also carry the service_request_id, so the
-- "can see the request" arm exposed staff-only work-order files (vendor
-- quotes, invoices) to anyone who could see the request.
--   * the request arm now covers only files attached to the request itself;
--   * work-order files follow the work order;
--   * files STAFF added (to a request or a work order) are internal: residents
--     and tenants see their own uploads and vendor before/after photos, never
--     staff quotes, invoices or notes. Staff, board and the assigned vendor
--     see everything their parent-record access allows.
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
    and (maintenance_attachments.uploader_role <> 'staff'
         or public.is_any_staff() or public.is_company_admin() or public.is_platform_operator()
         or public.is_board_user() or public.current_vendor_id() is not null)
  );
