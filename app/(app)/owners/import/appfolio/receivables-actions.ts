'use server';

// Opening balances from AppFolio's Aged Receivable Detail export (parsed in
// the browser by lib/imports/appfolio-receivables.ts). Each open item becomes
// one opening-balance charge on its unit through import_opening_balance,
// which posts the charge (post_ad_hoc_charge, can_manage_finance-checked)
// and records it in imported_balances (Import Variances) in one transaction.
//
// Nothing from the browser is trusted: the association is re-checked through
// the signed-in user's session (RLS), units are matched by number inside that
// association only, and every amount and date is re-validated here.
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireFinanceStaff } from '@/lib/auth/me';
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
const MEMO_PREFIX = 'AppFolio:';
const CONCURRENCY = 6;

const clean = (v: unknown): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());

function isoDate(v: unknown): string | null {
  const s = clean(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCDate() === Number(m[3]) && d.getUTCMonth() === Number(m[2]) - 1 ? s : null;
}

const itemKey = (unitId: string, asOf: string, memo: string, amount: number) =>
  `${unitId}|${asOf}|${memo}|${amount.toFixed(2)}`;

const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export async function importAppfolioReceivables(
  associationId: string,
  asOf: string,
  items: ReceivableImportItem[],
  options: { confirmDuplicate?: boolean } = {},
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

  // Idempotency: import_opening_balance records every posting in
  // imported_balances with the description as memo, so earlier AppFolio
  // postings for this association are known. With any present the import is
  // refused until the user confirms; once confirmed, items already posted
  // (same unit, date, description and amount) are still skipped, so a second
  // run only adds what the first one missed (e.g. units added since).
  const already = new Map<string, number>();
  let existingCount = 0;
  for (let from = 0; ; from += 1000) {
    const { data: rows, error: existingErr } = await db
      .from('imported_balances')
      .select('unit_id, as_of_date, imported_balance, memo')
      .eq('association_id', associationId)
      .like('memo', `${MEMO_PREFIX}%`)
      .order('created_at', { ascending: true })
      .range(from, from + 999);
    if (existingErr) return fail(`Could not check for an earlier AppFolio import: ${existingErr.message}`);
    for (const r of rows ?? []) {
      const key = itemKey(r.unit_id, r.as_of_date, r.memo, Number(r.imported_balance));
      already.set(key, (already.get(key) ?? 0) + 1);
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
      errors: [`This association already has ${existingCount} AppFolio opening balance${existingCount === 1 ? '' : 's'}. Nothing was imported. Import anyway to add only the items not posted before.`],
    };
  }

  // Same charge category as the CSV opening-balance import.
  const { data: category, error: catErr } = await db
    .from('charge_categories')
    .select('id')
    .eq('portfolio_id', association.portfolio_id)
    .eq('code', 'OTHER')
    .eq('active', true)
    .maybeSingle();
  if (catErr || !category) {
    return fail(`Could not find an active "Other" charge category for this company${catErr ? `: ${catErr.message}` : ''}.`);
  }

  const { data: units, error: unitsErr } = await db
    .from('units')
    .select('id, unit_number, buildings!inner(association_id)')
    .eq('buildings.association_id', associationId)
    .is('archived_at', null);
  if (unitsErr) return fail(`Could not load the association's units: ${unitsErr.message}`);
  const unitByNumber = new Map<string, string>(
    (units ?? []).map((u: any) => [clean(u.unit_number).toLowerCase(), u.id as string]),
  );

  let skipped = 0;
  const errors: string[] = [];
  const unmatched = new Map<string, { count: number; amount: number }>();
  const credits: string[] = [];
  let zero = 0;
  let previously = 0;
  const work: Array<{ line: string; unitNumber: string; unitId: string; amount: number; description: string; asOf: string }> = [];

  for (const it of items) {
    const line = clean(it?.row).slice(0, 10) || '?';
    const unitNumber = clean(it?.unit_number).slice(0, 40);
    const amount = typeof it?.amount === 'number' && Number.isFinite(it.amount) ? Math.round(it.amount * 100) / 100 : null;
    if (!unitNumber || amount === null) { skipped++; errors.push(`Line ${line}: missing unit or amount.`); continue; }
    if (amount === 0) { skipped++; zero++; continue; }
    const unitId = unitByNumber.get(unitNumber.toLowerCase());
    if (!unitId) {
      skipped++;
      const u = unmatched.get(unitNumber) ?? { count: 0, amount: 0 };
      u.count++; u.amount += amount;
      unmatched.set(unitNumber, u);
      continue;
    }
    if (amount < 0) {
      // Charges cannot be negative (charges_amount_check), and this RPC only
      // posts charges: a credit has to be entered as a credit in Portier369.
      skipped++;
      credits.push(`Line ${line} (${unitNumber}): credit of ${usd(-amount)} not imported. Charges can't be negative; enter it as a credit on the unit.`);
      continue;
    }
    if (amount > 10_000_000) { skipped++; errors.push(`Line ${line} (${unitNumber}): amount ${usd(amount)} is too large.`); continue; }
    const chargeDate = isoDate(it?.charge_date);
    const glName = clean(it?.gl_name).slice(0, 120) || 'Opening balance';
    const dated = chargeDate ?? asOfDate;
    const description = `${MEMO_PREFIX} ${glName} (${dated})`;
    const key = itemKey(unitId, dated, description, amount);
    const seen = already.get(key) ?? 0;
    if (seen > 0) {
      already.set(key, seen - 1);
      skipped++;
      previously++;
      continue;
    }
    work.push({
      line, unitNumber, unitId, amount,
      description,
      asOf: dated,
    });
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
  if (previously) errors.push(`${previously} item${previously === 1 ? ' was' : 's were'} already imported earlier and skipped.`);
  if (zero) errors.push(`${zero} item${zero === 1 ? '' : 's'} with nothing receivable skipped.`);

  if (imported) {
    revalidatePath('/charges');
    revalidatePath('/units');
    revalidatePath(`/associations/${associationId}`);
  }
  return { imported, skipped, errors: errors.length ? errors : undefined, totalImported };
}
