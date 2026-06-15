-- FIX 2: vendors can only SELECT/UPDATE vendor_compliance; first-time entry (no existing row)
-- is blocked because there is no INSERT policy. Add a self-scoped INSERT policy so the
-- upsert in app/vendor/compliance/page.tsx succeeds for vendors with no row yet.
create policy "vendor_compliance_self_insert"
  on public.vendor_compliance
  for insert
  to authenticated
  with check (vendor_id = current_vendor_id());
