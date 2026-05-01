import { describe, expect, it } from 'vitest';
import { buildCommandMetrics } from '@/lib/operations/command-center';

describe('buildCommandMetrics', () => {
  it('returns command metrics in stable display order', () => {
    const metrics = buildCommandMetrics({
      openViolations: 4,
      overdueViolations: 1,
      pendingBills: 9,
      unreconciledBankAccounts: 3,
      scheduledReportsDue: 2,
      openWorkOrders: 8,
    });

    expect(metrics.map((metric) => metric.label)).toEqual([
      'Open violations',
      'Overdue violations',
      'Pending bills',
      'Unreconciled accounts',
      'Reports due',
      'Open work orders',
    ]);
    expect(metrics[0].href).toBe('/violations?status=open');
    expect(metrics[2].href).toBe('/bills?status=pending_approval');
    expect(metrics[3].href).toBe('/bank-accounts?filter=unreconciled');
    expect(metrics[5].href).toBe('/work-orders?tab=open');
  });
});
