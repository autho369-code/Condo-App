import { describe, expect, it } from 'vitest';
import { DEFAULT_TIME_ZONE, displayTimeZone, isValidTimeZone, predominantTimeZone } from '@/lib/time/display-zone';
import { date } from '@/lib/utils';

describe('display time zone', () => {
  it('picks the most common association zone', () => {
    expect(predominantTimeZone(['America/New_York', 'America/Chicago', 'America/New_York', null])).toBe('America/New_York');
    expect(predominantTimeZone([])).toBeNull();
  });

  it('falls back to the default outside a request', () => {
    expect(displayTimeZone()).toBe(DEFAULT_TIME_ZONE);
  });

  it('rejects unknown zones', () => {
    expect(isValidTimeZone('America/Denver')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });

  it('formats a timestamp in the zone passed', () => {
    // 04:30 UTC is 12:30 AM Eastern but still the previous evening in Central.
    expect(date('2026-10-02T04:30:00Z', 'short', 'America/New_York')).toBe('Oct 2, 2026');
    expect(date('2026-10-02T04:30:00Z', 'short', 'America/Chicago')).toBe('Oct 1, 2026');
  });
});
