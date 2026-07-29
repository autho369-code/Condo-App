-- Board members can read agenda items / meeting documents for meetings that
-- belong to one of their association(s).
--
-- NOTE: agenda_items.meeting_id and meeting_documents.meeting_id are typed
-- `integer`, while meetings.id is `uuid`. There is no usable FK between these
-- legacy tables and the current uuid `meetings` table, so the join is written
-- with an explicit text cast to keep the policy valid SQL. Until meeting_id is
-- repointed to a uuid, these joins will not match any rows (the tables are
-- currently empty). The policies are additive and safely restrictive.
CREATE POLICY agenda_items_board_read ON public.agenda_items
  FOR SELECT
  TO authenticated
  USING (
    is_board_user()
    AND EXISTS (
      SELECT 1
      FROM public.meetings m
      WHERE m.id::text = agenda_items.meeting_id::text
        AND m.association_id IN (SELECT current_board_association_ids())
    )
  );

CREATE POLICY meeting_documents_board_read ON public.meeting_documents
  FOR SELECT
  TO authenticated
  USING (
    is_board_user()
    AND EXISTS (
      SELECT 1
      FROM public.meetings m
      WHERE m.id::text = meeting_documents.meeting_id::text
        AND m.association_id IN (SELECT current_board_association_ids())
    )
  );
