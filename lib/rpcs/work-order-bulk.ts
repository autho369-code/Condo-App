'use server';

// Bulk actions on the Work Orders list: assign a vendor, change status or
// change priority for many work orders at once. Each work order goes through
// the caller's RLS-scoped client (so association-scoped managers only touch
// their own), gets an activity entry, and — for status changes — the same
// homeowner notification as a single update.

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { notifyOwnerOfStatusChange } from '@/lib/notifications/status-change';
import { todayInZone } from '@/lib/time/zoned';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = new Set(['new', 'assigned', 'scheduled', 'in_progress', 'done', 'completed', 'billed', 'closed', 'cancelled']);
const PRIORITIES = new Set(['low', 'normal', 'high', 'emergency']);
const MAX = 200;

export async function bulkWorkOrderAction(formData: FormData) {
  await requireStaff();
  const back = String(formData.get('back') ?? '/work-orders');
  const safeBack = back.startsWith('/work-orders') && !back.startsWith('//') ? back : '/work-orders';
  const sep = safeBack.includes('?') ? '&' : '?';
  const fail = (msg: string): never => redirect(`${safeBack}${sep}error=${encodeURIComponent(msg)}`);

  const op = String(formData.get('op') ?? '');
  const ids = [...new Set(formData.getAll('work_order_id').map(String).filter((v) => UUID.test(v)))];
  if (!ids.length) fail('Select at least one work order');
  if (ids.length > MAX) fail(`${ids.length} work orders selected — select ${MAX} or fewer at a time`);

  const db = (await createClient()) as any;
  let patch: Record<string, unknown> = {};
  let note = '';

  let vendorPortfolio: string | null = null;

  if (op === 'assign') {
    const vendorId = String(formData.get('vendor_id') ?? '');
    if (!UUID.test(vendorId)) fail('Pick a vendor to assign');
    const { data: vendor } = await db.from('vendors').select('id, name, portfolio_id').eq('id', vendorId).is('archived_at', null).maybeSingle();
    if (!vendor) fail('Vendor not found');
    vendorPortfolio = vendor.portfolio_id;
    patch = { vendor_id: vendor.id };
    note = `Assigned to vendor: ${vendor.name} (bulk)`;
  } else if (op === 'status') {
    const status = String(formData.get('status') ?? '');
    if (!STATUSES.has(status)) fail('Pick a status');

    patch = { status };
    if (status === 'completed' || status === 'closed') patch.completed_date = todayInZone();
    else if (status === 'cancelled') patch.completed_date = null;
    note = `Status changed to ${status.replace(/_/g, ' ')} (bulk)`;
  } else if (op === 'priority') {
    const priority = String(formData.get('priority') ?? '');
    if (!PRIORITIES.has(priority)) fail('Pick a priority');
    patch = { priority };
    note = `Priority set to ${priority} (bulk)`;
  } else {
    fail('Choose an action');
  }

  let done = 0;
  const failures: string[] = [];
  for (const id of ids) {
    const rowPatch: Record<string, unknown> = { ...patch };
    if (op === 'assign') {
      // Only assign within the vendor's own company; move brand-new orders to "assigned".
      const { data: current } = await db.from('work_orders').select('id, status, portfolio_id').eq('id', id).maybeSingle();
      if (!current) { failures.push('Work order not found'); continue; }
      if (current.portfolio_id !== vendorPortfolio) { failures.push('Vendor is from a different company'); continue; }
      if (current.status === 'new') rowPatch.status = 'assigned';
    }
    let query = db.from('work_orders').update(rowPatch).eq('id', id).is('archived_at', null);
    if (op === 'assign') query = query.eq('portfolio_id', vendorPortfolio);
    const { data: updated, error } = await query.select('id, status').maybeSingle();
    if (error || !updated) { failures.push(error?.message ?? 'Work order not found'); continue; }
    const statusChanged = rowPatch.status as string | undefined;
    const { error: logError } = await db.from('work_order_updates').insert({
      work_order_id: id,
      note,
      new_status: statusChanged ?? null,
    });
    if (logError) failures.push(`Updated, but the activity entry failed: ${logError.message}`);
    if (statusChanged) await notifyOwnerOfStatusChange({ kind: 'work_order', id, newStatus: statusChanged });
    done += 1;
  }

  revalidatePath('/work-orders');
  const reasons = [...new Set(failures)].slice(0, 3).join('; ');
  redirect(`${safeBack}${sep}bulk=${op}&done=${done}${failures.length ? `&failed=${failures.length}&reason=${encodeURIComponent(reasons)}` : ''}`);
}
