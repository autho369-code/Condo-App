-- SECURITY DEFINER RPC: a board member casts (or changes) their digital sign-off
-- on an approval request, recomputes tallies, and resolves the request status by
-- its voting scheme.
create or replace function public.cast_board_approval(
  p_request_id uuid,
  p_decision text,
  p_signature text,
  p_comment text
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  r              public.approval_requests%rowtype;
  v_member_id    uuid;
  v_for          int;
  v_against      int;
  v_abstain      int;
  v_eligible     int;
  v_new_status   public.approval_request_status;
begin
  -- Load the request.
  select * into r from public.approval_requests where id = p_request_id;
  if not found then
    raise exception 'Approval request not found';
  end if;

  -- Resolve the caller's active board membership for this request's association.
  select bm.id into v_member_id
  from public.board_members bm
  where bm.auth_user_id = auth.uid()
    and bm.active
    and bm.association_id = r.association_id
  limit 1;
  if v_member_id is null then
    raise exception 'Not a board member for this request';
  end if;

  -- Validate decision.
  if p_decision not in ('approve','reject','abstain') then
    raise exception 'Invalid decision: %', p_decision;
  end if;

  -- Signature required when the request demands signatures.
  if coalesce(r.signatures_required, false) and (p_signature is null or btrim(p_signature) = '') then
    raise exception 'Signature required';
  end if;

  -- Upsert this member's decision.
  insert into public.approval_decisions
    (approval_request_id, board_member_id, decided_by, decision, signature_name, comment, decided_at)
  values
    (p_request_id, v_member_id, auth.uid(), p_decision, nullif(btrim(coalesce(p_signature,'')), ''), nullif(btrim(coalesce(p_comment,'')), ''), now())
  on conflict (approval_request_id, decided_by) do update
    set decision      = excluded.decision,
        signature_name = excluded.signature_name,
        comment        = excluded.comment,
        board_member_id = excluded.board_member_id,
        decided_at     = now();

  -- Recompute tallies.
  select
    count(*) filter (where decision = 'approve'),
    count(*) filter (where decision = 'reject'),
    count(*) filter (where decision = 'abstain')
  into v_for, v_against, v_abstain
  from public.approval_decisions
  where approval_request_id = p_request_id;

  -- Eligible voters.
  if r.board_member_ids is not null and array_length(r.board_member_ids, 1) > 0 then
    v_eligible := array_length(r.board_member_ids, 1);
  else
    select count(*) into v_eligible
    from public.board_members
    where association_id = r.association_id and active;
  end if;
  v_eligible := greatest(coalesce(v_eligible, 0), 0);

  -- Resolve status by voting scheme.
  v_new_status := null;
  if r.voting_scheme = 'any_one_approver' then
    if v_for >= 1 then
      v_new_status := 'approved';
    elsif (v_for + v_against + v_abstain) >= v_eligible and v_for = 0 then
      v_new_status := 'rejected';
    end if;
  elsif r.voting_scheme = 'majority_approval_required' then
    if v_for > v_eligible / 2.0 then
      v_new_status := 'approved';
    elsif v_against >= ceil(v_eligible / 2.0) then
      v_new_status := 'rejected';
    end if;
  elsif r.voting_scheme = 'unanimous_approval_required' then
    if v_eligible > 0 and v_for = v_eligible then
      v_new_status := 'approved';
    elsif v_against >= 1 then
      v_new_status := 'rejected';
    end if;
  elsif r.voting_scheme = 'percentage_required' then
    if (v_for * 100.0 / greatest(v_eligible, 1)) >= coalesce(r.percentage_required, r.required_votes, 100) then
      v_new_status := 'approved';
    elsif ((v_eligible - v_against - v_abstain) * 100.0 / greatest(v_eligible, 1)) < coalesce(r.percentage_required, 100) then
      v_new_status := 'rejected';
    end if;
  end if;

  -- Persist tallies (and resolution if reached). Do not override a non-pending status.
  if v_new_status is not null and r.status = 'pending' then
    update public.approval_requests
      set votes_for     = v_for,
          votes_against = v_against,
          votes_abstain = v_abstain,
          status        = v_new_status,
          decision_by   = auth.uid(),
          decision_at   = now()
      where id = p_request_id;
  else
    update public.approval_requests
      set votes_for     = v_for,
          votes_against = v_against,
          votes_abstain = v_abstain
      where id = p_request_id;
  end if;
end;
$$;

grant execute on function public.cast_board_approval(uuid, text, text, text) to authenticated;
