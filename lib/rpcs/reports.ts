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

  const failTo = (msg: string) => {
    redirect(`/reports?error=${encodeURIComponent(msg)}`);
  };

  const definitionId = formData.get('definition_id') as string;
  const outputFormat = parseOutputFormat(formData.get('output_format'));
  if (!definitionId) { failTo('definition_id required'); return; }

  // Parameter fields can be added per-report as <input name="param_xxx"> in the form.
  const params: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith('param_') && v) params[k.slice(6)] = v;
  }
  if (!params.scope) {
    failTo('Report scope is required');
    return;
  }

  const { data, error } = await (supabase as any).rpc('queue_report_run', {
    p_definition_id: definitionId,
    p_parameters: params as any,
    p_output_format: outputFormat,
  });
  if (error) { failTo(error.message); return; }

  revalidatePath('/reports/runs');
  redirect(`/reports/runs/${(data as any).id}`);
}

function parseOutputFormat(value: FormDataEntryValue | null): 'pdf' | 'xlsx' | 'csv' | 'json' | 'html' {
  switch (value) {
    case 'pdf':
    case 'xlsx':
    case 'json':
    case 'html':
      return value;
    case 'csv':
    default:
      return 'csv';
  }
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
  if (error) redirect(`/reports/runs/${runId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/reports/runs');
  revalidatePath(`/reports/runs/${runId}`);
}

// ── Scheduled report actions ──

export async function toggleSchedule(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const id = formData.get('id') as string;
  const active = formData.get('active') === 'true';
  const { error } = await (supabase as any)
    .from('scheduled_reports')
    .update({ active: !active })
    .eq('id', id);
  if (error) redirect(`/scheduled-reports?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/scheduled-reports');
  revalidatePath('/reports');
}

export async function deleteSchedule(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const id = formData.get('id') as string;
  const { error } = await (supabase as any)
    .from('scheduled_reports')
    .update({ archived_at: new Date().toISOString(), active: false })
    .eq('id', id);
  if (error) redirect(`/scheduled-reports?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/scheduled-reports');
  revalidatePath('/reports');
}

export async function runScheduleNow(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const id = formData.get('id') as string;
  // Force next_run_at to now so the enqueuer picks it up
  const { error } = await (supabase as any)
    .from('scheduled_reports')
    .update({ next_run_at: new Date().toISOString() })
    .eq('id', id);
  if (error) redirect(`/scheduled-reports?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/scheduled-reports');
  revalidatePath('/reports/runs');
}

export async function createSchedule(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const definition_id = formData.get('definition_id') as string;
  const name = formData.get('name') as string;
  const frequency = formData.get('frequency') as string;
  const recipients = formData.get('recipients') as string;
  const output_format = (formData.get('output_format') as string) || 'pdf';
  const delivery_channel = (formData.get('delivery_channel') as string) || 'email';

  if (!definition_id || !name || !frequency) {
    return { error: 'definition_id, name, and frequency are required' };
  }

  // Parse recipients from comma-separated string
  const recipientList = recipients
    ? recipients.split(',').map((e) => e.trim()).filter(Boolean)
    : [];

  // Compute next_run_at — simple heuristic: next hour
  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setHours(nextRun.getHours() + 1, 0, 0, 0);

  const { data: portfolioData } = await (supabase as any)
    .from('portfolios')
    .select('id')
    .limit(1)
    .single();

  const portfolio_id = portfolioData?.id;
  if (!portfolio_id) return { error: 'No portfolio found' };

  const { error } = await (supabase as any)
    .from('scheduled_reports')
    .insert({
      definition_id,
      name,
      frequency,
      delivery_targets: recipientList,
      delivery_channel,
      output_format,
      next_run_at: nextRun.toISOString(),
      portfolio_id,
      active: true,
      hour_utc: nextRun.getUTCHours(),
    });

  if (error) return { error: error.message };

  revalidatePath('/scheduled-reports');
  revalidatePath('/reports');
  redirect('/scheduled-reports');
}
