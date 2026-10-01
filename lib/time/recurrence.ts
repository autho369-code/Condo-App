// Next occurrence of a recurring schedule, matching recurring_next_date() in
// the database. Month-based schedules keep an anchor day (the schedule's
// start day) clamped to each month's length, so Jan 31 -> Feb 28 -> Mar 31
// instead of drifting to the 28th (or overflowing into March).

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually' | string;

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** `date` and the result are calendar dates (YYYY-MM-DD). Returns null for bad input. */
export function nextRecurringDate(
  date: string,
  frequency: RecurrenceFrequency,
  interval = 1,
  anchorDay?: number | null,
): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? '');
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const n = Number.isFinite(interval) && interval > 0 ? Math.floor(interval) : 1;
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

  if (frequency === 'daily') return iso(Date.UTC(y, mo, d + n));
  if (frequency === 'weekly') return iso(Date.UTC(y, mo, d + 7 * n));
  const months = frequency === 'monthly' ? n : frequency === 'quarterly' ? 3 * n : frequency === 'annually' ? 12 * n : null;
  if (months == null) return null;

  const anchor = anchorDay ?? (d === lastDayOfMonth(y, mo) ? 31 : d);
  const target = new Date(Date.UTC(y, mo + months, 1));
  const ty = target.getUTCFullYear();
  const tm = target.getUTCMonth();
  return iso(Date.UTC(ty, tm, Math.min(Math.max(anchor, 1), lastDayOfMonth(ty, tm))));
}
