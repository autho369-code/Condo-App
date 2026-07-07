import { createServiceClient } from '@/lib/supabase/server';

// The missing half of the reporting pipeline: executes a queued report_run.
//
// Data comes from the report_data_dispatch() SQL function (SECURITY DEFINER,
// one case per implemented slug). Output is CSV or JSON uploaded to the
// private `reports` bucket; output_url is a 30-day signed link the run page
// renders as the download button.
//
// Slugs report_data_dispatch doesn't implement fail LOUDLY with an honest
// error_message — a failed run in the history beats a forever-"queued" one.

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return 'No data\n';
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((h) => esc(row[h])).join(','));
  return lines.join('\n') + '\n';
}

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
    const slug = run.report_definitions?.slug;
    const { data: result, error } = await svc.rpc('report_data_dispatch', {
      p_portfolio_id: run.portfolio_id,
      p_slug: slug,
      p_params: run.parameters ?? {},
    });
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
    const wantJson = run.output_format === 'json';
    const body = wantJson ? JSON.stringify(rows, null, 2) : toCsv(rows);
    const ext = wantJson ? 'json' : 'csv';
    const path = `${run.portfolio_id}/${runId}.${ext}`;

    const { error: upErr } = await svc.storage.from('reports').upload(path, Buffer.from(body, 'utf8'), {
      contentType: wantJson ? 'application/json' : 'text/csv',
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
      output_size_bytes: Buffer.byteLength(body, 'utf8'),
      row_count: rows.length,
    });
  } catch (e: any) {
    await finish({ status: 'failed', error_message: e?.message ?? 'Unexpected error while generating the report.' });
  }
}
