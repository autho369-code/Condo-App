-- Email unsubscribe and suppression (Status Next gaps #1; Mirsad's recommended
-- defaults in docs/TODO.md, built as written while he hasn't answered).
--
-- 1. Every queued email is 'required' (sign-in links, receipts, statements,
--    violation, hearing, meeting and collection notices, letters, replies,
--    staff mail) or 'optional' (mass email, announcements, dues, insurance and
--    calendar reminders, automations, vendor bulk mail). The database decides
--    from the email's key; a signed-in user can't mark mass mail required.
-- 2. email_suppressions (per company, by address): 'unsubscribed' and
--    'complained' (a spam report) stop optional mail; only the recipient
--    clears them, from the link. Required mail (sign-in links, legal notices)
--    still goes. 'bounced' stops all mail (the address can't receive it);
--    staff can clear a bounce once the address is fixed. Changes are logged
--    in email_suppression_events. Per company: one company's bounce or
--    unsubscribe is not shown to another (Resend already stops hard bounces
--    across the account). Managers limited to some associations don't see
--    or clear them (they aren't tied to an association).
-- 3. Every email is checked when the worker picks it up to send: one to a
--    suppressed address is kept, marked failed with the reason
--    (suppressed_at), so staff see why it wasn't sent (a Communication
--    Center message counts it as done once the other recipients are sent;
--    the row shows why it was stopped). Optional mail to an owner whose
--    preferred contact is mail is kept the same way. Checking at send time
--    covers mail queued before an unsubscribe or bounce, and adds no
--    per-row work to a 5,000-recipient send.
-- 4. Unsubscribe links: one per optional email, on the company's own
--    address, in the email and its List-Unsubscribe header (RFC 8058
--    one-click). Read and written only by the server.
-- 5. Resend reports a permanent bounce or a spam complaint: the address is
--    suppressed for that company.

-- 1. ----------------------------------------------------------------------------
alter table public.email_queue
  add column if not exists mail_class text not null default 'required',
  add column if not exists suppressed_at timestamptz;

do $do$
begin
  if not exists (select 1 from pg_constraint where conname = 'email_queue_mail_class_check') then
    alter table public.email_queue add constraint email_queue_mail_class_check
      check (mail_class in ('required', 'optional')) not valid;
    alter table public.email_queue validate constraint email_queue_mail_class_check;
  end if;
end
$do$;

comment on column public.email_queue.mail_class is
  'required: always sent (unless the address bounced). optional: not sent after an unsubscribe or spam report, or to an owner who prefers mail.';
comment on column public.email_queue.suppressed_at is
  'Set when the email was not sent because the address is unsubscribed, bounced or complained, or the owner prefers mail (error_message says which).';

-- Optional mail, by the email's key (set by every producer of it).
create or replace function public.email_queue_optional_key(p_key text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $function$
  select coalesce(p_key ~ '^(mass-email|communication|dues-reminder|insurance-reminder|calendar-reminder|automation|vendor-bulk):', false)
$function$;

-- Mail a signed-in user may queue as required: notices, letters, statements,
-- signing and document requests, replies and staff mail (by key), and
-- sign-in links. Anything else a signed-in user queues is optional.
create or replace function public.email_queue_required_key(p_key text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $function$
  select coalesce(p_key ~ '^(notice|violation-letter|letter|owner-statement|signature|vendor-doc-request|vendor-doc-submitted|board-report|msg|mention|maintenance-reminder|owner-form|invitation-verification|manager-invitation|stripe-receipt|scheduled-report|scheduled-report-failed|sr-emergency|calendar-maintenance):', false)
$function$;

-- Pure functions of the key: the classifying trigger runs as the signed-in
-- user, who must be able to call them.
revoke all on function public.email_queue_optional_key(text) from public, anon;
revoke all on function public.email_queue_required_key(text) from public, anon;
grant execute on function public.email_queue_optional_key(text) to authenticated;
grant execute on function public.email_queue_required_key(text) to authenticated;

-- Mail queued before this change, sent or not: mass and reminder mail is
-- optional (its page shows the right kind; waiting mail gets the link).
update public.email_queue
   set mail_class = 'optional'
 where mail_class = 'required'
   and public.email_queue_optional_key(idempotency_key);

-- 2. ----------------------------------------------------------------------------
create table if not exists public.email_suppressions (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email like '%@%'),
  reason text not null check (reason in ('unsubscribed', 'bounced', 'complained')),
  source text not null,
  detail text,
  suppressed_at timestamptz not null default now(),
  cleared_at timestamptz,
  cleared_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (portfolio_id, email, reason)
);

create index if not exists email_suppressions_active_idx
  on public.email_suppressions(portfolio_id, email) where cleared_at is null;

create table if not exists public.email_suppression_events (
  id uuid primary key default gen_random_uuid(),
  suppression_id uuid not null references public.email_suppressions(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  email text not null,
  reason text not null,
  action text not null check (action in ('suppressed', 'cleared')),
  source text not null,
  actor_user_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists email_suppression_events_suppression_idx
  on public.email_suppression_events(suppression_id, created_at);

alter table public.email_suppressions enable row level security;
alter table public.email_suppression_events enable row level security;

-- Staff read their company's; nobody signed in writes (server functions do).
revoke all on public.email_suppressions from anon, authenticated;
revoke all on public.email_suppression_events from anon, authenticated;
grant select on public.email_suppressions to authenticated;
grant select on public.email_suppression_events to authenticated;

drop policy if exists email_suppressions_staff_read on public.email_suppressions;
create policy email_suppressions_staff_read on public.email_suppressions
  for select to authenticated
  using (
    ((select public.is_any_staff()) and not (select public.manager_is_scoped())
      and coalesce(portfolio_id = (select public.my_access_portfolio()), false))
    or ((select public.is_platform_operator()) and portfolio_id is not null)
  );

drop policy if exists email_suppression_events_staff_read on public.email_suppression_events;
create policy email_suppression_events_staff_read on public.email_suppression_events
  for select to authenticated
  using (
    ((select public.is_any_staff()) and not (select public.manager_is_scoped())
      and coalesce(portfolio_id = (select public.my_access_portfolio()), false))
    or ((select public.is_platform_operator()) and portfolio_id is not null)
  );

-- Read-only platform operators can't change them (as on every RLS table).
do $do$
declare r text;
begin
  foreach r in array array['email_suppressions', 'email_suppression_events'] loop
    if not exists (select 1 from pg_trigger where tgname = 'operator_write_guard' and tgrelid = ('public.' || r)::regclass) then
      execute format('create trigger operator_write_guard before insert or update or delete on public.%I for each statement execute function public.operator_write_guard(%L)', r, 'false');
    end if;
  end loop;
end
$do$;

create or replace function public.email_suppressions_audit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' or (old.cleared_at is not null and new.cleared_at is null) then
    insert into public.email_suppression_events (suppression_id, portfolio_id, email, reason, action, source)
    values (new.id, new.portfolio_id, new.email, new.reason, 'suppressed', new.source);
  elsif old.cleared_at is null and new.cleared_at is not null then
    insert into public.email_suppression_events (suppression_id, portfolio_id, email, reason, action, source)
    values (new.id, new.portfolio_id, new.email, new.reason, 'cleared', new.source);
  end if;
  return new;
end $function$;

revoke all on function public.email_suppressions_audit() from public, anon, authenticated;

-- AFTER for inserts (the event references the row), BEFORE for updates
-- (updated_at).
drop trigger if exists email_suppressions_audit_insert on public.email_suppressions;
create trigger email_suppressions_audit_insert
  after insert on public.email_suppressions
  for each row execute function public.email_suppressions_audit();
drop trigger if exists email_suppressions_audit_update on public.email_suppressions;
create trigger email_suppressions_audit_update
  before update on public.email_suppressions
  for each row execute function public.email_suppressions_audit();

-- Why an email can't be sent (null: it can). A bounce stops all mail; an
-- unsubscribe, a spam report or a preference for mail stops optional mail
-- (sign-in links and legal notices still go).
create or replace function public.email_suppression_reason(p_portfolio uuid, p_email text, p_class text, p_owner uuid)
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select case
    when p_portfolio is null then null
    when exists (select 1 from public.email_suppressions s
                  where s.portfolio_id = p_portfolio and s.email = lower(btrim(p_email))
                    and s.reason = 'bounced' and s.cleared_at is null)
      then 'Not sent: email to this address bounced. Fix the address, then allow email to it again.'
    when p_class = 'optional' and exists (select 1 from public.email_suppressions s
                  where s.portfolio_id = p_portfolio and s.email = lower(btrim(p_email))
                    and s.reason = 'complained' and s.cleared_at is null)
      then 'Not sent: the recipient marked an earlier email as spam, so optional email stopped.'
    when p_class = 'optional' and exists (select 1 from public.email_suppressions s
                  where s.portfolio_id = p_portfolio and s.email = lower(btrim(p_email))
                    and s.reason = 'unsubscribed' and s.cleared_at is null)
      then 'Not sent: the recipient unsubscribed from optional email.'
    when p_class = 'optional' and p_owner is not null and exists (
                  select 1 from public.owners o where o.id = p_owner and o.preferred_comm = 'mail')
      then 'Not sent: the owner prefers mail.'
  end
$function$;

revoke all on function public.email_suppression_reason(uuid, text, text, uuid) from public, anon, authenticated;

-- 3. ----------------------------------------------------------------------------
-- Classifies each new email (runs after the other queue triggers, named to
-- sort last, so holds_auth_link is set). Suppression itself is checked when
-- the worker sends (email_prepare_batch).
create or replace function public.email_queue_zz_suppression()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if tg_op = 'INSERT' then
    if public.email_queue_optional_key(new.idempotency_key) then
      new.mail_class := 'optional';
    elsif current_user in ('authenticated', 'anon')
          and new.mail_class = 'required'
          and not coalesce(new.holds_auth_link, false)
          and not public.email_queue_required_key(new.idempotency_key) then
      new.mail_class := 'optional';
    end if;
    new.suppressed_at := null;
    return new;
  end if;
  -- Only the server classifies mail.
  if current_user in ('authenticated', 'anon') then
    new.mail_class := old.mail_class;
  end if;
  -- Sending a suppressed email again (failed -> pending): it is checked
  -- again when the worker picks it up.
  if old.suppressed_at is not null and new.status = 'pending' and old.status <> 'pending' then
    new.suppressed_at := null;
  elsif current_user in ('authenticated', 'anon') then
    new.suppressed_at := old.suppressed_at;
  end if;
  return new;
end $function$;

revoke all on function public.email_queue_zz_suppression() from public, anon, authenticated;

drop trigger if exists zz_email_queue_suppression on public.email_queue;
create trigger zz_email_queue_suppression
  before insert or update on public.email_queue
  for each row execute function public.email_queue_zz_suppression();

-- Suppressed mail is never claimed for sending.
do $do$
declare
  v_def text := replace(pg_get_functiondef('public.claim_email_queue_snapshot(integer)'::regprocedure), E'\r\n', E'\n');
  v_old text := E'      and attempt_count < 5\n';
  v_new text := E'      and attempt_count < 5\n      and suppressed_at is null\n';
begin
  if position('and suppressed_at is null' in v_def) > 0 then
    raise notice 'claim_email_queue_snapshot already patched';
    return;
  end if;
  if array_length(string_to_array(v_def, v_old), 1) <> 2 then
    raise exception 'claim_email_queue_snapshot: expected text not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$do$;

-- A Communication Center message is sent once every recipient's email is
-- sent or was stopped (unsubscribed, bounced).
do $do$
declare
  v_def text := replace(pg_get_functiondef('public.complete_email_delivery(uuid,text)'::regprocedure), E'\r\n', E'\n');
  v_old text := E'    where communication_message_id = v_message_id and status <> ''sent''\n';
  v_new text := E'    where communication_message_id = v_message_id and status <> ''sent'' and suppressed_at is null\n';
begin
  if position('and status <> ''sent'' and suppressed_at is null' in v_def) > 0 then
    raise notice 'complete_email_delivery already patched';
    return;
  end if;
  if array_length(string_to_array(v_def, v_old), 1) <> 2 then
    raise exception 'complete_email_delivery: expected text not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$do$;

-- The older claim_email_queue(integer) is unused (the worker calls
-- claim_email_queue_snapshot) and doesn't skip suppressed mail: no one may
-- call it. Dropping it is Mirsad's (docs/TODO.md).
do $do$
begin
  if to_regprocedure('public.claim_email_queue(integer)') is not null then
    revoke all on function public.claim_email_queue(integer) from public, anon, authenticated, service_role;
  end if;
end
$do$;

-- 4. ----------------------------------------------------------------------------
create table if not exists public.email_unsubscribe_links (
  queue_id uuid primary key references public.email_queue(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  email text not null,
  token text not null unique,
  page_url text,
  created_at timestamptz not null default now()
);

-- Server only: the token unsubscribes its recipient, so no signed-in user
-- (staff included) can read it. The raw token is kept so a retried send is
-- the identical email.
alter table public.email_unsubscribe_links enable row level security;
revoke all on public.email_unsubscribe_links from anon, authenticated;

-- The worker's check for claimed mail: marks what can't be sent now (an
-- unsubscribe or bounce after it was queued) and returns, for optional
-- company mail, its unsubscribe token (made once per email) and saved link.
create or replace function public.email_prepare_batch(p_ids uuid[])
returns table (id uuid, suppressed boolean, unsubscribe_token text, unsubscribe_url text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  r record;
  v_portfolio uuid;
  v_reason text;
  v_token text;
  v_url text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required'; end if;
  for r in
    select q.* from public.email_queue q where q.id = any(p_ids) order by q.id
  loop
    v_portfolio := coalesce((select a.portfolio_id from public.associations a where a.id = r.association_id), r.portfolio_id);
    v_reason := public.email_suppression_reason(v_portfolio, r.to_email, r.mail_class, r.owner_id);
    if v_reason is not null then
      update public.email_queue q
         set status = 'failed', suppressed_at = now(), error_message = v_reason, processing_at = null
       where q.id = r.id;
      -- One Communication Center message covers every recipient: it is sent
      -- once all the others are (this row shows why it wasn't).
      if r.communication_message_id is not null and not exists (
           select 1 from public.email_queue o
            where o.communication_message_id = r.communication_message_id
              and o.status <> 'sent' and o.suppressed_at is null) then
        update public.communication_messages m
           set status = 'sent', sent_at = coalesce(m.sent_at, now()), error_message = null, updated_at = now()
         where m.id = r.communication_message_id and m.status <> 'sent';
      end if;
      id := r.id; suppressed := true; unsubscribe_token := null; unsubscribe_url := null;
      return next;
      continue;
    end if;
    v_token := null; v_url := null;
    -- Platform mail (sent as Portier369, the worker's isPlatformSenderName,
    -- and queued by the server or a platform operator) carries no company
    -- unsubscribe link. Staff can't drop the link by naming something
    -- Portier369.
    if r.mail_class = 'optional' and v_portfolio is not null
       and not (lower(btrim(coalesce(r.from_name, ''))) like 'portier369%'
                and (r.sent_by is null or exists (select 1 from public.platform_operators po
                                                   where po.auth_user_id = r.sent_by and po.active))) then
      insert into public.email_unsubscribe_links (queue_id, portfolio_id, email, token)
      values (r.id, v_portfolio, lower(btrim(r.to_email)), encode(extensions.gen_random_bytes(32), 'hex'))
      on conflict (queue_id) do nothing;
      select l.token, l.page_url into v_token, v_url from public.email_unsubscribe_links l where l.queue_id = r.id;
    end if;
    id := r.id; suppressed := false; unsubscribe_token := v_token; unsubscribe_url := v_url;
    return next;
  end loop;
end $function$;

-- The unsubscribe page: whose link it is, without the full address.
create or replace function public.email_unsubscribe_session(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select jsonb_build_object(
           'portfolio_id', l.portfolio_id,
           'company_name', p.company_name,
           'email_hint', left(l.email, 1) || '***@' || split_part(l.email, '@', 2),
           'unsubscribed', exists (select 1 from public.email_suppressions s
                                    where s.portfolio_id = l.portfolio_id and s.email = l.email
                                      and s.reason = 'unsubscribed' and s.cleared_at is null))
    from public.email_unsubscribe_links l
    join public.portfolios p on p.id = l.portfolio_id
   where l.token = p_token and p_token ~ '^[0-9a-f]{64}$'
$function$;

-- Unsubscribe (or subscribe again) the link's recipient from the company's
-- optional email. Subscribing again also clears a spam complaint: the
-- recipient asked for the mail. A bounce stays (the address must be fixed).
create or replace function public.email_set_unsubscribed(p_token text, p_unsubscribed boolean, p_source text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  l public.email_unsubscribe_links;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required'; end if;
  if p_token !~ '^[0-9a-f]{64}$' then return false; end if;
  select * into l from public.email_unsubscribe_links where token = p_token;
  if not found then return false; end if;
  if p_unsubscribed then
    insert into public.email_suppressions (portfolio_id, email, reason, source)
    values (l.portfolio_id, l.email, 'unsubscribed', left(coalesce(p_source, 'unsubscribe_link'), 100))
    on conflict (portfolio_id, email, reason) do update
      set cleared_at = null, cleared_by = null, suppressed_at = now(), source = excluded.source
      where public.email_suppressions.cleared_at is not null;
  else
    update public.email_suppressions s
       set cleared_at = now(), cleared_by = null, source = 'resubscribed_by_recipient'
     where s.portfolio_id = l.portfolio_id and s.email = l.email
       and s.reason in ('unsubscribed', 'complained') and s.cleared_at is null;
  end if;
  return true;
end $function$;

-- 5. ----------------------------------------------------------------------------
-- A permanent bounce or a complaint Resend reports, for the email it names.
create or replace function public.email_suppress_from_event(p_provider_message_id text, p_reason text, p_detail text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  q public.email_queue;
  v_portfolio uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required'; end if;
  if p_reason not in ('bounced', 'complained') then raise exception 'Unknown suppression reason'; end if;
  select * into q from public.email_queue where provider_message_id = p_provider_message_id limit 1;
  if not found then return false; end if;
  v_portfolio := coalesce((select a.portfolio_id from public.associations a where a.id = q.association_id), q.portfolio_id);
  if v_portfolio is null or coalesce(q.to_email, '') !~ '@' then return false; end if;
  insert into public.email_suppressions (portfolio_id, email, reason, source, detail)
  values (v_portfolio, lower(btrim(q.to_email)), p_reason, 'resend_' || p_reason, left(p_detail, 500))
  on conflict (portfolio_id, email, reason) do update
    set cleared_at = null, cleared_by = null, suppressed_at = now(), source = excluded.source, detail = excluded.detail
    where public.email_suppressions.cleared_at is not null;
  return true;
end $function$;

-- Staff allow email to an address again after a bounce (once it's fixed).
-- An unsubscribe or spam complaint is the recipient's to undo.
create or replace function public.clear_email_bounce(p_suppression_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  s public.email_suppressions;
begin
  select * into s from public.email_suppressions where id = p_suppression_id;
  if not found or not public.is_any_staff() or public.manager_is_scoped()
     or not public.can_access_portfolio(s.portfolio_id) then
    raise exception 'Suppression not found' using errcode = '42501';
  end if;
  if s.reason <> 'bounced' then
    raise exception 'Only the recipient can undo an unsubscribe or spam report' using errcode = '42501';
  end if;
  if s.cleared_at is not null then return; end if;
  update public.email_suppressions
     set cleared_at = now(), cleared_by = auth.uid(), source = 'cleared_by_staff'
   where id = p_suppression_id;
end $function$;

revoke all on function public.email_prepare_batch(uuid[]) from public, anon, authenticated;
revoke all on function public.email_unsubscribe_session(text) from public, anon, authenticated;
revoke all on function public.email_set_unsubscribed(text, boolean, text) from public, anon, authenticated;
revoke all on function public.email_suppress_from_event(text, text, text) from public, anon, authenticated;
revoke all on function public.clear_email_bounce(uuid) from public, anon;
grant execute on function public.email_prepare_batch(uuid[]) to service_role;
grant execute on function public.email_unsubscribe_session(text) to service_role;
grant execute on function public.email_set_unsubscribed(text, boolean, text) to service_role;
grant execute on function public.email_suppress_from_event(text, text, text) to service_role;
grant execute on function public.clear_email_bounce(uuid) to authenticated;
