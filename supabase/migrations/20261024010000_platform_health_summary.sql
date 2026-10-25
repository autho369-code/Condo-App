-- Platform health summary (2026-10-24, outside review follow-up).
--
-- The System Monitor showed failed emails and webhooks but not failed
-- scheduled database jobs (pg_cron), and nothing told the platform operator
-- when something broke. platform_health_summary returns, for the last
-- p_hours, the failed pg_cron runs and failure counts for email, webhooks,
-- reports, automations and Stripe. The System Monitor shows it; the daily app
-- cron /api/platform/health-alert emails the operator when anything is
-- non-zero (the email is written in app code, Decisions: nightly mail from an
-- app cron).
--
-- Counts and job names only: no email recipients, subjects or bodies (sign-in
-- emails stay invisible to operator monitors).
--
-- Callable by an active platform operator (System Monitor) or the service
-- role (the cron route). cron.job_run_details is readable only by its owner,
-- so the function is SECURITY DEFINER with a pinned search_path.

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
    -- Suppressed mail (unsubscribed, bounced) is kept and marked, not a fault.
    'emails_failed', (select count(*) from public.email_queue
                       where status = 'failed' and suppressed_at is null
                         and created_at >= v_since),
    -- Due over an hour ago and still not sent. Mail held for a suspended
    -- company is waiting on purpose (claim_email_queue_snapshot) and left out.
    'emails_stuck', (select count(*) from public.email_queue q
                      where q.status = 'pending' and q.suppressed_at is null
                        and coalesce(q.next_attempt_at, q.created_at) < now() - interval '1 hour'
                        and not exists (
                          select 1 from public.portfolios pf
                           where pf.id = q.portfolio_id
                             and pf.suspended_at is not null
                             and not q.platform_mail)),
    'webhooks_failed', (select count(*) from public.webhook_deliveries
                         where status in ('failed', 'abandoned') and created_at >= v_since),
    'reports_failed', (select count(*) from public.report_runs
                        where status = 'failed' and created_at >= v_since),
    'automations_failed', (select count(*) from public.automation_flow_runs
                            where status = 'failed' and fired_at >= v_since),
    'stripe_events_failed', (select count(*) from public.stripe_webhook_events
                              where status = 'failed' and coalesce(processed_at, claimed_at) >= v_since),
    'autopay_failed', (select count(*) from public.stripe_autopay_runs
                        where status = 'failed' and created_at >= v_since)
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.platform_health_summary(integer) from public, anon;
grant execute on function public.platform_health_summary(integer) to authenticated, service_role;

comment on function public.platform_health_summary(integer) is
  'Failed scheduled jobs and failure counts (email, webhooks, reports, automations, Stripe) for the last p_hours. Platform operator or service role only. Counts and job names only.';
