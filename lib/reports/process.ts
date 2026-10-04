import { createServiceClient } from '@/lib/supabase/server';
import { isSupportedReportOutputFormat, serializeReportOutput } from '@/lib/reports/output';
import { generateLiveExportRows, supportsLiveExport } from '@/lib/reports/live-export';
import { computePeriod, PERIOD_PRESETS } from '@/lib/reports/period';
import { isValidTimeZone } from '@/lib/time/display-zone';

// The missing half of the reporting pipeline: executes a queued report_run.
//
// Data comes from the report_data_dispatch() SQL function (SECURITY DEFINER,
// one case per implemented slug). Output is CSV or JSON uploaded to the
// private `reports` bucket; output_url is a 30-day signed link the run page
// renders as the download button.
//
// Slugs report_data_dispatch doesn't implement fail LOUDLY with an honest
// error_message — a failed run in the history beats a forever-"queued" one.

export async function processReportRun(runId: string): Promise<void> {
  const svc = createServiceClient() as any;
  const startedAt = Date.now();

  const { data: run } = await svc
    .from('report_runs')
    .select('id, portfolio_id, status, parameters, output_format, report_definitions:definition_id(slug, name)')
    .eq('id', runId)
    .maybeSingle();
  if (!run || !['queued', 'running'].includes(run.status)) return;

  // Claim the run atomically: only a queued run, or one stuck in "running" for
  // over 15 minutes, moves to running here. A second worker (the hourly cron
  // overlapping the request that queued it) finds nothing to claim and stops,
  // so a report is never generated twice.
  const stuckBefore = new Date(Date.now() - 15 * 60000).toISOString();
  const { data: claimed } = await svc.from('report_runs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', runId)
    .or(`status.eq.queued,and(status.eq.running,started_at.lt.${stuckBefore})`)
    .select('id');
  if (!claimed || claimed.length === 0) return;

  // duration_ms is a GENERATED column (finished_at - started_at) — never set it.
  const finish = async (patch: Record<string, unknown>) => {
    const { error } = await svc.from('report_runs').update({
      ...patch,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', runId);
    if (error) console.error('[reports] finish update failed for run', runId, error.message);
  };

  try {
    if (!isSupportedReportOutputFormat(run.output_format)) {
      await finish({
        status: 'failed',
        error_message: `Unsupported report format "${run.output_format}". This environment supports CSV, Excel, PDF and JSON.`,
      });
      return;
    }

    // Generation runs with the service role, so re-check the run against the
    // user who requested it (association scope, finance-only tax reports).
    const { data: accessError, error: accessCheckError } = await svc.rpc('report_run_access_error', { p_run_id: runId });
    if (accessCheckError || accessError) {
      await finish({ status: 'failed', error_message: accessCheckError?.message ?? String(accessError) });
      return;
    }

    // A schedule built from a custom report keeps a relative period ("last
    // month"); resolve it to dates on the day the run happens.
    const preset = typeof run.parameters?.preset === 'string' ? run.parameters.preset : '';
    if (preset && preset !== 'custom' && PERIOD_PRESETS.includes(preset) && !run.parameters?.date_from) {
      // In the schedule's own time zone: the worker has no signed-in user to
      // take a display zone from.
      const zone = typeof run.parameters?.time_zone === 'string' && isValidTimeZone(run.parameters.time_zone)
        ? run.parameters.time_zone
        : undefined;
      const period = computePeriod(preset, undefined, undefined, zone);
      run.parameters = { ...run.parameters, date_from: period.from, date_to: period.to };
    }

    const slug = run.report_definitions?.slug;
    const liveRows = supportsLiveExport(slug) ? await generateLiveExportRows(svc, run.portfolio_id, slug, run.parameters ?? {}) : null;
    const { data: result, error } = liveRows == null ? await svc.rpc('report_data_dispatch', {
      p_portfolio_id: run.portfolio_id,
      p_slug: slug,
      p_params: run.parameters ?? {},
    }) : { data: liveRows, error: null };
    if (error) {
      const notImplemented = /not implemented/i.test(error.message);
      await finish({
        status: 'failed',
        error_message: notImplemented
          ? `"${run.report_definitions?.name ?? slug}" doesn't have an automated data source yet. Live reports (financials, 1099, reserve, trust, fees) run instantly from their report page; ask support to prioritize this one.`
          : error.message,
      });
      return;
    }

    const rows: Record<string, unknown>[] = Array.isArray(result) ? result : (result?.rows ?? []);
    const parameters = (run.parameters ?? {}) as Record<string, unknown>;
    const associationId = typeof parameters.association_id === 'string' ? parameters.association_id : null;
    let scope = 'Portfolio';
    if (associationId) {
      const { data: association } = await svc
        .from('associations')
        .select('name')
        .eq('id', associationId)
        .eq('portfolio_id', run.portfolio_id)
        .maybeSingle();
      scope = association?.name ?? 'Selected association';
    }
    const output = await serializeReportOutput(run.output_format, rows, {
      title: run.report_definitions?.name ?? slug ?? 'Portier369 report',
      scope,
      dateFrom: typeof parameters.date_from === 'string' ? parameters.date_from : null,
      dateTo: typeof parameters.date_to === 'string' ? parameters.date_to : null,
    });
    const path = `${run.portfolio_id}/${runId}.${output.extension}`;

    const { error: upErr } = await svc.storage.from('reports').upload(path, output.body, {
      contentType: output.contentType,
      upsert: true,
    });
    if (upErr) {
      await finish({ status: 'failed', error_message: `Output upload failed: ${upErr.message}` });
      return;
    }

    const { data: signed, error: signErr } = await svc.storage.from('reports').createSignedUrl(path, 60 * 60 * 24 * 30);
    if (signErr || !signed?.signedUrl) {
      await finish({ status: 'failed', error_message: `Output signing failed: ${signErr?.message ?? 'No signed URL was returned'}` });
      return;
    }
    await finish({
      status: 'succeeded',
      output_url: signed.signedUrl,
      output_size_bytes: output.body.byteLength,
      row_count: rows.length,
    });
  } catch (e: any) {
    await finish({ status: 'failed', error_message: e?.message ?? 'Unexpected error while generating the report.' });
  }
}
