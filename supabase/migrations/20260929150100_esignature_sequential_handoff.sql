-- Sequential signing: when a signer finishes, issue a fresh token to the next
-- signer (their initial token was never delivered). Service role only.
create or replace function public.issue_next_signer_token(p_request_id uuid, p_token_hash text)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  r public.signature_requests;
  nxt public.signature_signers;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid token'; end if;
  select * into r from public.signature_requests where id = p_request_id for update;
  if not found or r.status <> 'sent' or not r.sequential then return null; end if;
  select * into nxt from public.signature_signers
   where request_id = r.id and status = 'pending'
   order by sign_order limit 1 for update;
  if not found then return null; end if;
  if exists (select 1 from public.signature_signers o where o.request_id = r.id and o.sign_order < nxt.sign_order and o.status <> 'signed') then
    return null;
  end if;
  update public.signature_signers set token_hash = p_token_hash, last_sent_at = now() where id = nxt.id;
  insert into public.signature_events (request_id, signer_id, event_type) values (r.id, nxt.id, 'sent_to_next_signer');
  return jsonb_build_object(
    'signer_id', nxt.id, 'name', nxt.name, 'email', nxt.email, 'title', r.title, 'message', r.message,
    'expires_at', r.expires_at, 'portfolio_id', r.portfolio_id, 'association_id', r.association_id,
    'company', (select company_name from public.portfolios where id = r.portfolio_id));
end;
$$;

alter function public.issue_next_signer_token(uuid, text) owner to postgres;
revoke all on function public.issue_next_signer_token(uuid, text) from public, anon, authenticated;
grant execute on function public.issue_next_signer_token(uuid, text) to service_role;
