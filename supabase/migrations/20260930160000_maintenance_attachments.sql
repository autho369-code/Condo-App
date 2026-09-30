-- Photos and files on service requests and work orders.
--
-- Residents attach photos of the problem to their request, staff add quotes
-- and invoices to work orders, vendors add before/after photos. Files live in
-- the private association-documents bucket under maintenance/<parent id>/…
-- and are served through short-lived signed URLs.
--
-- Rows are written only by server code (service role) after it has checked
-- the caller can see the parent record, so there are no INSERT/UPDATE/DELETE
-- policies. Reading follows the parent: anyone whose RLS lets them see the
-- service request or work order sees its files; the assigned vendor also sees
-- the resident's photos on the request behind their work order.
create table if not exists public.maintenance_attachments (
  id                 uuid primary key default gen_random_uuid(),
  portfolio_id       uuid not null references public.portfolios(id) on delete cascade,
  association_id     uuid references public.associations(id) on delete cascade,
  service_request_id uuid references public.service_requests(id) on delete cascade,
  work_order_id      uuid references public.work_orders(id) on delete cascade,
  file_name          text not null check (length(file_name) between 1 and 255),
  file_path          text not null unique,
  content_type       text,
  size_bytes         bigint check (size_bytes is null or size_bytes >= 0),
  uploaded_by        uuid,
  uploader_role      text not null check (uploader_role in ('staff', 'resident', 'vendor')),
  created_at         timestamptz not null default now(),
  check (service_request_id is not null or work_order_id is not null)
);
create index if not exists maintenance_attachments_sr_idx on public.maintenance_attachments (service_request_id, created_at);
create index if not exists maintenance_attachments_wo_idx on public.maintenance_attachments (work_order_id, created_at);

alter table public.maintenance_attachments enable row level security;

drop policy if exists maintenance_attachments_parent_read on public.maintenance_attachments;
create policy maintenance_attachments_parent_read on public.maintenance_attachments
  for select to authenticated
  using (
    (maintenance_attachments.service_request_id is not null
     and exists (select 1 from public.service_requests s where s.id = maintenance_attachments.service_request_id))
    or (maintenance_attachments.work_order_id is not null
        and exists (select 1 from public.work_orders w where w.id = maintenance_attachments.work_order_id))
  );

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
                        or (maintenance_attachments.service_request_id is not null
                            and w.service_request_id = maintenance_attachments.service_request_id)))
  );

drop policy if exists mgr_assoc_scope on public.maintenance_attachments;
create policy mgr_assoc_scope on public.maintenance_attachments as restrictive for all to authenticated
  using (public.can_view_association_row(association_id));

revoke insert, update, delete on public.maintenance_attachments from anon, authenticated;
grant select on public.maintenance_attachments to authenticated;
