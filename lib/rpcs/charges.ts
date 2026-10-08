'use server';
import { isReceiptMethod } from '@/lib/payments/methods';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { revalidatePath } from 'next/cache';
import { todayInZone } from '@/lib/time/zoned';
import { claimSubmission, completeSubmission, releaseSubmission } from '@/lib/forms/submission';
import { redirect } from 'next/navigation';

/* ============ Charge Categories ============ */

export async function createChargeCategory(formData: FormData) {
  await requireStaff();  // in-action guard: server actions are callable endpoints
  const failTo = (msg: string) => {
    redirect(`/charge-categories/new?error=${encodeURIComponent(msg)}`);
  };
  const supabase = await createClient();
  const { data, error } = await (supabase as any).from('charge_categories').insert({
    portfolio_id:       formData.get('portfolio_id') as string,
    association_id:     (formData.get('association_id') as string) || null,
    name:               formData.get('name') as string,
    code:               (formData.get('code') as string)?.toUpperCase() || null,
    description:        (formData.get('description') as string) || null,
    default_amount:     parseFloat(formData.get('default_amount') as string) || 0,
    default_frequency:  (formData.get('default_frequency') as any) || 'monthly',
    gl_account_id:      (formData.get('gl_account_id') as string) || null,
    charge_type:        (formData.get('charge_type') as any) || 'other',
    is_assessment:      formData.get('is_assessment') === 'on',
    is_fee:             formData.get('is_fee') === 'on',
    active:             true,
  }).select('id').single();
  if (error) { failTo(error.message); return; }
  revalidatePath('/charge-categories');
  redirect(`/charge-categories/${data.id}`);
}

export async function updateChargeCategory(id: string, formData: FormData) {
  await requireStaff();  // in-action guard: server actions are callable endpoints
  const failTo = (msg: string) => {
    redirect(`/charge-categories/${id}?error=${encodeURIComponent(msg)}`);
  };
  const supabase = await createClient();
  const db = supabase as any;
  const { data: current } = await db.from('charge_categories').select('id, is_system').eq('id', id).maybeSingle();
  if (!current) { failTo('Charge category not found.'); return; }
  const patch: Record<string, unknown> = {
    name:              formData.get('name') as string,
    description:       (formData.get('description') as string) || null,
    default_amount:    parseFloat(formData.get('default_amount') as string) || 0,
    default_frequency: (formData.get('default_frequency') as any) || 'monthly',
    gl_account_id:     (formData.get('gl_account_id') as string) || null,
    charge_type:       (formData.get('charge_type') as any) || 'other',
    is_assessment:     formData.get('is_assessment') === 'on',
    is_fee:            formData.get('is_fee') === 'on',
    active:            formData.get('active') === 'on',
  };
  // System codes (DUES, PARKING, OTHER, …) are looked up by code elsewhere;
  // the field is not editable for them, so never overwrite it.
  if (!current.is_system) patch.code = (formData.get('code') as string)?.trim().toUpperCase() || null;
  const { data: updated, error } = await db.from('charge_categories').update(patch).eq('id', id).select('id');
  if (error) { failTo(error.message); return; }
  if (!updated || updated.length === 0) { failTo('You need finance access to change charge categories.'); return; }
  revalidatePath('/charge-categories');
  revalidatePath(`/charge-categories/${id}`);
  redirect(`/charge-categories/${id}?saved=1`);
}

export async function archiveChargeCategory(id: string) {
  await requireStaff();  // in-action guard: server actions are callable endpoints
  const failTo = (msg: string) => {
    redirect(`/charge-categories/${id}?error=${encodeURIComponent(msg)}`);
  };
  const supabase = await createClient();
  const db = supabase as any;
  const { data: current } = await db.from('charge_categories').select('id, is_system').eq('id', id).maybeSingle();
  if (!current) { failTo('Charge category not found.'); return; }
  if (current.is_system) { failTo('Built-in categories cannot be archived; mark them inactive instead.'); return; }
  const { data: updated, error } = await db.from('charge_categories')
    .update({ archived_at: new Date().toISOString(), active: false }).eq('id', id).select('id');
  if (error) { failTo(error.message); return; }
  if (!updated || updated.length === 0) { failTo('You need finance access to archive charge categories.'); return; }
  revalidatePath('/charge-categories');
  redirect('/charge-categories');
}

/* ============ Per-Unit Subscriptions ============ */

export async function subscribeUnitToCharge(formData: FormData) {
  await requireStaff();  // in-action guard: server actions are callable endpoints
  const supabase = await createClient();
  const unit_id            = formData.get('unit_id') as string;
  const failTo = (msg: string) => {
    redirect(`/units/${unit_id}?error=${encodeURIComponent(msg)}`);
  };
  const charge_category_id = formData.get('charge_category_id') as string;
  const amount             = parseFloat(formData.get('amount') as string);
  const frequency          = (formData.get('frequency') as any) || null;
  const start_date         = (formData.get('start_date') as string) || undefined;
  const memo               = (formData.get('memo') as string) || undefined;
  // Always send p_identifier: with it omitted, the 6- and 7-argument versions
  // of subscribe_unit_to_charge both matched and the call failed as ambiguous.
  const identifier         = (formData.get('identifier') as string) || null;

  const { error } = await (supabase as any).rpc('subscribe_unit_to_charge', {
    p_unit_id:            unit_id,
    p_charge_category_id: charge_category_id,
    p_amount:             amount,
    p_frequency:          frequency,
    p_start_date:         start_date,
    p_memo:               memo,
    p_identifier:         identifier,
  });
  if (error) { failTo(error.message); return; }
  revalidatePath(`/units/${unit_id}`);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// unit_recurring_charges is writable only by finance staff (RLS
// unit_recurring_charges_finance); for anyone else an update silently matches
// 0 rows, so check up front and confirm a row actually changed.
async function requireUnitFinanceAccess(unitId: string): Promise<(msg: string) => never> {
  const me = await requireStaff();  // in-action guard: server actions are callable endpoints
  const failTo = (msg: string): never => redirect(`/units/${unitId}?error=${encodeURIComponent(msg)}`);
  if (!UUID_RE.test(unitId)) redirect('/units?error=' + encodeURIComponent('Unit not found.'));
  if (!me.is_finance_staff && !me.is_platform_operator) failTo('You need finance access to change recurring charges.');
  return failTo;
}

export async function unsubscribeUnit(subscriptionId: string, unitId: string) {
  const failTo = await requireUnitFinanceAccess(unitId);
  if (!UUID_RE.test(subscriptionId)) failTo('Recurring charge not found.');
  const db = (await createClient()) as any;
  const { data: updated, error } = await db.from('unit_recurring_charges')
    .update({ active: false, end_date: todayInZone() })
    .eq('id', subscriptionId)
    .eq('unit_id', unitId)
    .select('id');
  if (error) failTo(error.message);
  if (!updated || updated.length === 0) failTo('That recurring charge was not found on this unit, or you cannot change it.');
  revalidatePath(`/units/${unitId}`);
}

export async function updateUnitSubscription(id: string, unitId: string, formData: FormData) {
  const failTo = await requireUnitFinanceAccess(unitId);
  if (!UUID_RE.test(id)) failTo('Recurring charge not found.');
  const amount = parseFloat(formData.get('amount') as string);
  if (!Number.isFinite(amount) || amount < 0) failTo('Enter a valid amount.');
  const db = (await createClient()) as any;
  const { data: updated, error } = await db.from('unit_recurring_charges').update({
    amount:    Math.round(amount * 100) / 100,
    frequency: (formData.get('frequency') as any) || 'monthly',
    memo:      (formData.get('memo') as string) || null,
    active:    formData.get('active') === 'on',
  }).eq('id', id).eq('unit_id', unitId).select('id');
  if (error) failTo(error.message);
  if (!updated || updated.length === 0) failTo('That recurring charge was not found on this unit, or you cannot change it.');
  revalidatePath(`/units/${unitId}`);
}

/* ============ Ad-hoc charges + manual receipts ============ */

export async function postAdHocCharge(formData: FormData) {
  await requireStaff();  // in-action guard: server actions are callable endpoints
  const supabase = await createClient();
  const unit_id            = formData.get('unit_id') as string;
  const failTo = (msg: string) => {
    redirect(`/units/${unit_id}?error=${encodeURIComponent(msg)}`);
  };
  const charge_category_id = formData.get('charge_category_id') as string;
  const amount             = parseFloat(formData.get('amount') as string);
  const description        = formData.get('description') as string;
  const due_date           = (formData.get('due_date') as string) || undefined;
  const db = supabase as any;

  // A double click or re-sent form must not post the charge twice.
  const claim = await claimSubmission(db, formData, 'ad_hoc_charge');
  if (claim.status === 'error') { failTo(claim.message); return; }
  if (claim.status === 'duplicate') {
    revalidatePath(`/units/${unit_id}`);
    failTo(claim.resultId ? 'This charge was already posted.' : 'This charge is already being posted. Refresh in a moment to see it.');
    return;
  }
  const token = claim.token;

  const { data: charge, error } = await db.rpc('post_ad_hoc_charge', {
    p_unit_id:             unit_id,
    p_charge_category_id:  charge_category_id,
    p_amount:              amount,
    p_description:         description,
    p_due_date:            due_date,
  });
  if (error) { await releaseSubmission(db, token); failTo(error.message); return; }
  const chargeId = Array.isArray(charge) ? charge[0]?.id : (charge?.id ?? charge);
  if (typeof chargeId === 'string') await completeSubmission(db, token, chargeId);
  revalidatePath(`/units/${unit_id}`);
}

export async function recordReceipt(formData: FormData) {
  const me = await requireStaff();  // in-action guard: server actions are callable endpoints
  const unit_id      = String(formData.get('unit_id') ?? '');
  if (!UUID_RE.test(unit_id)) redirect('/units?error=' + encodeURIComponent('Unit not found.'));
  const failTo = (msg: string): never => redirect(`/units/${unit_id}?error=${encodeURIComponent(msg)}`);
  // payments RLS (payments_finance_all) only lets finance staff insert.
  if (!me.is_finance_staff && !me.is_platform_operator) failTo('You need finance access to record receipts.');
  const amount       = Number(formData.get('amount'));
  const payment_date = String(formData.get('payment_date') ?? '');
  const method       = String(formData.get('method') ?? '');
  const reference    = String(formData.get('reference') ?? '').trim().slice(0, 100) || null;
  const notes        = String(formData.get('notes') ?? '').trim().slice(0, 1000) || null;
  const bank_account_id = String(formData.get('bank_account_id') ?? '') || null;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) failTo('Enter the amount received.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payment_date)) failTo('Enter the date received.');
  if (!isReceiptMethod(method)) failTo('Choose how the payment was made.');

  const db = (await createClient()) as any;
  // RLS scopes both lookups to the caller's portfolio.
  const { data: unit } = await db.from('units')
    .select('id, buildings!inner(association_id)')
    .eq('id', unit_id).is('archived_at', null).maybeSingle();
  if (!unit) failTo('That unit was not found in your portfolio.');
  if (bank_account_id) {
    if (!UUID_RE.test(bank_account_id)) failTo('Choose a valid deposit account.');
    const { data: bank } = await db.from('bank_accounts').select('id')
      .eq('id', bank_account_id).eq('association_id', (unit.buildings as any)?.association_id)
      .is('archived_at', null).maybeSingle();
    if (!bank) failTo('The deposit account must belong to this unit’s association.');
  }

  // A double click or re-sent form must not record the payment twice.
  const claim = await claimSubmission(db, formData, 'homeowner_receipt');
  if (claim.status === 'error') failTo(claim.message);
  if (claim.status === 'duplicate') {
    redirect(claim.resultId ? `/units/${unit_id}?receipt=${claim.resultId}` : `/units/${unit_id}?error=${encodeURIComponent('This receipt is already being recorded. Refresh in a moment to see it.')}`);
  }
  const token = (claim as { token: string }).token;

  // auto_apply_new_payment applies it to charges and trg_post_payment_to_gl
  // posts Dr bank / Cr A/R.
  const { data, error } = await db.from('payments').insert({
    unit_id, amount: Math.round(amount * 100) / 100, payment_date, method, reference, notes, bank_account_id,
    created_by: me.auth_user_id,
  }).select('id').single();
  if (error || !data) {
    await releaseSubmission(db, token);
    failTo(error?.message ?? 'The receipt could not be saved.');
  }
  await completeSubmission(db, token, data.id);
  revalidatePath(`/units/${unit_id}`);
  redirect(`/units/${unit_id}?receipt=${data.id}`);
}

