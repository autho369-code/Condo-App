'use server';

import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function num(formData: FormData, key: string) {
  const raw = str(formData, key);
  if (!raw) return 0;
  return Number(raw.replace(/[$,]/g, '')) || 0;
}

function required(value: string | null, label: string) {
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

export async function createHomeownerReceipt(formData: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const unitId = required(str(formData, 'unit_id'), 'Unit');

  const { error } = await (supabase as any).from('payments').insert({
    unit_id: unitId,
    amount: num(formData, 'amount'),
    payment_date: str(formData, 'payment_date') ?? new Date().toISOString().slice(0, 10),
    method: str(formData, 'method') ?? 'check',
    reference: str(formData, 'reference'),
    notes: str(formData, 'notes'),
    bank_account_id: str(formData, 'bank_account_id'),
    gl_account_id: str(formData, 'gl_account_id'),
  });

  if (error) throw new Error(error.message);
  revalidatePath('/charges');
  revalidatePath(`/units/${unitId}`);
  redirect('/charges');
}

export async function createHomeownerCharge(formData: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const unitId = required(str(formData, 'unit_id'), 'Unit');

  const { error } = await (supabase as any).rpc('post_ad_hoc_charge', {
    p_unit_id: unitId,
    p_charge_category_id: required(str(formData, 'charge_category_id'), 'Charge category'),
    p_amount: num(formData, 'amount'),
    p_description: required(str(formData, 'description'), 'Description'),
    p_due_date: str(formData, 'due_date') ?? undefined,
  });

  if (error) throw new Error(error.message);
  revalidatePath('/charges');
  revalidatePath(`/units/${unitId}`);
  redirect('/charges?view=charges');
}

export async function createBankTransfer(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();

  const { error } = await (supabase as any).from('bank_transfers').insert({
    portfolio_id: me.portfolio?.id,
    created_by: me.auth_user_id,
    from_bank_account_id: required(str(formData, 'from_bank_account_id'), 'From account'),
    to_bank_account_id: required(str(formData, 'to_bank_account_id'), 'To account'),
    amount: num(formData, 'amount'),
    transfer_date: str(formData, 'transfer_date') ?? new Date().toISOString().slice(0, 10),
    reference_number: str(formData, 'reference_number'),
    memo: str(formData, 'memo'),
  });

  if (error) throw new Error(error.message);
  revalidatePath('/bank-transfers');
  revalidatePath('/bank-accounts');
  redirect('/bank-transfers');
}

export async function createJournalEntry(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const amount = num(formData, 'amount');
  const associationId = str(formData, 'association_id');
  const memo = str(formData, 'memo');

  const { data: entry, error: entryError } = await (supabase as any)
    .from('journal_entries')
    .insert({
      portfolio_id: me.portfolio?.id,
      created_by: me.auth_user_id,
      entry_date: str(formData, 'entry_date') ?? new Date().toISOString().slice(0, 10),
      reference_number: str(formData, 'reference_number'),
      description: str(formData, 'description'),
      memo,
      source_type: 'manual',
      posted: formData.get('posted') === 'on',
      posted_at: formData.get('posted') === 'on' ? new Date().toISOString() : null,
    })
    .select('id')
    .single();

  if (entryError) throw new Error(entryError.message);

  const lines = [
    {
      entry_id: entry.id,
      gl_account_id: required(str(formData, 'debit_gl_account_id'), 'Debit GL account'),
      association_id: associationId,
      debit_amount: amount,
      credit_amount: 0,
      memo,
      sort_order: 1,
    },
    {
      entry_id: entry.id,
      gl_account_id: required(str(formData, 'credit_gl_account_id'), 'Credit GL account'),
      association_id: associationId,
      debit_amount: 0,
      credit_amount: amount,
      memo,
      sort_order: 2,
    },
  ];

  const { error: lineError } = await (supabase as any).from('journal_lines').insert(lines);
  if (lineError) throw new Error(lineError.message);

  revalidatePath('/journal-entries');
  redirect('/journal-entries');
}

export async function createGLAccount(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();

  const { error } = await (supabase as any).from('gl_accounts').insert({
    portfolio_id: me.portfolio?.id,
    association_id: str(formData, 'association_id'),
    number: Number(required(str(formData, 'number'), 'GL account number')),
    name: required(str(formData, 'name'), 'GL account name'),
    account_type: required(str(formData, 'account_type'), 'Account type'),
    fund_account: str(formData, 'fund_account'),
    description: str(formData, 'description'),
    include_on_cash_flow: formData.get('include_on_cash_flow') === 'on',
    subject_to_management_fees: formData.get('subject_to_management_fees') === 'on',
    active: true,
  });

  if (error) throw new Error(error.message);
  revalidatePath('/gl-accounts');
  redirect('/gl-accounts');
}

export async function createBankDeposit(formData: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const paymentIds = formData.getAll('payment_ids').filter((value): value is string => typeof value === 'string' && value.length > 0);
  if (paymentIds.length === 0) throw new Error('Select at least one receipt.');

  const { error } = await (supabase as any)
    .from('payments')
    .update({
      bank_account_id: required(str(formData, 'bank_account_id'), 'Bank account'),
      reference: str(formData, 'deposit_reference'),
      payment_date: str(formData, 'deposit_date') ?? new Date().toISOString().slice(0, 10),
    })
    .in('id', paymentIds);

  if (error) throw new Error(error.message);
  revalidatePath('/charges');
  revalidatePath('/bank-accounts');
  revalidatePath('/bank-accounts/deposits/new');
  redirect('/charges');
}

export async function applyCredits(formData: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const chargeIds = formData.getAll('charge_ids').filter((value): value is string => typeof value === 'string' && value.length > 0);

  const { error } = await (supabase as any).rpc('apply_payment', {
    p_payment_id: required(str(formData, 'payment_id'), 'Credit payment'),
    p_charge_ids: chargeIds.length > 0 ? chargeIds : undefined,
    p_strategy: chargeIds.length > 0 ? 'selected' : 'oldest_first',
  });

  if (error) throw new Error(error.message);
  revalidatePath('/charges');
  revalidatePath('/credits/apply');
  redirect('/charges');
}

export async function createLockboxBatch(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const amount = num(formData, 'check_amount');
  const amountCents = Math.round(amount * 100);
  const unitId = str(formData, 'unit_id');
  const receivedAt = str(formData, 'received_at') ?? new Date().toISOString().slice(0, 10);
  const bankAccountId = str(formData, 'bank_account_id');
  const checkNumber = str(formData, 'check_number');
  const providerBatchId = str(formData, 'provider_batch_id');

  const { data: batch, error: batchError } = await (supabase as any)
    .from('lockbox_batches')
    .insert({
      portfolio_id: me.portfolio?.id,
      provider: required(str(formData, 'provider'), 'Provider'),
      provider_batch_id: providerBatchId,
      bank_account_id: bankAccountId,
      batch_date: str(formData, 'batch_date') ?? receivedAt,
      received_at: receivedAt,
      deposit_reference: str(formData, 'deposit_reference'),
      notes: str(formData, 'notes'),
      total_amount_cents: amountCents,
      total_items: amountCents > 0 ? 1 : 0,
      status: 'received',
    })
    .select('id')
    .single();

  if (batchError) throw new Error(batchError.message);

  let paymentId: string | null = null;
  if (amountCents > 0 && unitId) {
    const { data: payment, error: paymentError } = await (supabase as any)
      .from('payments')
      .insert({
        unit_id: unitId,
        amount,
        payment_date: receivedAt,
        method: 'lockbox',
        reference: checkNumber ?? providerBatchId,
        notes: str(formData, 'payer_name'),
        bank_account_id: bankAccountId,
      })
      .select('id')
      .single();

    if (paymentError) throw new Error(paymentError.message);
    paymentId = payment.id;
  }

  if (amountCents > 0) {
    const { error: itemError } = await (supabase as any).from('lockbox_items').insert({
      portfolio_id: me.portfolio?.id,
      batch_id: batch.id,
      association_id: str(formData, 'association_id'),
      unit_id: unitId,
      payer_name: str(formData, 'payer_name'),
      check_number: checkNumber,
      check_amount_cents: amountCents,
      account_number_masked: str(formData, 'account_number_masked'),
      routing_number: str(formData, 'routing_number'),
      payment_id: paymentId,
      manually_matched: Boolean(paymentId),
      matched_confidence: paymentId ? 100 : null,
    });

    if (itemError) throw new Error(itemError.message);
  }

  revalidatePath('/lockbox');
  revalidatePath('/charges');
  redirect('/lockbox');
}

export async function createRecurringJournalEntry(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const amount = num(formData, 'amount');
  const memo = str(formData, 'memo');

  const templateLines = [
    {
      gl_account_id: required(str(formData, 'debit_gl_account_id'), 'Debit GL account'),
      debit_amount: amount,
      credit_amount: 0,
      memo,
    },
    {
      gl_account_id: required(str(formData, 'credit_gl_account_id'), 'Credit GL account'),
      debit_amount: 0,
      credit_amount: amount,
      memo,
    },
  ];

  const { error } = await (supabase as any).from('recurring_journal_entries').insert({
    portfolio_id: me.portfolio?.id,
    created_by: me.auth_user_id,
    name: required(str(formData, 'name'), 'Name'),
    memo,
    frequency: str(formData, 'frequency') ?? 'monthly',
    interval_count: Number(str(formData, 'interval_count') ?? '1') || 1,
    next_post_date: str(formData, 'next_post_date') ?? new Date().toISOString().slice(0, 10),
    auto_generate: formData.get('auto_generate') === 'on',
    template_lines: templateLines,
  });

  if (error) throw new Error(error.message);
  revalidatePath('/journal-entries');
  revalidatePath('/journal-entries/recurring');
  redirect('/journal-entries/recurring');
}

export async function createJournalEntryBatch(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();

  const { error } = await (supabase as any).from('journal_entry_batches').insert({
    portfolio_id: me.portfolio?.id,
    created_by: me.auth_user_id,
    name: required(str(formData, 'name'), 'Batch name'),
    description: str(formData, 'description'),
    upload_url: str(formData, 'upload_url'),
    total_entries: Number(str(formData, 'total_entries') ?? '0') || 0,
    total_debit: num(formData, 'total_debit'),
    total_credit: num(formData, 'total_credit'),
    status: 'draft',
  });

  if (error) throw new Error(error.message);
  revalidatePath('/journal-entries/batches');
  redirect('/journal-entries/batches');
}

export async function generateRecurringJournalEntries() {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('generate_recurring_journal_entries');

  if (error) throw new Error(error.message);
  revalidatePath('/journal-entries');
  revalidatePath('/journal-entries/recurring');
  redirect('/journal-entries');
}
