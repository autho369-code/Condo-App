'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BACK = '/charges/tasks';

function id(formData: FormData, key: string) {
  const v = String(formData.get(key) ?? '').trim();
  return UUID.test(v) ? v : null;
}

/** Apply unapplied payments/credits to open charges. Re-checked in apply_credits. */
export async function applyCredits(formData: FormData) {
  await requireFinanceStaff();
  const associationId = id(formData, 'association_id');
  if (!associationId) redirect(`${BACK}?error=${encodeURIComponent('Choose an association.')}`);
  const db = (await createClient()) as any;
  const { data, error } = await db.rpc('apply_credits', { p_association_id: associationId, p_unit_id: id(formData, 'unit_id') });
  if (error) redirect(`${BACK}?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/charges');
  redirect(`${BACK}?applied=${encodeURIComponent(`${data?.applied_total ?? 0}|${data?.payments ?? 0}`)}`);
}

/** Charge late fees now with the association's late-fee policy. Re-checked in charge_late_fees_now. */
export async function chargeLateFeesNow(formData: FormData) {
  await requireFinanceStaff();
  const associationId = id(formData, 'association_id');
  if (!associationId) redirect(`${BACK}?error=${encodeURIComponent('Choose an association.')}`);
  const db = (await createClient()) as any;
  const { data, error } = await db.rpc('charge_late_fees_now', { p_association_id: associationId });
  if (error) redirect(`${BACK}?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/charges');
  redirect(`${BACK}?fees=${encodeURIComponent(`${data?.total ?? 0}|${data?.fees ?? 0}`)}`);
}
