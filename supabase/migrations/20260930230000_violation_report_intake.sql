-- Resident / public violation reports (the /report-violation form) land in
-- violation_cases, but no staff screen ever read that table — reports were
-- stored and never seen. This adds the intake workflow:
--   reported -> converted (a real violation is opened, linked back here)
--   reported -> dismissed (with a reason)
-- plus the manager association-scope restriction the table was missing.
-- The reporter's identity stays staff-only: the opened violation's timeline
-- note visible to the owner never names the reporter.

alter table public.violation_cases
  add column if not exists violation_id uuid references public.violations(id) on delete set null,
  add column if not exists reviewed_by uuid,
  add column if not exists reviewed_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'violation_cases_status_check' and conrelid = 'public.violation_cases'::regclass) then
    alter table public.violation_cases
      add constraint violation_cases_status_check check (status in ('reported', 'converted', 'dismissed'));
  end if;
end $$;

create index if not exists violation_cases_open_idx on public.violation_cases (association_id, reported_at desc) where status = 'reported';

drop policy if exists mgr_assoc_scope on public.violation_cases;
create policy mgr_assoc_scope on public.violation_cases as restrictive for all to authenticated
  using (public.can_view_association_row(association_id));

create or replace function public.violation_report_type(p_type text)
returns public.violation_type language sql immutable set search_path = pg_catalog, public as $$
  select case p_type
    when 'noise' then 'noise'
    when 'parking' then 'parking'
    when 'pet' then 'pets'
    when 'construction' then 'exterior_modification'
    when 'balcony' then 'exterior_modification'
    when 'waste' then 'trash_debris'
    when 'subletting' then 'lease_violation'
    else 'other'
  end::public.violation_type;
$$;

create or replace function public.convert_violation_report(
  p_case_id uuid,
  p_unit_id uuid,
  p_house_rule_id uuid,
  p_title text
) returns uuid
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  c public.violation_cases;
  v_id uuid;
  v_observed date;
begin
  select * into c from public.violation_cases where id = p_case_id for update;
  if c.id is null or c.archived_at is not null then
    raise exception 'Report not found';
  end if;
  if not public.can_manage_violations(c.association_id) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if c.status <> 'reported' then
    raise exception 'This report was already %', c.status using errcode = '22023';
  end if;
  v_observed := least(coalesce(c.reported_at::date, current_date), current_date);

  -- open_violation re-checks access, the unit and the rule against the association.
  v_id := public.open_violation(
    c.association_id, p_unit_id, coalesce(p_house_rule_id, c.house_rule_id),
    coalesce(nullif(btrim(coalesce(p_title, '')), ''), initcap(replace(coalesce(c.violation_type, 'other'), '_', ' ')) || ' reported by a resident'),
    c.violation_description, v_observed, public.violation_report_type(c.violation_type));

  -- Staff-only note with the report's details (not added to the owner-visible history).
  perform public.log_violation_event(v_id,
    left('Opened from a resident report received ' || to_char(coalesce(c.reported_at, now()), 'Mon DD, YYYY')
      || ' — reported by ' || coalesce(c.reporter_name, 'unknown')
      || coalesce(' (unit ' || c.reporter_unit || ')', '')
      || coalesce('; contact ' || c.reporter_contact, '')
      || coalesce('; when: ' || c.dates_times, '')
      || coalesce('; witnesses: ' || c.witnesses, '')
      || '; requested: ' || coalesce(c.requested_action, 'warning'), 2000),
    'open', false);

  update public.violation_cases
     set status = 'converted', violation_id = v_id, reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
   where id = c.id;
  return v_id;
end $$;

create or replace function public.dismiss_violation_report(p_case_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  c public.violation_cases;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select * into c from public.violation_cases where id = p_case_id for update;
  if c.id is null or c.archived_at is not null then
    raise exception 'Report not found';
  end if;
  if not public.can_manage_violations(c.association_id) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if c.status <> 'reported' then
    raise exception 'This report was already %', c.status using errcode = '22023';
  end if;
  if v_reason is null then
    raise exception 'Enter a reason for dismissing the report' using errcode = '22023';
  end if;
  update public.violation_cases
     set status = 'dismissed', determination_notes = left(v_reason, 2000), determined_at = now(), determined_by = auth.uid(),
         reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
   where id = c.id;
end $$;

revoke all on function public.convert_violation_report(uuid, uuid, uuid, text) from public, anon;
revoke all on function public.dismiss_violation_report(uuid, text) from public, anon;
grant execute on function public.convert_violation_report(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.dismiss_violation_report(uuid, text) to authenticated;
