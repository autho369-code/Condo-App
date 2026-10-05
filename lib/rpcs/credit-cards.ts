'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { claimSubmission, completeSubmission, releaseSubmission } from '@/lib/forms/submission';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function uuidOrNull(formData: FormData, key: string) {
  const v = text(formData, key);
  return UUID.test(v) ? v : null;
}

/** Add or edit a credit card account. Authorization is re-checked in save_credit_card_account. */
export async function saveCreditCardAccount(formData: FormData) {
  await requireFinanceStaff();
  const cardId = uuidOrNull(formData, 'card_id');
  const back = cardId ? `/credit-cards/${cardId}` : '/credit-cards';
  const db = (await createClient()) as any;
  const { data, error } = await db.rpc('save_credit_card_account', {
    p_card_id: cardId,
    p_association_id: uuidOrNull(formData, 'association_id'),
    p_name: text(formData, 'name'),
    p_issuer: text(formData, 'issuer') || null,
    p_last_four: text(formData, 'last_four') || null,
    p_gl_account_id: uuidOrNull(formData, 'gl_account_id'),
  });
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/credit-cards');
  redirect(`/credit-cards/${data}?saved=1`);
}

/** Record a card purchase (posts Dr expense / Cr card liability). Re-checked in record_credit_card_charge. */
export async function recordCreditCardCharge(formData: FormData) {
  await requireFinanceStaff();
  const cardId = uuidOrNull(formData, 'card_id');
  if (!cardId) redirect('/credit-cards');
  const back = `/credit-cards/${cardId}`;
  const chargeDate = text(formData, 'charge_date');
  if (!DATE.test(chargeDate)) redirect(`${back}?error=${encodeURIComponent('Enter the charge date.')}`);
  const amount = Number(text(formData, 'amount'));
  const db = (await createClient()) as any;
  // A double click or re-sent form must not post the same card charge twice.
  const claim = await claimSubmission(db, formData, 'credit_card_charge');
  if (claim.status === 'error') redirect(`${back}?error=${encodeURIComponent(claim.message)}`);
  if (claim.status === 'duplicate') redirect(`${back}?charged=1`);
  const token = (claim as { token: string }).token;
  const { data, error } = await db.rpc('record_credit_card_charge', {
    p_card_id: cardId,
    p_association_id: uuidOrNull(formData, 'association_id'),
    p_charge_date: chargeDate,
    p_payee: text(formData, 'payee') || null,
    p_vendor_id: uuidOrNull(formData, 'vendor_id'),
    p_gl_account_id: uuidOrNull(formData, 'gl_account_id'),
    p_amount: Number.isFinite(amount) ? amount : null,
    p_reference: text(formData, 'reference') || null,
    p_description: text(formData, 'description') || null,
  });
  if (error) {
    await releaseSubmission(db, token);
    redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  }
  if (typeof data === 'string' && data) await completeSubmission(db, token, data);
  revalidatePath(back);
  revalidatePath('/credit-cards');
  redirect(`${back}?charged=1`);
}

/** Void a card charge (posts the reversal). Re-checked in void_credit_card_charge. */
export async function voidCreditCardCharge(formData: FormData) {
  await requireFinanceStaff();
  const cardId = uuidOrNull(formData, 'card_id');
  const chargeId = uuidOrNull(formData, 'charge_id');
  if (!cardId || !chargeId) redirect('/credit-cards');
  const back = `/credit-cards/${cardId}`;
  const db = (await createClient()) as any;
  const { error } = await db.rpc('void_credit_card_charge', { p_charge_id: chargeId, p_reason: text(formData, 'reason') });
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(back);
  revalidatePath('/credit-cards');
  redirect(`${back}?voided=1`);
}
