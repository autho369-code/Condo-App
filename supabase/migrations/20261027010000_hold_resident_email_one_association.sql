-- Email hold for one association only (Mirsad, 2026-10-26). LIVE on production as 20261026194614.
--
-- 20261026010000 held all email to owners and tenants on the whole platform,
-- because the sample association (Randolph Station) is a real building. A
-- pilot company's owners would get nothing either. Now:
--
-- 1. public.email_hold_associations lists the associations whose owners,
--    board members and tenants get no email (held: left pending, not sent,
--    not deleted). Randolph Station is on it. Platform operator only.
-- 2. The platform-wide switch 'hold_resident_email' stays for emergencies
--    (on = every company's residents held again) and is turned off.
-- 3. public.email_is_held(association, owner, address) is the one test,
--    used by claim_email_queue_snapshot (the only path to the email provider)
--    and platform_health_summary. Deliberately broad inside a held
--    association: the row's owner, or the address appearing in any address
--    field of one of its owners, board members, tenants or leases.
--    Over-holding is the safe direction.
--
-- Checked 2026-10-26 before applying: production has one association
-- (Randolph Station) and no pending or failed mail, so nothing is released.
--
-- Lift the hold for the sample building later (Mirsad's decision; held mail
-- then goes out unless removed first):
--   delete from public.email_hold_associations
--    where association_id = '62344573-04f3-4a39-82d3-a70cbc2f045c';
--
-- Bodies: claim_email_queue_snapshot and platform_health_summary as live
-- (20261026010000 / 20261026020000) with only the hold test replaced.

create table if not exists public.email_hold_associations (
  association_id uuid primary key references public.associations(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid
);
alter table public.email_hold_associations enable row level security;
revoke all on public.email_hold_associations from anon;
drop policy if exists email_hold_associations_operator_all on public.email_hold_associations;
create policy email_hold_associations_operator_all on public.email_hold_associations
  for all to authenticated
  using ((select public.is_platform_operator()))
  with check ((select public.is_platform_operator()));

insert into public.email_hold_associations (association_id, note)
select a.id, 'Mirsad 2026-10-26: the sample building is real; no email to its owners or tenants.'
  from public.associations a
 where a.id = '62344573-04f3-4a39-82d3-a70cbc2f045c'
on conflict (association_id) do nothing;

update public.platform_flags
   set enabled = false,
       note = 'Emergency switch: on holds email to every company''s owners and tenants. Off since 2026-10-26; the sample building is held through email_hold_associations.',
       updated_at = now()
 where key = 'hold_resident_email';

create or replace function public.email_is_held(p_association_id uuid, p_owner_id uuid, p_to_email text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  with a as (select lower(btrim(coalesce(p_to_email, ''))) as addr),
       h as (select association_id from public.email_hold_associations)
  select
    -- Emergency switch: every company's owners and tenants.
    (public.resident_email_on_hold() and public.email_is_to_resident(p_owner_id, p_to_email))
    or (exists (select 1 from h) and (
      -- The row names an owner of a held association.
      exists (select 1 from public.owners o
               where o.id = p_owner_id
                 and (o.association_id in (select association_id from h)
                      or exists (select 1 from public.unit_owners uo
                                   join public.units u on u.id = uo.unit_id
                                   join public.buildings b on b.id = u.building_id
                                  where uo.owner_id = o.id
                                    and b.association_id in (select association_id from h))))
      -- An owner-less row of a held association with no address.
      or (p_association_id in (select association_id from h) and (select addr from a) = '')
      -- The address belongs to someone in a held association (position(): no
      -- wildcards; one field can hold several addresses).
      or ((select addr from a) <> '' and (
            exists (select 1 from public.owners o
                     where position((select addr from a) in lower(coalesce(o.email, '') || ' ' || coalesce(o.emails::text, ''))) > 0
                       and (o.association_id in (select association_id from h)
                            or exists (select 1 from public.unit_owners uo
                                         join public.units u on u.id = uo.unit_id
                                         join public.buildings b on b.id = u.building_id
                                        where uo.owner_id = o.id
                                          and b.association_id in (select association_id from h))))
         or exists (select 1 from public.board_members bm
                     where bm.association_id in (select association_id from h)
                       and position((select addr from a) in lower(coalesce(bm.email, ''))) > 0)
         or exists (select 1 from public.tenants t
                     where (t.association_id in (select association_id from h)
                            -- association_id can be empty on a tenant: match by unit too.
                            or exists (select 1 from public.units u
                                         join public.buildings b on b.id = u.building_id
                                        where u.id = t.unit_id
                                          and b.association_id in (select association_id from h)))
                       and position((select addr from a) in lower(coalesce(t.email, ''))) > 0)
         or exists (select 1 from public.tenancies tn
                      join public.units u on u.id = tn.unit_id
                      join public.buildings b on b.id = u.building_id
                     where b.association_id in (select association_id from h)
                       and position((select addr from a) in lower(coalesce(tn.tenant_email, ''))) > 0)))));
$function$;
revoke all on function public.email_is_held(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.email_is_held(uuid, uuid, text) to service_role;

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
      -- Held: residents of an association on email_hold_associations (or of
      -- every company while the emergency switch is on).
      and not public.email_is_held(email_queue.association_id, email_queue.owner_id, email_queue.to_email)
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

create or replace function public.platform_health_summary(p_hours integer default 24)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_since timestamptz;
  v_result jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_platform_operator() then
    raise exception 'Only the platform operator can view system health.' using errcode = '42501';
  end if;

  v_since := now() - make_interval(hours => least(greatest(coalesce(p_hours, 24), 1), 24 * 31));

  select jsonb_build_object(
    'since', v_since,
    'cron_failures', coalesce((
      select jsonb_agg(f order by f.started_at desc)
      from (
        select j.jobname as job,
               d.start_time as started_at,
               d.status as status,
               left(coalesce(d.return_message, ''), 200) as message
        from cron.job_run_details d
        join cron.job j on j.jobid = d.jobid
        where d.start_time >= v_since
          and d.status = 'failed'
        order by d.start_time desc
        limit 50
      ) f), '[]'::jsonb),
    -- Failed in the window, by when delivery failed, not when it was queued
    -- (mail held for a suspended company can fail days after queueing).
    -- fail_email_delivery sets next_attempt_at to the failure time plus at
    -- most 2 hours, so this may also count a failure up to 2 hours before
    -- the window. Suppressed mail (unsubscribed, bounced) is kept and
    -- marked, not a fault.
    'emails_failed', (select count(*) from public.email_queue
                       where status = 'failed' and suppressed_at is null
                         and next_attempt_at >= v_since),
    -- Due over an hour ago and still not sent: waiting (pending) or waiting
    -- for a retry (failed, under 5 attempts; claim_email_queue_snapshot).
    -- Mail held for a suspended company is waiting on purpose and left out.
    'emails_stuck', (select count(*) from public.email_queue q
                      where (q.status = 'pending' or (q.status = 'failed' and q.attempt_count < 5))
                        and q.suppressed_at is null
                        and coalesce(q.next_attempt_at, q.created_at) < now() - interval '1 hour'
                        and not exists (
                          select 1 from public.portfolios pf
                           where pf.id = q.portfolio_id
                             and pf.suspended_at is not null
                             and not q.platform_mail)
                        -- Held on purpose (email_hold_associations or the emergency switch).
                        and not public.email_is_held(q.association_id, q.owner_id, q.to_email)),
    'emails_held_for_residents', (select count(*) from public.email_queue q
                                   where q.status in ('pending', 'failed') and q.suppressed_at is null
                                     and public.email_is_held(q.association_id, q.owner_id, q.to_email)),
    -- Sent over two hours ago with no report back from the email provider
    -- (delivered, bounced or complained): the provider's delivery webhook
    -- isn't reaching us (RESEND_WEBHOOK_SECRET / Resend webhook not set up),
    -- so bounces and complaints can't stop future mail. The window starts two
    -- hours earlier than the others, so mail sent in the two hours before one
    -- daily check is counted by the next (Codex on #410).
    'emails_unconfirmed', (select count(*) from public.email_queue
                            where status = 'sent' and sent_at >= v_since - interval '2 hours'
                              and provider_message_id is not null
                              and sent_at < now() - interval '2 hours'
                              and delivered_at is null and bounced_at is null and complained_at is null
                              and delivery_status is null),
    'webhooks_failed', (select count(*) from public.webhook_deliveries
                         where status in ('failed', 'abandoned')
                           and coalesce(last_attempt_at, created_at) >= v_since),
    'reports_failed', (select count(*) from public.report_runs
                        where status = 'failed' and coalesce(finished_at, updated_at, created_at) >= v_since),
    'automations_failed', (select count(*) from public.automation_flow_runs
                            where status in ('failed', 'partial')  -- partial: some actions failed
                              and coalesce(last_attempt_at, fired_at) >= v_since),
    'stripe_events_failed', (select count(*) from public.stripe_webhook_events
                              where status = 'failed' and coalesce(processed_at, claimed_at) >= v_since),
    'autopay_failed', (select count(*) from public.stripe_autopay_runs
                        where status = 'failed' and coalesce(updated_at, created_at) >= v_since),
    -- Failed password sign-ins (counts only; who and from where stay on the
    -- operator's Security Center page).
    'sign_in_failures', (select count(*) from public.login_attempts
                          where not success and at >= v_since),
    'sign_in_failures_one_account', coalesce((select max(n) from (
                          select count(*) as n from public.login_attempts
                           where not success and at >= v_since
                           group by lower(email)) per_account), 0)
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.platform_health_summary(integer) from public, anon;
grant execute on function public.platform_health_summary(integer) to authenticated, service_role;

comment on function public.platform_health_summary(integer) is
  'Failed scheduled jobs and failure counts (email incl. unconfirmed delivery and mail held for residents, webhooks, reports, automations, Stripe, AutoPay, sign-ins) for the last p_hours. Platform operator or service role only. Counts and job names only.';
