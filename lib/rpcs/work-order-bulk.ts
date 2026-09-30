'use server';

// Bulk actions on the Work Orders list: assign a vendor, change status or
// change priority for up to 200 work orders at once.
//
// Set-based: one read of the selection, one or two updates, one activity
// insert, then homeowner notifications in small parallel batches — so a full
// batch finishes in a handful of round trips instead of timing out part-way.
// Every read/write uses the caller's RLS-scoped client, so association-scoped
// managers only touch their own work orders. Orders already in the requested
// state are left alone (no rewritten completion dates, no repeat emails).

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { notifyOwnerOfStatusChange } from '@/lib/notifications/status-change';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = new Set(['new', 'assigned', 'scheduled', 'in_progress', 'done', 'completed', 'billed', 'closed', 'cancelled']);
const PRIORITIES = new Set(['low', 'normal', 'high', 'emergency']);
const MAX = 200;
const NOTIFY_CONCURRENCY = 10;

async function inBatches<T>(items: T[], size: number, run: (item: T) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(run));
}

export async function bulkWorkOrderAction(formData: FormData) {
  await requireStaff();
  const back = String(formData.get('back') ?? '/work-orders');
  const safeBack = back.startsWith('/work-orders') && !back.startsWith('//') ? back : '/work-orders';
  const sep = safeBack.includes('?') ? '&' : '?';
  const fail = (msg: string): never => redirect(`${safeBack}${sep}error=${encodeURIComponent(msg)}`);

  const op = String(formData.get('op') ?? '');
  if (op !== 'assign' && op !== 'status' && op !== 'priority') fail('Choose an action');
  const ids = [...new Set(formData.getAll('work_order_id').map(String).filter((v) => UUID.test(v)))];
  if (!ids.length) fail('Select at least one work order');
  if (ids.length > MAX) fail(`${ids.length} work orders selected — select ${MAX} or fewer at a time`);

  const db = (await createClient()) as any;
  const { data: current, error: readError } = await db.from('work_orders')
    .select('id, status, priority, vendor_id, portfolio_id')
    .in('id', ids).is('archived_at', null);
  if (readError) fail(readError.message);
  const rows = (current ?? []) as Array<{ id: string; status: string; priority: string; vendor_id: string | null; portfolio_id: string | null }>;
  const failures: string[] = [];
  if (rows.length < ids.length) failures.push(...Array(ids.length - rows.length).fill('Work order not found'));

  // Each group = one UPDATE with its own patch; notify = ids whose status changed.
  const groups: Array<{ ids: string[]; patch: Record<string, unknown>; note: string; status: string | null; portfolio?: string }> = [];
  let unchanged = 0;

  if (op === 'status') {
    const status = String(formData.get('status') ?? '');
    if (!STATUSES.has(status)) fail('Pick a status');
    const changing = rows.filter((r) => r.status !== status);
    unchanged = rows.length - changing.length;
    const patch: Record<string, unknown> = { status };
    // Only real transitions get a completion date; already-closed orders keep theirs.
    if (status === 'completed' || status === 'closed') patch.completed_date = new Date().toISOString().slice(0, 10);
    else if (status === 'cancelled') patch.completed_date = null;
    groups.push({ ids: changing.map((r) => r.id), patch, note: `Status changed to ${status.replace(/_/g, ' ')} (bulk)`, status });
  } else if (op === 'priority') {
    const priority = String(formData.get('priority') ?? '');
    if (!PRIORITIES.has(priority)) fail('Pick a priority');
    const changing = rows.filter((r) => r.priority !== priority);
    unchanged = rows.length - changing.length;
    groups.push({ ids: changing.map((r) => r.id), patch: { priority }, note: `Priority set to ${priority} (bulk)`, status: null });
  } else {
    const vendorId = String(formData.get('vendor_id') ?? '');
    if (!UUID.test(vendorId)) fail('Pick a vendor to assign');
    const { data: vendor } = await db.from('vendors').select('id, name, portfolio_id').eq('id', vendorId).is('archived_at', null).maybeSingle();
    if (!vendor) fail('Vendor not found');
    const sameCompany = rows.filter((r) => r.portfolio_id === vendor.portfolio_id);
    if (sameCompany.length < rows.length) failures.push(...Array(rows.length - sameCompany.length).fill('Vendor is from a different company'));
    const changing = sameCompany.filter((r) => r.vendor_id !== vendor.id);
    unchanged = sameCompany.length - changing.length;
    const note = `Assigned to vendor: ${vendor.name} (bulk)`;
    // Brand-new orders also move to "assigned"; others keep their status.
    // Only within the vendor's own company.
    groups.push({ ids: changing.filter((r) => r.status === 'new').map((r) => r.id), patch: { vendor_id: vendor.id, status: 'assigned' }, note, status: 'assigned', portfolio: vendor.portfolio_id });
    groups.push({ ids: changing.filter((r) => r.status !== 'new').map((r) => r.id), patch: { vendor_id: vendor.id }, note, status: null, portfolio: vendor.portfolio_id });
  }

  let done = 0;
  const activity: Array<{ work_order_id: string; note: string; new_status: string | null }> = [];
  const notify: Array<{ id: string; status: string }> = [];
  for (const g of groups) {
    if (!g.ids.length) continue;
    let query = db.from('work_orders').update(g.patch).in('id', g.ids).is('archived_at', null);
    if (g.portfolio) query = query.eq('portfolio_id', g.portfolio);
    const { data: updated, error } = await query.select('id');
    if (error) { failures.push(...Array(g.ids.length).fill(error.message)); continue; }
    const updatedIds = new Set(((updated ?? []) as Array<{ id: string }>).map((u) => u.id));
    if (updatedIds.size < g.ids.length) failures.push(...Array(g.ids.length - updatedIds.size).fill('Work order not found'));
    done += updatedIds.size;
    for (const id of updatedIds) {
      activity.push({ work_order_id: id, note: g.note, new_status: g.status });
      if (g.status) notify.push({ id, status: g.status });
    }
  }

  // Orders that WERE updated but whose activity entries could not be written
  // are reported separately, so nobody retries (and re-notifies) a done change.
  let logMissing = 0;
  if (activity.length) {
    const { error: logError } = await db.from('work_order_updates').insert(activity);
    if (logError) logMissing = activity.length;
  }
  await inBatches(notify, NOTIFY_CONCURRENCY, (n) => notifyOwnerOfStatusChange({ kind: 'work_order', id: n.id, newStatus: n.status }));

  revalidatePath('/work-orders');
  const reasons = [...new Set(failures)].slice(0, 3).join('; ');
  redirect(`${safeBack}${sep}bulk=${op}&done=${done}`
    + (unchanged ? `&same=${unchanged}` : '')
    + (failures.length ? `&failed=${failures.length}&reason=${encodeURIComponent(reasons)}` : '')
    + (logMissing ? `&nolog=${logMissing}` : ''));
}
