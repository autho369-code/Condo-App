'use server';
import { LIVE_ONLY_REPORT_SLUGS } from '@/lib/reports/catalog';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { revalidatePath } from 'next/cache';

const str = (f: FormData, k: string) => { const v = f.get(k); return typeof v === 'string' && v.trim() !== '' ? v.trim() : null; };
const req = (f: FormData, k: string) => { const v = str(f, k); if (!v) throw new Error(`${k} is required`); return v; };

/* ================================================================
   BULK CHARGES — create charges for multiple units at once
   ================================================================ */
export async function createBulkCharges(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const dueDate = str(formData, 'due_date') || undefined;
  const description = str(formData, 'description') || 'Assessment charge';
  const chargeCategoryId = str(formData, 'charge_category_id') || undefined;
  const glAccountId = str(formData, 'gl_account_id') || undefined;

  const unitIds = formData.getAll('unit_ids').filter((v): v is string => typeof v === 'string');
  const amounts = formData.getAll('amounts').filter((v): v is string => typeof v === 'string');

  if (unitIds.length === 0) return { error: 'No units selected' };

  const charges = unitIds.map((uid, i) => ({
    unit_id: uid,
    amount: parseFloat(amounts[i] || '0'),
    description: str(formData, `desc_${i}`) || description,
    due_date: str(formData, `due_${i}`) || dueDate,
  }));

  const { data, error } = await db.rpc('bulk_create_charges', {
    p_charges: charges,
    p_charge_category_id: chargeCategoryId,
    p_due_date: dueDate,
    p_description: description,
    p_gl_account_id: glAccountId,
  });

  if (error) return { error: error.message };

  revalidatePath('/charges');
  revalidatePath('/charges/bulk');
  revalidatePath('/accounting');
  return { success: true, count: (data as any)?.inserted_count ?? 0, charge_ids: (data as any)?.charge_ids ?? [] };
}

/* ================================================================
   BULK RECURRING CHARGES — create subscriptions for multiple units
   ================================================================ */
export async function createBulkRecurringCharges(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const frequency = req(formData, 'frequency');
  const startDate = str(formData, 'start_date') || undefined;
  const memo = str(formData, 'memo') || undefined;
  const chargeCategoryId = str(formData, 'charge_category_id') || undefined;

  const unitIds = formData.getAll('unit_ids').filter((v): v is string => typeof v === 'string');
  const amounts = formData.getAll('amounts').filter((v): v is string => typeof v === 'string');

  if (unitIds.length === 0) return { error: 'No units selected' };

  const subscriptions = unitIds.map((uid, i) => ({
    unit_id: uid,
    amount: parseFloat(amounts[i] || '0'),
    frequency,
    start_date: str(formData, `start_${i}`) || startDate,
    memo: str(formData, `memo_${i}`) || memo,
  }));

  const { data, error } = await db.rpc('bulk_create_recurring_charges', {
    p_subscriptions: subscriptions,
    p_charge_category_id: chargeCategoryId,
    p_frequency: frequency,
    p_start_date: startDate,
    p_memo: memo,
  });

  if (error) return { error: error.message };

  revalidatePath('/charges');
  revalidatePath('/charges/bulk-recurring');
  return { success: true, count: (data as any)?.inserted_count ?? 0, subscription_ids: (data as any)?.subscription_ids ?? [] };
}

/* ================================================================
   BULK REPORTS — queue multiple reports for multiple associations
   ================================================================ */
export async function queueBulkReports(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const associationIds = formData.getAll('association_ids').filter((v): v is string => typeof v === 'string');
  const reportSlugs = formData.getAll('report_slugs').filter((v): v is string => typeof v === 'string');
  const dateStart = str(formData, 'date_start') || undefined;
  const dateEnd = str(formData, 'date_end') || undefined;
  const outputFormat = str(formData, 'output_format') || 'csv';

  if (associationIds.length === 0) return { error: 'No associations selected' };
  if (reportSlugs.length === 0) return { error: 'No report types selected' };
  if (reportSlugs.some((slug) => LIVE_ONLY_REPORT_SLUGS.has(slug))) return { error: 'Owner 1099 reports run live on their own page and cannot be queued.' };

  const { data, error } = await db.rpc('bulk_queue_reports', {
    p_association_ids: associationIds,
    p_report_slugs: reportSlugs,
    p_scope: 'association',
    p_date_start: dateStart,
    p_date_end: dateEnd,
    p_output_format: outputFormat,
  });

  if (error) return { error: error.message };

  // bulk_queue_reports returns a set: PostgREST hands back [{ queued_count, run_ids }].
  const row = (Array.isArray(data) ? data[0] : data) as { queued_count?: number; run_ids?: string[] } | null;
  const runIds = row?.run_ids ?? [];
  // These runs have no scheduled_report_id, so the cron never picks them up;
  // process them now (as queueReport does) instead of leaving them "queued".
  const { processReportRun } = await import('@/lib/reports/process');
  for (const id of runIds) {
    try { await processReportRun(id); } catch { /* the run row records its own failure */ }
  }

  revalidatePath('/reports');
  revalidatePath('/reports/bulk-association');
  revalidatePath('/reports/runs');
  return { success: true, count: row?.queued_count ?? runIds.length, run_ids: runIds };
}

/* ================================================================
   SEND STATEMENTS — generate & send statements to all owners
   ================================================================ */
export async function sendOwnerStatements(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const associationId = req(formData, 'association_id');
  const periodStart = req(formData, 'period_start');
  const periodEnd = req(formData, 'period_end');
  const batchName = str(formData, 'batch_name') || undefined;
  const deliveryChannel = str(formData, 'delivery_channel') || 'email';

  const { data, error } = await db.rpc('generate_owner_statements', {
    p_association_id: associationId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_delivery_channel: deliveryChannel,
    p_batch_name: batchName,
  });

  if (error) return { error: error.message };
  const batchId = data as string;

  // Deliver. generate_owner_statements only records the statements; nothing
  // ever emailed them, so "Generate & Send" sent nothing.
  let sent = 0;
  let skipped = 0;
  if (deliveryChannel === 'email') {
    const { data: statements, error: loadError } = await db
      .from('owner_statements')
      .select('id, owner_id, period_start, period_end, amount_due, amount_past_due, amount_prepaid, total_due, owners(full_name, email), units(unit_number), associations(name)')
      .eq('batch_id', batchId);
    if (loadError) return { error: `Statements were generated but could not be loaded for sending: ${loadError.message}` };

    const { queueEmails } = await import('@/lib/email/queue');
    const { tenantWorkspaceUrl } = await import('@/lib/tenant/host');
    const ledgerUrl = tenantWorkspaceUrl(me.portfolio?.slug, '/portal/ledger');
    const fmt = (n: unknown) => Number(n ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    const sendable = (statements ?? []).filter((s: any) => s.owners?.email);
    const failedIds = (statements ?? []).filter((s: any) => !s.owners?.email).map((s: any) => s.id);
    const queued = await queueEmails(db, sendable.map((s: any) => ({
      to: s.owners.email,
      toName: s.owners.full_name,
      subject: `Your ${s.associations?.name ?? 'association'} statement — Unit ${s.units?.unit_number ?? ''}`.trim(),
      text: [
        `Hello ${s.owners.full_name},`,
        '',
        `Here is your statement for Unit ${s.units?.unit_number ?? ''} at ${s.associations?.name ?? 'your association'}, ${s.period_start} to ${s.period_end}.`,
        '',
        `Past due: ${fmt(s.amount_past_due)}`,
        `Current charges due: ${fmt(s.amount_due)}`,
        `Total due: ${fmt(s.total_due)}`,
        ...(Number(s.amount_prepaid) > 0 ? [`Credit on account: ${fmt(s.amount_prepaid)}`] : []),
        '',
        `See every charge and payment, and pay online, in your owner portal: ${ledgerUrl}`,
        '',
        `${me.portfolio?.company_name ?? 'Your management office'}`,
      ].join('\n'),
      portfolioId: me.portfolio?.id,
      associationId,
      fromName: me.portfolio?.company_name ?? null,
      sentBy: me.auth_user_id,
      ownerId: s.owner_id,
      idempotencyKey: `owner-statement:${s.id}`,
    })));
    if (queued.error) return { error: `Statements were generated but could not be queued for email: ${queued.error}` };
    const { error: markError } = await db.rpc('mark_owner_statement_delivery', {
      p_batch_id: batchId,
      p_sent_statement_ids: sendable.map((s: any) => s.id),
      p_failed_statement_ids: failedIds,
    });
    if (markError) return { error: `Statements were emailed but their delivery status was not saved: ${markError.message}` };
    sent = sendable.length;
    skipped = failedIds.length;
  }

  revalidatePath('/statements/send');
  revalidatePath('/reports');
  return { success: true, batch_id: batchId, sent, skipped };
}

/* ================================================================
   BULK STATEMENT SETTINGS — update statement config for associations
   ================================================================ */
export async function bulkUpdateStatementSettings(formData: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const associationIds = [...new Set(
    formData.getAll('association_ids').filter((v): v is string => typeof v === 'string' && v.length > 0),
  )];
  if (associationIds.length === 0) return { error: 'No associations selected' };
  if (associationIds.length > 500) return { error: 'At most 500 associations may be updated at once' };

  const settings: Record<string, boolean | string> = {};
  const booleanFields = [
    'use_enhanced_statement', 'include_current_and_upcoming_charges',
    'include_upcoming_in_amount_due', 'include_current_message_on_statement',
    'include_logo_on_statement', 'include_payments_due_date',
    'include_payments_history_and_balance_forward', 'show_remaining_amount_for_past_due_charges',
    'include_payment_coupon_on_statement',
  ];

  for (const field of booleanFields) {
    const val = str(formData, field);
    if (val !== null) settings[field] = val === 'true';
  }

  const textFields = ['upcoming_charges_timeframe', 'charge_history_includes'];
  for (const field of textFields) {
    const val = str(formData, field);
    if (val === null) continue;
    const allowed = field === 'upcoming_charges_timeframe'
      ? ['next_month', 'next_quarter', 'next_year']
      : [
          'all_past_due_charges', 'current_and_past_due', 'all_charges',
          'current_month_only', 'past_three_months',
        ];
    if (!allowed.includes(val)) return { error: `Invalid ${field} value` };
    settings[field] = val;
  }

  if (Object.keys(settings).length === 0) return { error: 'No settings to update' };

  // Prove every requested row is visible under the caller's RLS session before
  // crossing the service-role boundary. The elevated update remains constrained
  // to that exact, deduplicated ID set and an allowlist of statement columns.
  const { data: visibleAssociations, error: scopeError } = await db
    .from('associations')
    .select('id')
    .in('id', associationIds);
  if (scopeError) return { error: scopeError.message };
  if ((visibleAssociations ?? []).length !== associationIds.length) {
    return { error: 'One or more associations are outside your authorized scope' };
  }

  const serviceDb = createServiceClient() as any;
  const { data, error } = await serviceDb
    .from('associations')
    .update(settings)
    .in('id', associationIds)
    .select('id');

  if (error) return { error: error.message };
  if ((data ?? []).length !== associationIds.length) {
    return { error: 'One or more associations were not updated' };
  }

  revalidatePath('/statements/bulk-settings');
  return { success: true, updated_count: data.length };
}
