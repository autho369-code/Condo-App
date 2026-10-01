import { cache } from 'react';

/** Zone used when no association zone applies. */
export const DEFAULT_TIME_ZONE = 'America/Chicago';

// The time zone pages format timestamps in, resolved once per request from
// the associations the viewer can see (getMe primes it). React's cache()
// scopes the slot to the current server request; outside a request (client
// components, tests) every call gets a fresh slot, i.e. the default.
const zoneSlot = cache((): { zone: string | null } => ({ zone: null }));

export function displayTimeZone(): string {
  try {
    return zoneSlot().zone ?? DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function setDisplayTimeZone(zone: string | null | undefined): void {
  if (!zone || !isValidTimeZone(zone)) return;
  try {
    zoneSlot().zone = zone;
  } catch {
    // No request scope — nothing to remember.
  }
}

/** Most common zone among the viewer's associations (ties: first seen). */
export function predominantTimeZone(zones: Array<string | null | undefined>): string | null {
  const counts = new Map<string, number>();
  for (const z of zones) if (z) counts.set(z, (counts.get(z) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [z, n] of counts) if (n > bestCount) { best = z; bestCount = n; }
  return best;
}

export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
