'use server';

// Opening balances from AppFolio's Aged Receivable Detail export (parsed in
// the browser by lib/imports/appfolio-receivables.ts). Each open item becomes
// one opening-balance charge on its unit through import_opening_balance,
// which posts the charge (post_ad_hoc_charge, can_manage_finance-checked)
// and records it in imported_balances (Import Variances) in one transaction.
// The file can cover a whole company; the page sends one AppFolio
// association's items at a time, into the association the user picked.
//
// import_opening_balance takes one date, used for both the charge and the
// imported_balances row: every item is dated with the report's as-of date so
// Import Variances compares one per-unit total, and the original charge date
// is kept in the description.
//
// Nothing from the browser is trusted: the association is re-checked through
// the signed-in user's session (RLS), units are matched by number inside that
// association only, and every amount and date is re-validated here.
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireFinanceStaff } from '@/lib/auth/me';
import { withImportLock } from '@/lib/imports/import-lock';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import type { AppfolioReceivableItem } from '@/lib/imports/appfolio-receivables';

export type ReceivablesImportSummary = {
  imported: number;
  skipped: number;
  errors?: string[];
  /** Sum of the charges posted by this run. */
  totalImported: number;
  /**
   * Set when the association already has AppFolio opening balances: nothing
   * was posted. Call again with `{ confirmDuplicate: true }` to import anyway.
   */
  alreadyImported?: number;
};

/** What the action needs from each parsed item (extra fields are ignored). */
export type ReceivableImportItem = Pick<AppfolioReceivableItem, 'row' | 'unit_number' | 'charge_date' | 'gl_name' | 'amount'>;

const MAX_ITEMS = 5000;
/** Prefix of every description this import writes; imported_balances.memo keeps it. */
const MEMO_PREFIX = 'Prior system:';
const CONCURRENCY = 6;

const clean = (v: unknown): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());

function isoDate(v: unknown): string | null {
  const s = clean(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCDate() === Number(m[3]) && d.getUTCMonth() === Number(m[2]) - 1 ? s : null;
}

/** Unit numbers compare case-insensitively, ignoring spacing around dashes ("3817 - 1" = "3817-1"). */
const unitKey = (v: unknown) => clean(v).toLowerCase().replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ');

/**
 * An imported source item, independent of the report cutoff and of its outstanding amount:
 * unit + description (GL name and original charge date). Re-importing a later snapshot (other
 * as-of date, or an item partly paid since) therefore still recognises every item already
 * posted, and a changed amount is reported instead of posted again in full.
 */
const itemKey = (unitId: string, memo: string) => `${unitId}|${memo}`;
const cents = (n: number) => Math.round(n * 100);

const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export async function importAppfolioReceivables(
  associationId: string,
  asOf: string,
  items: ReceivableImportItem[],
  /**
   * complete: the browser read every row of the file and it has a Total line it ties to. Only then
   * are earlier items missing from this file reported (a row the parser skipped is not "gone").
   */
  options: { confirmDuplicate?: boolean; complete?: boolean } = {},
): Promise<ReceivablesImportSummary> {
  await requireFinanceStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const fail = (message: string, skipped = Array.isArray(items) ? items.length : 0): ReceivablesImportSummary =>
    ({ imported: 0, skipped, errors: [message], totalImported: 0 });

  if (!Array.isArray(items) || items.length === 0) return fail('The file has no open items.', 0);
  if (items.length > MAX_ITEMS) return fail(`Import at most ${MAX_ITEMS} open items at a time.`);
  if (typeof associationId !== 'string' || !associationId) return fail('No association selected.');
  const asOfDate = isoDate(asOf);
  if (!asOfDate) return fail('Enter the report’s as-of date.');

  // The association id comes from the browser: it must be one this user can see.
  const { data: association, error: assocErr } = await db
    .from('associations').select('id, portfolio_id').eq('id', associationId).is('archived_at', null).maybeSingle();
  if (assocErr || !association) {
    return fail(assocErr ? `Could not check the association: ${assocErr.message}` : 'That association was not found or is outside your access.');
  }

  // Same charge category as the CSV opening-balance import. A company may also have an
  // association-specific OTHER override: use it for this association, else the
  // company-wide one (never another association's).
  const { data: categories, error: catErr } = await db
    .from('charge_categories')
    .select('id, association_id')
    .eq('portfolio_id', association.portfolio_id)
    .eq('code', 'OTHER')
    .eq('active', true)
    .or(`association_id.eq.${association.id},association_id.is.null`)
    .order('association_id', { ascending: true, nullsFirst: false })
    .order('id')
    .limit(1);
  const category = (categories ?? [])[0] as { id: string } | undefined;
  if (catErr || !category) {
    return fail(`Could not find an active "Other" charge category for this company${catErr ? `: ${catErr.message}` : ''}.`);
  }

  // Paged: PostgREST returns at most 1,000 rows; a missed unit's charges would be skipped.
  const { rows: units, error: unitsErr } = await fetchAllRows<any>(() => db
    .from('units')
    .select('id, unit_number, buildings!inner(association_id)')
    .eq('buildings.association_id', associationId)
    .is('archived_at', null)
    .order('id'));
  if (unitsErr) return fail(`Could not load the association's units: ${unitsErr}`);
  // A unit number used in more than one building is ambiguous: its items stay unmatched
  // rather than landing on an arbitrary unit.
  const unitByNumber = new Map<string, string>();
  const unitNumberById = new Map<string, string>();
  const ambiguousUnits = new Set<string>();
  for (const u of units ?? []) {
    unitNumberById.set(u.id as string, clean(u.unit_number));
    const k = unitKey(u.unit_number);
    if (unitByNumber.has(k)) ambiguousUnits.add(k);
    else unitByNumber.set(k, u.id as string);
  }
  for (const k of ambiguousUnits) unitByNumber.delete(k);

  // Two runs at once would both pass the duplicate check below and post every
  // item twice: the check and the posting run under the association's import lock.
  try {
    return await withImportLock(db, associationId, 'appfolio_receivables', async () => {
      // Idempotency: import_opening_balance records every posting in
      // imported_balances with the description as memo, so earlier AppFolio
      // postings for this association are known. With any present the import is
      // refused until the user confirms; once confirmed, items already posted
      // (same unit and description, whatever the as-of date) are still skipped, so a second
      // run only adds what the first one missed (e.g. units added since). An item whose
      // amount changed since (e.g. partly paid) is reported, never posted again.
      // Per unit + description: the amounts (in cents) already posted.
      const already = new Map<string, number[]>();
      let existingCount = 0;
      for (let from = 0; ; from += 1000) {
        const { data: rows, error: existingErr } = await db
          .from('imported_balances')
          .select('unit_id, imported_balance, memo')
          .eq('association_id', associationId)
          .like('memo', `${MEMO_PREFIX}%`)
          .order('created_at', { ascending: true })
          .range(from, from + 999);
        if (existingErr) return fail(`Could not check for an earlier import: ${existingErr.message}`);
        for (const r of rows ?? []) {
          const key = itemKey(r.unit_id, r.memo);
          already.set(key, [...(already.get(key) ?? []), cents(Number(r.imported_balance))]);
          existingCount++;
        }
        if (!rows || rows.length < 1000) break;
      }
      if (existingCount > 0 && !options.confirmDuplicate) {
        return {
          imported: 0,
          skipped: items.length,
          totalImported: 0,
          alreadyImported: existingCount,
          errors: [`This association already has ${existingCount} imported opening balance${existingCount === 1 ? '' : 's'}. Nothing was imported. Import anyway to add only the items not posted before.`],
        };
      }

      let skipped = 0;
      const errors: string[] = [];
      const unmatched = new Map<string, { count: number; amount: number }>();
      const credits: string[] = [];
      let zero = 0;
      let previously = 0;
      const changed: string[] = [];
      const candidates: Array<{ line: string; unitNumber: string; unitId: string; amount: number; description: string; asOf: string }> = [];

      for (const it of items) {
        const line = clean(it?.row).slice(0, 10) || '?';
        const unitNumber = clean(it?.unit_number).slice(0, 40);
        const amount = typeof it?.amount === 'number' && Number.isFinite(it.amount) ? Math.round(it.amount * 100) / 100 : null;
        if (!unitNumber || amount === null) { skipped++; errors.push(`Line ${line}: missing unit or amount.`); continue; }
        if (amount === 0) { skipped++; zero++; continue; }
        const unitId = unitByNumber.get(unitKey(unitNumber));
        if (!unitId) {
          skipped++;
          if (ambiguousUnits.has(unitKey(unitNumber))) {
            errors.push(`Line ${line}: unit "${unitNumber}" exists in more than one building; not posted.`);
            continue;
          }
          const u = unmatched.get(unitNumber) ?? { count: 0, amount: 0 };
          u.count++; u.amount += amount;
          unmatched.set(unitNumber, u);
          continue;
        }
        if (amount < 0) {
          // Charges cannot be negative (charges_amount_check), and this RPC only
          // posts charges: a credit has to be entered as a credit on the unit.
          skipped++;
          credits.push(`Line ${line} (${unitNumber}): credit of ${usd(-amount)} not imported. Charges can't be negative; enter it as a credit on the unit.`);
          continue;
        }
        if (amount > 10_000_000) { skipped++; errors.push(`Line ${line} (${unitNumber}): amount ${usd(amount)} is too large.`); continue; }
        const chargeDate = isoDate(it?.charge_date);
        const glName = clean(it?.gl_name).slice(0, 120) || 'Opening balance';
        const description = chargeDate ? `${MEMO_PREFIX} ${glName} (charged ${chargeDate})` : `${MEMO_PREFIX} ${glName}`;
        candidates.push({
          line, unitNumber, unitId, amount,
          description,
          asOf: asOfDate,
        });
      }

      // Items already posted: exact amounts first (so two same-day items of one GL account
      // pair up correctly), then any left on the same unit + description with another amount.
      const pending: typeof candidates = [];
      for (const c of candidates) {
        const amounts = already.get(itemKey(c.unitId, c.description));
        const at = amounts?.indexOf(cents(c.amount)) ?? -1;
        if (amounts && at >= 0) {
          amounts.splice(at, 1);
          skipped++;
          previously++;
        } else pending.push(c);
      }
      const work: typeof candidates = [];
      for (const c of pending) {
        const amounts = already.get(itemKey(c.unitId, c.description));
        if (amounts && amounts.length) {
          const before = amounts.shift()! / 100;
          skipped++;
          changed.push(`Line ${c.line} (${c.unitNumber}): ${c.description.slice(MEMO_PREFIX.length).trim()} was imported earlier as ${usd(before)} and is ${usd(c.amount)} in this file. Not posted again; compare the unit's current balance with your previous system (Import Variances report) before changing it.`);
        } else work.push(c);
      }

      // Items imported earlier that this file no longer lists (paid in full or removed in
      // AppFolio; a fully paid item drops out of the report). Only for a complete file: the
      // page sends the association's whole snapshot, but a row the parser could not read
      // would otherwise look paid.
      const gone = new Map<string, { count: number; amount: number }>();
      let goneUnchecked = 0;
      for (const [key, amounts] of already) {
        if (amounts.length && options.complete !== true) { goneUnchecked += amounts.length; continue; }
        if (!amounts.length) continue;
        const unitId = key.slice(0, key.indexOf('|'));
        const g = gone.get(unitId) ?? { count: 0, amount: 0 };
        g.count += amounts.length;
        g.amount += amounts.reduce((sum, a) => sum + a, 0) / 100;
        gone.set(unitId, g);
      }
      for (const [unitId, g] of gone) {
        const unitNumber = unitNumberById.get(unitId);
        changed.push(`${unitNumber ? `Unit "${unitNumber}"` : 'An archived unit'}: ${g.count} item${g.count === 1 ? '' : 's'} imported earlier (${usd(g.amount)}) ${g.count === 1 ? 'is' : 'are'} no longer in this file (paid or removed in your previous system). Compare the unit's current balance with your previous system (Import Variances report) before changing it.`);
      }
      if (goneUnchecked) {
        changed.push(`${goneUnchecked} item${goneUnchecked === 1 ? '' : 's'} imported earlier ${goneUnchecked === 1 ? 'is' : 'are'} not in this file, but the file had rows that could not be read or has no Total line it ties to, so ${goneUnchecked === 1 ? 'it was' : 'they were'} not checked.`);
      }

      let imported = 0;
      let totalImported = 0;
      for (let i = 0; i < work.length; i += CONCURRENCY) {
        const batch = work.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map((w) => db.rpc('import_opening_balance', {
          p_unit_id: w.unitId,
          p_charge_category_id: category.id,
          p_amount: w.amount,
          p_description: w.description,
          p_as_of: w.asOf,
        })));
        results.forEach((res: { error: { message: string } | null }, idx: number) => {
          const w = batch[idx];
          if (res.error) {
            skipped++;
            errors.push(`Line ${w.line} (${w.unitNumber}): ${res.error.message}`);
          } else {
            imported++;
            totalImported = Math.round((totalImported + w.amount) * 100) / 100;
          }
        });
      }

      for (const [unitNumber, u] of unmatched) {
        errors.push(`Unit "${unitNumber}" is not in this association: ${u.count} item${u.count === 1 ? '' : 's'} (${usd(u.amount)}) not imported. Add the unit, then import this file again: items already posted are skipped.`);
      }
      errors.push(...credits);
      errors.push(...changed);
      if (previously) errors.push(`${previously} item${previously === 1 ? ' was' : 's were'} already imported earlier and skipped.`);
      if (zero) errors.push(`${zero} item${zero === 1 ? '' : 's'} with nothing receivable skipped.`);

      if (imported) {
        revalidatePath('/charges');
        revalidatePath('/units');
        revalidatePath(`/associations/${associationId}`);
      }
      return { imported, skipped, errors: errors.length ? errors : undefined, totalImported };
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'The import failed. Try again.');
  }
}
