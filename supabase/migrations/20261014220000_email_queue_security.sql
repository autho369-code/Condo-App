-- Communications deep check (2026-10-13), plus Codex on #366.
--
-- 1. Password-reset and invitation links were readable by every staff login
--    of the company (email_queue rows with association_id null), and a
--    pending one could be redirected with an UPDATE of to_email: account
--    takeover, including of the company admin. Rows holding a sign-in link are
--    now marked (holds_auth_link, set by a trigger from the body) and, after
--    the security review (section 6), readable by no signed-in user; signed-in
--    users can no longer update or delete queue rows except to retry a failed
--    one (delivery runs in SECURITY DEFINER functions and the service-role
--    worker).
-- 2. A staff login could insert queue rows with any sender name, any reply-to
--    and raw HTML (scripts, forms): phishing under the platform domain. Rows
--    inserted by signed-in users must now use the company's or association's
--    name, reply to the company's support address, the sender's own address
--    or the company's verified domain, carry no active HTML, and stay under
--    5,000 emails per company per hour.
-- 3. enqueue_communication_message: replies go to the company's support
--    address (they went to the platform mailbox), owner ids are passed in so
--    a 2,000-owner send no longer times out, and up to 5,000 recipients.
-- 4. Codex on #366: the old upsert_budget_line / delete_budget_line RPCs
--    (unused by the app) let finance users write budget lines without the
--    worksheet's checks; they are no longer callable by signed-in users.
-- 5. Password resets and invitations are sent ahead of other queued mail.
-- 6. Security review: sign-in, e-signature and upload links readable by no
--    signed-in user and queued by the server only; signed-in users only retry
--    a failed email; invitation tokens unreadable; staff-queued mail counts
--    toward the hourly limit.
-- 7. Speed: the guards check without row-level security (2,000 rows 0.5 s,
--    5,000 Communication Center recipients 3.2 s).
-- 8. Security review round 3: the checks answer only for the caller's own
--    company, the sender of a user-queued row is that user, and an email is
--    linked only to the owner it is addressed to.

-- 1. -----------------------------------------------------------------------------
alter table public.email_queue add column if not exists holds_auth_link boolean not null default false;

create or replace function public.email_queue_mark_auth_link()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  -- Sign-in links: Supabase verification (token_hash=, and the
  -- /verify?token= fallback) and portal invitations (/invite?token=). Once
  -- marked, a row stays marked.
  new.holds_auth_link := coalesce(new.holds_auth_link, false)
    or coalesce(new.body, '') ~* '(token_hash=|/verify\?token=|/invite\?token=|/accept-invitation\?)';
  return new;
end
$function$;

revoke all on function public.email_queue_mark_auth_link() from public, anon, authenticated;

create or replace trigger email_queue_mark_auth_link
  before insert or update of body, holds_auth_link on public.email_queue
  for each row execute function public.email_queue_mark_auth_link();

update public.email_queue set holds_auth_link = true
 where not holds_auth_link
   and body ~* '(token_hash=|/verify\?token=|/invite\?token=|/accept-invitation\?)';

do $do$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'email_queue'
                  and policyname = 'email_queue_auth_links_private') then
    create policy email_queue_auth_links_private on public.email_queue
      as restrictive for select to authenticated
      using (not holds_auth_link or sent_by = (select auth.uid()));
  end if;
end
$do$;

revoke update, delete, truncate on public.email_queue from anon, authenticated;
-- Only the retry columns, for enqueue_communication_message re-queuing a
-- failed send (its ON CONFLICT ... DO UPDATE); recipient, body and sender
-- can't be changed.
grant update (status, attempt_count, next_attempt_at, processing_at, error_message) on public.email_queue to authenticated;

-- 2. -----------------------------------------------------------------------------
create or replace function public.email_queue_guard_user_insert()
returns trigger
language plpgsql
-- Invoker on purpose: it checks who is writing (current_user).
set search_path = pg_catalog, public
as $function$
declare
  v_company text;
  v_association text;
  v_support text;
  v_own text;
  v_reply text := lower(btrim(coalesce(new.reply_to, '')));
  v_domain text;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  select p.company_name, lower(btrim(p.support_email)) into v_company, v_support
    from public.portfolios p where p.id = new.portfolio_id;
  if new.association_id is not null then
    select a.name into v_association from public.associations a where a.id = new.association_id;
  end if;

  if new.from_name is not null
     and lower(btrim(new.from_name)) is distinct from lower(btrim(coalesce(v_company, '')))
     and lower(btrim(new.from_name)) is distinct from lower(btrim(coalesce(v_association, ''))) then
    raise exception 'Emails are sent under the company''s or association''s name' using errcode = '42501';
  end if;

  if v_reply <> '' then
    -- The caller's own address, from their sign-in token (this trigger runs
    -- as the caller, who can't read auth.users).
    v_own := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
    v_domain := split_part(v_reply, '@', 2);
    if v_reply is distinct from v_support
       and v_reply is distinct from v_own
       and not exists (select 1 from public.portfolio_email_domains d
                        where d.portfolio_id = new.portfolio_id and d.enabled
                          and d.status = 'verified' and lower(d.domain) = v_domain) then
      raise exception 'Replies go to the company''s support address, your own address or the company''s email domain' using errcode = '42501';
    end if;
  end if;

  -- The sending address: the app's own platform senders, or the company's
  -- verified domain (delivery accepts any platform-domain address).
  if new.from_address is not null
     and lower(btrim(new.from_address)) not in ('hello@portier369.com', 'noreply@portier369.com', 'maintenance@portier369.com')
     and not exists (select 1 from public.portfolio_email_domains d
                      where d.portfolio_id = new.portfolio_id and d.enabled and d.status = 'verified'
                        and lower(d.domain) = split_part(lower(btrim(new.from_address)), '@', 2)) then
    raise exception 'Emails are sent from the company''s own address' using errcode = '42501';
  end if;

  -- Active HTML only (inside tags): text the app escapes can't contain '<'.
  if coalesce(new.body, '') ~* '(<\s*(script|iframe|object|embed|form|meta|base|link)\y|<[^>]*\son[a-z]+\s*=|<[^>]*=\s*["'']?\s*javascript:)' then
    raise exception 'The email contains content that can''t be sent (scripts, forms or embedded pages)' using errcode = '22023';
  end if;

  if new.holds_auth_link and new.sent_by is distinct from auth.uid() then
    raise exception 'A sign-in link is queued by the person who created it' using errcode = '42501';
  end if;
  return new;
end
$function$;

revoke all on function public.email_queue_guard_user_insert() from public, anon, authenticated;

-- After the auth-link mark (trigger names run in alphabetical order).
create or replace trigger email_queue_z_guard_user_insert
  before insert on public.email_queue
  for each row execute function public.email_queue_guard_user_insert();

create index if not exists email_queue_portfolio_created_idx
  on public.email_queue(portfolio_id, created_at);

-- Every row people queued for the company in the last hour, whoever queued it
-- (the caller's own RLS view would let several scoped managers together exceed
-- the limit). In public: a trigger runs as the signed-in user, who can't
-- resolve names in rls_private.
create or replace function public.email_queue_company_recent_count(p_portfolio_id uuid)
returns bigint
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select count(*) from public.email_queue q
   where q.portfolio_id = p_portfolio_id and q.sent_by is not null
     and q.created_at > now() - interval '1 hour';
$function$;

revoke all on function public.email_queue_company_recent_count(uuid) from public, anon;
grant execute on function public.email_queue_company_recent_count(uuid) to authenticated;

create or replace function public.email_queue_user_rate_limit()
returns trigger
language plpgsql
-- Invoker on purpose: it limits what signed-in users queue.
set search_path = pg_catalog, public
as $function$
declare
  v_over text;
begin
  if current_user not in ('authenticated', 'anon') then
    return null;
  end if;
  select coalesce(p.company_name, n.portfolio_id::text) into v_over
    from (select distinct portfolio_id from new_rows where portfolio_id is not null) n
    left join public.portfolios p on p.id = n.portfolio_id
   where public.email_queue_company_recent_count(n.portfolio_id) > 5000
   limit 1;
  if v_over is not null then
    raise exception 'More than 5,000 emails were queued for % in the last hour; try again later', v_over using errcode = '54000';
  end if;
  return null;
end
$function$;

revoke all on function public.email_queue_user_rate_limit() from public, anon, authenticated;

create or replace trigger email_queue_user_rate_limit
  after insert on public.email_queue
  referencing new table as new_rows
  for each statement execute function public.email_queue_user_rate_limit();

-- 3. -----------------------------------------------------------------------------
create or replace function public.enqueue_communication_message(p_message_id uuid, p_recipients jsonb, p_html text, p_from_name text default null::text)
returns integer
language plpgsql
set search_path to ''
as $function$
declare
  v_message public.communication_messages%rowtype;
  v_reply text;
  v_count integer := 0;
begin
  if not (public.is_staff() or public.is_platform_operator()) then
    raise exception 'Staff access required';
  end if;

  select * into v_message
  from public.communication_messages
  where id = p_message_id
  for update;

  if not found then raise exception 'Message not found or unavailable'; end if;
  if v_message.channel <> 'email' then raise exception 'Only email messages may be queued'; end if;
  if v_message.status in ('queued', 'sent') then
    select count(*) into v_count from public.email_queue where communication_message_id = p_message_id;
    return v_count;
  end if;
  if coalesce(length(v_message.subject), 0) < 1 or length(v_message.subject) > 300 then
    raise exception 'Message subject length is invalid';
  end if;
  if coalesce(length(v_message.body), 0) < 1 or length(v_message.body) > 50000 then
    raise exception 'Message body length is invalid';
  end if;
  if jsonb_typeof(p_recipients) <> 'array' or jsonb_array_length(p_recipients) < 1
     or jsonb_array_length(p_recipients) > 5000 then
    raise exception 'Recipient count must be between 1 and 5,000';
  end if;
  if coalesce(length(p_html), 0) < 1 or length(p_html) > 200000 then
    raise exception 'Rendered message length is invalid';
  end if;

  -- Replies go to the company, not the platform mailbox.
  select nullif(lower(btrim(p.support_email)), '') into v_reply
    from public.portfolios p where p.id = v_message.portfolio_id;

  if exists (select 1 from jsonb_array_elements(p_recipients) x(value)
              where length(lower(trim(x.value ->> 'email'))) > 320
                 or coalesce(lower(trim(x.value ->> 'email')), '') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
    raise exception 'Invalid recipient email address';
  end if;

  -- One statement for every recipient (the per-company hourly limit is
  -- counted once, not once per row).
  insert into public.email_queue (
    to_email, to_name, subject, body, association_id, portfolio_id,
    sent_by, status, from_address, from_name, reply_to,
    communication_message_id, idempotency_key, owner_id
  )
  select distinct on (r.email)
         r.email, r.name, v_message.subject, p_html, v_message.association_id,
         v_message.portfolio_id, auth.uid(), 'pending', 'hello@portier369.com',
         left(nullif(trim(p_from_name), ''), 200), v_reply, p_message_id,
         'communication:' || p_message_id::text || ':' || r.email,
         -- An owner id from the request counts only for an owner of this
         -- company with that address; otherwise delivery looks it up.
         o.id
    from (select lower(trim(x.value ->> 'email')) as email,
                 nullif(trim(x.value ->> 'name'), '') as name,
                 case when (x.value ->> 'owner_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                      then (x.value ->> 'owner_id')::uuid end as owner_id
            from jsonb_array_elements(p_recipients) x(value)) r
    left join public.owners o
      on o.id = r.owner_id and o.portfolio_id = v_message.portfolio_id and lower(btrim(o.email)) = r.email
   order by r.email
  on conflict (idempotency_key) do update
    set status = 'pending',
        attempt_count = 0,
        next_attempt_at = now(),
        processing_at = null,
        error_message = null
    where public.email_queue.status = 'failed';
  get diagnostics v_count = row_count;

  update public.communication_messages
  set status = 'queued', queued_at = now(), error_message = null, updated_at = now()
  where id = p_message_id;

  return v_count;
end;
$function$;

-- 4. -----------------------------------------------------------------------------
do $do$
declare r record;
begin
  for r in select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('upsert_budget_line', 'delete_budget_line') loop
    execute format('revoke all on function %s from public, anon, authenticated', r.f);
  end loop;
end
$do$;

-- 5. -----------------------------------------------------------------------------
-- Password resets and invitations are sent first: one large mass email used to
-- hold them back past their expiry (the worker sends a few per minute).
do $do$
declare
  v_def text := replace(pg_get_functiondef('public.claim_email_queue_snapshot(integer)'::regprocedure), E'\r\n', E'\n');
  v_old text := E'    order by next_attempt_at, created_at\n';
  v_new text := E'    order by holds_auth_link desc, next_attempt_at, created_at\n';
begin
  if position('order by holds_auth_link desc' in v_def) > 0 then
    raise notice 'claim_email_queue_snapshot already patched';
    return;
  end if;
  if array_length(string_to_array(v_def, v_old), 1) <> 2 then
    raise exception 'claim_email_queue_snapshot: expected text not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$do$;

-- 6. Security review round 2 ----------------------------------------------------
-- a. Sign-in links (and e-signature / vendor-upload links, which act as the
--    owner or vendor) are readable by no signed-in user, not even the one who
--    asked for them: a staff member resetting someone else's password is the
--    "sender". Every app path that queues such a link uses the service role.
create or replace function public.email_queue_mark_auth_link()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  -- Sign-in links: Supabase verification (token_hash=, the /verify?token=
  -- fallback), portal invitations (/invite?token=), e-signature and vendor
  -- upload links. Once marked, a row stays marked.
  new.holds_auth_link := coalesce(new.holds_auth_link, false)
    or coalesce(new.body, '') ~* '(token_hash=|/verify\?token=|/invite\?token=|/accept-invitation\?|/sign/[A-Za-z0-9_-]{16,}|/vendor-upload/[A-Za-z0-9_-]{16,})';
  return new;
end
$function$;

update public.email_queue set holds_auth_link = true
 where not holds_auth_link
   and body ~* '(token_hash=|/verify\?token=|/invite\?token=|/accept-invitation\?|/sign/[A-Za-z0-9_-]{16,}|/vendor-upload/[A-Za-z0-9_-]{16,})';

alter policy email_queue_auth_links_private on public.email_queue using (not holds_auth_link);

-- b. Signed-in users can retry a failed email and nothing else (the column
--    grant alone let them re-send sent mail or bury a colleague's notice).
create or replace function public.email_queue_guard_user_update()
returns trigger
language plpgsql
-- Invoker on purpose: it checks who is writing (current_user).
set search_path = pg_catalog, public
as $function$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if old.status is distinct from 'failed' or new.status is distinct from 'pending'
     or new.attempt_count is distinct from 0 or new.processing_at is not null
     or new.next_attempt_at > now() + interval '1 minute' then
    raise exception 'Only a failed email can be sent again' using errcode = '42501';
  end if;
  return new;
end
$function$;

revoke all on function public.email_queue_guard_user_update() from public, anon, authenticated;

create or replace trigger email_queue_guard_user_update
  before update on public.email_queue
  for each row execute function public.email_queue_guard_user_update();

-- d. The hourly limit counts mail that people queued (not the system's own
--    reminders), company-wide.
create or replace function public.email_queue_company_recent_count(p_portfolio_id uuid)
returns bigint
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select count(*) from public.email_queue q
   where q.portfolio_id = p_portfolio_id and q.sent_by is not null
     and q.created_at > now() - interval '1 hour';
$function$;

-- e. Invitation tokens are readable by no signed-in user (holding one lets
--    anyone set the invitee's password). The app reads them with the service
--    role only; every other column stays readable under the existing policies.
revoke select on public.user_invitations from anon, authenticated;
grant select (accepted_at, association_id, association_ids, created_at, created_by, email, expires_at,
              full_name, hoa_role, id, invited_by, message, metadata, mvp_role, portfolio_id, role,
              role_id, status, unit_id, updated_at, used_at, used_by)
  on public.user_invitations to authenticated;

-- f. Linking an email to its owner by address: the primary address through an
--    index first (a per-row scan of every owner timed out large sends); see 7.
create index if not exists owners_portfolio_lower_email_idx
  on public.owners (portfolio_id, lower(email)) where archived_at is null;


-- 7. Speed: the guards looked up the company, association and owner as the
--    signed-in user, so row-level security ran on every queued row (2,000 rows
--    took ~4 s; the base insert ~0.2 s). One definer check answers yes/no per
--    row (it returns no data); the existing worker-columns guard gets the
--    association's company the same way.
create or replace function public.email_queue_association_company(p_association_id uuid)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select a.portfolio_id from public.associations a where a.id = p_association_id;
$function$;

revoke all on function public.email_queue_association_company(uuid) from public, anon;
grant execute on function public.email_queue_association_company(uuid) to authenticated;

-- Null when the row may be sent as written; otherwise the reason it can't.
create or replace function public.email_queue_sender_problem(
  p_portfolio_id uuid, p_association_id uuid, p_from_name text, p_reply_to text,
  p_own_email text, p_from_address text, p_owner_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_company text;
  v_support text;
  v_association text;
  v_reply text := lower(btrim(coalesce(p_reply_to, '')));
  v_from text := lower(btrim(coalesce(p_from_address, '')));
begin
  select p.company_name, lower(btrim(p.support_email)) into v_company, v_support
    from public.portfolios p where p.id = p_portfolio_id;
  if p_association_id is not null then
    select a.name into v_association from public.associations a
     where a.id = p_association_id and a.portfolio_id = p_portfolio_id;
  end if;

  if p_from_name is not null
     and lower(btrim(p_from_name)) is distinct from lower(btrim(coalesce(v_company, '')))
     and lower(btrim(p_from_name)) is distinct from lower(btrim(coalesce(v_association, ''))) then
    return 'Emails are sent under the company''s or association''s name';
  end if;

  if v_reply <> ''
     and v_reply is distinct from v_support
     and v_reply is distinct from lower(btrim(coalesce(p_own_email, '')))
     and not exists (select 1 from public.portfolio_email_domains d
                      where d.portfolio_id = p_portfolio_id and d.enabled and d.status = 'verified'
                        and lower(d.domain) = split_part(v_reply, '@', 2)) then
    return 'Replies go to the company''s support address, your own address or the company''s email domain';
  end if;

  -- The sending address: the app's own platform senders, or the company's
  -- verified domain (delivery accepts any platform-domain address).
  if v_from <> ''
     and v_from not in ('hello@portier369.com', 'noreply@portier369.com', 'maintenance@portier369.com')
     and not exists (select 1 from public.portfolio_email_domains d
                      where d.portfolio_id = p_portfolio_id and d.enabled and d.status = 'verified'
                        and lower(d.domain) = split_part(v_from, '@', 2)) then
    return 'Emails are sent from the company''s own address';
  end if;

  -- The owner whose email history shows this email: one of the company's.
  if p_owner_id is not null and not exists (
       select 1 from public.owners o where o.id = p_owner_id and o.portfolio_id = p_portfolio_id) then
    return 'That owner is not with this company';
  end if;
  return null;
end
$function$;

revoke all on function public.email_queue_sender_problem(uuid, uuid, text, text, text, text, uuid) from public, anon;
grant execute on function public.email_queue_sender_problem(uuid, uuid, text, text, text, text, uuid) to authenticated;

create or replace function public.email_queue_guard_user_insert()
returns trigger
language plpgsql
-- Invoker on purpose: it checks who is writing (current_user).
set search_path = pg_catalog, public
as $function$
declare
  v_problem text;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  -- Sign-in, e-signature and upload links are queued by the server only.
  if new.holds_auth_link then
    raise exception 'Emails with sign-in, signing or upload links are sent by the system only' using errcode = '42501';
  end if;

  -- Active HTML only (inside tags): text the app escapes can't contain '<'.
  if coalesce(new.body, '') ~* '(<\s*(script|iframe|object|embed|form|meta|base|link)\y|<[^>]*\son[a-z]+\s*=|<[^>]*=\s*["'']?\s*(javascript:|&#))' then
    raise exception 'The email contains content that can''t be sent (scripts, forms or embedded pages)' using errcode = '22023';
  end if;

  -- Sender name, reply-to, sending address and owner: checked without the
  -- caller's row-level security (the caller's own address comes from their
  -- sign-in token).
  v_problem := public.email_queue_sender_problem(
    new.portfolio_id, new.association_id, new.from_name, new.reply_to,
    auth.jwt() ->> 'email', new.from_address, new.owner_id);
  if v_problem is not null then
    raise exception '%', v_problem using errcode = '42501';
  end if;
  return new;
end
$function$;

do $do$
declare
  v_def text := replace(pg_get_functiondef('public.email_queue_guard_worker_columns()'::regprocedure), E'\r\n', E'\n');
  v_old text := 'select a.portfolio_id into v_company from public.associations a where a.id = new.association_id;';
  v_new text := 'v_company := public.email_queue_association_company(new.association_id);';
begin
  if position(v_new in v_def) > 0 then
    raise notice 'email_queue_guard_worker_columns already patched';
    return;
  end if;
  if array_length(string_to_array(v_def, v_old), 1) <> 2 then
    raise exception 'email_queue_guard_worker_columns: expected text not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$do$;

-- The extra-addresses fallback of the owner lookup, through an index.
create index if not exists owners_emails_gin_idx
  on public.owners using gin (emails) where archived_at is null;

create or replace function public.email_owner_for_address(p_portfolio_id uuid, p_email text)
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_email text := lower(btrim(p_email));
  v_ids uuid[];
begin
  if p_portfolio_id is null or v_email is null or v_email = '' then
    return null;
  end if;
  -- The owner's primary address first (indexed); the extra addresses list
  -- only when no owner has it as their primary.
  select array_agg(o.id) into v_ids
    from public.owners o
   where o.portfolio_id = p_portfolio_id and o.archived_at is null and lower(o.email) = v_email;
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    select array_agg(o.id) into v_ids
      from public.owners o
     where o.portfolio_id = p_portfolio_id and o.archived_at is null
       and (o.emails ? v_email or o.emails ? btrim(p_email));
  end if;
  return case when array_length(v_ids, 1) = 1 then v_ids[1] end;
end
$function$;

-- 8. Security review round 3 ----------------------------------------------------
-- a. The helpers answer only for the caller's own company (they're callable
--    as RPCs by any signed-in user).
create or replace function public.email_queue_company_recent_count(p_portfolio_id uuid)
returns bigint
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select case when public.can_access_portfolio(p_portfolio_id) or public.is_platform_operator()
              then (select count(*) from public.email_queue q
                     where q.portfolio_id = p_portfolio_id and q.sent_by is not null
                       and q.created_at > now() - interval '1 hour')
              else 0 end;
$function$;

create or replace function public.email_queue_association_company(p_association_id uuid)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select a.portfolio_id from public.associations a
   where a.id = p_association_id
     and (public.can_access_portfolio(a.portfolio_id) or public.is_platform_operator());
$function$;

-- b. One check for a row a signed-in user queues (replaces
--    email_queue_sender_problem): the caller's own company only, and the owner
--    must be the recipient (an owner of the company whose address it is).
create or replace function public.email_queue_insert_problem(
  p_portfolio_id uuid, p_association_id uuid, p_from_name text, p_reply_to text,
  p_own_email text, p_from_address text, p_owner_id uuid, p_to_email text)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_company text;
  v_support text;
  v_association text;
  v_reply text := lower(btrim(coalesce(p_reply_to, '')));
  v_from text := lower(btrim(coalesce(p_from_address, '')));
  v_to text := lower(btrim(coalesce(p_to_email, '')));
begin
  if p_portfolio_id is null or not (public.can_access_portfolio(p_portfolio_id) or public.is_platform_operator()) then
    return 'This email is not for your company';
  end if;

  select p.company_name, lower(btrim(p.support_email)) into v_company, v_support
    from public.portfolios p where p.id = p_portfolio_id;
  if p_association_id is not null then
    select a.name into v_association from public.associations a
     where a.id = p_association_id and a.portfolio_id = p_portfolio_id;
  end if;

  if p_from_name is not null
     and lower(btrim(p_from_name)) is distinct from lower(btrim(coalesce(v_company, '')))
     and lower(btrim(p_from_name)) is distinct from lower(btrim(coalesce(v_association, ''))) then
    return 'Emails are sent under the company''s or association''s name';
  end if;

  if v_reply <> ''
     and v_reply is distinct from v_support
     and v_reply is distinct from lower(btrim(coalesce(p_own_email, '')))
     and not exists (select 1 from public.portfolio_email_domains d
                      where d.portfolio_id = p_portfolio_id and d.enabled and d.status = 'verified'
                        and lower(d.domain) = split_part(v_reply, '@', 2)) then
    return 'Replies go to the company''s support address, your own address or the company''s email domain';
  end if;

  -- The sending address: the app's own platform senders, or the company's
  -- verified domain (delivery accepts any platform-domain address).
  if v_from <> ''
     and v_from not in ('hello@portier369.com', 'noreply@portier369.com', 'maintenance@portier369.com')
     and not exists (select 1 from public.portfolio_email_domains d
                      where d.portfolio_id = p_portfolio_id and d.enabled and d.status = 'verified'
                        and lower(d.domain) = split_part(v_from, '@', 2)) then
    return 'Emails are sent from the company''s own address';
  end if;

  -- The owner whose email history shows this email: the company's owner the
  -- email is addressed to.
  if p_owner_id is not null and not exists (
       select 1 from public.owners o
        where o.id = p_owner_id and o.portfolio_id = p_portfolio_id
          and (lower(btrim(o.email)) = v_to or o.emails ? v_to or o.emails ? btrim(p_to_email))) then
    return 'That owner is not the recipient of this email';
  end if;
  return null;
end
$function$;

revoke all on function public.email_queue_insert_problem(uuid, uuid, text, text, text, text, uuid, text) from public, anon;
grant execute on function public.email_queue_insert_problem(uuid, uuid, text, text, text, text, uuid, text) to authenticated;
revoke all on function public.email_queue_sender_problem(uuid, uuid, text, text, text, text, uuid) from public, anon, authenticated;

-- c. The sender of a row a signed-in user queues is that user (the hourly
--    limit counts by it; it could be left out or set to a colleague).
create or replace function public.email_queue_guard_user_insert()
returns trigger
language plpgsql
-- Invoker on purpose: it checks who is writing (current_user).
set search_path = pg_catalog, public
as $function$
declare
  v_problem text;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  new.sent_by := auth.uid();

  -- Sign-in, e-signature and upload links are queued by the server only.
  if new.holds_auth_link then
    raise exception 'Emails with sign-in, signing or upload links are sent by the system only' using errcode = '42501';
  end if;

  -- Active HTML only (inside tags): text the app escapes can't contain '<'.
  if coalesce(new.body, '') ~* '(<\s*(script|iframe|object|embed|form|meta|base|link)\y|<[^>]*\son[a-z]+\s*=|<[^>]*=\s*["'']?\s*(javascript:|&#))' then
    raise exception 'The email contains content that can''t be sent (scripts, forms or embedded pages)' using errcode = '22023';
  end if;

  -- Company, sender name and address, reply-to and owner: checked without
  -- the caller's row-level security (their own address comes from their
  -- sign-in token).
  v_problem := public.email_queue_insert_problem(
    new.portfolio_id, new.association_id, new.from_name, new.reply_to,
    auth.jwt() ->> 'email', new.from_address, new.owner_id, new.to_email);
  if v_problem is not null then
    raise exception '%', v_problem using errcode = '42501';
  end if;
  return new;
end
$function$;
