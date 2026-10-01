import { describe, expect, it } from 'vitest';
import { nextRecurringDate } from '@/lib/time/recurrence';

describe('nextRecurringDate', () => {
  it('keeps the anchor day through short months', () => {
    expect(nextRecurringDate('2026-01-31', 'monthly', 1, 31)).toBe('2026-02-28');
    expect(nextRecurringDate('2026-02-28', 'monthly', 1, 31)).toBe('2026-03-31');
    expect(nextRecurringDate('2026-01-30', 'monthly', 1, 30)).toBe('2026-02-28');
    expect(nextRecurringDate('2026-02-28', 'monthly', 1, 30)).toBe('2026-03-30');
  });

  it('keeps month-end dates at month end without an anchor', () => {
    expect(nextRecurringDate('2026-02-28', 'monthly')).toBe('2026-03-31');
    expect(nextRecurringDate('2026-04-15', 'monthly')).toBe('2026-05-15');
  });

  it('handles quarters, years and day/week steps', () => {
    expect(nextRecurringDate('2026-11-30', 'quarterly', 1, 30)).toBe('2027-02-28');
    expect(nextRecurringDate('2024-02-29', 'annually', 1, 29)).toBe('2025-02-28');
    expect(nextRecurringDate('2026-01-15', 'weekly', 2)).toBe('2026-01-29');
    expect(nextRecurringDate('2026-12-31', 'daily')).toBe('2027-01-01');
  });

  it('rejects bad input', () => {
    expect(nextRecurringDate('nope', 'monthly')).toBeNull();
    expect(nextRecurringDate('2026-01-01', 'hourly')).toBeNull();
  });
});
