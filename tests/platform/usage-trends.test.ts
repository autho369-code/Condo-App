import { describe, expect, it } from 'vitest';
import { changeLabel, monthKey, monthLabel, percentChange, previousMonth, totalsByMonth } from '@/lib/platform/usage-trends';

describe('usage trends', () => {
  it('sums every company per month, newest month first', () => {
    const totals = totalsByMonth([
      { portfolio_id: 'a', period_year: 2026, period_month: 9, unit_count: 10, work_orders_created: 2 },
      { portfolio_id: 'b', period_year: 2026, period_month: 9, unit_count: 5, work_orders_created: null },
      { portfolio_id: 'a', period_year: 2026, period_month: 10, unit_count: 11, work_orders_created: 4 },
    ]);
    expect(totals.map((t) => t.month)).toEqual(['2026-10', '2026-09']);
    expect(totals[1]).toMatchObject({ companies: 2, unit_count: 15, work_orders_created: 2, emails_sent: 0 });
  });

  it('walks months across the year boundary', () => {
    expect(monthKey({ period_year: 2026, period_month: 3 })).toBe('2026-03');
    expect(previousMonth('2026-01')).toBe('2025-12');
    expect(previousMonth('2026-10')).toBe('2026-09');
    expect(monthLabel('2026-10')).toBe('Oct 2026');
    expect(monthLabel('2026-10', false)).toBe('Oct');
  });

  it('describes month-over-month change without dividing by zero', () => {
    expect(percentChange(12, 10)).toBe(20);
    expect(percentChange(5, 0)).toBeNull();
    expect(changeLabel(12, 10, 'Sep')).toBe('+20% vs Sep');
    expect(changeLabel(8, 10, 'Sep')).toBe('-20% vs Sep');
    expect(changeLabel(10, 10, 'Sep')).toBe('Same as Sep');
    expect(changeLabel(3, 0, 'Sep')).toBe('Up from 0 in Sep');
    expect(changeLabel(0, 0, 'Sep')).toBe('None in Sep either');
    expect(changeLabel(3, null, 'Sep')).toBe('No earlier month');
  });
});
