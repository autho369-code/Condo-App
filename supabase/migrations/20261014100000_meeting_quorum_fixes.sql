-- Meetings deep check (2026-10-13), rolled back on production.
--
-- calculate_meeting_quorum is SECURITY DEFINER and granted to signed-in
-- users; owners (non-executive meetings) and view-only staff pass its check.
-- It always wrote quorum_met, quorum_requirement and total_units, so an
-- owner could rewrite a completed meeting's recorded quorum (3 -> 9 in the
-- test) and every call replaced a quorum the manager had set by hand.
-- Now:
--   * anyone it lets in still gets the calculation back (read only);
--   * it writes only when the caller can edit the meeting
--     (can_edit_association_mvp) and the meeting is still scheduled or in
--     progress, so a completed meeting keeps the result recorded when it
--     was held;
--   * a quorum the manager set on the meeting is the number needed; the
--     association's percentage of units is used only when none is set.
-- publishMeetingMinutes now calls it before completing the meeting, so the
-- result is recorded (the page already shows the recorded result for
-- completed meetings, but nothing wrote it).

create or replace function public.calculate_meeting_quorum(p_meeting_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_meeting public.meetings%rowtype;
  v_quorum_pct integer;
  v_total_units integer;
  v_attendee_count integer;
  v_board_count integer;
  v_owner_count integer;
  v_quorum_needed integer;
  v_quorum_reached boolean;
  v_authorized boolean;
  v_can_record boolean;
begin
  if auth.uid() is null or p_meeting_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- No row lock here: read-only callers (owners, view-only staff) must not
  -- block the meeting; a recording caller locks it below.
  select * into v_meeting
  from public.meetings m
  where m.id = p_meeting_id;

  if not found then
    raise exception 'Meeting not found' using errcode = 'P0002';
  end if;

  v_authorized := public.is_platform_operator()
    or (
      (public.is_any_staff() or public.is_company_admin())
      and public.can_access_portfolio(v_meeting.portfolio_id) and public.can_view_association_row(v_meeting.association_id)
    )
    or (
      public.current_owner_id() is not null
      and v_meeting.meeting_type <> 'executive_session'
      and v_meeting.association_id in (select public.current_resident_association_ids())
    );

  if not v_authorized then
    raise exception 'Not authorized for this meeting' using errcode = '42501';
  end if;

  v_can_record := v_meeting.status::text in ('scheduled', 'in_progress')
    and public.can_edit_association_mvp(v_meeting.association_id);
  if v_can_record then
    select * into v_meeting from public.meetings m where m.id = p_meeting_id for update;
    v_can_record := v_meeting.status::text in ('scheduled', 'in_progress');
  end if;

  select greatest(1, least(100, coalesce(a.quorum_percentage, 51))),
         greatest(0, coalesce(a.unit_count, 0))
  into v_quorum_pct, v_total_units
  from public.associations a
  where a.id = v_meeting.association_id;

  select count(*)::integer,
         count(*) filter (where ma.attendee_role = 'board_member')::integer,
         count(distinct ma.owner_id) filter (
           where ma.owner_id is not null
             and coalesce(ma.voting_eligible, false)
             and exists (
               select 1 from public.occupancies o
               where o.owner_id = ma.owner_id
                 and o.association_id = v_meeting.association_id
                 and o.status = 'current'
             )
         )::integer
  into v_attendee_count, v_board_count, v_owner_count
  from public.meeting_attendees ma
  where ma.meeting_id = p_meeting_id
    and ma.present;

  -- A completed meeting reports what was recorded when it was held.
  if v_meeting.status::text = 'completed' and v_meeting.quorum_met is not null then
    v_quorum_needed := coalesce(v_meeting.quorum_requirement, ceil(v_total_units * v_quorum_pct / 100.0)::integer);
    v_quorum_reached := v_meeting.quorum_met;
    v_total_units := coalesce(v_meeting.total_units, v_total_units);
  else
    v_quorum_needed := coalesce(v_meeting.quorum_requirement, ceil(v_total_units * v_quorum_pct / 100.0)::integer);
    v_quorum_reached := v_owner_count >= v_quorum_needed;
  end if;

  if v_can_record then
    update public.meetings m
    set quorum_met = v_quorum_reached,
        quorum_requirement = v_quorum_needed,
        total_units = v_total_units
    where m.id = p_meeting_id;
  end if;

  return jsonb_build_object(
    'meeting_id', p_meeting_id,
    'total_units', v_total_units,
    'quorum_percentage', v_quorum_pct,
    'quorum_needed', v_quorum_needed,
    'attendee_count', v_attendee_count,
    'board_count', v_board_count,
    'owner_count', v_owner_count,
    'quorum_reached', v_quorum_reached,
    'recorded', v_can_record
  );
end;
$function$;
