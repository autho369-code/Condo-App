'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireFinanceStaff } from '@/lib/auth/me';
import { isReceiptMethod } from '@/lib/payments/methods';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Homeowner receipt entered from the Receipts register (not a unit page). */
export async function recordHomeownerReceipt(formData: FormData) {
  await requireFinanceStaff(); // in-action guard: server actions are callable endpoints
  const unitId = String(formData.get('unit_id') ?? '');
  const back = (msg: string): never =>
    redirect(`/receipts/new${UUID.test(unitId) ? `?unit=${unitId}&` : '?'}error=${encodeURIComponent(msg)}`);
  if (!UUID.test(unitId)) back('Choose the homeowner unit that paid.');

  const amount = Number(formData.get('amount'));
  const paymentDate = String(formData.get('payment_date') ?? '');
  const method = String(formData.get('method') ?? '');
  const reference = String(formData.get('reference') ?? '').trim().slice(0, 100) || null;
  const notes = String(formData.get('notes') ?? '').trim().slice(0, 1000) || null;
  const bankAccountId = String(formData.get('bank_account_id') ?? '');
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) back('Enter the amount received.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) back('Enter the date received.');
  if (!isReceiptMethod(method)) back('Choose how the payment was made.');

  const db = (await createClient()) as any;
  // RLS scopes both lookups to the caller's portfolio: a unit or bank account
  // from another portfolio simply isn't found.
  const { data: unit } = await db.from('units')
    .select('id, buildings!inner(association_id)')
    .eq('id', unitId).is('archived_at', null).maybeSingle();
  if (!unit) back('That unit was not found in your portfolio.');
  const associationId = (unit.buildings as any)?.association_id;
  if (bankAccountId) {
    if (!UUID.test(bankAccountId)) back('Choose a valid deposit account.');
    const { data: bank } = await db.from('bank_accounts').select('id')
      .eq('id', bankAccountId).eq('association_id', associationId).is('archived_at', null).maybeSingle();
    if (!bank) back('The deposit account must belong to this unit’s association.');
  }

  // auto_apply_new_payment applies it oldest-charge-first; post_payment_to_gl
  // posts Dr bank / Cr A/R.
  const { data, error } = await db.from('payments').insert({
    unit_id: unitId,
    amount: Math.round(amount * 100) / 100,
    payment_date: paymentDate,
    method,
    reference,
    notes,
    bank_account_id: bankAccountId || null,
  }).select('id').single();
  if (error || !data) back(error?.message ?? 'The receipt could not be saved.');

  revalidatePath('/receipts');
  revalidatePath(`/units/${unitId}`);
  const another = formData.get('next') === 'another';
  redirect(another ? `/receipts/new?posted=${data.id}` : `/receipts?posted=${data.id}&from=${paymentDate}`);
}
