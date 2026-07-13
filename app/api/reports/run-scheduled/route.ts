/**
 * GET /api/reports/run-scheduled
 * Called hourly by cron (vercel.json). Completes the scheduled-reports pipeline:
 *   1. enqueue_scheduled_reports() — turns due schedules into queued report_runs
 *      and advances each schedule's next_run_at/last_run_at (SQL, SECURITY DEFINER).
 *   2. processReportRun() — executes each queued scheduled run (CSV/JSON to the
 *      private reports bucket with a signed output_url).
 *   3. Email delivery — queues one email per delivery target with the download
 *      link, via the same email_queue pipeline the rest of the app uses.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { processReportRun } from '@/lib/reports/process';
import { requireCronSecret } from '@/lib/server/cron-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  try {
    const svc = createServiceClient() as any;

    // 1. Enqueue due schedules.
    const { data: enqueued, error: enqueueErr } = await svc.rpc('enqueue_scheduled_reports');
    if (enqueueErr) {
      return NextResponse.json({ error: `enqueue failed: ${enqueueErr.message}` }, { status: 500 });
    }

    // 2. Execute queued scheduled runs (including any left over from earlier ticks).
    const { data: runs } = await svc
      .from('report_runs')
      .select('id, scheduled_report_id')
      .eq('status', 'queued')
      .not('scheduled_report_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(25);

    const results: any[] = [];
    for (const run of runs ?? []) {
      try {
        await processReportRun(run.id);
      } catch (e: any) {
        results.push({ run: run.id, status: 'process_failed', error: e.message });
        continue;
      }

      // 3. Deliver by email when the schedule asks for it.
      const { data: done } = await svc
        .from('report_runs')
        .select('id, status, output_url, error_message, scheduled_reports:scheduled_report_id(name, delivery_channel, delivery_targets)')
        .eq('id', run.id)
        .maybeSingle();

      const sched = done?.scheduled_reports;
      const targets: string[] = Array.isArray(sched?.delivery_targets) ? sched.delivery_targets.filter(Boolean) : [];
      if (done?.status === 'succeeded' && done.output_url && sched?.delivery_channel === 'email' && targets.length > 0) {
        let queuedEmails = 0;
        for (const to of targets) {
          const { error: mailErr } = await svc.from('email_queue').insert({
            to_email: to,
            subject: `Scheduled report: ${sched.name}`,
            body_html:
              `<p>Your scheduled report <strong>${sched.name}</strong> is ready.</p>` +
              `<p><a href="${done.output_url}">Download the report</a> (link valid for 30 days).</p>`,
            status: 'pending',
          });
          if (!mailErr) queuedEmails++;
        }
        results.push({ run: run.id, status: done.status, emails_queued: queuedEmails });
      } else {
        results.push({ run: run.id, status: done?.status ?? 'unknown', error: done?.error_message ?? undefined });
      }
    }

    return NextResponse.json({ enqueued: enqueued ?? 0, processed: results.length, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
