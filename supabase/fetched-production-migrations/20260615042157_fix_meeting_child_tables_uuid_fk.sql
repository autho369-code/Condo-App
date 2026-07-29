
-- agenda_items.meeting_id and meeting_documents.meeting_id were integer while
-- meetings.id is uuid, so they could never join. Both tables empty (0 rows).
-- Drop the board-read policies that depend on the column, retype to uuid + add
-- a real FK, then recreate the policies with a clean uuid join (no ::text cast).

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
;
