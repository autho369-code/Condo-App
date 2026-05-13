'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/me';
import { computeNextScheduledReportRun } from '@/lib/reports/schedule';
import { createClient } from '@/lib/supabase/server';

export async function createScheduledReport(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();

  const definitionId = stringField(formData, 'definition_id');
  const name = stringField(formData, 'name');
  const frequency = scheduleFrequency(formData.get('frequency'));
  const hourUtc = numberField(formData, 'hour_utc', 9);
  const dayOfWeek = numberField(formData, 'day_of_week', 1);
  const dayOfMonth = numberField(formData, 'day_of_month', 1);
  const outputFormat = reportFormat(formData.get('output_format'));
  const deliveryChannel = deliveryChannelValue(formData.get('delivery_channel'));

  if (!definitionId || !name || !me.portfolio?.id) {
    redirect('/scheduled-reports/new?error=Missing+required+fields');
  }

  const parameters = {
    scope: stringField(formData, 'param_scope') || 'portfolio',
    association_id: stringField(formData, 'param_association_id') || undefined,
    date_from: stringField(formData, 'param_date_from') || undefined,
    date_to: stringField(formData, 'param_date_to') || undefined,
  };

  const { error } = await (supabase as any).from('scheduled_reports').insert({
    name,
    definition_id: definitionId,
    portfolio_id: me.portfolio.id,
    created_by: me.auth_user_id,
    frequency,
    day_of_week: frequency === 'weekly' || frequency === 'biweekly' ? dayOfWeek : null,
    day_of_month: frequency === 'monthly' || frequency === 'quarterly' || frequency === 'annually' ? dayOfMonth : null,
    hour_utc: hourUtc,
    output_format: outputFormat,
    delivery_channel: deliveryChannel,
    delivery_targets: [],
    parameters,
    next_run_at: computeNextScheduledReportRun({ frequency, hourUtc, dayOfWeek, dayOfMonth }),
    active: true,
  });

  if (error) {
    redirect(`/scheduled-reports/new?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/scheduled-reports');
  redirect('/scheduled-reports');
}

function stringField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function numberField(formData: FormData, name: string, fallback: number) {
  const value = Number(formData.get(name));
  return Number.isFinite(value) ? value : fallback;
}

function scheduleFrequency(value: FormDataEntryValue | null) {
  switch (value) {
    case 'daily':
    case 'weekly':
    case 'biweekly':
    case 'monthly':
    case 'quarterly':
    case 'annually':
      return value;
    default:
      return 'weekly';
  }
}

function reportFormat(value: FormDataEntryValue | null) {
  switch (value) {
    case 'pdf':
    case 'xlsx':
    case 'json':
    case 'html':
      return value;
    case 'csv':
      return 'csv';
    default:
      return 'pdf';
  }
}

function deliveryChannelValue(value: FormDataEntryValue | null) {
  switch (value) {
    case 'email':
    case 'portal':
    case 'webhook':
      return value;
    case 'download_only':
    default:
      return 'download_only';
  }
}
