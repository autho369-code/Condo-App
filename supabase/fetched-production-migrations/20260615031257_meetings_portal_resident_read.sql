create policy meetings_portal_resident_read
  on public.meetings
  for select
  to authenticated
  using (
    is_portal_resident()
    and association_id in (select current_resident_association_ids())
    and minutes is not null
    and status = 'completed'
    and archived_at is null
  );;
