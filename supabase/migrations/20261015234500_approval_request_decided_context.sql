-- Codex on #387: a decided approval request froze its status, amount and
-- notes, but signed-in staff could still rewrite its title, description,
-- due date, attachments and requester, i.e. what the board decided on.
-- Once decided, those are frozen too (pending requests stay editable).
-- Foreign-key SET NULL (deleting a vendor, unit or owner) runs as the table
-- owner and is not blocked (dry-run on production).
create or replace function public.approval_requests_decision_guard()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if current_user not in ('authenticated', 'anon')
     or coalesce(current_setting('app.approval_decision', true), '') = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Approval requests can''t be deleted' using errcode = '42501';
  end if;
  if new.status is distinct from old.status
     or new.required_votes is distinct from old.required_votes
     or new.voting_scheme is distinct from old.voting_scheme
     or new.board_member_ids is distinct from old.board_member_ids
     or new.percentage_required is distinct from old.percentage_required
     or new.signatures_required is distinct from old.signatures_required
     or new.amount is distinct from old.amount
     or new.votes_for is distinct from old.votes_for
     or new.votes_against is distinct from old.votes_against
     or new.votes_abstain is distinct from old.votes_abstain
     or new.decision_by is distinct from old.decision_by
     or new.decision_at is distinct from old.decision_at
     or new.archived_at is distinct from old.archived_at
     or new.request_type is distinct from old.request_type
     or new.association_id is distinct from old.association_id
     or new.portfolio_id is distinct from old.portfolio_id
     or new.vendor_id is distinct from old.vendor_id
     or new.owner_id is distinct from old.owner_id
     or new.unit_id is distinct from old.unit_id
     -- approval_request_decided_context: once decided, what the board decided
     -- on (title, scope, due date, evidence, requester) is history too.
     or (old.status is distinct from 'pending'::public.approval_request_status
         and (new.notes is distinct from old.notes
              or new.title is distinct from old.title
              or new.description is distinct from old.description
              or new.due_date is distinct from old.due_date
              or new.attachments is distinct from old.attachments
              or new.requested_by_name is distinct from old.requested_by_name
              or new.requested_by_email is distinct from old.requested_by_email
              or new.requested_at is distinct from old.requested_at)) then
    raise exception 'Record the board''s decision from the bill or purchase order page' using errcode = '42501';
  end if;
  return new;
end
$function$;

revoke all on function public.approval_requests_decision_guard() from public, anon, authenticated;
