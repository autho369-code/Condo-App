import 'server-only';

// The owner portal must show only the signed-in owner's own units. RLS alone is
// not enough: an owner who is also a board member can read the whole
// association, so unfiltered portal queries leaked every owner's ledger,
// balances and requests. Every /portal query on unit-scoped data filters by
// these ids explicitly.
export const NO_UNITS = ['00000000-0000-0000-0000-000000000000'];

/**
 * The owner's current unit ids plus the read error, if any. Pages must render
 * the error in an <Alert>: treating a failed read as "no units" showed empty
 * lists and a $0.00 balance as if they were real.
 */
export async function loadOwnPortalUnitIds(
  db: any,
  ownerId: string | null | undefined,
): Promise<{ ids: string[]; error: string | null }> {
  if (!ownerId) return { ids: [], error: null };
  const { data, error } = await db
    .from('occupancies')
    .select('unit_id')
    .eq('owner_id', ownerId)
    .eq('status', 'current');
  if (error) return { ids: [], error: `Could not load your units: ${error.message ?? 'unknown error'}` };
  return { ids: [...new Set(((data ?? []) as { unit_id: string }[]).map((r) => r.unit_id).filter(Boolean))], error: null };
}

/** The owner's current unit ids; throws when the read fails (never a silent []). */
export async function ownPortalUnitIds(db: any, ownerId: string | null | undefined): Promise<string[]> {
  const { ids, error } = await loadOwnPortalUnitIds(db, ownerId);
  if (error) throw new Error(error);
  return ids;
}

/** Value for `.in('unit_id', …)` that matches nothing when the owner has no units. */
export function unitFilter(ids: string[]): string[] {
  return ids.length > 0 ? ids : NO_UNITS;
}
