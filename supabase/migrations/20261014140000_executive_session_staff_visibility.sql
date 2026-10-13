-- Meetings deep check (2026-10-13): staff in the company who may not see an
-- association's confidential meetings (for example an assistant manager not
-- assigned to it) could still read its executive sessions - the meeting row
-- (title, agenda text) and its attendees - although its agenda items,
-- documents and follow-ups were already hidden from them
-- (rls_private.my_confidential_meeting_association_ids).
-- Executive sessions now follow the same set on the meeting and attendee
-- rows; other meetings are unchanged. The set is computed once per query.

alter policy meetings_staff_select on public.meetings
  using (
    (coalesce(portfolio_id = (select public.my_access_portfolio()), false)
      or ((select public.is_platform_operator()) and portfolio_id is not null))
    and (meeting_type <> 'executive_session'::meeting_type
      or association_id in (select rls_private.my_confidential_meeting_association_ids()))
  );

alter policy meeting_attendees_staff_select on public.meeting_attendees
  using (
    exists (
      select 1
        from public.meetings m
       where m.id = meeting_attendees.meeting_id
         and (coalesce(m.portfolio_id = (select public.my_access_portfolio()), false)
           or ((select public.is_platform_operator()) and m.portfolio_id is not null))
         and (m.meeting_type <> 'executive_session'::meeting_type
           or m.association_id in (select rls_private.my_confidential_meeting_association_ids()))
    )
  );

-- calculate_meeting_quorum is SECURITY DEFINER, so it applies the same rule
-- itself: staff get an executive session's counts only when they may see
-- the association's confidential meetings (migration review).
do $$
declare
  v_def text := pg_get_functiondef('public.calculate_meeting_quorum(uuid)'::regprocedure);
  v_old text := $o$      and public.can_access_portfolio(v_meeting.portfolio_id) and public.can_view_association_row(v_meeting.association_id)
$o$;
  v_new text := $n$      and public.can_access_portfolio(v_meeting.portfolio_id) and public.can_view_association_row(v_meeting.association_id)
      and (v_meeting.meeting_type <> 'executive_session'
        or public.can_access_confidential_meeting_mvp(v_meeting.association_id))
$n$;
begin
  if position('can_access_confidential_meeting_mvp' in v_def) > 0 then
    return;
  end if;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'calculate_meeting_quorum: staff check not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$$;
