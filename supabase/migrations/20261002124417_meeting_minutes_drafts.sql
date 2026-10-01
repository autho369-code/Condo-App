-- Meeting minutes were saved straight onto meetings.minutes, which owners and
-- tenants can read for scheduled meetings: unapproved minutes (even notes on
-- executive-session items) were public the moment they were typed, and no
-- action ever completed a meeting. Drafts now live in a staff/board-only
-- table; publishing copies them to meetings.minutes and completes the meeting.
create table if not exists public.meeting_private (
  meeting_id uuid primary key references public.meetings(id) on delete cascade,
  minutes_draft text,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
alter table public.meeting_private enable row level security;

drop policy if exists meeting_private_staff on public.meeting_private;
create policy meeting_private_staff on public.meeting_private
  for all to authenticated
  using (exists (select 1 from public.meetings m
                  where m.id = meeting_id and public.can_edit_association_mvp(m.association_id)))
  with check (exists (select 1 from public.meetings m
                       where m.id = meeting_id and public.can_edit_association_mvp(m.association_id)));

drop policy if exists meeting_private_board_read on public.meeting_private;
create policy meeting_private_board_read on public.meeting_private
  for select to authenticated
  using (exists (select 1 from public.meetings m
                  where m.id = meeting_id and m.association_id in (select public.current_board_association_ids())));

revoke all on public.meeting_private from anon;
grant select, insert, update, delete on public.meeting_private to authenticated;

-- Minutes already on meetings that are not completed are drafts.
insert into public.meeting_private (meeting_id, minutes_draft)
select id, minutes from public.meetings where minutes is not null and status <> 'completed'
on conflict (meeting_id) do nothing;
update public.meetings set minutes = null where minutes is not null and status <> 'completed';
