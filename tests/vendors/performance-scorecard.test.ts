import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  buildVendorPerformanceScorecard,
  formatPerformanceDays,
  type VendorPerformanceWorkOrder,
} from '@/lib/vendors/performance';

const asOf = new Date('2026-08-03T12:00:00.000Z');

function workOrder(overrides: Partial<VendorPerformanceWorkOrder> = {}): VendorPerformanceWorkOrder {
  return {
    status: 'completed',
    priority: 'normal',
    created_at: '2026-07-01T12:00:00.000Z',
    scheduled_date: '2026-07-05',
    completed_date: '2026-07-04',
    ...overrides,
  };
}

describe('vendor performance scorecard', () => {
  it('grades only after enough scheduled completion evidence exists', () => {
    const building = buildVendorPerformanceScorecard([workOrder(), workOrder()], {}, { asOf });
    expect(building.onTimeRate).toBe(100);
    expect(building.serviceRecord).toMatchObject({ label: 'Building history', tone: 'neutral' });

    const strong = buildVendorPerformanceScorecard([
      workOrder(),
      workOrder({ completed_date: '2026-07-05' }),
      workOrder({ completed_date: '2026-07-08' }),
      workOrder(),
      workOrder(),
      workOrder(),
      workOrder(),
    ], {}, { asOf });
    expect(strong.onTimeRate).toBe(86);
    expect(strong.serviceRecord).toMatchObject({ label: 'Strong', tone: 'success' });
  });

  it('separates current backlog from the trailing completion window', () => {
    const result = buildVendorPerformanceScorecard([
      workOrder({ status: 'assigned', created_at: '2024-01-01T00:00:00.000Z', scheduled_date: '2026-08-01', completed_date: null }),
      workOrder({ status: 'completed', created_at: '2024-01-01T00:00:00.000Z', completed_date: '2024-01-05' }),
      workOrder(),
    ], {}, { asOf });
    expect(result).toMatchObject({ open: 1, overdue: 1, completed: 1 });
  });

  it('rejects invalid date spans from completion-time averages', () => {
    const result = buildVendorPerformanceScorecard([
      workOrder({ created_at: '2026-07-10T00:00:00.000Z', completed_date: '2026-07-09' }),
    ], {}, { asOf });
    expect(result.averageCompletionDays).toBeNull();
  });

  it('keeps compliance evidence separate and flags recorded expirations', () => {
    const result = buildVendorPerformanceScorecard([], {
      general_liability_expiration: '2026-08-20',
      workers_comp_expiration: '2026-07-01',
      state_license_expiration: '2027-01-01',
    }, { asOf });
    expect(result.compliance).toMatchObject({
      current: 1,
      expiringSoon: 1,
      expired: 1,
      notRecorded: 3,
      label: 'Action required',
      tone: 'danger',
    });
  });

  it('formats completion duration without overstating precision', () => {
    expect(formatPerformanceDays(null)).toBe('—');
    expect(formatPerformanceDays(0.5)).toBe('12h');
    expect(formatPerformanceDays(2.345)).toBe('2.3d');
  });

  it('keeps management reads portfolio-scoped and paginated', () => {
    const query = readFileSync('lib/vendors/performance-query.ts', 'utf8');
    const detail = readFileSync('app/(app)/vendors/[id]/page.tsx', 'utf8');
    expect(query).toContain(".eq('portfolio_id', portfolioId)");
    expect(query).toContain('completed_date.gte.${windowStart}');
    expect(query).toContain('.range(from, from + PAGE_SIZE - 1)');
    expect(detail).toContain('requireWorkspaceStaff()');
    expect(detail).toContain(".eq('portfolio_id', portfolioId)");
  });
});
