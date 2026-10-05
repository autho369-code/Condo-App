// An owner's monthly dues (occupancies.dues_amount) are billed by a unit
// recurring charge in the dues category; the daily post_unit_recurring_charges
// job posts it. Entering dues on an owner without creating that charge means
// dues are never billed.
//
// schedule_owner_dues() takes the amount from the occupancy itself, picks the
// DUES category deterministically, and lets any staff who manage the
// association schedule it (not only finance staff).

/** First day of the month on or after `date` (YYYY-MM-DD): dues post on the 1st. */
export function firstDuesDate(date: string): string {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  if (d === 1) return date.slice(0, 10);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, '0')}-01`;
}

/**
 * Schedule the monthly dues for a newly created owner occupancy, starting on
 * the first of the month on/after `startFrom` (the move-in date). Any other
 * dues schedule on the unit (the previous owner's) is retired. Returns an error message, or null.
 */
export async function scheduleOwnerDues(db: any, occupancyId: string, startFrom: string): Promise<string | null> {
  const { error } = await db.rpc('schedule_owner_dues', {
    p_occupancy_id: occupancyId,
    // Raw date: the function clamps to today and rounds to the 1st in the
    // association's time zone.
    p_start: startFrom.slice(0, 10),
  });
  return error ? `dues: ${error.message}` : null;
}
