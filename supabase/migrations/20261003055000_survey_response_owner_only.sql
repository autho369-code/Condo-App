-- Owners answer surveys from the portal, which never ties a response to a
-- work order. Requiring work_order_id to be null keeps every owner response
-- under the once-per-survey unique index (it excludes work-order rows).
alter policy survey_responses_resident_insert on public.survey_responses
  with check (
    is_portal_resident()
    and submitted_by_owner_id = current_owner_id()
    and work_order_id is null
    and exists (
      select 1 from public.surveys s
       where s.id = survey_id
         and s.active
         and s.archived_at is null
    )
  );
