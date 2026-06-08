'use server';
import { createClient } from '@/lib/supabase/server';
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

  const { data, error } = await db.rpc('bulk_queue_reports', {
    p_association_ids: associationIds,
    p_report_slugs: reportSlugs,
    p_scope: 'association',
    p_date_start: dateStart,
    p_date_end: dateEnd,
    p_output_format: outputFormat,
  });

  if (error) return { error: error.message };

  revalidatePath('/reports');
  revalidatePath('/reports/bulk-association');
  revalidatePath('/reports/runs');
  return { success: true, count: (data as any)?.queued_count ?? 0, run_ids: (data as any)?.run_ids ?? [] };
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

  revalidatePath('/statements/send');
  revalidatePath('/reports');
  return { success: true, batch_id: data };
}

/* ================================================================
   BULK STATEMENT SETTINGS — update statement config for associations
   ================================================================ */
export async function bulkUpdateStatementSettings(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const associationIds = formData.getAll('association_ids').filter((v): v is string => typeof v === 'string');
  if (associationIds.length === 0) return { error: 'No associations selected' };

  const settings: Record<string, any> = {};
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
    if (val !== null) settings[field] = val;
  }

  if (Object.keys(settings).length === 0) return { error: 'No settings to update' };

  const { data, error } = await db.rpc('bulk_update_statement_settings', {
    p_association_ids: associationIds,
    p_settings: settings,
  });

  if (error) return { error: error.message };

  revalidatePath('/statements/bulk-settings');
  return { success: true, updated_count: data };
}
