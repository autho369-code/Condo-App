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
  if (a.reserve_method === 'email') {
    const email = (a.reservation_email ?? '').trim();
    return EMAIL.test(email) ? { kind: 'email', email } : { kind: 'none' };
  }
  if (a.reserve_method === 'platform_link') {
    const url = (a.reservation_url ?? '').trim();
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

/**
 * Whether a same-day request (HH:MM wall times in the community's zone) falls
 * inside the amenity's hours. An end of 00:00 means midnight. Hours that run
 * past midnight (closes before opens) are not checked, like the database guard.
 */
export function withinAmenityHours(start: string, end: string, opensAt: string | null | undefined, closesAt: string | null | undefined): boolean {
  const s = minutes(start);
  let e = minutes(end);
  if (s === null || e === null) return false;
  if (e === 0) e = 24 * 60;
  const open = minutes(opensAt);
  const close = minutes(closesAt);
  if (open !== null && close !== null && open >= close) return true;
  if (open !== null && s < open) return false;
  if (close !== null && e > close) return false;
  return true;
}
