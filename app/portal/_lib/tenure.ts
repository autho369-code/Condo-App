import 'server-only';
import { DEFAULT_TIME_ZONE, isValidTimeZone } from '@/lib/time/display-zone';

// A unit's history belongs to whoever owned it at the time. When a unit is
// sold, the buyer must still see the full open balance (that debt is real),
// but not the seller's payment details, service requests or payment plans.
// These helpers scope unit-keyed history to the signed-in owner's tenure:
// rows dated on/after their current occupancy's move_in_date.

/** unit_id → the owner's move-in date (null = no recorded move-in, no cutoff). */
export type TenureCutoffs = Map<string, string | null>;

export async function ownerTenureCutoffs(db: any, ownerId: string | null | undefined): Promise<TenureCutoffs> {
  const cutoffs: TenureCutoffs = new Map();
  if (!ownerId) return cutoffs;
  const { data } = await db
    .from('occupancies')
    .select('unit_id, move_in_date')
    .eq('owner_id', ownerId)
    .eq('status', 'current');
  for (const row of (data ?? []) as { unit_id: string | null; move_in_date: string | null }[]) {
    if (!row.unit_id) continue;
    const date = row.move_in_date ? String(row.move_in_date).slice(0, 10) : null;
    if (!cutoffs.has(row.unit_id)) { cutoffs.set(row.unit_id, date); continue; }
    const prev = cutoffs.get(row.unit_id) ?? null;
    // Several current rows for one unit: the earliest (or none) wins.
    cutoffs.set(row.unit_id, prev === null || date === null ? null : (date < prev ? date : prev));
  }
  return cutoffs;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * PostgREST `or` filter limiting rows to the owner's units, each from its
 * move-in date on: `unit_id = U1 OR (unit_id = U2 AND <column> >= D2)`.
 * Returns null when the owner has no units (caller should show nothing).
 */
export function tenureFilter(cutoffs: TenureCutoffs, column: string, unitIds?: string[]): string | null {
  const parts: string[] = [];
  for (const [unitId, since] of cutoffs) {
    if (unitIds && !unitIds.includes(unitId)) continue;
    if (!UUID.test(unitId)) continue;
    parts.push(since && DAY.test(since) ? `and(unit_id.eq.${unitId},${column}.gte.${since})` : `unit_id.eq.${unitId}`);
  }
  return parts.length > 0 ? parts.join(',') : null;
}

/** True when a row dated `value` falls inside the owner's tenure for `unitId`. */
export function withinTenure(cutoffs: TenureCutoffs, unitId: string | null | undefined, value: string | null | undefined): boolean {
  if (!unitId || !cutoffs.has(unitId)) return false;
  const since = cutoffs.get(unitId);
  if (!since) return true;
  if (!value) return false;
  return String(value).slice(0, 10) >= since;
}

/** The association's zone when it is a valid IANA zone, else the default. */
export function associationZone(zone: string | null | undefined): string {
  return zone && isValidTimeZone(zone) ? zone : DEFAULT_TIME_ZONE;
}
