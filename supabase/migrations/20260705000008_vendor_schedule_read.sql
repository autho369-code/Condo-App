-- Vendor portal Schedule: vendors can see calendar events and preventive
-- maintenance tasks that are assigned to THEM. SELECT-only.

drop policy if exists calendar_events_vendor_read on public.calendar_events;
create policy calendar_events_vendor_read on public.calendar_events
  for select to authenticated
  using (vendor_id = current_vendor_id());

drop policy if exists maintenance_tasks_vendor_read on public.maintenance_tasks;
create policy maintenance_tasks_vendor_read on public.maintenance_tasks
  for select to authenticated
  using (vendor_id = current_vendor_id());
