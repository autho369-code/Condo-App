-- Board members whose seat is matched by email (auth_user_id null) could see
-- approvals but not vote. cast_board_approval now links such a seat to the
-- voter's confirmed login first. The rest of the function is unchanged.
CREATE OR REPLACE FUNCTION public.cast_board_approval(p_request_id uuid, p_decision text, p_signature text, p_comment text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  r public.approval_requests%rowtype;
  v_member_id uuid;
  v_for integer;
  v_against integer;
  v_abstain integer;
  v_eligible integer;
  v_new_status public.approval_request_status;
  v_email text;
begin
  select * into r from public.approval_requests where id = p_request_id for update;
  if not found then raise exception 'Approval request not found'; end if;
  if r.status is distinct from 'pending'::public.approval_request_status then
    raise exception 'This approval request is already finalized';
  end if;

  -- A seat matched only by email (auth_user_id null) already grants board
  -- access via current_board_association_ids(); link it to this login so the
  -- member can vote (previously: "Not a board member for this request").
  select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if v_email is not null then
    update public.board_members bm
       set auth_user_id = auth.uid()
     where bm.auth_user_id is null
       and bm.active
       and bm.association_id = r.association_id
       and lower(bm.email) = v_email;
  end if;

  select bm.id into v_member_id
    from public.board_members bm
   where bm.auth_user_id = auth.uid()
     and bm.active
     and bm.association_id = r.association_id
   limit 1;
  if v_member_id is null then raise exception 'Not a board member for this request'; end if;
  if coalesce(cardinality(r.board_member_ids), 0) > 0
     and not (v_member_id = any(r.board_member_ids)) then
    raise exception 'Not an eligible voter for this approval request';
  end if;
  if p_decision not in ('approve', 'reject', 'abstain') then
    raise exception 'Invalid decision: %', p_decision;
  end if;
  if coalesce(r.signatures_required, false)
     and nullif(btrim(coalesce(p_signature, '')), '') is null then
    raise exception 'Signature required';
  end if;

  insert into public.approval_decisions (
    approval_request_id, board_member_id, decided_by, decision,
    signature_name, comment, decided_at
  ) values (
    p_request_id, v_member_id, auth.uid(), p_decision,
    nullif(btrim(coalesce(p_signature, '')), ''),
    nullif(btrim(coalesce(p_comment, '')), ''), now()
  )
  on conflict (approval_request_id, decided_by) do update
     set decision = excluded.decision,
         signature_name = excluded.signature_name,
         comment = excluded.comment,
         board_member_id = excluded.board_member_id,
         decided_at = now();

  select count(*) filter (where decision = 'approve'),
         count(*) filter (where decision = 'reject'),
         count(*) filter (where decision = 'abstain')
    into v_for, v_against, v_abstain
    from public.approval_decisions
   where approval_request_id = p_request_id;

  if coalesce(cardinality(r.board_member_ids), 0) > 0 then
    v_eligible := cardinality(r.board_member_ids);
  else
    select count(*) into v_eligible from public.board_members where association_id = r.association_id and active;
  end if;
  v_eligible := greatest(coalesce(v_eligible, 0), 0);

  v_new_status := null;
  if r.voting_scheme = 'any_one_approver' then
    if v_for >= 1 then v_new_status := 'approved';
    elsif v_for + v_against + v_abstain >= v_eligible and v_for = 0 then v_new_status := 'rejected';
    end if;
  elsif r.voting_scheme = 'majority_approval_required' then
    if v_for > v_eligible / 2.0 then v_new_status := 'approved';
    elsif v_against >= ceil(v_eligible / 2.0) then v_new_status := 'rejected';
    end if;
  elsif r.voting_scheme = 'unanimous_approval_required' then
    if v_eligible > 0 and v_for = v_eligible then v_new_status := 'approved';
    elsif v_against >= 1 then v_new_status := 'rejected';
    end if;
  elsif r.voting_scheme = 'percentage_required' then
    if v_for * 100.0 / greatest(v_eligible, 1)
       >= coalesce(r.percentage_required, r.required_votes, 100) then
      v_new_status := 'approved';
    elsif (v_eligible - v_against - v_abstain) * 100.0 / greatest(v_eligible, 1)
          < coalesce(r.percentage_required, 100) then
      v_new_status := 'rejected';
    end if;
  end if;

  update public.approval_requests
     set votes_for = v_for,
         votes_against = v_against,
         votes_abstain = v_abstain,
         status = coalesce(v_new_status, status),
         decision_by = case when v_new_status is null then decision_by else auth.uid() end,
         decision_at = case when v_new_status is null then decision_at else now() end
   where id = p_request_id;
end;
$function$;
