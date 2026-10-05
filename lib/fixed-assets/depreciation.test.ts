import { describe, expect, it } from 'vitest';
import { depreciationToDate, wholeMonthsBetween } from './depreciation';

describe('wholeMonthsBetween', () => {
  it('counts only completed months', () => {
    expect(wholeMonthsBetween('2025-01-15', '2025-02-14')).toBe(0);
    expect(wholeMonthsBetween('2025-01-15', '2025-02-15')).toBe(1);
    expect(wholeMonthsBetween('2025-01-15', '2026-01-15')).toBe(12);
    expect(wholeMonthsBetween('2026-01-15', '2025-01-15')).toBe(0);
  });
});

describe('depreciationToDate', () => {
  const base = { purchase_price: 12000, salvage_value: 2000, useful_life_years: 10, depreciation_method: 'straight_line' };

  it('computes straight-line depreciation from the in-service date', () => {
    const r = depreciationToDate({ ...base, placed_in_service_date: '2024-01-01' }, '2026-01-01');
    expect(r.basis).toBe('calculated');
    expect(r.accumulated).toBe(2000); // 24 of 120 months of 10,000
    expect(r.bookValue).toBe(10000);
  });

  it('falls back to the purchase date and caps at cost less salvage', () => {
    const r = depreciationToDate({ ...base, purchase_date: '2000-06-01' }, '2026-01-01');
    expect(r.accumulated).toBe(10000);
    expect(r.bookValue).toBe(2000);
  });

  it('stops at the disposal date', () => {
    const r = depreciationToDate(
      { ...base, placed_in_service_date: '2024-01-01', status: 'sold', disposed_at: '2025-01-01T12:00:00Z' },
      '2026-06-01',
    );
    expect(r.accumulated).toBe(1000);
  });

  it('uses the recorded value when inputs are missing or the method is not straight-line', () => {
    expect(depreciationToDate({ ...base, accumulated_depreciation: 50 }, '2026-01-01')).toMatchObject({ basis: 'recorded', accumulated: 50, bookValue: 11950 });
    expect(depreciationToDate({ ...base, depreciation_method: 'declining_balance', placed_in_service_date: '2024-01-01' }, '2026-01-01').basis).toBe('recorded');
    expect(depreciationToDate({ ...base, depreciation_method: 'none', placed_in_service_date: '2024-01-01' }, '2026-01-01')).toMatchObject({ basis: 'none', accumulated: 0 });
  });
});
