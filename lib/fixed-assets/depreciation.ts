/**
 * Display-only depreciation for fixed assets.
 *
 * Nothing posts depreciation to the ledger yet, so fixed_assets.accumulated_depreciation
 * stays at whatever was typed in (usually 0). For straight-line assets we compute
 * depreciation to date from the asset's own fields so cost and book value mean
 * something. The result is labelled as calculated wherever it is shown; it is
 * not a journal entry.
 */

export type DepreciationInput = {
  purchase_price?: number | string | null;
  salvage_value?: number | string | null;
  useful_life_years?: number | string | null;
  depreciation_method?: string | null;
  placed_in_service_date?: string | null;
  purchase_date?: string | null;
  accumulated_depreciation?: number | string | null;
  status?: string | null;
  disposed_at?: string | null;
};

export type DepreciationResult = {
  /** Accumulated depreciation to show. */
  accumulated: number;
  /** cost - accumulated, or null when the asset has no cost. */
  bookValue: number | null;
  /**
   * calculated: straight-line to date from the asset's fields.
   * recorded:   the stored accumulated_depreciation (method not straight-line or inputs missing).
   * none:       the asset is set to no depreciation.
   */
  basis: 'calculated' | 'recorded' | 'none';
  /** Why the value could not be calculated, when basis is 'recorded'. */
  note?: string;
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Whole months from start (YYYY-MM-DD) up to end (YYYY-MM-DD); 0 if end is before start. */
export function wholeMonthsBetween(start: string, end: string): number {
  const [sy, sm, sd] = start.slice(0, 10).split('-').map(Number);
  const [ey, em, ed] = end.slice(0, 10).split('-').map(Number);
  if (![sy, sm, sd, ey, em, ed].every(Number.isFinite)) return 0;
  let months = (ey - sy) * 12 + (em - sm);
  if (ed < sd) months -= 1;
  return Math.max(0, months);
}

export function depreciationToDate(asset: DepreciationInput, asOf: string): DepreciationResult {
  const cost = num(asset.purchase_price);
  const recorded = num(asset.accumulated_depreciation) ?? 0;
  const book = (acc: number) => (cost == null ? null : round2(cost - acc));
  const method = asset.depreciation_method ?? 'straight_line';

  if (method === 'none') return { accumulated: recorded, bookValue: book(recorded), basis: 'none' };
  if (method !== 'straight_line') {
    return { accumulated: recorded, bookValue: book(recorded), basis: 'recorded', note: 'Only straight-line depreciation is calculated.' };
  }

  const life = num(asset.useful_life_years);
  const start = asset.placed_in_service_date || asset.purchase_date || null;
  if (cost == null || cost <= 0 || !life || life <= 0 || !start) {
    return {
      accumulated: recorded,
      bookValue: book(recorded),
      basis: 'recorded',
      note: 'Needs a cost, useful life, and placed-in-service or purchase date to calculate.',
    };
  }

  const salvage = Math.min(Math.max(num(asset.salvage_value) ?? 0, 0), cost);
  const depreciable = cost - salvage;
  // Stop depreciating when the asset left service.
  const disposed = (asset.status === 'disposed' || asset.status === 'sold') && asset.disposed_at
    ? String(asset.disposed_at).slice(0, 10)
    : null;
  const end = disposed && disposed < asOf ? disposed : asOf;
  const totalMonths = Math.round(life * 12);
  const elapsed = Math.min(wholeMonthsBetween(start, end), totalMonths);
  const accumulated = round2(depreciable * (elapsed / totalMonths));
  return { accumulated, bookValue: book(accumulated), basis: 'calculated' };
}
