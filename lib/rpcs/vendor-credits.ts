'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const BACK = '/bills/credits';

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}
function id(formData: FormData, key: string) {
  const v = text(formData, key);
  return UUID.test(v) ? v : null;
}

/** Enter a vendor credit (Dr A/P, Cr the chosen account). Re-checked in enter_vendor_credit. */
export async function enterVendorCredit(formData: FormData) {
  await requireFinanceStaff();
  const date = text(formData, 'credit_date');
  if (!DATE.test(date)) redirect(`${BACK}?error=${encodeURIComponent('Enter the credit date.')}`);
  const amount = Number(text(formData, 'amount'));
  const db = (await createClient()) as any;
  const { error } = await db.rpc('enter_vendor_credit', {
    p_association_id: id(formData, 'association_id'),
    p_vendor_id: id(formData, 'vendor_id'),
    p_credit_date: date,
    p_gl_account_id: id(formData, 'gl_account_id'),
    p_amount: Number.isFinite(amount) ? amount : null,
    p_reference: text(formData, 'reference') || null,
    p_memo: text(formData, 'memo') || null,
  });
  if (error) redirect(`${BACK}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(BACK);
  redirect(`${BACK}?entered=1`);
}

/** Apply a credit to an approved, unpaid bill of the same vendor. Re-checked in apply_vendor_credit. */
export async function applyVendorCredit(formData: FormData) {
  await requireFinanceStaff();
  const amount = Number(text(formData, 'amount'));
  const db = (await createClient()) as any;
  const { error } = await db.rpc('apply_vendor_credit', {
    p_credit_id: id(formData, 'credit_id'),
    p_bill_id: id(formData, 'bill_id'),
    p_amount: Number.isFinite(amount) ? amount : null,
  });
  if (error) redirect(`${BACK}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(BACK);
  revalidatePath('/bills');
  revalidatePath('/bills/check-run');
  redirect(`${BACK}?applied=1`);
}
