import 'server-only';

// The owner portal must show only the signed-in owner's own units. RLS alone is
// not enough: an owner who is also a board member can read the whole
// association, so unfiltered portal queries leaked every owner's ledger,
// balances and requests. Every /portal query on unit-scoped data filters by
// these ids explicitly.
export const NO_UNITS = ['00000000-0000-0000-0000-000000000000'];

export async function ownPortalUnitIds(db: any, ownerId: string | null | undefined): Promise<string[]> {
  if (!ownerId) return [];
  const { data } = await db
    .from('occupancies')
    .select('unit_id')
    .eq('owner_id', ownerId)
    .eq('status', 'current');
  return [...new Set(((data ?? []) as { unit_id: string }[]).map((r) => r.unit_id).filter(Boolean))];
}

/** Value for `.in('unit_id', …)` that matches nothing when the owner has no units. */
export function unitFilter(ids: string[]): string[] {
  return ids.length > 0 ? ids : NO_UNITS;
}
