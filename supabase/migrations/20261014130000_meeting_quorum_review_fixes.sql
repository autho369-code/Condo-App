-- Codex on #355 (reviewing 20261014100000).
--
-- 1. A completed meeting's recorded quorum (quorum_met, quorum_requirement,
--    total_units) could still be changed, and the meeting reopened, by any
--    editor through the API: meetings_staff_update allows it and the record
--    trigger only acts when a meeting becomes completed. Now refused, except
--    for a repair path (the service role, or a direct database session with
--    no request, e.g. a migration or a scheduled job). A cancelled meeting
--    can't be reopened either (security review).
-- 2. The attendance lock's service-role exemption never applied: inside a
--    SECURITY DEFINER function current_user is the function owner. It now
--    reads the request role, with the same repair path as (1).
-- 3. A completed meeting from before 20261014100000 has quorum_met = false
--    by column default but no recorded quorum_requirement or total_units.
--    It is treated as recorded only when all three were recorded; otherwise
--    the result is counted from its (now fixed) attendance.
-- The meeting page now shows calculate_meeting_quorum's result, so the
-- "Quorum met / Need N more" badge appears when no quorum is set by hand.

-- True for the service role and for a direct database session with no
-- request (migrations, pg_cron). Every API request comes through the
-- authenticator login, so one whose token lacks a role is not a repair.
create or replace function public.app_is_repair_session()
returns boolean
language sql
stable
set search_path = pg_catalog, public
as $function$
  select coalesce(auth.role(), case when session_user <> 'authenticator' then 'service_role' end) = 'service_role'
$function$;

revoke all on function public.app_is_repair_session() from public, anon, authenticated;

create or replace function public.calculate_meeting_quorum(p_meeting_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_meeting public.meetings%rowtype;
  q record;
  v_reached boolean;
  v_needed integer;
  v_total integer;
begin
  if auth.uid() is null or p_meeting_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_meeting from public.meetings m where m.id = p_meeting_id;
  if not found then
    raise exception 'Meeting not found' using errcode = 'P0002';
  end if;

  if not (
    public.is_platform_operator()
    or (
      (public.is_any_staff() or public.is_company_admin())
      and public.can_access_portfolio(v_meeting.portfolio_id) and public.can_view_association_row(v_meeting.association_id)
    )
    or (
      public.current_owner_id() is not null
      and v_meeting.meeting_type <> 'executive_session'
      and v_meeting.association_id in (select public.current_resident_association_ids())
    )
  ) then
    raise exception 'Not authorized for this meeting' using errcode = '42501';
  end if;

  select * into q from public.app_meeting_quorum_snapshot(v_meeting);

  -- A completed meeting reports what was recorded when it was held; one
  -- completed before results were recorded is counted from its attendance.
  if v_meeting.status::text = 'completed' and v_meeting.quorum_met is not null
     and v_meeting.quorum_requirement is not null and v_meeting.total_units is not null then
    v_reached := v_meeting.quorum_met;
    v_needed := v_meeting.quorum_requirement;
    v_total := v_meeting.total_units;
  else
    v_reached := q.owner_count >= q.quorum_needed;
    v_needed := q.quorum_needed;
    v_total := q.total_units;
  end if;

  return jsonb_build_object(
    'meeting_id', p_meeting_id,
    'total_units', v_total,
    'quorum_percentage', q.quorum_percentage,
    'quorum_needed', v_needed,
    'attendee_count', q.attendee_count,
    'board_count', q.board_count,
    'owner_count', q.owner_count,
    'quorum_reached', v_reached
  );
end;
$function$;

-- A completed meeting stays completed and keeps its recorded quorum; a
-- cancelled one stays cancelled (the app refuses both; so does the database).
create or replace function public.meetings_keep_completed_result()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if old.status::text = 'cancelled' and new.status::text is distinct from 'cancelled'
     and not public.app_is_repair_session() then
    raise exception 'A cancelled meeting cannot be reopened' using errcode = '55000';
  end if;
  if old.status::text = 'completed' and not public.app_is_repair_session() then
    if new.status::text is distinct from 'completed' then
      raise exception 'A completed meeting cannot be reopened' using errcode = '55000';
    end if;
    if new.quorum_met is distinct from old.quorum_met
       or new.quorum_requirement is distinct from old.quorum_requirement
       or new.total_units is distinct from old.total_units then
      raise exception 'The quorum recorded for a completed meeting cannot be changed' using errcode = '55000';
    end if;
    if new.start_time is distinct from old.start_time
       or new.association_id is distinct from old.association_id then
      raise exception 'A completed meeting keeps its date and association' using errcode = '55000';
    end if;
  end if;
  return new;
end
$function$;

revoke all on function public.meetings_keep_completed_result() from public, anon, authenticated;

create or replace trigger trg_meetings_keep_completed_result
  before update on public.meetings
  for each row execute function public.meetings_keep_completed_result();

create or replace function public.meeting_attendees_only_while_open()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare v_status text;
begin
  if public.app_is_repair_session() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  select m.status::text into v_status
    from public.meetings m
   where m.id = case when tg_op = 'DELETE' then old.meeting_id else new.meeting_id end
   for share;
  if v_status in ('completed', 'cancelled') then
    raise exception 'Attendance cannot change after the meeting is completed or cancelled' using errcode = '55000';
  end if;
  if tg_op = 'UPDATE' and new.meeting_id is distinct from old.meeting_id then
    select m.status::text into v_status from public.meetings m where m.id = old.meeting_id for share;
    if v_status in ('completed', 'cancelled') then
      raise exception 'Attendance cannot change after the meeting is completed or cancelled' using errcode = '55000';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$function$;

-- Migration review on #355: the lock above covers updates only.
--   * A meeting inserted as completed has its quorum recorded from its
--     attendance (none yet), not taken from the request;
--   * a completed meeting can't be deleted (deleting and re-inserting would
--     rewrite its result; the app never deletes meetings);
--   * its date and association, which decide who counted, can't change.
-- Outside a repair session.
create or replace function public.meetings_record_quorum_on_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare q record;
begin
  if new.status::text = 'completed' and not public.app_is_repair_session() then
    select * into q from public.app_meeting_quorum_snapshot(new);
    new.quorum_requirement := q.quorum_needed;
    new.total_units := q.total_units;
    new.quorum_met := q.owner_count >= q.quorum_needed;
  end if;
  return new;
end
$function$;

revoke all on function public.meetings_record_quorum_on_insert() from public, anon, authenticated;

create or replace trigger trg_meetings_record_quorum_on_insert
  before insert on public.meetings
  for each row execute function public.meetings_record_quorum_on_insert();

create or replace function public.meetings_keep_completed_on_delete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if old.status::text = 'completed' and not public.app_is_repair_session() then
    raise exception 'A completed meeting cannot be deleted' using errcode = '55000';
  end if;
  return old;
end
$function$;

revoke all on function public.meetings_keep_completed_on_delete() from public, anon, authenticated;

create or replace trigger trg_meetings_keep_completed_on_delete
  before delete on public.meetings
  for each row execute function public.meetings_keep_completed_on_delete();

-- Record the result once for meetings completed before results were
-- recorded (none on production on 2026-10-13), so the lock protects them.
update public.meetings m
   set quorum_requirement = q.quorum_needed,
       total_units = q.total_units,
       quorum_met = q.owner_count >= q.quorum_needed
  from public.meetings src
  cross join lateral public.app_meeting_quorum_snapshot(src) q
 where src.id = m.id
   and m.status::text = 'completed'
   and (m.quorum_requirement is null or m.total_units is null);
