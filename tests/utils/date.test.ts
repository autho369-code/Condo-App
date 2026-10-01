import { describe, expect, it } from 'vitest';
import { date } from '@/lib/utils';

describe('date()', () => {
  it('formats a date-only value as that calendar day', () => {
    expect(date('2026-10-01')).toBe('Oct 1, 2026');
    expect(date('2026-01-31', 'long')).toBe('January 31, 2026');
  });
  it('formats timestamps in the community zone, not UTC', () => {
    // 9 PM Central on Oct 1 is 02:00 UTC on Oct 2.
    expect(date('2026-10-02T02:00:00Z')).toBe('Oct 1, 2026');
  });
  it('handles empty and invalid input', () => {
    expect(date(null)).toBe('—');
    expect(date('not a date')).toBe('—');
  });
});
