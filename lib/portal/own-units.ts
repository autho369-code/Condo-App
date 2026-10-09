import 'server-only';

// The owner portal must show only the signed-in owner's own units. RLS alone is
// not enough: an owner who is also a board member can read the whole
// association, so unfiltered portal queries leaked every owner's ledger,
// balances and requests. Every /portal query on unit-scoped data filters by
// these ids explicitly.
export const NO_UNITS = ['00000000-0000-0000-0000-000000000000'];

/**
 * One owner login can hold several owner records (one per association it was
 * invited to): portal reads take every record of the login (`me.owner_ids`).
 * A single id is accepted too.
 */
export type OwnerIds = string | readonly string[] | null | undefined;

export function ownerIdList(ownerIds: OwnerIds): string[] {
  if (!ownerIds) return [];
  return (typeof ownerIds === 'string' ? [ownerIds] : [...ownerIds]).filter(Boolean);
}

/**
 * The owner's current unit ids plus the read error, if any. Pages must render
 * the error in an <Alert>: treating a failed read as "no units" showed empty
 * lists and a $0.00 balance as if they were real.
 */
export async function loadOwnPortalUnitIds(
  db: any,
  ownerIds: OwnerIds,
): Promise<{ ids: string[]; error: string | null }> {
  const ids = ownerIdList(ownerIds);
  if (!ids.length) return { ids: [], error: null };
  const { data, error } = await db
    .from('occupancies')
    .select('unit_id')
    .in('owner_id', ids)
    .eq('status', 'current');
  if (error) return { ids: [], error: `Could not load your units: ${error.message ?? 'unknown error'}` };
  return { ids: [...new Set(((data ?? []) as { unit_id: string }[]).map((r) => r.unit_id).filter(Boolean))], error: null };
}

/** The owner's current unit ids; throws when the read fails (never a silent []). */
export async function ownPortalUnitIds(db: any, ownerIds: OwnerIds): Promise<string[]> {
  const { ids, error } = await loadOwnPortalUnitIds(db, ownerIds);
  if (error) throw new Error(error);
  return ids;
}

/** Value for `.in('unit_id', …)` that matches nothing when the owner has no units. */
export function unitFilter(ids: string[]): string[] {
  return ids.length > 0 ? ids : NO_UNITS;
}

/**
 * The login's owner record that currently holds `unitId` (one record per
 * association), or null. Writes about a unit are filed under this record.
 */
export async function ownerRecordForUnit(
  db: any,
  ownerIds: OwnerIds,
  unitId: string,
): Promise<{ ownerId: string | null; error: string | null }> {
  const ids = ownerIdList(ownerIds);
  if (!ids.length || !unitId) return { ownerId: null, error: null };
  const { data, error } = await db
    .from('occupancies')
    .select('owner_id')
    .in('owner_id', ids)
    .eq('unit_id', unitId)
    .eq('status', 'current')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) return { ownerId: null, error: `Could not check your unit: ${error.message ?? 'unknown error'}` };
  return { ownerId: (data?.owner_id as string | undefined) ?? null, error: null };
}
