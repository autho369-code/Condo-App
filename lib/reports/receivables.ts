import { fetchAllRows } from '@/lib/supabase/fetch-all';

// Credit on file for the A/R aging report: unapplied payments and homeowner
// credits (v_unapplied_credits). The Receivables page counts outstanding as
// open charges less this credit, so the aging report lists it too (as
// negative rows) and its total matches that page.

export type UnappliedCredit = {
  paymentId: string;
  unitId: string;
  unitNumber: string;
  associationId: string;
  associationName: string;
  paymentDate: string | null;
  unapplied: number;
};

const CHUNK = 200;
const TRUNCATED = 'There are too many rows to total reliably; narrow the report to fewer associations.';

function chunks<T>(list: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * Unapplied credit per payment for units in `associationIds`, or every unit
 * the client can read when null (a signed-in client: row-level security
 * limits it to the user's own associations). Pass association ids with a
 * service client.
 */
export async function loadUnappliedCredits(db: any, associationIds: string[] | null): Promise<UnappliedCredit[]> {
  const units = new Map<string, { unitNumber: string; associationId: string; associationName: string }>();
  const addUnits = (rows: any[]) => {
    for (const u of rows) {
      units.set(u.id, {
        unitNumber: u.unit_number ?? '',
        associationId: u.buildings?.association_id ?? '',
        associationName: u.buildings?.associations?.name ?? '',
      });
    }
  };
  const unitQuery = () => db.from('units').select('id, unit_number, buildings!inner(association_id, associations(name))');

  let credits: any[] = [];
  if (associationIds) {
    if (associationIds.length === 0) return [];
    for (const ids of chunks(associationIds)) {
      const { rows, truncated, error } = await fetchAllRows<any>(() => unitQuery().in('buildings.association_id', ids).order('id'));
      if (error) throw new Error(`Could not load units: ${error}`);
      if (truncated) throw new Error(TRUNCATED);
      addUnits(rows);
    }
    for (const ids of chunks([...units.keys()])) {
      const { rows, truncated, error } = await fetchAllRows<any>(() => db.from('v_unapplied_credits')
        .select('payment_id, unit_id, payment_date, unapplied_amount').in('unit_id', ids).order('payment_id'));
      if (error) throw new Error(`Could not load unapplied credits: ${error}`);
      if (truncated) throw new Error(TRUNCATED);
      credits.push(...rows);
    }
  } else {
    const { rows, truncated, error } = await fetchAllRows<any>(() => db.from('v_unapplied_credits')
      .select('payment_id, unit_id, payment_date, unapplied_amount').order('payment_id'));
    if (error) throw new Error(`Could not load unapplied credits: ${error}`);
    if (truncated) throw new Error(TRUNCATED);
    credits = rows;
    const missing = [...new Set(credits.map((c) => c.unit_id))];
    for (const ids of chunks(missing)) {
      const { rows: unitRows, truncated: unitTruncated, error: unitError } = await fetchAllRows<any>(() => unitQuery().in('id', ids).order('id'));
      if (unitError) throw new Error(`Could not load units: ${unitError}`);
      if (unitTruncated) throw new Error(TRUNCATED);
      addUnits(unitRows);
    }
  }

  return credits
    .filter((c) => units.has(c.unit_id) && Number(c.unapplied_amount ?? 0) > 0)
    .map((c) => {
      const unit = units.get(c.unit_id)!;
      return {
        paymentId: c.payment_id,
        unitId: c.unit_id,
        unitNumber: unit.unitNumber,
        associationId: unit.associationId,
        associationName: unit.associationName,
        paymentDate: c.payment_date ?? null,
        unapplied: Number(c.unapplied_amount ?? 0),
      };
    })
    .sort((a, b) => a.associationName.localeCompare(b.associationName) || a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }));
}

/** Outstanding receivables as the Receivables page counts them. */
export function outstandingReceivables(openChargeBalances: number[], credits: Pick<UnappliedCredit, 'unapplied'>[]): number {
  const open = openChargeBalances.reduce((s, v) => s + Number(v ?? 0), 0);
  const credit = credits.reduce((s, c) => s + Number(c.unapplied ?? 0), 0);
  return open - credit;
}
