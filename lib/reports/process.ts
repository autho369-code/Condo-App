import { createServiceClient } from '@/lib/supabase/server';
import { isSupportedReportOutputFormat, serializeReportOutput } from '@/lib/reports/output';
import { generateLiveExportRows, supportsLiveExport } from '@/lib/reports/live-export';

// The missing half of the reporting pipeline: executes a queued report_run.
//
// Data comes from the report_data_dispatch() SQL function (SECURITY DEFINER,
// one case per implemented slug). Output is CSV or JSON uploaded to the
// private `reports` bucket; output_url is a 30-day signed link the run page
// renders as the download button.
//
// Slugs report_data_dispatch doesn't implement fail LOUDLY with an honest
// error_message â€” a failed run in the history beats a forever-"queued" one.

export async function processReportRun(runId: string): Promise<void> {
  const svc = createServiceClient() as any;
  const startedAt = Date.now();

  const { data: run } = await svc
    .from('report_runs')
    .select('id, portfolio_id, status, parameters, output_format, report_definitions:definition_id(slug, name)')
    .eq('id', runId)
    .maybeSingle();
  if (!run || !['queued', 'running'].includes(run.status)) return;

  await svc.from('report_runs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', runId);

  // duration_ms is a GENERATED column (finished_at - started_at) â€” never set it.
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
        error_message: `Unsupported report format "${run.output_format}". This environment supports CSV, JSON, and PDF.`,
      });
      return;
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
    const output = serializeReportOutput(run.output_format, rows, {
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

    const { data: signed } = await svc.storage.from('reports').createSignedUrl(path, 60 * 60 * 24 * 30);
    await finish({
      status: 'succeeded',
      output_url: signed?.signedUrl ?? null,
      output_size_bytes: output.body.byteLength,
      row_count: rows.length,
    });
  } catch (e: any) {
    await finish({ status: 'failed', error_message: e?.message ?? 'Unexpected error while generating the report.' });
  }
}
