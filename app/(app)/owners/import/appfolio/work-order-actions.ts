'use server';

// AppFolio "Work Order" report (parsed in the browser by
// lib/imports/appfolio-work-orders.ts) into one association's work_orders:
// history and open work, matched to the association's units and its
// company's vendors.
//
// Runs through the logged-in staff session client, so RLS applies to every
// read and insert; the work_orders triggers re-check that the unit is in the
// association and the vendor is the association's company's. Nothing from
// the browser is trusted: every value is re-validated here.
//
// work_orders has no column for another system's number (`number` is
// Portier369's own, assigned by trg_work_order_assign_number from a
// per-company counter, so an AppFolio number there could collide with a
// future Portier369 one). The AppFolio number goes at the start of the
// description ("AppFolio WO #1234-1"), and a work order whose number is
// already in the association is skipped, so re-importing the same file is
// safe.
//
// Inserting fires trg_dispatch_wo_created (one "work_order.created" webhook
// per row, for companies with active webhook endpoints subscribed to it). No
// email or in-app notification fires on insert, and this action sends none.
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import {
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  type AppfolioWorkOrder,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from '@/lib/imports/appfolio-work-orders';

export type WorkOrderImportSummary = { imported: number; skipped: number; errors?: string[] };

const MAX_WORK_ORDERS = 5000;
const BATCH = 200;
const MARKER = 'AppFolio WO #';
const MARKER_RE = /^AppFolio WO #(\S+)/;
const FINISHED: WorkOrderStatus[] = ['done', 'completed', 'billed', 'closed'];

function clean(v: unknown, max = 500): string {
  const s = typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
  return s.slice(0, max);
}
const orNull = (v: unknown, max?: number): string | null => clean(v, max) || null;
const isoDate = (v: unknown): string | null => {
  const s = clean(v, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) ? s : null;
};
const isoTime = (v: unknown): string | null => {
  const s = clean(v, 8);
  return /^([01]\d|2[0-3]):[0-5]\d:00$/.test(s) ? s : null;
};
const money = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e10 ? Math.round(v * 100) / 100 : null;
const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** Unit and vendor names compare case-insensitively with whitespace collapsed. */
const nameKey = (v: unknown) => clean(v, 300).toLowerCase().replace(/\s+/g, ' ');
const unitKey = (v: unknown) => nameKey(v).replace(/^(unit|apt|apartment|suite|ste)\.?\s+/, '').replace(/^#\s*/, '');

function titleFor(w: AppfolioWorkOrder, number: string): string {
  const firstLine = clean(w.job_description, 2000).split(/\r?\n/)[0].trim();
  const base = clean(w.issue, 200) || firstLine || `AppFolio work order ${number}`;
  const t = base.length > 200 ? `${base.slice(0, 199).trimEnd()}…` : base;
  return t.length >= 2 ? t : `AppFolio work order ${number}`.slice(0, 200);
}

/** Staff-only notes: what AppFolio had that work_orders has no column for. */
function internalNotesFor(w: AppfolioWorkOrder, unmatchedVendor: string | null, unmatchedUnit: string | null): string {
  const lines = ['Imported from AppFolio.'];
  const add = (label: string, v: string | null) => { if (v) lines.push(`${label}: ${v}`); };
  add('AppFolio status', orNull(w.appfolio_status, 60));
  add('AppFolio priority', orNull(w.appfolio_priority, 60));
  add('Type', orNull(w.type, 60));
  add('Vendor in AppFolio (no matching vendor here)', unmatchedVendor);
  add('Unit in AppFolio (no matching unit here)', unmatchedUnit);
  add('Primary resident', orNull(w.primary_resident, 200));
  add('Created in AppFolio', isoDate(w.created_on));
  add('Estimate requested', isoDate(w.estimate_requested_on));
  add('Estimated', isoDate(w.estimated_on));
  const est = money(w.estimate_amount);
  add('Estimate amount', est === null ? null : usd(est));
  add('Estimate approval', orNull(w.estimate_approval_status, 60));
  add('Estimate approved', isoDate(w.estimate_approved_on));
  add('Scheduled end', isoDate(w.scheduled_end));
  add('Work done', isoDate(w.work_done_on));
  add('Completed', isoDate(w.completed_on));
  const amount = money(w.amount);
  add('Amount', amount === null ? null : usd(amount));
  add('Invoice', orNull(w.invoice, 100));
  add('Unit turn ID', orNull(w.unit_turn_id, 60));
  add('Recurring', orNull(w.recurring, 20));
  add('Home warranty expiration', isoDate(w.home_warranty_expiration));
  return lines.join('\n');
}

export async function importAppfolioWorkOrders(
  associationId: string,
  workOrders: AppfolioWorkOrder[],
): Promise<WorkOrderImportSummary> {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  if (!Array.isArray(workOrders) || workOrders.length === 0) return { imported: 0, skipped: 0, errors: ['The file has no work orders.'] };
  if (workOrders.length > MAX_WORK_ORDERS) {
    return { imported: 0, skipped: workOrders.length, errors: [`Import at most ${MAX_WORK_ORDERS} work orders at a time.`] };
  }
  if (typeof associationId !== 'string' || !associationId) return { imported: 0, skipped: workOrders.length, errors: ['No association selected.'] };

  // The association id comes from the browser: RLS limits this to associations the staffer can see.
  const { data: association, error: assocErr } = await db
    .from('associations').select('id, portfolio_id').eq('id', associationId).is('archived_at', null).maybeSingle();
  if (assocErr || !association?.portfolio_id) {
    return { imported: 0, skipped: workOrders.length, errors: [assocErr ? `Could not check the association: ${assocErr.message}` : 'That association was not found or is outside your access.'] };
  }
  const portfolioId: string = association.portfolio_id;

  const [unitsRes, vendorsRes, existingRes] = await Promise.all([
    fetchAllRows<any>(() => db.from('units').select('id, unit_number, buildings!inner(association_id)')
      .eq('buildings.association_id', associationId).is('archived_at', null).order('id')),
    // Vendors of the association's company only (a work order's vendor must be;
    // trg_work_order_01_vendor_company enforces it too).
    fetchAllRows<any>(() => db.from('vendors').select('id, name')
      .eq('portfolio_id', portfolioId).is('archived_at', null).order('id')),
    // Archived ones count too: a work order someone removed is not brought back.
    fetchAllRows<any>(() => db.from('work_orders').select('id, description')
      .eq('association_id', associationId).ilike('description', 'AppFolio WO #%').order('id')),
  ]);
  const loadErr = unitsRes.error ?? vendorsRes.error ?? existingRes.error;
  if (loadErr) return { imported: 0, skipped: workOrders.length, errors: [`Could not load the association's units, vendors or work orders: ${loadErr}`] };

  // Unit numbers that appear in more than one building are ambiguous: leave unmatched.
  const unitByNumber = new Map<string, string | null>();
  for (const u of unitsRes.rows) {
    const k = unitKey(u.unit_number);
    if (!k) continue;
    unitByNumber.set(k, unitByNumber.has(k) ? null : u.id);
  }
  const vendorByName = new Map<string, string | null>();
  for (const v of vendorsRes.rows) {
    const k = nameKey(v.name);
    if (!k) continue;
    vendorByName.set(k, vendorByName.has(k) ? null : v.id);
  }
  const importedNumbers = new Set<string>();
  for (const w of existingRes.rows) {
    const m = clean(w.description, 200).match(MARKER_RE);
    if (m) importedNumbers.add(m[1].toLowerCase());
  }

  let skipped = 0;
  const errors: string[] = [];
  const unmatchedVendors = new Map<string, number>();
  const unmatchedUnits = new Map<string, number>();
  let duplicates = 0;
  const inFile = new Set<string>();
  const pending: Array<{ line: string; number: string; record: Record<string, unknown> }> = [];

  for (const w of workOrders) {
    const line = clean(w?.row, 10) || '?';
    const number = clean(w?.number, 60).replace(/\s+/g, '');
    if (!number) { skipped++; errors.push(`Line ${line}: no work order number.`); continue; }
    const numberKey = number.toLowerCase();
    if (importedNumbers.has(numberKey)) { skipped++; duplicates++; continue; }
    if (inFile.has(numberKey)) { skipped++; errors.push(`Line ${line} (WO ${number}): appears earlier in the file; skipped.`); continue; }
    inFile.add(numberKey);

    const status: WorkOrderStatus = (WORK_ORDER_STATUSES as readonly string[]).includes(w.status) ? w.status : 'new';
    const priority: WorkOrderPriority = (WORK_ORDER_PRIORITIES as readonly string[]).includes(w.priority) ? w.priority : 'normal';

    const unitName = orNull(w.unit, 60);
    let unitId: string | null = null;
    if (unitName) {
      unitId = unitByNumber.get(unitKey(unitName)) ?? null;
      if (!unitId) unmatchedUnits.set(unitName, (unmatchedUnits.get(unitName) ?? 0) + 1);
    }
    const vendorName = orNull(w.vendor, 200);
    let vendorId: string | null = null;
    if (vendorName) {
      vendorId = vendorByName.get(nameKey(vendorName)) ?? null;
      if (!vendorId) unmatchedVendors.set(vendorName, (unmatchedVendors.get(vendorName) ?? 0) + 1);
    }

    const jobDescription = clean(w.job_description, 20000);
    const marker = `${MARKER}${number}`;
    // work_orders.description is at most 2,000 characters; a longer job
    // description is kept whole in job_description.
    const full = jobDescription ? `${marker}\n\n${jobDescription}` : marker;
    const description = full.length > 2000 ? `${full.slice(0, 1999)}…` : full;

    const createdOn = isoDate(w.created_on);
    const completedDate = FINISHED.includes(status) ? (isoDate(w.completed_on) ?? isoDate(w.work_done_on)) : null;
    const record: Record<string, unknown> = {
      portfolio_id: portfolioId,
      association_id: associationId,
      unit_id: unitId,
      vendor_id: vendorId,
      title: titleFor(w, number),
      description,
      job_description: full.length > 2000 ? jobDescription : null,
      issue: orNull(w.issue, 500),
      category: 'other',
      priority,
      status,
      scheduled_date: isoDate(w.scheduled_date),
      scheduled_time: isoDate(w.scheduled_date) ? isoTime(w.scheduled_time) : null,
      // Finished work orders keep AppFolio's completion date (the stamp
      // trigger only fills in today when it is missing).
      completed_date: completedDate,
      requested_by: clean(w.type, 60).toLowerCase() === 'resident' ? orNull(w.primary_resident, 200) : null,
      // Moved to the staff-only work_order_private / work_order_vendor_private
      // tables by the work_orders_move_*_private_fields triggers.
      internal_notes: internalNotesFor(w, vendorName && !vendorId ? vendorName : null, unitName && !unitId ? unitName : null),
      vendor_instructions: orNull(w.instructions, 5000),
      owner_approved: false,
      withheld_amount_from_owner: 0,
      created_by: me.auth_user_id,
      // Noon UTC keeps the AppFolio creation day in every US time zone. Every
      // row sets it, so a batch insert never nulls it for a row without one.
      created_at: createdOn ? `${createdOn}T12:00:00Z` : new Date().toISOString(),
    };
    pending.push({ line, number, record });
  }

  // Batches of 200 (thousands of single inserts would be thousands of round
  // trips); a batch that fails is retried row by row so the error names the line.
  let imported = 0;
  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);
    const { error: batchErr } = await db.from('work_orders').insert(batch.map((p) => p.record));
    if (!batchErr) { imported += batch.length; continue; }
    for (const p of batch) {
      const { error: rowErr } = await db.from('work_orders').insert(p.record);
      if (rowErr) { skipped++; errors.push(`Line ${p.line} (WO ${p.number}): ${rowErr.message}`); }
      else imported++;
    }
  }

  if (duplicates) errors.unshift(`${duplicates} work order${duplicates === 1 ? ' was' : 's were'} already imported into this association; skipped.`);
  if (unmatchedVendors.size) {
    errors.push(`Imported without a vendor (no vendor with exactly this name in this company): ${[...unmatchedVendors].map(([n, c]) => `${n} (${c})`).join(', ')}. Add the vendor and assign it on the work order.`);
  }
  if (unmatchedUnits.size) {
    errors.push(`Imported without a unit (no single unit with this number in the association): ${[...unmatchedUnits].map(([n, c]) => `${n} (${c})`).join(', ')}.`);
  }

  revalidatePath('/work-orders');
  revalidatePath(`/associations/${associationId}`);
  return { imported, skipped, errors: errors.length ? errors : undefined };
}
