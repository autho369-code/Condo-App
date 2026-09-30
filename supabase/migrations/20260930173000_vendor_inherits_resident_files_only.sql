-- Review fix: a vendor inherited EVERY request-level file on requests behind
-- their work orders, including files staff attached to the request itself.
-- Vendors now inherit only the resident's own uploads there; files on their
-- own work order are unchanged.
drop policy if exists maintenance_attachments_vendor_read on public.maintenance_attachments;
create policy maintenance_attachments_vendor_read on public.maintenance_attachments
  for select to authenticated
  using (
    public.current_vendor_id() is not null
    and exists (select 1 from public.work_orders w
                 where w.vendor_id = public.current_vendor_id()
                   and w.archived_at is null
                   -- Columns are table-qualified: work_orders also has a
                   -- service_request_id, which an unqualified name would bind to.
                   and (w.id = maintenance_attachments.work_order_id
                        or (maintenance_attachments.work_order_id is null
                            and maintenance_attachments.service_request_id is not null
                            and maintenance_attachments.uploader_role = 'resident'
                            and w.service_request_id = maintenance_attachments.service_request_id)))
  );
