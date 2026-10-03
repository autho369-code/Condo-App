'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { claimSubmission, completeSubmission, releaseSubmission } from '@/lib/forms/submission';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const s = (fd: FormData, k: string) => ((fd.get(k) as string) ?? '').trim();

function paymentId(formData: FormData) {
  const id = s(formData, 'payment_id');
  if (!UUID_RE.test(id)) redirect('/receipts?error=' + encodeURIComponent('Payment not found'));
  return id;
}

/**
 * Replace a payment's charge allocations in one step. Fields are
 * alloc_<charge id> = amount; anything left over stays as credit on file.
 * reallocate_payment re-checks finance access, the unit and every amount.
 */
export async function reallocatePayment(formData: FormData) {
  await requireFinanceStaff();
  const id = paymentId(formData);
  const back = `/payments/${id}`;
  const fail = (msg: string): never => redirect(`${back}?error=${encodeURIComponent(msg)}`);

  const allocations: { charge_id: string; amount: number }[] = [];
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith('alloc_')) continue;
    const chargeId = key.slice(6);
    const text = String(raw).replace(/[$,\s]/g, '');
    if (!text) continue;
    const amount = Number(text);
    if (!UUID_RE.test(chargeId)) fail('A charge in the form is not valid.');
    if (!Number.isFinite(amount) || amount < 0) fail('Enter amounts of zero or more.');
    if (amount > 0) allocations.push({ charge_id: chargeId, amount: Math.round(amount * 100) / 100 });
  }

  const db = (await createClient()) as any;
  const { error } = await db.rpc('reallocate_payment', { p_payment_id: id, p_allocations: allocations });
  if (error) fail(error.message);
  revalidatePath(back);
  revalidatePath('/receipts');
  redirect(`${back}?reallocated=1`);
}

/**
 * Reverse a returned payment (bounced check, NSF, chargeback). The receipt
 * stays on record; a "Returned payment" charge puts the amount back on the
 * owner's account and the charges it paid are open again.
 */
export async function reversePayment(formData: FormData) {
  await requireFinanceStaff();
  const id = paymentId(formData);
  const back = `/payments/${id}`;
  const fail = (msg: string): never => redirect(`${back}?error=${encodeURIComponent(msg)}`);
  const reason = s(formData, 'reason');
  if (!reason) fail('Enter why the payment was returned.');
  const reversalDate = s(formData, 'reversal_date');
  if (reversalDate && !/^\d{4}-\d{2}-\d{2}$/.test(reversalDate)) fail('Enter a valid reversal date.');

  const db = (await createClient()) as any;
  // A double click must not reverse twice (the RPC also refuses a second reversal).
  const claim = await claimSubmission(db, formData, 'payment_reversal');
  if (claim.status === 'error') fail(claim.message);
  if (claim.status === 'duplicate') redirect(`${back}?reversed=1`);
  const token = (claim as { token: string }).token;

  const { data: chargeId, error } = await db.rpc('reverse_homeowner_payment', {
    p_payment_id: id,
    p_reason: reason,
    p_reversal_date: reversalDate || null,
    p_charge_nsf_fee: formData.get('nsf_fee') === 'on',
  });
  if (error) {
    await releaseSubmission(db, token);
    fail(error.message);
  }
  if (chargeId) await completeSubmission(db, token, String(chargeId));
  revalidatePath(back);
  revalidatePath('/receipts');
  redirect(`${back}?reversed=1`);
}
