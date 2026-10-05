// An owner's monthly dues (occupancies.dues_amount) are billed by a unit
// recurring charge in the portfolio's assessment category; the daily
// post_unit_recurring_charges job posts it. Entering dues on an owner without
// creating that charge means dues are never billed.

/** First day of the month on or after `date` (YYYY-MM-DD): dues post on the 1st. */
export function firstDuesDate(date: string): string {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  if (d === 1) return date.slice(0, 10);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, '0')}-01`;
}

/**
 * Create the monthly dues recurring charge for a unit, starting on the first
 * of the month on/after `startFrom`. No-op when the amount is 0 or the unit
 * already has an active recurring charge in the assessment category.
 * Returns an error message, or null.
 */
export async function subscribeUnitDues(
  db: any,
  opts: { unitId: string; portfolioId: string; associationId: string; amount: number; startFrom: string },
): Promise<string | null> {
  if (!(opts.amount > 0)) return null;
  const { data: cats, error: catErr } = await db
    .from('charge_categories')
    .select('id, association_id')
    .eq('portfolio_id', opts.portfolioId)
    .eq('charge_type', 'assessment')
    .eq('active', true);
  if (catErr) return `dues: could not load the assessment charge category: ${catErr.message}`;
  const list = (cats ?? []) as Array<{ id: string; association_id: string | null }>;
  const cat = list.find((c) => c.association_id === opts.associationId) ?? list.find((c) => !c.association_id);
  if (!cat) return 'dues: no active assessment charge category exists, so monthly dues were not scheduled. Add one under Charge categories, then add the dues on the unit.';

  const { data: existing, error: exErr } = await db
    .from('unit_recurring_charges')
    .select('id')
    .eq('unit_id', opts.unitId)
    .eq('charge_category_id', cat.id)
    .eq('active', true)
    .limit(1);
  if (exErr) return `dues: could not check existing recurring charges: ${exErr.message}`;
  if ((existing ?? []).length) return null;

  const { error } = await db.rpc('subscribe_unit_to_charge', {
    p_unit_id: opts.unitId,
    p_charge_category_id: cat.id,
    p_amount: Math.round(opts.amount * 100) / 100,
    p_frequency: 'monthly',
    p_start_date: firstDuesDate(opts.startFrom),
    p_memo: null,
    p_identifier: null,
  });
  return error ? `dues: ${error.message}` : null;
}
