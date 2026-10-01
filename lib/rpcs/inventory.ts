'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function num(formData: FormData, key: string): number | null {
  const raw = text(formData, key);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function itemPath(formData: FormData) {
  const id = text(formData, 'item_id');
  if (!UUID.test(id)) redirect('/inventory');
  return { id, back: `/inventory/${id}` };
}

/** Edit an item's details. Quantity is not editable here — it moves only through stock movements. */
export async function updateInventoryItem(formData: FormData) {
  await requireStaff();
  const { id, back } = itemPath(formData);
  const name = text(formData, 'name');
  if (!name) redirect(`${back}?error=${encodeURIComponent('Item name is required.')}`);
  const reorderPoint = num(formData, 'reorder_point');
  if (reorderPoint != null && reorderPoint < 0) redirect(`${back}?error=${encodeURIComponent('The reorder point cannot be negative.')}`);
  const db = (await createClient()) as any;
  const { data, error } = await db.from('inventory_items').update({
    name,
    sku: text(formData, 'sku') || null,
    category: text(formData, 'category') || null,
    location: text(formData, 'location') || null,
    unit_of_measure: text(formData, 'unit_of_measure') || null,
    reorder_point: reorderPoint,
  }).eq('id', id).select('id').maybeSingle();
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  if (!data) redirect(`${back}?error=${encodeURIComponent('You cannot edit this item.')}`);
  revalidatePath(back);
  revalidatePath('/inventory');
  redirect(`${back}?saved=1`);
}

/** Receive, use (optionally on a work order) or adjust stock. Authorization is re-checked in record_inventory_movement. */
export async function recordInventoryMovement(formData: FormData) {
  await requireStaff();
  const { id, back } = itemPath(formData);
  const kind = text(formData, 'kind');
  let workOrder = text(formData, 'work_order_id');
  const workOrderNumber = text(formData, 'work_order_number').replace(/^#/, '');
  const db = (await createClient()) as any;
  if (kind === 'used' && !UUID.test(workOrder) && workOrderNumber) {
    // RLS limits the lookup to work orders this staffer can see.
    const { data: wo } = await db.from('work_orders').select('id').eq('number', workOrderNumber).limit(1).maybeSingle();
    if (!wo) redirect(`${back}?error=${encodeURIComponent(`Work order #${workOrderNumber} not found.`)}`);
    workOrder = wo.id;
  }
  const { error } = await db.rpc('record_inventory_movement', {
    p_item_id: id,
    p_kind: kind,
    p_quantity: num(formData, 'quantity'),
    p_direction: text(formData, 'direction') || null,
    p_work_order_id: kind === 'used' && UUID.test(workOrder) ? workOrder : null,
    p_unit_cost: kind === 'received' ? num(formData, 'unit_cost') : null,
    p_note: text(formData, 'note') || null,
  });
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(back);
  revalidatePath('/inventory');
  redirect(`${back}?moved=${encodeURIComponent(kind)}`);
}

/** Hide an item from inventory (history and reports keep it). */
export async function archiveInventoryItem(formData: FormData) {
  await requireStaff();
  const { id, back } = itemPath(formData);
  const db = (await createClient()) as any;
  const { data, error } = await db.from('inventory_items').update({ archived_at: new Date().toISOString() }).eq('id', id).select('id').maybeSingle();
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  if (!data) redirect(`${back}?error=${encodeURIComponent('You cannot remove this item.')}`);
  revalidatePath('/inventory');
  redirect('/inventory?archived=1');
}
