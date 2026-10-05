import { describe, expect, it } from 'vitest';
import { wallDateTimeToIso, zonedWallTimeToUtc } from '@/lib/time/zoned';

describe('zonedWallTimeToUtc', () => {
  it('rejects wall times inside the spring-forward gap', () => {
    expect(zonedWallTimeToUtc('2026-03-08', '02:30', 'America/Chicago')).toBeNull();
    expect(zonedWallTimeToUtc('2026-03-08', '01:30', 'America/Chicago')?.toISOString()).toBe('2026-03-08T07:30:00.000Z');
    expect(zonedWallTimeToUtc('2026-03-08', '03:30', 'America/Chicago')?.toISOString()).toBe('2026-03-08T08:30:00.000Z');
  });

  it('accepts the repeated fall-back hour', () => {
    expect(zonedWallTimeToUtc('2026-11-01', '01:30', 'America/Chicago')).not.toBeNull();
  });

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

describe('wallDateTimeToIso', () => {
  it('reads datetime-local input in the zone', () => {
    expect(wallDateTimeToIso('2026-10-05T09:00', 'America/Chicago')).toBe('2026-10-05T14:00:00.000Z');
  });
  it('treats a date-only value as local midnight', () => {
    expect(wallDateTimeToIso('2026-10-05', 'America/Chicago')).toBe('2026-10-05T05:00:00.000Z');
  });
  it('keeps values that carry an offset', () => {
    expect(wallDateTimeToIso('2026-10-05T09:00:00-04:00', 'America/Chicago')).toBe('2026-10-05T13:00:00.000Z');
    expect(wallDateTimeToIso('2026-10-05T09:00:00Z', 'America/Chicago')).toBe('2026-10-05T09:00:00.000Z');
  });
  it('rejects junk', () => {
    expect(wallDateTimeToIso('tomorrow', 'America/Chicago')).toBeNull();
    expect(wallDateTimeToIso('', 'America/Chicago')).toBeNull();
  });
});
