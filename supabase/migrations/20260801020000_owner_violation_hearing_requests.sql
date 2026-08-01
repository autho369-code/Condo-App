-- The owner portal displayed hearing information but told owners to contact
-- management outside the application. Record a durable, owner-scoped request
-- on the existing violation and move it into the hearing queue atomically.
alter table public.violations
  add column if not exists hearing_requested_at timestamptz,
  add column if not exists hearing_request_note text;

alter table public.violations
  drop constraint if exists violations_hearing_request_note_check;

alter table public.violations
  add constraint violations_hearing_request_note_check check (
    hearing_request_note is null
    or char_length(hearing_request_note) between 10 and 1000
  );

create or replace function public.request_owner_violation_hearing(
  p_violation_id uuid,
  p_reason text
)
returns timestamptz
language plpgsql
security definer
set search_path = 'pg_catalog', 'public'
as $$
declare
  v_owner_id uuid;
  v_violation public.violations%rowtype;
  v_reason text := trim(p_reason);
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  v_owner_id := public.current_owner_id();
  if v_owner_id is null then
    raise exception 'Active owner portal access is required';
  end if;
  if char_length(v_reason) < 10 or char_length(v_reason) > 1000 then
    raise exception 'Hearing request reason must be 10 to 1,000 characters';
  end if;

  select * into v_violation
  from public.violations v
  where v.id = p_violation_id
    and v.owner_id = v_owner_id
    and v.archived_at is null
  for update;

  if not found then
    raise exception 'Violation not found';
  end if;
  if v_violation.status in ('cured', 'closed') then
    raise exception 'A hearing cannot be requested for a closed violation';
  end if;
  if v_violation.hearing_requested_at is not null then
    return v_violation.hearing_requested_at;
  end if;

  update public.violations
  set hearing_required = true,
      hearing_requested_at = now(),
      hearing_request_note = v_reason,
      status = 'hearing_pending'
  where id = p_violation_id
  returning hearing_requested_at into v_violation.hearing_requested_at;

  return v_violation.hearing_requested_at;
end;
$$;

revoke all on function public.request_owner_violation_hearing(uuid, text) from public, anon;
grant execute on function public.request_owner_violation_hearing(uuid, text) to authenticated;
