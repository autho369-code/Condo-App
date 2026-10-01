import { describe, expect, it } from 'vitest';
import { zonedWallTimeToUtc } from '@/lib/time/zoned';

describe('zonedWallTimeToUtc', () => {
  it('reads wall time in the association time zone (CDT)', () => {
    expect(zonedWallTimeToUtc('2026-10-01', '18:00', 'America/Chicago')?.toISOString()).toBe('2026-10-01T23:00:00.000Z');
  });
  it('handles standard time (CST)', () => {
    expect(zonedWallTimeToUtc('2026-12-15', '09:30', 'America/Chicago')?.toISOString()).toBe('2026-12-15T15:30:00.000Z');
  });
  it('handles other zones', () => {
    expect(zonedWallTimeToUtc('2026-07-04', '12:00', 'America/New_York')?.toISOString()).toBe('2026-07-04T16:00:00.000Z');
  });
  it('rejects bad input', () => {
    expect(zonedWallTimeToUtc('2026-13-01', '10:00', 'America/Chicago')).toBeNull();
    expect(zonedWallTimeToUtc('', '10:00', 'America/Chicago')).toBeNull();
    expect(zonedWallTimeToUtc('2026-10-01', '25:00', 'America/Chicago')).toBeNull();
  });
});
