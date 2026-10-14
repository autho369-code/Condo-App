// A homeowner's figures for a unit cover their own ownership of it: from
// their move-in to their move-out (when one is set). A unit's earlier history
// belongs to the previous owner, and charges after a move-out to the next.

export type OwnershipWindow = { since: string | null; until: string | null };

type OccupancyLike = {
  unit_id?: string | null;
  units?: { id?: string | null } | null;
  move_in_date?: string | null;
  move_out_date?: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const day = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : null);

/**
 * unit_id -> the owner's window on that unit, from their occupancies of it.
 * Several rows for one unit: the earliest move-in and the latest move-out
 * win; a missing date means no bound on that side.
 */
export function ownershipWindows(occupancies: OccupancyLike[]): Map<string, OwnershipWindow> {
  const windows = new Map<string, OwnershipWindow>();
  for (const o of occupancies) {
    const unitId = o.units?.id ?? o.unit_id ?? null;
    if (!unitId) continue;
    const since = day(o.move_in_date);
    const until = day(o.move_out_date);
    const prev = windows.get(unitId);
    if (!prev) { windows.set(unitId, { since, until }); continue; }
    windows.set(unitId, {
      since: prev.since === null || since === null ? null : (since < prev.since ? since : prev.since),
      until: prev.until === null || until === null ? null : (until > prev.until ? until : prev.until),
    });
  }
  return windows;
}

/**
 * PostgREST `or` filter for rows of these units dated inside the owner's
 * window: `and(unit_id.eq.U,<column>.gte.SINCE,<column>.lt.UNTIL)`.
 * Returns null when there are no units (the caller shows nothing).
 */
export function ownershipWindowFilter(windows: Map<string, OwnershipWindow>, column: string): string | null {
  const parts: string[] = [];
  for (const [unitId, w] of windows) {
    if (!UUID.test(unitId)) continue;
    const bounds = [`unit_id.eq.${unitId}`];
    if (w.since && DAY.test(w.since)) bounds.push(`${column}.gte.${w.since}`);
    if (w.until && DAY.test(w.until)) bounds.push(`${column}.lt.${w.until}`);
    parts.push(bounds.length === 1 ? bounds[0] : `and(${bounds.join(',')})`);
  }
  return parts.length > 0 ? parts.join(',') : null;
}

/** True when a row of `unitId` dated `value` falls inside the owner's window. */
export function withinOwnershipWindow(
  windows: Map<string, OwnershipWindow>,
  unitId: string | null | undefined,
  value: string | null | undefined,
): boolean {
  if (!unitId) return false;
  const w = windows.get(unitId);
  if (!w) return false;
  const d = day(value);
  if (!d) return w.since === null && w.until === null;
  if (w.since && d < w.since) return false;
  if (w.until && d >= w.until) return false;
  return true;
}
