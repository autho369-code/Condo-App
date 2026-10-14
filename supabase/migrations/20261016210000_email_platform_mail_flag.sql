-- Platform mail is marked by the server, not recognised by its sender name
-- (2026-10-16).
--
-- Three places decided "this is the platform's own mail" by a sender name
-- starting with Portier369: the suspended-company hold in
-- claim_email_queue_snapshot, the company unsubscribe link in
-- email_prepare_batch, and the worker's isPlatformSenderName (platform
-- sending address). A company or association named "Portier369 ..." sends
-- server mail under its own name with sent_by null, so it could be taken for
-- the platform (the claim rule worked around it by refusing any exemption to
-- such a company, which also held the platform's genuine invoice to it).
--
-- 1. email_queue.platform_mail (default false). Only server code sets it
--    (platform-operator actions and announcements, the platform's own password
--    reset). A direct write by a signed-in user (current_user authenticated /
--    anon) can't: an insert is forced to false and an update keeps the stored
--    value (authenticated has a table-wide INSERT grant, so the column can't
--    be left out of the grant; its UPDATE grant is column-level and doesn't
--    include it, the trigger is the second lock). The check sits in the
--    existing SECURITY INVOKER guard email_queue_guard_worker_columns, so
--    current_user is the caller; it calls nothing new.
-- 2. The suspended-company hold and the unsubscribe-link rule test
--    platform_mail instead of the name. The sent_by / active-operator and
--    company-name tests existed only because anyone could pick the name;
--    the flag can't be picked, so they go. Genuine platform mail to a
--    suspended company named Portier369 ... is now sent; that company's own
--    mail is held like any other.
-- 3. No backfill: no unsent row exists (2026-10-16), and flagging old rows by
--    name would repeat the mistake this fixes. A platform row queued before
--    this migration and code ship together would at worst be held for a
--    suspended company or get a company unsubscribe link.
--
-- Every function body below is the live body (pg_get_functiondef,
-- 2026-10-16) with only the marked change.

-- 1. ------------------------------------------------------------------------
alter table public.email_queue
  add column if not exists platform_mail boolean not null default false;

comment on column public.email_queue.platform_mail is
  'The platform''s own mail (set by server code only; signed-in writes can''t set it). Exempt from the suspended-company hold and the company unsubscribe link; sent from the platform address.';

create or replace function public.email_queue_guard_worker_columns()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
declare
  v_company uuid;
begin
  -- Direct writes by signed-in users (current_user), not trusted functions.
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      if new.sender_address is not null or coalesce(new.snapshot_claims, 0) <> 0 then
        raise exception 'The sending address is set by email delivery only.' using errcode = '42501';
      end if;
      -- Changed: only server code marks platform mail.
      new.platform_mail := false;
    else
      if new.sender_address is distinct from old.sender_address
         or new.snapshot_claims is distinct from old.snapshot_claims then
        raise exception 'The sending address is set by email delivery only.' using errcode = '42501';
      end if;
      -- Changed: a retry keeps what the server set.
      new.platform_mail := old.platform_mail;
    end if;

    if new.association_id is not null then
      v_company := public.email_queue_association_company(new.association_id);
      if new.portfolio_id is null then
        new.portfolio_id := v_company;
      elsif new.portfolio_id is distinct from v_company then
        raise exception 'The email''s company does not match its association.' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$function$;

-- 2. ------------------------------------------------------------------------
create or replace function public.claim_email_queue_snapshot(p_limit integer default 10)
 returns setof public.email_queue
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if p_limit < 1 or p_limit > 50 then raise exception 'Claim limit must be between 1 and 50'; end if;

  return query
  with due as (
    select id
    from public.email_queue
    where status in ('pending', 'failed')
      and attempt_count < 5
      and suppressed_at is null
      and next_attempt_at <= now()
      and (processing_at is null or processing_at < now() - interval '10 minutes')
      -- Changed: a suspended company's mail waits until it is reactivated;
      -- the platform's own mail to the company (platform_mail, set by server
      -- code only) still goes, whatever the company is called.
      and not exists (
        select 1 from public.portfolios pf
         where pf.id = email_queue.portfolio_id
           and pf.suspended_at is not null
           and not email_queue.platform_mail)
    order by holds_auth_link desc, next_attempt_at, created_at
    for update skip locked
    limit p_limit
  )
  update public.email_queue q
  set processing_at = now(), attempt_count = q.attempt_count + 1, snapshot_claims = q.snapshot_claims + 1,
      status = 'pending', error_message = null
  from due
  where q.id = due.id
  returning q.*;
end;
$function$;

create or replace function public.email_prepare_batch(p_ids uuid[])
 returns table(id uuid, suppressed boolean, unsubscribe_token text, unsubscribe_url text)
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
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
    -- Changed: platform mail (platform_mail, set by server code only)
    -- carries no company unsubscribe link; the sender name doesn't decide.
    if r.mail_class = 'optional' and v_portfolio is not null
       and not r.platform_mail then
      insert into public.email_unsubscribe_links (queue_id, portfolio_id, email, token)
      values (r.id, v_portfolio, lower(btrim(r.to_email)), encode(extensions.gen_random_bytes(32), 'hex'))
      on conflict (queue_id) do nothing;
      select l.token, l.page_url into v_token, v_url from public.email_unsubscribe_links l where l.queue_id = r.id;
    end if;
    id := r.id; suppressed := false; unsubscribe_token := v_token; unsubscribe_url := v_url;
    return next;
  end loop;
end $function$;
