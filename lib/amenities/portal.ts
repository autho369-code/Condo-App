// How the resident portal offers an amenity, following what staff configured
// on the amenity (association amenities page): reserve by email, through the
// reservation platform link, or by requesting it in the portal (no method set).

export type ReserveMethod = 'email' | 'platform_link' | null;

export type AmenityReserveAction =
  | { kind: 'email'; email: string }
  | { kind: 'link'; url: string }
  | { kind: 'request' }
  | { kind: 'none' };

const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

export function amenityReserveAction(a: {
  allow_reservations?: boolean | null;
  reserve_method?: string | null;
  reservation_email?: string | null;
  reservation_url?: string | null;
}): AmenityReserveAction {
  if (!a.allow_reservations) return { kind: 'none' };
  // An email or link amenity saved without its address is requested in the
  // portal (an unusable address that is set is not offered at all).
  if (a.reserve_method === 'email') {
    const email = (a.reservation_email ?? '').trim();
    if (!email) return { kind: 'request' };
    return EMAIL.test(email) ? { kind: 'email', email } : { kind: 'none' };
  }
  if (a.reserve_method === 'platform_link') {
    const url = (a.reservation_url ?? '').trim();
    if (!url) return { kind: 'request' };
    return /^https?:\/\/[^\s]+$/i.test(url) ? { kind: 'link', url } : { kind: 'none' };
  }
  if (a.reserve_method == null) return { kind: 'request' };
  return { kind: 'none' };
}

/** The price as staff set it ("Flat rate: $25.00", "Hourly: $10.00/hr"), or null. */
export function amenityPriceLabel(mode: string | null | undefined, amount: number | string | null | undefined): string | null {
  if (mode !== 'flat' && mode !== 'hourly') return null;
  const n = Number(amount ?? 0);
  const price = `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
  return mode === 'flat' ? `Flat rate: ${price}` : `Hourly: ${price}/hr`;
}

function minutes(t: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(t ?? '');
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function runsPastMidnight(opensAt: string | null | undefined, closesAt: string | null | undefined): boolean {
  const open = minutes(opensAt);
  const close = minutes(closesAt);
  return open !== null && close !== null && open > close;
}

/**
 * Whether a request's end time (HH:MM) falls on the day after its start: an
 * end of 00:00 (midnight), or, for hours that run past midnight
 * (e.g. 18:00–02:00), an end at or before the start time.
 */
export function amenityEndsNextDay(start: string, end: string, opensAt: string | null | undefined, closesAt: string | null | undefined): boolean {
  const s = minutes(start);
  const e = minutes(end);
  if (s === null || e === null) return false;
  if (e === 0) return true;
  return runsPastMidnight(opensAt, closesAt) && e <= s;
}

/**
 * Whether a request (HH:MM wall times in the community's zone) falls inside
 * the amenity's hours, as the database guard checks it. An end of 00:00 means
 * midnight. Normal hours: the same day, from opening to closing. Hours that
 * run past midnight (e.g. 18:00–02:00): inside [opens, 24:00] or
 * [00:00, closes] on one day, or from opening to closing the next day.
 */
export function withinAmenityHours(start: string, end: string, opensAt: string | null | undefined, closesAt: string | null | undefined): boolean {
  const s = minutes(start);
  const rawEnd = minutes(end);
  if (s === null || rawEnd === null) return false;
  const open = minutes(opensAt);
  const close = minutes(closesAt);
  if (open !== null && close !== null && open > close) {
    if (amenityEndsNextDay(start, end, opensAt, closesAt)) return s >= open && rawEnd <= close;
    return s >= open || rawEnd <= close;
  }
  const e = rawEnd === 0 ? 24 * 60 : rawEnd;
  if (open !== null && close !== null && open === close) return true;
  if (open !== null && s < open) return false;
  if (close !== null && e > close) return false;
  return true;
}

/** The calendar day after a YYYY-MM-DD date, or null when it is not one. */
export function nextCalendarDate(date: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.toISOString().slice(0, 10) !== date) return null;
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
