'use server';
import { createClient } from '@/lib/supabase/server';
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
  const outputFormat = (formData.get('output_format') as string) || 'csv';
  if (!definitionId) return { error: 'definition_id required' };

  // Parameter fields can be added per-report as <input name="param_xxx"> in the form.
  const params: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith('param_') && v) params[k.slice(6)] = v;
  }
  if (!params.scope) {
    return { error: 'Report scope is required' };
  }

  const { data, error } = await (supabase as any).rpc('queue_report_run', {
    p_definition_id: definitionId,
    p_parameters: params,
    p_output_format: outputFormat,
  });
  if (error) return { error: error.message };

  revalidatePath('/reports/runs');
  redirect(`/reports/runs/${(data as any).id}`);
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
