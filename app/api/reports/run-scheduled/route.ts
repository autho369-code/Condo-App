/**
 * Hourly scheduled-report generator and durable delivery recovery worker.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { processReportRun } from '@/lib/reports/process';
import { requireCronSecret } from '@/lib/server/cron-auth';
import { queueEmails } from '@/lib/email/queue';

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

    const { data: queuedRuns, error: runLookupError } = await svc
      .from('report_runs')
      .select('id')
      .eq('status', 'queued')
      .not('scheduled_report_id', 'is', null)
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

    // Recover all still-downloadable successful runs, not just those generated
    // above. If execution stopped after generation but before queue insertion,
    // the next cron tick recovers delivery. Queue keys guarantee exactly one
    // email per run and normalized recipient across every replay.
    const recoveryCutoff = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: deliverable, error: deliveryLookupError } = await svc
      .from('report_runs')
      .select('id, portfolio_id, output_url, finished_at, portfolios(company_name, support_email), scheduled_reports:scheduled_report_id(name, delivery_channel, delivery_targets)')
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
      const targets = Array.from(new Set(
        (Array.isArray(schedule.delivery_targets) ? schedule.delivery_targets : [])
          .map((value: unknown) => String(value ?? '').trim().toLowerCase())
          .filter((value: string) => EMAIL_PATTERN.test(value) && value.length <= 320),
      )).slice(0, 100) as string[];
      if (!targets.length) {
        deliveries.push({ run: run.id, status: 'no_valid_recipients' });
        continue;
      }

      const companyName = run.portfolios?.company_name ?? 'Portier369';
      const { error, count } = await queueEmails(svc, targets.map((to) => ({
        to,
        subject: `Scheduled report: ${schedule.name}`,
        text: `Your scheduled report "${schedule.name}" is ready.\n\nDownload it here (link valid for 30 days):\n${run.output_url}`,
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

    return NextResponse.json({ enqueued: enqueued ?? 0, processed: results.length, results, deliveries });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
