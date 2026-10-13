-- Signature reminder and void respect a manager's association scope
-- (security-reviewer on #333).
--
-- rotate_signature_signer_token and void_signature_request run as definer and
-- checked only can_manage_signatures(portfolio_id), so a manager assigned to
-- some associations who held another association's signer or request id
-- could set a signer's token (and so sign as them), read the signer's name
-- and email, or void the request. Both now also require
-- can_view_association_row(association_id) (true for unscoped staff and for
-- requests without an association). Bodies otherwise unchanged.

create or replace function public.rotate_signature_signer_token(p_signer_id uuid, p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare sg public.signature_signers; r public.signature_requests;
begin
  select * into sg from public.signature_signers where id = p_signer_id for update;
  if not found then raise exception 'Signer not found'; end if;
  select * into r from public.signature_requests where id = sg.request_id;
  if not public.can_manage_signatures(r.portfolio_id)
     or not public.can_view_association_row(r.association_id) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if r.status <> 'sent' or sg.status in ('signed', 'declined') then raise exception 'This signer can no longer be reminded' using errcode = '22023'; end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid token' using errcode = '22023'; end if;
  update public.signature_signers set token_hash = p_token_hash, last_sent_at = now() where id = p_signer_id;
  insert into public.signature_events (request_id, signer_id, event_type, actor_id) values (r.id, sg.id, 'reminder_sent', auth.uid());
  return jsonb_build_object('name', sg.name, 'email', sg.email, 'title', r.title, 'message', r.message, 'expires_at', r.expires_at);
end;
$function$;

create or replace function public.void_signature_request(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare r public.signature_requests;
begin
  select * into r from public.signature_requests where id = p_id for update;
  if not found
     or not public.can_manage_signatures(r.portfolio_id)
     or not public.can_view_association_row(r.association_id) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if r.status <> 'sent' then raise exception 'Only an in-progress request can be voided' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'Enter a reason' using errcode = '22023'; end if;
  update public.signature_requests set status = 'voided', voided_at = now(), void_reason = left(btrim(p_reason), 500) where id = p_id;
  insert into public.signature_events (request_id, event_type, actor_id, detail) values (p_id, 'voided', auth.uid(), jsonb_build_object('reason', left(btrim(p_reason), 500)));
end;
$function$;
