-- Review follow-up on board_decide_architectural_request (#120): approving a
-- request that had been sent back for more information, without new notes,
-- kept the old information request as the "Decision notes" the homeowner
-- sees. Final decisions (approved / denied) now replace the notes, matching
-- the management decision path.
create or replace function public.board_decide_architectural_request(
  p_request_id uuid,
  p_decision text,
  p_notes text default null
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_req public.architectural_requests;
  v_status text;
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_name text;
  v_label text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to record a decision' using errcode = '42501';
  end if;

  v_status := case p_decision
    when 'approve' then 'approved'
    when 'deny' then 'denied'
    when 'more_info' then 'more_info'
    when 'review' then 'under_review'
    else null end;
  if v_status is null then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;
  if v_status = 'denied' and v_notes is null then
    raise exception 'Give the homeowner a reason when denying a request' using errcode = '22023';
  end if;
  if v_status = 'more_info' and v_notes is null then
    raise exception 'Say what additional information is needed' using errcode = '22023';
  end if;

  select * into v_req from public.architectural_requests where id = p_request_id for update;
  if not found or v_req.association_id not in (select public.current_board_association_ids()) then
    raise exception 'Request not found' using errcode = '42501';
  end if;
  if v_req.owner_id is not null and v_req.owner_id = public.current_owner_id() then
    raise exception 'You cannot decide your own request; another board member or management must' using errcode = '42501';
  end if;
  if v_req.status not in ('submitted', 'under_review', 'more_info') then
    raise exception 'This request is already %', replace(v_req.status, '_', ' ') using errcode = '55000';
  end if;

  update public.architectural_requests
     set status = v_status,
         decided_by = case when v_status in ('approved', 'denied') then auth.uid() else decided_by end,
         decided_at = case when v_status in ('approved', 'denied') then now() else decided_at end,
         -- A final decision replaces the notes (an approval without notes must
         -- not keep showing an earlier "please send more information").
         decision_notes = case when v_status in ('approved', 'denied') then v_notes
                               else coalesce(v_notes, decision_notes) end
   where id = p_request_id;

  select coalesce(nullif(p.full_name, ''), u.email) into v_name
    from auth.users u left join public.profiles p on p.id = u.id
   where u.id = auth.uid();
  v_label := case v_status
    when 'approved' then 'Approved by the board'
    when 'denied' then 'Denied by the board'
    when 'more_info' then 'The board requested more information'
    else 'The board marked this under review' end;

  insert into public.architectural_request_messages (request_id, author_id, author_name, author_role, body)
  values (p_request_id, auth.uid(), v_name, 'board', v_label || coalesce(E'\n\n' || v_notes, ''));

  return v_status;
end;
$$;

revoke all on function public.board_decide_architectural_request(uuid, text, text) from public, anon;
grant execute on function public.board_decide_architectural_request(uuid, text, text) to authenticated;
