/**
 * Convert a wall-clock date + time in an IANA time zone to a UTC Date.
 * Server code runs in UTC, so `new Date('2026-10-01T18:00')` would read an
 * owner's "6 PM" as 6 PM UTC. Returns null for invalid input.
 */
export function zonedWallTimeToUtc(date: string, time: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!m || !t) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const [h, mi] = [Number(t[1]), Number(t[2])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  if (new Date(asUtc).getUTCDate() !== d) return null; // e.g. Feb 31
  let guess: number;
  try {
    // Two passes settle the offset across DST transitions.
    guess = asUtc - offsetMs(asUtc, timeZone);
    guess = asUtc - offsetMs(guess, timeZone);
  } catch {
    return null; // unknown time zone
  }
  const result = new Date(guess);
  return Number.isNaN(result.getTime()) ? null : result;
}

function offsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const local = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return local - Math.floor(utcMs / 1000) * 1000;
}
