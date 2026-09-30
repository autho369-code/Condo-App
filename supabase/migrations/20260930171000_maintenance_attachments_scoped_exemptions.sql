-- Review fix: the parent-record policy exempted ANY vendor login and ANY board
-- login from the resident file restrictions. A person who is also a resident
-- (or a board member elsewhere) could therefore read staff files and vendor
-- documents on their own unit's requests. Vendors are covered by their own
-- policy (only work orders assigned to them); the board exemption now applies
-- only inside the associations they serve on.
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
         or (public.is_board_user()
             and maintenance_attachments.association_id in (select public.current_board_association_ids())))
  );
