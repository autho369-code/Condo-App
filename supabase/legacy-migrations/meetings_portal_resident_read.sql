-- Let owners (portal residents) read APPROVED meeting minutes for their own
-- association. Additive/permissive SELECT policy: exposes only completed,
-- non-archived meetings that actually have minutes — never drafts or other
-- associations. Applied to remote DB on 2026-06-14.
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
  );
