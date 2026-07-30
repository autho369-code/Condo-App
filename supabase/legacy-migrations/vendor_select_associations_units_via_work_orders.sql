-- FIX 5: vendors have no SELECT policy on associations/units, so embedded
-- associations(name)/units(unit_number) in the vendor portal return null ("—" everywhere).
-- Grant vendors SELECT on exactly the associations and units that appear on their own
-- work orders (vendor_id = current_vendor_id()).
create policy "associations_vendor_read"
  on public.associations
  for select
  to authenticated
  using (
    current_vendor_id() is not null
    and id in (
      select wo.association_id from public.work_orders wo
      where wo.vendor_id = current_vendor_id()
        and wo.association_id is not null
    )
  );

create policy "units_vendor_read"
  on public.units
  for select
  to authenticated
  using (
    current_vendor_id() is not null
    and id in (
      select wo.unit_id from public.work_orders wo
      where wo.vendor_id = current_vendor_id()
        and wo.unit_id is not null
    )
  );
