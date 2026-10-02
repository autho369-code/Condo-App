'use server';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isSupportedReportOutputFormat } from '@/lib/reports/output';

/**
 * Queue a report run. The DB function stamps the portfolio_id + triggered_by
 * from the session; we just pass the definition and parameters.
 *
 * A worker (edge function or queue processor) picks the row up, generates
 * the output, uploads it to the `reports` storage bucket, and sets
 * report_runs.status='succeeded' with output_url.
 */
export async function queueReport(formData: FormData) {
  await requireStaff();  // in-action guard: server actions are callable endpoints
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

  // Process synchronously so the run page shows a finished result (or an
  // honest failure) instead of a forever-"queued" row — there is no
  // background worker for report runs.
  const { processReportRun } = await import('@/lib/reports/process');
  try {
    await processReportRun((data as any).id);
  } catch (e) {
    console.error('[reports] processReportRun failed for run', (data as any).id, e);
  }

  revalidatePath('/reports/runs');
  redirect(`/reports/runs/${(data as any).id}`);
}

function parseOutputFormat(value: FormDataEntryValue | null): 'pdf' | 'csv' | 'json' {
  return isSupportedReportOutputFormat(value) ? value : 'csv';
}

/**
 * Cancel a queued report run. Only works on 'queued' or 'running' — the worker
 * checks this status before each step and bails early.
 */
export async function cancelReportRun(runId: string) {
  await requireStaff();  // in-action guard: server actions are callable endpoints
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
  await requireStaff();  // in-action guard: server actions are callable endpoints
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
  await requireStaff();  // in-action guard: server actions are callable endpoints
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
  await requireStaff();  // in-action guard: server actions are callable endpoints
  const supabase = await createClient();
  const id = formData.get('id') as string;

  // Scope check before any service-role work: the schedule must be visible to
  // the caller under RLS (their own portfolio). A silent 0-row update would
  // otherwise let any staff trigger the global enqueue pipeline.
  const { data: owned } = await (supabase as any)
    .from('scheduled_reports')
    .select('id, active')
    .eq('id', id)
    .maybeSingle();
  if (!owned) redirect(`/scheduled-reports?error=${encodeURIComponent('Schedule not found in your portfolio.')}`);
  // The enqueuer skips paused schedules, so "Run now" did nothing yet reported success.
  if (owned.active === false) redirect(`/scheduled-reports?error=${encodeURIComponent('This schedule is paused. Resume it, then use Run now.')}`);

  // Force next_run_at to now so the enqueuer picks it up...
  const { error } = await (supabase as any)
    .from('scheduled_reports')
    .update({ next_run_at: new Date().toISOString() })
    .eq('id', id);
  if (error) redirect(`/scheduled-reports?error=${encodeURIComponent(error.message)}`);

  // ...then run the enqueue + execute pipeline immediately instead of waiting
  // for the hourly cron tick, so "Run now" actually produces a run.
  const { createServiceClient } = await import('@/lib/supabase/server');
  const { processReportRun } = await import('@/lib/reports/process');
  const svc = createServiceClient() as any;
  await svc.rpc('enqueue_scheduled_reports');
  const { data: runs } = await svc
    .from('report_runs')
    .select('id')
    .eq('status', 'queued')
    .eq('scheduled_report_id', id)
    .order('created_at', { ascending: true })
    .limit(3);
  if (!runs || runs.length === 0) redirect(`/scheduled-reports?error=${encodeURIComponent('No run was queued for this schedule. Check its recipients and report, then try again.')}`);
  for (const run of runs ?? []) {
    try { await processReportRun(run.id); } catch { /* run row records its own failure */ }
  }

  revalidatePath('/scheduled-reports');
  revalidatePath('/reports/runs');
  redirect('/scheduled-reports?ran=1');
}

export async function createSchedule(formData: FormData) {
  const me = await requireStaff();  // in-action guard: server actions are callable endpoints
  const supabase = await createClient();
  const failTo = (msg: string) => {
    redirect(`/scheduled-reports?error=${encodeURIComponent(msg)}`);
  };
  const definition_id = formData.get('definition_id') as string;
  const name = formData.get('name') as string;
  const frequency = formData.get('frequency') as string;
  const recipients = formData.get('recipients') as string;
  const output_format = (formData.get('output_format') as string) || 'pdf';
  const delivery_channel = (formData.get('delivery_channel') as string) || 'email';

  if (!definition_id || !name || !frequency) {
    failTo('definition_id, name, and frequency are required');
    return;
  }

  // Parse recipients from comma-separated string
  const recipientList = recipients
    ? recipients.split(',').map((e) => e.trim()).filter(Boolean)
    : [];

  // Compute next_run_at — simple heuristic: next hour
  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setHours(nextRun.getHours() + 1, 0, 0, 0);

  // The caller's own company (an arbitrary first portfolio was picked before,
  // which for a platform operator could be any tenant).
  const portfolio_id = me.portfolio?.id;
  if (!portfolio_id) { failTo('No portfolio found'); return; }

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

  if (error) { failTo(error.message); return; }

  revalidatePath('/scheduled-reports');
  revalidatePath('/reports');
  redirect('/scheduled-reports');
}

const REPORT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REPORT_DATE = /^\d{4}-\d{2}-\d{2}$/;
const REPORT_PRESETS = ['this_month', 'last_month', 'this_quarter', 'last_quarter', 'ytd', 'last_year', 'custom'];

/** Only same-site report paths are valid places to return to. */
function reportsReturnTo(formData: FormData) {
  const back = String(formData.get('return_to') ?? '/reports');
  return back.startsWith('/reports') && !back.startsWith('//') ? back : '/reports';
}

/** The report pages render no alerts of their own, so errors go to the Reports index. */
function failReports(message: string) {
  return `/reports?error=${encodeURIComponent(message)}`;
}

function withParam(path: string, key: string, value: string) {
  const url = new URL(path, 'http://x');
  url.searchParams.delete('error');
  url.searchParams.delete('saved_report');
  url.searchParams.delete('favorite');
  url.searchParams.set(key, value);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

/** Star or unstar a report for the signed-in user. */
export async function toggleReportFavorite(formData: FormData) {
  const me = await requireStaff();
  const back = reportsReturnTo(formData);
  const definitionId = String(formData.get('definition_id') ?? '');
  if (!REPORT_UUID.test(definitionId)) redirect(failReports('Unknown report.'));
  const db = (await createClient()) as any;
  const { data: def } = await db.from('report_definitions').select('id').eq('id', definitionId).eq('active', true).maybeSingle();
  if (!def) redirect(failReports('Unknown report.'));

  if (formData.get('favorite') === '1') {
    const { error } = await db.from('report_favorites')
      .upsert({ user_id: me.auth_user_id, definition_id: definitionId }, { onConflict: 'user_id,definition_id', ignoreDuplicates: true });
    if (error) redirect(failReports(error.message));
  } else {
    const { error } = await db.from('report_favorites').delete().eq('user_id', me.auth_user_id).eq('definition_id', definitionId);
    if (error) redirect(failReports(error.message));
  }
  revalidatePath('/reports');
  redirect(back);
}

/** Save a report with its current filters as a custom report for the company. */
export async function saveCustomReport(formData: FormData) {
  const me = await requireStaff();
  const back = reportsReturnTo(formData);
  const definitionId = String(formData.get('definition_id') ?? '');
  const name = String(formData.get('name') ?? '').trim().slice(0, 120);
  if (!REPORT_UUID.test(definitionId)) redirect(failReports('Unknown report.'));
  if (!name) redirect(failReports('Enter a name for the custom report.'));
  if (!me.portfolio?.id) redirect(failReports('Custom reports are saved to a company; sign in to one first.'));

  const db = (await createClient()) as any;
  const { data: def } = await db.from('report_definitions').select('id').eq('id', definitionId).eq('active', true).maybeSingle();
  if (!def) redirect(failReports('Unknown report.'));

  const str = (k: string) => String(formData.get(k) ?? '').trim();
  const parameters: Record<string, string> = {};
  const preset = str('preset');
  if (REPORT_PRESETS.includes(preset)) parameters.preset = preset;
  if (preset === 'custom') {
    if (REPORT_DATE.test(str('from'))) parameters.from = str('from');
    if (REPORT_DATE.test(str('to'))) parameters.to = str('to');
  }
  const association = str('association');
  if (association) {
    if (!REPORT_UUID.test(association)) redirect(failReports('Unknown association.'));
    // RLS: the association must be one this staffer can see.
    const { data: assoc } = await db.from('associations').select('id').eq('id', association).maybeSingle();
    if (!assoc) redirect(failReports('Unknown association.'));
    parameters.association = association;
  }
  if (/^[a-z_]{1,40}$/.test(str('scope'))) parameters.scope = str('scope');
  if (REPORT_UUID.test(str('account'))) parameters.account = str('account');

  const { data, error } = await db.from('saved_reports').insert({
    portfolio_id: me.portfolio.id,
    definition_id: definitionId,
    user_id: me.auth_user_id,
    name,
    parameters,
  }).select('id').maybeSingle();
  if (error) redirect(failReports(error.message));
  if (!data) redirect(failReports('You cannot save custom reports.'));
  revalidatePath('/reports');
  redirect('/reports?tab=custom&saved_report=1');
}

/** Pin a custom report to Favorites, or unpin it. */
export async function toggleSavedReportPin(formData: FormData) {
  await requireStaff();
  const back = reportsReturnTo(formData);
  const id = String(formData.get('saved_report_id') ?? '');
  if (!REPORT_UUID.test(id)) redirect(failReports('Unknown custom report.'));
  const db = (await createClient()) as any;
  const { data, error } = await db.from('saved_reports')
    .update({ pinned: formData.get('pinned') === '1' })
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) redirect(failReports(error.message));
  if (!data) redirect(failReports('You cannot change this custom report.'));
  revalidatePath('/reports');
  redirect(back);
}

/** Delete a custom report (the standard report it was built on is unaffected). */
export async function deleteSavedReport(formData: FormData) {
  await requireStaff();
  const back = reportsReturnTo(formData);
  const id = String(formData.get('saved_report_id') ?? '');
  if (!REPORT_UUID.test(id)) redirect(failReports('Unknown custom report.'));
  const db = (await createClient()) as any;
  const { data, error } = await db.from('saved_reports').delete().eq('id', id).select('id').maybeSingle();
  if (error) redirect(failReports(error.message));
  if (!data) redirect(failReports('You cannot delete this custom report.'));
  revalidatePath('/reports');
  redirect(withParam(back, 'deleted', '1'));
}
