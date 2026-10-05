-- Vendor isolation on reassigned work orders. The vendor read policies keyed
-- only on the work order's CURRENT vendor, so after a manager reassigned a job
-- from vendor A to vendor B, B could read A's activity notes, A's discussion
-- messages and A's uploaded quotes/invoices. A vendor now sees staff- and
-- resident-written rows on its jobs as before, but only its OWN vendor-written
-- rows. Approval requests (board deliberations, votes) are not vendor data and
-- are no longer vendor-readable; the vendor portal never reads them.
alter policy wo_updates_vendor_read on public.work_order_updates
  using (
    (not staff_only)
    and work_order_id in (select wo.id from public.work_orders wo where wo.vendor_id = current_vendor_id())
    and (
      created_by = (select auth.uid())
      or created_by is null
      or not exists (select 1 from public.vendors v where v.auth_user_id = work_order_updates.created_by)
    )
  );

alter policy wo_msg_vendor_select on public.work_order_messages
  using (
    exists (
      select 1 from public.work_orders wo
       where wo.id = work_order_messages.work_order_id and wo.vendor_id = current_vendor_id())
    and (author_role is distinct from 'vendor' or author_id = (select auth.uid()))
  );

alter policy maintenance_attachments_vendor_read on public.maintenance_attachments
  using (
    current_vendor_id() is not null
    and (uploader_role <> 'vendor' or uploaded_by = (select auth.uid()))
    and exists (
      select 1 from public.work_orders w
       where w.vendor_id = current_vendor_id()
         and w.archived_at is null
         and (
           w.id = maintenance_attachments.work_order_id
           or (maintenance_attachments.work_order_id is null
               and maintenance_attachments.service_request_id is not null
               and maintenance_attachments.uploader_role = 'resident'
               and w.service_request_id = maintenance_attachments.service_request_id)))
  );

alter policy approval_requests_vendor_read on public.approval_requests
  using (false);
