import { describe, expect, it } from 'vitest';
import {
  isBillableSubscription,
  monthWindowInZone,
  monthlyRecurringCents,
  parseDollarsToCents,
  parsePositiveInt,
} from '@/lib/platform/operator-metrics';

describe('monthlyRecurringCents', () => {
  it('counts active and past-due subscriptions only', () => {
    expect(monthlyRecurringCents([
      { status: 'active', price_monthly_cents: 10000 },
      { status: 'past_due', price_monthly_cents: 5000 },
      { status: 'trialing', price_monthly_cents: 9999 },
      { status: 'paused', price_monthly_cents: 9999 },
      { status: 'canceled', price_monthly_cents: 9999 },
      { status: 'active', price_monthly_cents: null },
    ])).toBe(15000);
    expect(isBillableSubscription('trialing')).toBe(false);
    expect(isBillableSubscription(null)).toBe(false);
  });
});

describe('monthWindowInZone', () => {
  it('uses the zone calendar, not UTC, near a month boundary', () => {
    // 03:00 UTC on Nov 1 is still Oct 31 in Chicago.
    const now = new Date('2026-11-01T03:00:00Z');
    const w = monthWindowInZone('America/Chicago', now);
    expect(w.month).toBe('2026-10');
    expect(w.startDate).toBe('2026-10-01');
    expect(w.endDate).toBe('2026-10-31');
    expect(w.startIso).toBe('2026-10-01T05:00:00.000Z'); // CDT midnight
    expect(w.endIso).toBe('2026-11-01T05:00:00.000Z');
  });

  it('shifts by whole months across a year boundary and DST', () => {
    const now = new Date('2026-01-15T12:00:00Z');
    const prev = monthWindowInZone('America/Chicago', now, -1);
    expect(prev.month).toBe('2025-12');
    expect(prev.startIso).toBe('2025-12-01T06:00:00.000Z'); // CST midnight
    expect(prev.endIso).toBe('2026-01-01T06:00:00.000Z');
    expect(monthWindowInZone('America/Chicago', new Date('2028-02-10T12:00:00Z')).endDate).toBe('2028-02-29');
  });
});

describe('form parsers', () => {
  it('parsePositiveInt accepts whole numbers above zero only', () => {
    expect(parsePositiveInt('25')).toBe(25);
    expect(parsePositiveInt(' 3 ')).toBe(3);
    expect(parsePositiveInt('0')).toBeNull();
    expect(parsePositiveInt('-5')).toBeNull();
    expect(parsePositiveInt('2.5')).toBeNull();
    expect(parsePositiveInt('abc')).toBeNull();
    expect(parsePositiveInt('')).toBeNull();
    expect(parsePositiveInt(null)).toBeNull();
  });

  it('parseDollarsToCents reads dollars and cents without float drift', () => {
    expect(parseDollarsToCents('249')).toBe(24900);
    expect(parseDollarsToCents('19.99')).toBe(1999);
    expect(parseDollarsToCents('0.1')).toBe(10);
    expect(parseDollarsToCents('0')).toBe(0);
    expect(parseDollarsToCents('-1')).toBeNull();
    expect(parseDollarsToCents('1.999')).toBeNull();
    expect(parseDollarsToCents('1e3')).toBeNull();
    expect(parseDollarsToCents('')).toBeNull();
  });
});
