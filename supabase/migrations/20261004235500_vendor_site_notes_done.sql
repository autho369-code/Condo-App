-- Codex review of #193: a vendor marking a job "Work complete" sets it to
-- 'done', which 20261004230000 did not treat as finished, so the vendor kept
-- reading the property's access notes (gate and lockbox codes) until staff
-- moved the order on. Count 'done' as finished too.
alter policy association_vendor_private_vendor_read on public.association_vendor_private
  using (
    public.current_vendor_id() is not null
    and association_id in (
      select wo.association_id
        from public.work_orders wo
       where wo.vendor_id = public.current_vendor_id()
         and wo.association_id is not null
         and wo.archived_at is null
         and wo.status::text not in ('done', 'completed', 'closed', 'cancelled', 'billed')
    )
  );
