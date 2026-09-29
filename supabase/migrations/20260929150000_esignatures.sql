-- Native electronic signatures (ESIGN / UETA style).
--
-- * A signature request wraps one immutable document (uploaded PDF or text)
--   identified by its SHA-256. Signers sign through a one-time link whose
--   token is stored only as a SHA-256 hash.
-- * Signing requires explicit consent to electronic records, a typed
--   signature, an unchanged document hash, and (optionally) signing order.
-- * Every view / sign / decline / void / resend is written to an audit
--   trail with IP and user agent; completion yields a certificate.
-- * Staff operations are SECURITY DEFINER RPCs scoped to the caller's
--   portfolio; signer operations are service-role only and authenticate by
--   token hash inside the function.

create table if not exists public.signature_requests (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid references public.associations(id) on delete set null,
  subject_type text not null default 'document'
    check (subject_type in ('document', 'architectural_request', 'board_resolution', 'vendor_agreement', 'management_agreement')),
  subject_id uuid,
  title text not null check (char_length(title) between 2 and 200),
  message text check (message is null or char_length(message) <= 2000),
  document_kind text not null check (document_kind in ('pdf', 'text')),
  document_path text,
  body_text text,
  document_sha256 text not null check (document_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'sent' check (status in ('sent', 'completed', 'declined', 'voided')),
  sequential boolean not null default false,
  expires_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz not null default now(),
  completed_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  check ((document_kind = 'pdf' and document_path like 'signatures/%' and body_text is null)
      or (document_kind = 'text' and document_path is null and char_length(coalesce(body_text, '')) between 20 and 50000))
);

create table if not exists public.signature_signers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.signature_requests(id) on delete cascade,
  sign_order integer not null check (sign_order between 1 and 20),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  role_label text check (role_label is null or char_length(role_label) <= 80),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'viewed', 'signed', 'declined')),
  viewed_at timestamptz,
  consented_at timestamptz,
  signed_at timestamptz,
  signature_name text,
  signed_ip text,
  signed_user_agent text,
  declined_at timestamptz,
  decline_reason text,
  last_sent_at timestamptz not null default now(),
  unique (request_id, sign_order)
);

create table if not exists public.signature_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.signature_requests(id) on delete cascade,
  signer_id uuid references public.signature_signers(id) on delete set null,
  event_type text not null,
  actor_id uuid,
  ip text,
  user_agent text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_signature_requests_portfolio on public.signature_requests (portfolio_id, status, created_at desc);
create index if not exists idx_signature_requests_subject on public.signature_requests (subject_type, subject_id);
create index if not exists idx_signature_signers_request on public.signature_signers (request_id, sign_order);
create index if not exists idx_signature_events_request on public.signature_events (request_id, created_at);

alter table public.signature_requests enable row level security;
alter table public.signature_signers enable row level security;
alter table public.signature_events enable row level security;

create or replace function public.can_manage_signatures(p_portfolio_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select p_portfolio_id is not null
     and public.can_access_portfolio(p_portfolio_id)
     and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator());
$$;

drop policy if exists signature_requests_staff_read on public.signature_requests;
create policy signature_requests_staff_read on public.signature_requests for select to authenticated
  using (public.can_manage_signatures(portfolio_id) and (association_id is null or public.can_view_association_row(association_id)));
drop policy if exists signature_signers_staff_read on public.signature_signers;
create policy signature_signers_staff_read on public.signature_signers for select to authenticated
  using (exists (select 1 from public.signature_requests r where r.id = request_id and public.can_manage_signatures(r.portfolio_id)));
drop policy if exists signature_events_staff_read on public.signature_events;
create policy signature_events_staff_read on public.signature_events for select to authenticated
  using (exists (select 1 from public.signature_requests r where r.id = request_id and public.can_manage_signatures(r.portfolio_id)));

-- Direct writes are never allowed; the token hash is never readable by API roles.
revoke all on public.signature_requests, public.signature_signers, public.signature_events from anon, authenticated;
grant select on public.signature_requests, public.signature_events to authenticated;
grant select (id, request_id, sign_order, name, email, role_label, status, viewed_at, consented_at, signed_at,
              signature_name, signed_ip, signed_user_agent, declined_at, decline_reason, last_sent_at)
  on public.signature_signers to authenticated;

-- ── Staff: create & send ───────────────────────────────────────────────────
create or replace function public.create_signature_request(
  p_portfolio_id uuid,
  p_association_id uuid,
  p_subject_type text,
  p_subject_id uuid,
  p_title text,
  p_message text,
  p_document_kind text,
  p_document_path text,
  p_body_text text,
  p_document_sha256 text,
  p_signers jsonb,
  p_expires_days integer,
  p_sequential boolean
) returns uuid
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_id uuid;
  s jsonb;
  n integer := 0;
  v_subject_portfolio uuid;
begin
  if not public.can_manage_signatures(p_portfolio_id) then raise exception 'Permission denied' using errcode = '42501'; end if;
  if p_association_id is not null and not exists (
    select 1 from public.associations a where a.id = p_association_id and a.portfolio_id = p_portfolio_id and a.archived_at is null
  ) then raise exception 'Association is outside your portfolio' using errcode = '42501'; end if;
  if p_association_id is not null and not public.can_view_association_row(p_association_id) then
    raise exception 'Permission denied for this association' using errcode = '42501';
  end if;

  if p_subject_id is not null then
    v_subject_portfolio := case p_subject_type
      when 'architectural_request' then (select portfolio_id from public.architectural_requests where id = p_subject_id)
      when 'management_agreement' then (select portfolio_id from public.management_agreements where id = p_subject_id)
      else null end;
    if v_subject_portfolio is distinct from p_portfolio_id then
      raise exception 'Linked record is outside your portfolio' using errcode = '42501';
    end if;
  end if;

  if p_signers is null or jsonb_typeof(p_signers) <> 'array' or jsonb_array_length(p_signers) not between 1 and 20 then
    raise exception 'Add between 1 and 20 signers' using errcode = '22023';
  end if;
  if coalesce(p_expires_days, 0) not between 1 and 90 then raise exception 'Expiry must be 1–90 days' using errcode = '22023'; end if;

  insert into public.signature_requests (
    portfolio_id, association_id, subject_type, subject_id, title, message, document_kind, document_path, body_text,
    document_sha256, sequential, expires_at, created_by
  ) values (
    p_portfolio_id, p_association_id, coalesce(p_subject_type, 'document'), p_subject_id, btrim(p_title),
    nullif(btrim(coalesce(p_message, '')), ''), p_document_kind, p_document_path, p_body_text,
    lower(p_document_sha256), coalesce(p_sequential, false), now() + make_interval(days => p_expires_days), auth.uid()
  ) returning id into v_id;

  for s in select * from jsonb_array_elements(p_signers) loop
    n := n + 1;
    insert into public.signature_signers (request_id, sign_order, name, email, role_label, token_hash)
    values (v_id, n, btrim(s ->> 'name'), lower(btrim(s ->> 'email')), nullif(btrim(coalesce(s ->> 'role_label', '')), ''), lower(s ->> 'token_hash'));
  end loop;

  insert into public.signature_events (request_id, event_type, actor_id, detail)
  values (v_id, 'sent', auth.uid(), jsonb_build_object('signers', n, 'document_sha256', lower(p_document_sha256), 'sequential', coalesce(p_sequential, false)));
  return v_id;
end;
$$;

create or replace function public.void_signature_request(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare r public.signature_requests;
begin
  select * into r from public.signature_requests where id = p_id for update;
  if not found or not public.can_manage_signatures(r.portfolio_id) then raise exception 'Permission denied' using errcode = '42501'; end if;
  if r.status <> 'sent' then raise exception 'Only an in-progress request can be voided' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'Enter a reason' using errcode = '22023'; end if;
  update public.signature_requests set status = 'voided', voided_at = now(), void_reason = left(btrim(p_reason), 500) where id = p_id;
  insert into public.signature_events (request_id, event_type, actor_id, detail) values (p_id, 'voided', auth.uid(), jsonb_build_object('reason', left(btrim(p_reason), 500)));
end;
$$;

-- Rotates the signer's token (old link stops working) so staff can resend.
create or replace function public.rotate_signature_signer_token(p_signer_id uuid, p_token_hash text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare sg public.signature_signers; r public.signature_requests;
begin
  select * into sg from public.signature_signers where id = p_signer_id for update;
  if not found then raise exception 'Signer not found'; end if;
  select * into r from public.signature_requests where id = sg.request_id;
  if not public.can_manage_signatures(r.portfolio_id) then raise exception 'Permission denied' using errcode = '42501'; end if;
  if r.status <> 'sent' or sg.status in ('signed', 'declined') then raise exception 'This signer can no longer be reminded' using errcode = '22023'; end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid token' using errcode = '22023'; end if;
  update public.signature_signers set token_hash = p_token_hash, last_sent_at = now() where id = p_signer_id;
  insert into public.signature_events (request_id, signer_id, event_type, actor_id) values (r.id, sg.id, 'reminder_sent', auth.uid());
  return jsonb_build_object('name', sg.name, 'email', sg.email, 'title', r.title, 'message', r.message, 'expires_at', r.expires_at);
end;
$$;

-- ── Signer (service role only; authenticated by token hash) ────────────────
create or replace function public.signature_session(p_token_hash text, p_ip text, p_user_agent text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare sg public.signature_signers; r public.signature_requests; v_blocked text;
begin
  select * into sg from public.signature_signers where token_hash = lower(p_token_hash);
  if not found then return null; end if;
  select * into r from public.signature_requests where id = sg.request_id;
  if r.status = 'sent' and r.expires_at < now() then v_blocked := 'expired'; end if;
  if r.sequential and sg.status not in ('signed', 'declined') and exists (
    select 1 from public.signature_signers o where o.request_id = r.id and o.sign_order < sg.sign_order and o.status <> 'signed'
  ) then v_blocked := coalesce(v_blocked, 'waiting'); end if;

  if sg.status = 'pending' and r.status = 'sent' and v_blocked is null then
    update public.signature_signers set status = 'viewed', viewed_at = now() where id = sg.id;
    insert into public.signature_events (request_id, signer_id, event_type, ip, user_agent)
    values (r.id, sg.id, 'viewed', left(p_ip, 128), left(p_user_agent, 400));
    sg.status := 'viewed';
  end if;

  return jsonb_build_object(
    'request', jsonb_build_object('id', r.id, 'title', r.title, 'message', r.message, 'status', r.status,
      'document_kind', r.document_kind, 'document_path', r.document_path, 'body_text', r.body_text,
      'document_sha256', r.document_sha256, 'expires_at', r.expires_at, 'completed_at', r.completed_at,
      'association', (select name from public.associations where id = r.association_id),
      'company', (select company_name from public.portfolios where id = r.portfolio_id)),
    'signer', jsonb_build_object('id', sg.id, 'name', sg.name, 'email', sg.email, 'role_label', sg.role_label,
      'status', sg.status, 'signed_at', sg.signed_at, 'signature_name', sg.signature_name),
    'signers', (select jsonb_agg(jsonb_build_object('name', o.name, 'role_label', o.role_label, 'status', o.status, 'signed_at', o.signed_at) order by o.sign_order)
                  from public.signature_signers o where o.request_id = r.id),
    'blocked', v_blocked);
end;
$$;

create or replace function public.sign_signature_request(
  p_token_hash text, p_signature_name text, p_consented boolean, p_document_sha256 text, p_ip text, p_user_agent text
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare sg public.signature_signers; r public.signature_requests; v_remaining integer;
begin
  select * into sg from public.signature_signers where token_hash = lower(p_token_hash) for update;
  if not found then raise exception 'This signing link is not valid'; end if;
  select * into r from public.signature_requests where id = sg.request_id for update;
  if r.status <> 'sent' then raise exception 'This request is no longer open for signature'; end if;
  if r.expires_at < now() then raise exception 'This signing link has expired'; end if;
  if sg.status in ('signed', 'declined') then raise exception 'You have already responded to this request'; end if;
  if r.sequential and exists (
    select 1 from public.signature_signers o where o.request_id = r.id and o.sign_order < sg.sign_order and o.status <> 'signed'
  ) then raise exception 'An earlier signer must sign first'; end if;
  if not coalesce(p_consented, false) then raise exception 'Consent to sign electronically is required'; end if;
  if char_length(btrim(coalesce(p_signature_name, ''))) < 2 then raise exception 'Type your full name to sign'; end if;
  if lower(coalesce(p_document_sha256, '')) <> r.document_sha256 then
    raise exception 'The document changed after it was sent — signing is blocked';
  end if;

  update public.signature_signers
     set status = 'signed', consented_at = now(), signed_at = now(), signature_name = left(btrim(p_signature_name), 120),
         signed_ip = left(p_ip, 128), signed_user_agent = left(p_user_agent, 400)
   where id = sg.id;
  insert into public.signature_events (request_id, signer_id, event_type, ip, user_agent, detail)
  values (r.id, sg.id, 'signed', left(p_ip, 128), left(p_user_agent, 400),
          jsonb_build_object('signature_name', left(btrim(p_signature_name), 120), 'document_sha256', r.document_sha256, 'consent', true));

  select count(*) into v_remaining from public.signature_signers where request_id = r.id and status <> 'signed';
  if v_remaining = 0 then
    update public.signature_requests set status = 'completed', completed_at = now() where id = r.id;
    insert into public.signature_events (request_id, event_type, detail) values (r.id, 'completed', jsonb_build_object('document_sha256', r.document_sha256));
    if r.subject_type = 'management_agreement' and r.subject_id is not null then
      update public.management_agreements
         set signed_at = coalesce(signed_at, now()),
             signed_by_owner = coalesce(signed_by_owner, (select signature_name from public.signature_signers where request_id = r.id order by sign_order limit 1)),
             status = case when status = 'draft' then 'active' else status end,
             updated_at = now()
       where id = r.subject_id and portfolio_id = r.portfolio_id;
    end if;
  end if;
  return jsonb_build_object('completed', v_remaining = 0, 'request_id', r.id);
end;
$$;

create or replace function public.decline_signature_request(p_token_hash text, p_reason text, p_ip text, p_user_agent text)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare sg public.signature_signers; r public.signature_requests;
begin
  select * into sg from public.signature_signers where token_hash = lower(p_token_hash) for update;
  if not found then raise exception 'This signing link is not valid'; end if;
  select * into r from public.signature_requests where id = sg.request_id for update;
  if r.status <> 'sent' then raise exception 'This request is no longer open'; end if;
  if sg.status in ('signed', 'declined') then raise exception 'You have already responded to this request'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'Tell the sender why you are declining'; end if;
  update public.signature_signers set status = 'declined', declined_at = now(), decline_reason = left(btrim(p_reason), 1000) where id = sg.id;
  update public.signature_requests set status = 'declined' where id = r.id;
  insert into public.signature_events (request_id, signer_id, event_type, ip, user_agent, detail)
  values (r.id, sg.id, 'declined', left(p_ip, 128), left(p_user_agent, 400), jsonb_build_object('reason', left(btrim(p_reason), 1000)));
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.can_manage_signatures(uuid)',
    'public.create_signature_request(uuid, uuid, text, uuid, text, text, text, text, text, text, jsonb, integer, boolean)',
    'public.void_signature_request(uuid, text)',
    'public.rotate_signature_signer_token(uuid, text)',
    'public.signature_session(text, text, text)',
    'public.sign_signature_request(text, text, boolean, text, text, text)',
    'public.decline_signature_request(text, text, text, text)'
  ] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

grant execute on function public.can_manage_signatures(uuid) to authenticated, service_role;
grant execute on function public.create_signature_request(uuid, uuid, text, uuid, text, text, text, text, text, text, jsonb, integer, boolean) to authenticated, service_role;
grant execute on function public.void_signature_request(uuid, text) to authenticated, service_role;
grant execute on function public.rotate_signature_signer_token(uuid, text) to authenticated, service_role;
-- Token-authenticated signer operations: server (service role) only.
grant execute on function public.signature_session(text, text, text) to service_role;
grant execute on function public.sign_signature_request(text, text, boolean, text, text, text) to service_role;
grant execute on function public.decline_signature_request(text, text, text, text) to service_role;
