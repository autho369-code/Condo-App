-- Email hold follow-up (2026-10-26, Codex on #413).
--
-- 1. email_is_to_resident missed addresses: an owner's extra addresses were
--    matched with ILIKE whose underscore escape didn't work (jane_doe@... could
--    miss the hold; Codex P1); one owners.email field can hold several
--    addresses (calendar reminders split it, with no owner_id on the row);
--    board members' and leases' addresses weren't checked (migration review).
--    Now the address counts as a resident's when it appears anywhere in owners
--    (email, emails), board_members.email, tenants.email or
--    tenancies.tenant_email (position(), no wildcards; over-holding is safe).
-- 2. platform_health_summary no longer counts held mail as stuck (it would have
--    sent a false "is the email worker running?" alert daily) and reports it
--    as emails_held_for_residents instead.
--
-- Bodies: email_is_to_resident as in 20261026010000 with the match replaced;
-- platform_health_summary as live (20261025080656) with the hold added.

create or replace function public.email_is_to_resident(p_owner_id uuid, p_to_email text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  -- Deliberately broad: the address appearing anywhere in an owner's address
  -- fields (one field can hold several addresses, and extra addresses live in
  -- owners.emails), a board member's, a tenant's or a lease's counts. Holding a
  -- little too much is the safe direction. position() has no wildcards.
  with a as (select lower(btrim(coalesce(p_to_email, ''))) as addr)
  select p_owner_id is not null
      or (select addr from a) = ''
      or exists (select 1 from public.owners o
                  where position((select addr from a) in lower(coalesce(o.email, '') || ' ' || coalesce(o.emails::text, ''))) > 0)
      or exists (select 1 from public.board_members b
                  where position((select addr from a) in lower(coalesce(b.email, ''))) > 0)
      or exists (select 1 from public.tenants t
                  where position((select addr from a) in lower(coalesce(t.email, ''))) > 0)
      or exists (select 1 from public.tenancies tn
                  where position((select addr from a) in lower(coalesce(tn.tenant_email, ''))) > 0);
$function$;
revoke all on function public.email_is_to_resident(uuid, text) from public, anon, authenticated;
grant execute on function public.email_is_to_resident(uuid, text) to service_role;

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
                        -- Held on purpose while email to owners/tenants is paused.
                        and not (public.resident_email_on_hold()
                                 and public.email_is_to_resident(q.owner_id, q.to_email))),
    'emails_held_for_residents', (select count(*) from public.email_queue q
                                   where q.status in ('pending', 'failed') and q.suppressed_at is null
                                     and public.resident_email_on_hold()
                                     and public.email_is_to_resident(q.owner_id, q.to_email)),
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
