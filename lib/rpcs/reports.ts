'use server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { generateReportOutput } from '@/lib/reports/generator';
import { reportDownloadPath } from '@/lib/reports/exporter';
import { type ReportFormat } from '@/lib/reports/exporter';
import { withReportError } from '@/lib/reports/routing';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

/**
 * Queue a report run. The DB function stamps the portfolio_id + triggered_by
 * from the session; we just pass the definition and parameters.
 *
 * A worker (edge function or queue processor) picks the row up, generates
 * the output, uploads it to the `reports` storage bucket, and sets
 * report_runs.status='succeeded' with output_url.
 */
export async function queueReport(formData: FormData) {
  const supabase = await createClient();

  const definitionId = formData.get('definition_id') as string;
  const returnTo = safeReturnTo(formData.get('return_to'));
  const outputFormat = parseOutputFormat(formData.get('output_format'));
  if (!definitionId) redirect(withReportError(returnTo, 'Report definition is required'));

  // Parameter fields can be added per-report as <input name="param_xxx"> in the form.
  const params: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith('param_') && v) params[k.slice(6)] = v;
  }
  if (!params.scope) {
    redirect(withReportError(returnTo, 'Report scope is required'));
  }

  const { data, error } = await (supabase as any).rpc('queue_report_run', {
    p_definition_id: definitionId,
    p_parameters: params as any,
    p_output_format: outputFormat,
  });
  if (error) redirect(withReportError(returnTo, error.message));

  await completeQueuedReportRun((data as any).id);

  revalidatePath('/reports/runs');
  revalidatePath(`/reports/runs/${(data as any).id}`);
  redirect(`/reports/runs/${(data as any).id}`);
}

function parseOutputFormat(value: FormDataEntryValue | null): ReportFormat {
  return value === 'xlsx' || value === 'csv' || value === 'json' || value === 'html' || value === 'pdf'
    ? value
    : 'pdf';
}

function safeReturnTo(value: FormDataEntryValue | null) {
  const path = typeof value === 'string' ? value : '';
  return path.startsWith('/reports/') ? path : '/reports';
}

async function completeQueuedReportRun(runId: string) {
  const service = createServiceClient();
  const startedAt = new Date();

  const { data: run, error: loadError } = await (service as any)
    .from('report_runs')
    .select('id, parameters, output_format, report_definitions(slug, name)')
    .eq('id', runId)
    .maybeSingle();

  if (loadError || !run) {
    await markReportFailed(service, runId, loadError?.message ?? 'Report run was not found');
    return;
  }

  try {
    await (service as any)
      .from('report_runs')
      .update({ status: 'running', started_at: startedAt.toISOString(), error_message: null })
      .eq('id', runId);

    const format = parseOutputFormat(run.output_format ?? 'pdf');
    const { body, rowCount } = await generateReportOutput(service, run, format);
    const finishedAt = new Date();

    await (service as any)
      .from('report_runs')
      .update({
        status: 'succeeded',
        row_count: rowCount,
        output_url: reportDownloadPath(runId),
        output_size_bytes: body.byteLength,
        duration_ms: finishedAt.getTime() - startedAt.getTime(),
        finished_at: finishedAt.toISOString(),
        error_message: null,
      })
      .eq('id', runId);
  } catch (error) {
    await markReportFailed(service, runId, error instanceof Error ? error.message : 'Report generation failed');
  }
}

async function markReportFailed(service: any, runId: string, message: string) {
  await service
    .from('report_runs')
    .update({
      status: 'failed',
      finished_at: new Date().toISOString(),
      error_message: message,
    })
    .eq('id', runId);
}

/**
 * Cancel a queued report run. Only works on 'queued' or 'running' — the worker
 * checks this status before each step and bails early.
 */
export async function cancelReportRun(runId: string) {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from('report_runs')
    .update({ status: 'cancelled', finished_at: new Date().toISOString() })
    .eq('id', runId)
    .in('status', ['queued', 'running']);
  if (error) return { error: error.message };
  revalidatePath('/reports/runs');
  revalidatePath(`/reports/runs/${runId}`);
}
