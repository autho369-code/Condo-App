'use server';
import { LIVE_ONLY_REPORT_SLUGS } from '@/lib/reports/catalog';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { SUPPORTED_REPORT_OUTPUT_FORMATS } from '@/lib/reports/formats';
import { PERIOD_PRESETS } from '@/lib/reports/period';
import { SCHEDULE_FREQUENCIES } from '@/lib/reports/schedule';
import { displayTimeZone, isValidTimeZone } from '@/lib/time/display-zone';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CHANNELS = ['email', 'download_only'];
const MAX_RECIPIENTS = 25;

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function fail(back: string, message: string): never {
  redirect(`${back}${back.includes('?') ? '&' : '?'}error=${encodeURIComponent(message)}`);
}

/**
 * A custom report's saved filters, in the parameter names report runs use
 * (association_id, date_from, date_to). A relative period ("last month") is
 * kept as `preset` and resolved on the day each run happens.
 */
function runParameters(saved: Record<string, unknown> | null | undefined) {
  const p = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>;
  const str = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : '');
  const out: Record<string, string> = { scope: /^[a-z_]{1,40}$/.test(str('scope')) ? str('scope') : 'portfolio' };
  const association = str('association') || str('association_id');
  if (UUID.test(association)) {
    out.association_id = association;
    if (!str('scope')) out.scope = 'association';
  }
  const preset = str('preset');
  if (preset === 'custom') {
    const from = str('from') || str('date_from');
    const to = str('to') || str('date_to');
    if (DATE.test(from)) out.date_from = from;
    if (DATE.test(to)) out.date_to = to;
  } else if (PERIOD_PRESETS.includes(preset)) {
    out.preset = preset;
  }
  // The ledger exporter reads gl_account_id.
  if (UUID.test(str('account'))) out.gl_account_id = str('account');
  return out;
}

/** Create or edit a scheduled report. */
export async function saveScheduledReport(formData: FormData) {
  const me = await requireStaff();
  const scheduleId = text(formData, 'schedule_id');
  if (scheduleId && !UUID.test(scheduleId)) redirect('/scheduled-reports');
  const back = scheduleId ? `/scheduled-reports/${scheduleId}` : '/scheduled-reports/new';
  const db = (await createClient()) as any;

  // The report: a standard report ("def:<id>") or a custom report ("saved:<id>").
  const source = text(formData, 'source');
  const [kind, sourceId] = source.split(':');
  if (!['def', 'saved'].includes(kind) || !UUID.test(sourceId ?? '')) fail(back, 'Choose a report.');
  let definitionId = sourceId;
  let savedReportId: string | null = null;
  let parameters: Record<string, string> = { scope: 'portfolio' };
  if (kind === 'saved') {
    const { data: saved } = await db.from('saved_reports').select('id, definition_id, parameters').eq('id', sourceId).maybeSingle();
    if (!saved) fail(back, 'That custom report was not found.');
    definitionId = saved.definition_id;
    savedReportId = saved.id;
    parameters = runParameters(saved.parameters);
  }
  const { data: def } = await db.from('report_definitions').select('id, slug').eq('id', definitionId).eq('active', true).maybeSingle();
  if (!def) fail(back, 'That report is not available.');
  if (LIVE_ONLY_REPORT_SLUGS.has(def.slug)) fail(back, 'This report runs live on its own page and cannot be scheduled.');
  // The same access rule every run is generated under, checked now so a
  // schedule that could never run isn't saved.
  const { data: accessError, error: accessCheckError } = await db.rpc('report_params_access_error', {
    p_portfolio_id: me.portfolio?.id, p_slug: def.slug, p_params: parameters,
  });
  if (accessCheckError || accessError) fail(back, accessCheckError?.message ?? String(accessError));

  const name = text(formData, 'name').slice(0, 120);
  if (!name) fail(back, 'Enter a name for this schedule.');

  const frequency = text(formData, 'frequency');
  if (!(SCHEDULE_FREQUENCIES as readonly string[]).includes(frequency)) fail(back, 'Choose how often the report runs.');
  const weekly = frequency === 'weekly' || frequency === 'biweekly';
  const dated = ['monthly', 'quarterly', 'annually'].includes(frequency);
  const dayOfWeek = Number(text(formData, 'day_of_week') || '1');
  const dayOfMonth = Number(text(formData, 'day_of_month') || '1');
  if (weekly && !(Number.isInteger(dayOfWeek) && dayOfWeek >= 0 && dayOfWeek <= 6)) fail(back, 'Choose a day of the week.');
  if (dated && !(Number.isInteger(dayOfMonth) && dayOfMonth >= 1 && dayOfMonth <= 31)) fail(back, 'Choose a day of the month from 1 to 31.');

  const localHour = Number(text(formData, 'hour'));
  if (!(Number.isInteger(localHour) && localHour >= 0 && localHour <= 23)) fail(back, 'Choose a time of day.');
  // The schedule keeps its local time and zone, so it runs at the same wall-clock
  // time across daylight-saving changes.
  const timeZone = displayTimeZone();
  if (!isValidTimeZone(timeZone)) fail(back, 'Your company time zone is not set correctly.');
  // Relative periods ("last month") resolve in this zone on each run day.
  parameters = { ...parameters, time_zone: timeZone };

  const outputFormat = text(formData, 'output_format') || 'pdf';
  if (!(SUPPORTED_REPORT_OUTPUT_FORMATS as readonly string[]).includes(outputFormat)) fail(back, 'Choose a file format.');
  const channel = text(formData, 'delivery_channel') || 'email';
  if (!CHANNELS.includes(channel)) fail(back, 'Choose how the report is delivered.');

  const recipients = [...new Set(text(formData, 'delivery_targets').split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean))];
  const bad = recipients.find((r) => !EMAIL.test(r));
  if (bad) fail(back, `"${bad}" is not an email address.`);
  if (channel === 'email' && recipients.length === 0) fail(back, 'Add at least one recipient email.');
  if (recipients.length > MAX_RECIPIENTS) fail(back, `Add at most ${MAX_RECIPIENTS} recipients.`);

  const { data: nextRun, error: nextError } = await db.rpc('scheduled_report_next_run', {
    p_frequency: frequency,
    p_day_of_week: weekly ? dayOfWeek : null,
    p_day_of_month: dated ? dayOfMonth : null,
    p_hour: localHour,
    p_time_zone: timeZone,
    p_after: new Date().toISOString(),
  });
  if (nextError || !nextRun) fail(back, nextError?.message ?? 'Could not work out the next run.');

  const row: Record<string, unknown> = {
    definition_id: definitionId,
    saved_report_id: savedReportId,
    parameters,
    name,
    frequency,
    day_of_week: weekly ? dayOfWeek : null,
    day_of_month: dated ? dayOfMonth : null,
    local_hour: localHour,
    time_zone: timeZone,
    // Kept for reference; runs are scheduled from local_hour and time_zone.
    hour_utc: new Date(nextRun).getUTCHours(),
    next_run_at: nextRun,
    output_format: outputFormat,
    delivery_channel: channel,
    delivery_targets: recipients,
  };

  if (scheduleId) {
    const { data, error } = await db.from('scheduled_reports').update(row).eq('id', scheduleId).is('archived_at', null).select('id').maybeSingle();
    if (error) fail(back, error.message);
    if (!data) fail(back, 'You cannot edit this schedule.');
  } else {
    if (!me.portfolio?.id) fail(back, 'Schedules are saved to a company; sign in to one first.');
    const { data, error } = await db.from('scheduled_reports')
      .insert({ ...row, portfolio_id: me.portfolio.id, active: true, created_by: me.auth_user_id })
      .select('id')
      .maybeSingle();
    if (error) fail(back, error.message);
    if (!data) fail(back, 'You cannot schedule reports.');
  }
  revalidatePath('/scheduled-reports');
  redirect(`/scheduled-reports?saved=${scheduleId ? 'updated' : 'created'}`);
}

/** Pause or resume a schedule. Resuming recomputes the next run from now. */
export async function setScheduleActive(formData: FormData) {
  await requireStaff();
  const id = text(formData, 'id');
  if (!UUID.test(id)) fail('/scheduled-reports', 'Unknown schedule.');
  const active = text(formData, 'active') === '1';
  const db = (await createClient()) as any;
  const patch: Record<string, unknown> = { active };
  if (active) {
    const { data: row } = await db.from('scheduled_reports').select('frequency, day_of_week, day_of_month, hour_utc, local_hour, time_zone').eq('id', id).maybeSingle();
    if (!row) fail('/scheduled-reports', 'Schedule not found.');
    const { data: nextRun } = await db.rpc('scheduled_report_next_run', {
      p_frequency: row.frequency,
      p_day_of_week: row.day_of_week,
      p_day_of_month: row.day_of_month,
      // Same rule as the enqueuer: older schedules run on hour_utc in UTC.
      p_hour: row.local_hour ?? row.hour_utc,
      p_time_zone: row.local_hour == null ? 'UTC' : row.time_zone,
      p_after: new Date().toISOString(),
    });
    // A paused schedule would otherwise run at once for every period it missed.
    if (nextRun) patch.next_run_at = nextRun;
  }
  const { data, error } = await db.from('scheduled_reports').update(patch).eq('id', id).is('archived_at', null).select('id').maybeSingle();
  if (error) fail('/scheduled-reports', error.message);
  if (!data) fail('/scheduled-reports', 'You cannot change this schedule.');
  revalidatePath('/scheduled-reports');
  redirect(`/scheduled-reports?saved=${active ? 'resumed' : 'paused'}`);
}

/** Delete a schedule (soft delete; its past runs stay in Report history). */
export async function archiveSchedule(formData: FormData) {
  await requireStaff();
  const id = text(formData, 'id');
  if (!UUID.test(id)) fail('/scheduled-reports', 'Unknown schedule.');
  const db = (await createClient()) as any;
  const { data, error } = await db.from('scheduled_reports')
    .update({ archived_at: new Date().toISOString(), active: false })
    .eq('id', id)
    .is('archived_at', null)
    .select('id')
    .maybeSingle();
  if (error) fail('/scheduled-reports', error.message);
  if (!data) fail('/scheduled-reports', 'You cannot delete this schedule.');
  revalidatePath('/scheduled-reports');
  redirect('/scheduled-reports?saved=deleted');
}
