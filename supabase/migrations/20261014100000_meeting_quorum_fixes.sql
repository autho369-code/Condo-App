-- Meetings deep check (2026-10-13), rolled back on production.
--
-- calculate_meeting_quorum is SECURITY DEFINER and granted to signed-in
-- users; owners (non-executive meetings) and view-only staff pass its check.
-- It always wrote quorum_met, quorum_requirement and total_units, so an
-- owner could rewrite a completed meeting's recorded quorum (3 -> 9 in the
-- test), every call replaced a quorum the manager had set by hand, and
-- nothing recorded the result when a meeting was completed.
--
-- Now (security-reviewer and migration-reviewer on this PR):
--   * calculate_meeting_quorum only reads: no role can change a meeting
--     through it (a read-only platform operator included);
--   * the result is recorded by a trigger in the same UPDATE that sets a
--     meeting to completed, whatever path completes it, so nothing can
--     change between counting and completing;
--   * a quorum the manager set is the number needed; the association's
--     percentage of units is used only when none is set;
--   * owners count when present, voting-eligible and an owner in the
--     association on the meeting's local date (the meeting page's rule: a
--     later sale doesn't change a past meeting's result);
--   * attendance can't change once a meeting is completed or cancelled
--     (it was only checked in the app).
-- A completed meeting reports the result recorded when it was held.

-- The quorum figures for a meeting, as of its date. Internal.
create or replace function public.app_meeting_quorum_snapshot(p_meeting public.meetings,
  out total_units integer, out quorum_percentage integer, out quorum_needed integer,
  out attendee_count integer, out board_count integer, out owner_count integer)
returns record
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_date date := public.association_local_date(p_meeting.association_id, coalesce(p_meeting.start_time, now()));
begin
  select greatest(1, least(100, coalesce(a.quorum_percentage, 51))),
         greatest(0, coalesce(a.unit_count, 0))
    into quorum_percentage, total_units
    from public.associations a
   where a.id = p_meeting.association_id;

  select count(*)::integer,
         count(*) filter (where ma.attendee_role = 'board_member')::integer,
         count(distinct ma.owner_id) filter (
           where ma.owner_id is not null
             and coalesce(ma.voting_eligible, false)
             and exists (
               select 1 from public.occupancies o
                where o.owner_id = ma.owner_id
                  and o.association_id = p_meeting.association_id
                  and o.occupancy_type = 'owner'
                  and (o.status::text <> 'past' or o.move_out_date is not null)
                  and (o.move_in_date is null or o.move_in_date <= v_date)
                  and (o.move_out_date is null or o.move_out_date > v_date)))::integer
    into attendee_count, board_count, owner_count
    from public.meeting_attendees ma
   where ma.meeting_id = p_meeting.id
     and ma.present;

  quorum_needed := coalesce(p_meeting.quorum_requirement, ceil(total_units * quorum_percentage / 100.0)::integer);
end
$function$;

revoke all on function public.app_meeting_quorum_snapshot(public.meetings) from public, anon, authenticated;

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

  -- A completed meeting reports what was recorded when it was held.
  if v_meeting.status::text = 'completed' and v_meeting.quorum_met is not null then
    v_reached := v_meeting.quorum_met;
    v_needed := coalesce(v_meeting.quorum_requirement, q.quorum_needed);
    v_total := coalesce(v_meeting.total_units, q.total_units);
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

-- Record the quorum in the same UPDATE that completes the meeting.
create or replace function public.meetings_record_quorum_on_complete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare q record;
begin
  if new.status::text = 'completed' and old.status::text is distinct from 'completed' then
    select * into q from public.app_meeting_quorum_snapshot(new);
    new.quorum_requirement := q.quorum_needed;
    new.total_units := q.total_units;
    new.quorum_met := q.owner_count >= q.quorum_needed;
  end if;
  return new;
end
$function$;

revoke all on function public.meetings_record_quorum_on_complete() from public, anon, authenticated;

create or replace trigger trg_meetings_record_quorum_on_complete
  before update of status on public.meetings
  for each row execute function public.meetings_record_quorum_on_complete();

-- Attendance is fixed once a meeting is completed or cancelled.
create or replace function public.meeting_attendees_only_while_open()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare v_status text;
begin
  if current_user = 'service_role' then
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

revoke all on function public.meeting_attendees_only_while_open() from public, anon, authenticated;

create or replace trigger trg_meeting_attendees_only_while_open
  before insert or update or delete on public.meeting_attendees
  for each row execute function public.meeting_attendees_only_while_open();
