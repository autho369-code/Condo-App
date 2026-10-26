-- Hold all email to owners and tenants (Mirsad, 2026-10-26).
--
-- The sample association on production is a real building: its owners are
-- real people and received automatic dues reminders (6 on 2026-10-15). Until
-- Mirsad says otherwise, nothing is sent to anyone who is an owner or tenant.
--
-- 1. public.platform_flags: platform-wide switches (platform operator only).
--    'hold_resident_email' is on.
-- 2. claim_email_queue_snapshot (the only path to the email provider: the
--    /api/email/process-queue worker) leaves such mail pending — held, not
--    sent, not deleted — while the switch is on. A recipient is a resident
--    when the row names an owner, or the address is an owner's (any company,
--    main or extra address) or a tenant's.
-- 3. platform_health_summary doesn't count held mail as stuck.
--
-- Lift it later (Mirsad's decision; held mail then goes out unless removed):
--   update public.platform_flags set enabled = false where key = 'hold_resident_email';
--
-- claim_email_queue_snapshot body is the live definition (pg_get_functiondef,
-- 2026-10-26) with only the hold added.

create table if not exists public.platform_flags (
  key text primary key,
  enabled boolean not null default false,
  note text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.platform_flags enable row level security;
revoke all on public.platform_flags from anon;
drop policy if exists platform_flags_operator_read on public.platform_flags;
create policy platform_flags_operator_read on public.platform_flags
  for select to authenticated using ((select public.is_platform_operator()));
drop policy if exists platform_flags_operator_write on public.platform_flags;
create policy platform_flags_operator_write on public.platform_flags
  for update to authenticated using ((select public.is_platform_operator())) with check ((select public.is_platform_operator()));

insert into public.platform_flags (key, enabled, note)
values ('hold_resident_email', true, 'Mirsad 2026-10-26: stop sending emails to owners (the sample building is real).')
on conflict (key) do update set enabled = true, note = excluded.note, updated_at = now();

-- Is this queued email addressed to an owner or tenant? (Definer: the worker
-- runs as the service role; owners/tenants are read across companies.)
create or replace function public.email_is_to_resident(p_owner_id uuid, p_to_email text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select p_owner_id is not null
      or exists (select 1 from public.owners o
                  where lower(o.email) = lower(btrim(p_to_email))
                     or o.emails::text ilike '%' || replace(replace(lower(btrim(p_to_email)), '%', ''), '_', '\_') || '%')
      or exists (select 1 from public.tenants t where lower(t.email) = lower(btrim(p_to_email)));
$function$;
revoke all on function public.email_is_to_resident(uuid, text) from public, anon, authenticated;
grant execute on function public.email_is_to_resident(uuid, text) to service_role;

create or replace function public.resident_email_on_hold()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select coalesce((select enabled from public.platform_flags where key = 'hold_resident_email'), false);
$function$;
revoke all on function public.resident_email_on_hold() from public, anon;
grant execute on function public.resident_email_on_hold() to authenticated, service_role;

create or replace function public.claim_email_queue_snapshot(p_limit integer default 10)
 returns setof email_queue
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
      and not exists (
        select 1 from public.portfolios pf
         where pf.id = email_queue.portfolio_id
           and pf.suspended_at is not null
           and not email_queue.platform_mail)
      -- Added: mail to owners and tenants is held while the switch is on.
      and not (public.resident_email_on_hold()
               and public.email_is_to_resident(email_queue.owner_id, email_queue.to_email))
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
revoke all on function public.claim_email_queue_snapshot(integer) from public, anon, authenticated;
grant execute on function public.claim_email_queue_snapshot(integer) to service_role;
