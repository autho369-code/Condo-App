-- Board and owners must see the SAME association calendar. Applied via MCP 2026-07-14.
-- Residents previously had zero read access to maintenance_tasks and could
-- not see in_progress meetings — items the board calendar showed.

drop policy if exists maintenance_tasks_resident_read on public.maintenance_tasks;
create policy maintenance_tasks_resident_read on public.maintenance_tasks
  for select using (
    is_portal_resident()
    and association_id in (select current_resident_association_ids())
  );

drop policy if exists meetings_portal_resident_read on public.meetings;
create policy meetings_portal_resident_read on public.meetings
  for select using (
    is_portal_resident()
    and association_id in (select current_resident_association_ids())
    and archived_at is null
    and (
      status in ('scheduled','in_progress')
      or (status = 'completed' and minutes is not null)
    )
  );
