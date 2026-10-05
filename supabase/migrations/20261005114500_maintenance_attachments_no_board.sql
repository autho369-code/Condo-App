-- Read-only board: a board member who is also an owner could read
-- staff-uploaded work-order attachments (quotes, invoices) through the board
-- branch of this policy. Board branch removed; everything else unchanged.
alter policy maintenance_attachments_parent_read on public.maintenance_attachments
  using (
    (
      (work_order_id is null and service_request_id is not null
        and exists (select 1 from public.service_requests s where s.id = maintenance_attachments.service_request_id))
      or (work_order_id is not null
        and exists (select 1 from public.work_orders w where w.id = maintenance_attachments.work_order_id))
    )
    and (
      uploader_role = 'resident'
      or (uploader_role = 'vendor' and coalesce(content_type, '') like 'image/%')
      or is_any_staff() or is_company_admin() or is_platform_operator()
    )
  );
