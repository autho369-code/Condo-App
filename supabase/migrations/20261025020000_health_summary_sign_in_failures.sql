-- Health summary: failed sign-ins and unconfirmed email delivery (2026-10-25,
-- outside review follow-up).
--
-- Grok's review asked for alerts on auth denials and for real email delivery
-- evidence. platform_health_summary now also returns failed password sign-ins
-- in the window, the most failures against any one account, and sent emails
-- the provider never reported on (on 2026-10-25 none of production's sent
-- mail had a delivery report: RESEND_WEBHOOK_SECRET isn't set, so
-- /api/webhooks/resend answers 503). The daily alert (lib/platform/health.ts) fires at
-- 25+ failures in 24 hours or 10+ against one account (password guessing).
-- Counts only: emails and addresses stay on the Security Center page.
-- login_attempts is small (purged nightly by purge-old-login-attempts).
--
-- Body is the live definition (20261024230049) with the three keys added.

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
                             and not q.platform_mail)),
    -- Sent over two hours ago with no report back from the email provider
    -- (delivered, bounced or complained): the provider's delivery webhook
    -- isn't reaching us (RESEND_WEBHOOK_SECRET / Resend webhook not set up),
    -- so bounces and complaints can't stop future mail.
    'emails_unconfirmed', (select count(*) from public.email_queue
                            where status = 'sent' and sent_at >= v_since
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
  'Failed scheduled jobs and failure counts (email incl. unconfirmed delivery, webhooks, reports, automations, Stripe, AutoPay, sign-ins) for the last p_hours. Platform operator or service role only. Counts and job names only.';
