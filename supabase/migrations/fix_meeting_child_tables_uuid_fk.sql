-- agenda_items.meeting_id and meeting_documents.meeting_id were typed integer
-- while meetings.id is uuid, so they could never join — the board meeting detail
-- page always showed an empty agenda / no documents, and inserts couldn't match.
-- Both tables were empty (0 rows), so retype to uuid and add a real FK to
-- meetings(id). The board-read policies depend on the column, so they are dropped
-- and recreated with a clean uuid join (replacing the earlier ::text-cast
-- workaround in board_read_agenda_items_and_meeting_documents.sql).
-- Applied to remote DB 2026-06-14.

drop policy if exists agenda_items_board_read on public.agenda_items;
drop policy if exists meeting_documents_board_read on public.meeting_documents;

alter table public.agenda_items
  alter column meeting_id type uuid using null::uuid;
alter table public.agenda_items
  add constraint agenda_items_meeting_id_fkey
  foreign key (meeting_id) references public.meetings(id) on delete cascade;

alter table public.meeting_documents
  alter column meeting_id type uuid using null::uuid;
alter table public.meeting_documents
  add constraint meeting_documents_meeting_id_fkey
  foreign key (meeting_id) references public.meetings(id) on delete cascade;

create policy agenda_items_board_read on public.agenda_items
  for select using (
    is_board_user() and exists (
      select 1 from public.meetings m
      where m.id = agenda_items.meeting_id
        and m.association_id in (select current_board_association_ids())
    )
  );

create policy meeting_documents_board_read on public.meeting_documents
  for select using (
    is_board_user() and exists (
      select 1 from public.meetings m
      where m.id = meeting_documents.meeting_id
        and m.association_id in (select current_board_association_ids())
    )
  );
