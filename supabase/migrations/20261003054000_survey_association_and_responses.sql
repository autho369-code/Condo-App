-- Surveys can be limited to one association (null = every association in
-- the company), owners see only surveys for associations they currently
-- live in, and each owner answers a survey once.
alter table public.surveys
  add column if not exists association_id uuid references public.associations(id) on delete cascade;

create index if not exists surveys_association_idx on public.surveys (association_id);

alter policy surveys_resident_read on public.surveys
  using (
    current_owner_id() is not null
    and active
    and archived_at is null
    and portfolio_id = current_portfolio_id()
    and (association_id is null or association_id in (select current_resident_association_ids()))
  );

-- A response only to a survey the owner can see (open, not archived).
alter policy survey_responses_resident_insert on public.survey_responses
  with check (
    is_portal_resident()
    and submitted_by_owner_id = current_owner_id()
    and exists (
      select 1 from public.surveys s
       where s.id = survey_id
         and s.active
         and s.archived_at is null
    )
  );

create unique index if not exists survey_responses_one_per_owner
  on public.survey_responses (survey_id, submitted_by_owner_id)
  where submitted_by_owner_id is not null and work_order_id is null;
