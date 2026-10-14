/**
 * Hourly report worker: generates scheduled runs, finishes manual or bulk
 * runs left queued or stuck, and recovers scheduled-report email delivery.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { processReportRun } from '@/lib/reports/process';
import { requireCronSecret } from '@/lib/server/cron-auth';
import { queueEmails } from '@/lib/email/queue';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { companyUrl } from '@/lib/tenant/host';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  try {
    const svc = createServiceClient() as any;
    const { data: enqueued, error: enqueueError } = await svc.rpc('enqueue_scheduled_reports');
    if (enqueueError) {
      return NextResponse.json({ error: `enqueue failed: ${enqueueError.message}` }, { status: 500 });
    }

    // Every queued run (scheduled, or a manual/bulk run whose request timed
    // out before it was processed), plus runs stuck in "running" for over 15
    // minutes; processReportRun takes both and records its own failures.
    // (A manual run gets 5 minutes to be processed by its own request first;
    // processReportRun also claims each run atomically.)
    const stuckBefore = new Date(Date.now() - 15 * 60000).toISOString();
    const manualBefore = new Date(Date.now() - 5 * 60000).toISOString();
    const { data: queuedRuns, error: runLookupError } = await svc
      .from('report_runs')
      .select('id')
      .or(`and(status.eq.queued,scheduled_report_id.not.is.null),and(status.eq.queued,created_at.lt.${manualBefore}),and(status.eq.running,started_at.lt.${stuckBefore})`)
      .order('created_at', { ascending: true })
      .limit(25);
    if (runLookupError) throw new Error(`run lookup failed: ${runLookupError.message}`);

    const results: any[] = [];
    for (const run of queuedRuns ?? []) {
      try {
        await processReportRun(run.id);
      } catch (error: any) {
        results.push({ run: run.id, status: 'process_failed', error: error.message });
        continue;
      }
      const { data: done } = await svc
        .from('report_runs')
        .select('id, status, error_message')
        .eq('id', run.id)
        .maybeSingle();
      results.push({ run: run.id, status: done?.status ?? 'unknown', error: done?.error_message ?? undefined });
    }

    // Recover recent successful runs, not just those generated above. If
    // execution stopped after generation but before queue insertion, the next
    // cron tick recovers delivery. Queue keys guarantee exactly one email per
    // run and normalized recipient across every replay. Two days, like the
    // failure notices: an older run is not news any more.
    const recoveryCutoff = new Date(Date.now() - 2 * 86400000).toISOString();
    const { data: deliverable, error: deliveryLookupError } = await svc
      .from('report_runs')
      .select('id, portfolio_id, output_url, finished_at, portfolios(company_name, support_email, slug, custom_domain, custom_domain_verified_at), scheduled_reports:scheduled_report_id(name, delivery_channel)')
      .eq('status', 'succeeded')
      .not('scheduled_report_id', 'is', null)
      .not('output_url', 'is', null)
      .gte('finished_at', recoveryCutoff)
      .order('finished_at', { ascending: false })
      .limit(200);
    if (deliveryLookupError) throw new Error(`delivery recovery failed: ${deliveryLookupError.message}`);

    const deliveries: any[] = [];
    for (const run of deliverable ?? []) {
      const schedule = run.scheduled_reports;
      if (schedule?.delivery_channel !== 'email') continue;
      // Only the company's active staff who can see this report themselves,
      // checked now (someone who left or lost access stops receiving it).
      const { data: allowed, error: recipientError } = await svc.rpc('scheduled_report_delivery_recipients', { p_run_id: run.id });
      if (recipientError) {
        deliveries.push({ run: run.id, status: 'recipient_check_failed', error: recipientError.message });
        continue;
      }
      const recipients = new Map<string, string | null>();
      for (const r of (allowed ?? []) as Array<{ email: string; full_name: string | null }>) {
        const to = String(r.email ?? '').trim().toLowerCase();
        if (EMAIL_PATTERN.test(to) && to.length <= 320) recipients.set(to, r.full_name ?? null);
      }
      const targets = [...recipients.keys()].slice(0, 100);
      if (!targets.length) {
        deliveries.push({ run: run.id, status: 'no_valid_recipients' });
        continue;
      }

      const companyName = run.portfolios?.company_name ?? null;
      // A link to the run on the company's own address: recipients sign in to
      // download, so the file is never reachable through the email alone.
      const runUrl = companyUrl(run.portfolios, `/reports/runs/${run.id}`);
      const { error, count } = await queueEmails(svc, targets.map((to) => ({
        to,
        toName: recipients.get(to) ?? null,
        subject: `Scheduled report: ${schedule.name}`,
        text: `Your scheduled report "${schedule.name}" is ready.\n\nSign in to download it:\n${runUrl}`,
        portfolioId: run.portfolio_id,
        fromName: companyName,
        replyTo: run.portfolios?.support_email ?? null,
        idempotencyKey: `scheduled-report:${run.id}:${to}`,
      })));
      deliveries.push({
        run: run.id,
        status: error ? 'queue_failed' : count ? 'queued' : 'already_queued',
        emails_queued: count,
        error,
      });
    }

    // A scheduled run that failed tells the person it runs as (otherwise the
    // failure only showed in Report history). One notice per run.
    // Every failure in the window (paged), not only the newest 200: the
    // idempotency key makes repeats no-ops, so older ones still get a notice.
    const { rows: failedRuns, error: failedLookupError } = await fetchAllRows<any>(() => svc
      .from('report_runs')
      .select('id, portfolio_id, error_message, triggered_by, portfolios(company_name, support_email, slug, custom_domain, custom_domain_verified_at), scheduled_reports:scheduled_report_id(name)')
      .eq('status', 'failed')
      .not('scheduled_report_id', 'is', null)
      .gte('finished_at', new Date(Date.now() - 2 * 86400000).toISOString())
      .order('finished_at', { ascending: false })
      .order('id'));
    if (failedLookupError) throw new Error(`failure lookup failed: ${failedLookupError}`);
    const ownerIds = [...new Set(failedRuns.map((r: any) => r.triggered_by).filter(Boolean))] as string[];
    const { data: owners } = ownerIds.length
      ? await svc.from('profiles').select('id, email, full_name, portfolio_id, hoa_role, disabled_at').in('id', ownerIds)
      : { data: [] };
    const ownerById = new Map(((owners ?? []) as any[]).map((o) => [o.id, o]));
    const failures: any[] = [];
    for (const run of failedRuns) {
      const owner = ownerById.get(run.triggered_by);
      // Only to someone still on the company's staff (a schedule paused because
      // its user left doesn't email them).
      if (!owner || owner.disabled_at || owner.portfolio_id !== run.portfolio_id
          || !['manager', 'company_admin'].includes(String(owner.hoa_role))) {
        failures.push({ run: run.id, status: 'owner_not_active_staff' });
        continue;
      }
      const to = String(owner?.email ?? '').trim().toLowerCase();
      if (!EMAIL_PATTERN.test(to)) continue;
      const { error, count } = await queueEmails(svc, [{
        to,
        toName: owner?.full_name ?? null,
        subject: `Scheduled report failed: ${run.scheduled_reports?.name ?? 'report'}`,
        text: `Your scheduled report "${run.scheduled_reports?.name ?? 'report'}" could not be generated.\n\nReason: ${run.error_message ?? 'Unknown error'}\n\nDetails: ${companyUrl(run.portfolios, `/reports/runs/${run.id}`)}`,
        portfolioId: run.portfolio_id,
        fromName: run.portfolios?.company_name ?? null,
        replyTo: run.portfolios?.support_email ?? null,
        idempotencyKey: `scheduled-report-failed:${run.id}`,
      }]);
      failures.push({ run: run.id, status: error ? 'queue_failed' : count ? 'notified' : 'already_notified', error });
    }

    return NextResponse.json({ enqueued: enqueued ?? 0, processed: results.length, results, deliveries, failures });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
