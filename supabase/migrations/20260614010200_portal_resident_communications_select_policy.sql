-- Residents (owner portal) can read their own sent messages and association-wide
-- announcements. Previously communications_log had no resident SELECT policy, so
-- Message History, Announcements, and dashboard timeline messages were always blank.
drop policy if exists communications_resident_read on public.communications_log;
create policy communications_resident_read on public.communications_log
  for select
  using (
    is_portal_resident()
    and (
      sender_id = current_owner_id()
      or (
        channel = 'announcement'
        and association_id in (select current_resident_association_ids())
      )
    )
  );
