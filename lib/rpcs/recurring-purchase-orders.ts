'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const LIST = '/purchase-orders/recurring';

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

/** Save a purchase order as a recurring one. Scope is re-checked in save_recurring_purchase_order. */
export async function saveRecurringPurchaseOrder(formData: FormData) {
  await requireFinanceStaff();
  const poId = text(formData, 'purchase_order_id');
  if (!UUID.test(poId)) redirect(`${LIST}?error=${encodeURIComponent('Purchase order not found.')}`);
  const back = `/purchase-orders/${poId}`;
  const start = text(formData, 'start_date');
  const end = text(formData, 'end_date');
  if (!DATE.test(start)) redirect(`${back}?error=${encodeURIComponent('Choose the first date.')}`);
  const db = (await createClient()) as any;
  const { error } = await db.rpc('save_recurring_purchase_order', {
    p_source_po_id: poId,
    p_name: text(formData, 'name'),
    p_frequency: text(formData, 'frequency'),
    p_interval: Number(text(formData, 'interval_count')) || 1,
    p_start_date: start,
    p_end_date: DATE.test(end) ? end : null,
    p_needed_by_days: Number(text(formData, 'needed_by_days')) || 0,
  });
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(LIST);
  redirect(`${LIST}?saved=1`);
}

/** Pause, resume or stop a recurring purchase order. */
export async function setRecurringPurchaseOrderState(formData: FormData) {
  await requireFinanceStaff();
  const id = text(formData, 'id');
  const db = (await createClient()) as any;
  const { error } = await db.rpc('set_recurring_purchase_order_state', {
    p_id: UUID.test(id) ? id : null,
    p_state: text(formData, 'state'),
  });
  if (error) redirect(`${LIST}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(LIST);
  redirect(LIST);
}

/** Create a draft purchase order from a recurring one right now. */
export async function createPurchaseOrderNow(formData: FormData) {
  await requireFinanceStaff();
  const id = text(formData, 'id');
  const db = (await createClient()) as any;
  const { data, error } = await db.rpc('create_po_from_recurring', { p_id: UUID.test(id) ? id : null });
  if (error || !data) redirect(`${LIST}?error=${encodeURIComponent(error?.message ?? 'Could not create the purchase order.')}`);
  revalidatePath('/purchase-orders');
  redirect(`/purchase-orders/${data}`);
}
