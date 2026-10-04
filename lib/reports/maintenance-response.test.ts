import { describe, expect, it } from 'vitest';
import { median, openWorkOrderAging, responseExportRows, responseMetrics, type ResponseRequest, type ResponseWorkOrder } from '@/lib/reports/maintenance-response';

const NOW = new Date('2026-10-04T12:00:00Z');
const req = (p: Partial<ResponseRequest>): ResponseRequest => ({
  association_id: 'a', priority: 'normal', status: 'open', created_at: '2026-10-01T10:00:00Z',
  first_response_due_at: null, acknowledged_at: null, resolved_at: null, ...p,
});
const wo = (p: Partial<ResponseWorkOrder>): ResponseWorkOrder => ({
  association_id: 'a', priority: 'normal', status: 'new', created_at: '2026-10-01T10:00:00Z', completed_date: null, ...p,
});

describe('maintenance response metrics', () => {
  it('computes medians', () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('splits requests into on time, late and overdue, with response and resolve times', () => {
    const m = responseMetrics([
      req({ first_response_due_at: '2026-10-01T14:00:00Z', acknowledged_at: '2026-10-01T12:00:00Z', resolved_at: '2026-10-03T10:00:00Z' }),
      req({ first_response_due_at: '2026-10-01T14:00:00Z', acknowledged_at: '2026-10-01T16:00:00Z' }),
      req({ first_response_due_at: '2026-10-02T10:00:00Z' }),
      req({ first_response_due_at: '2026-10-02T10:00:00Z', status: 'completed' }),
      req({}),
    ], [], NOW);
    expect(m).toMatchObject({ requests: 5, withTarget: 4, onTime: 1, late: 1, overdueNow: 1, resolved: 1 });
    expect(m.onTimeRate).toBe(0.25);
    expect(m.medianHoursToRespond).toBe(4); // 2 h and 6 h
    expect(m.medianDaysToResolve).toBe(2);
  });

  it('measures work-order completion in calendar days and counts done statuses without a date', () => {
    const m = responseMetrics([], [
      wo({ completed_date: '2026-10-04' }),
      wo({ created_at: '2026-10-01T23:30:00Z', completed_date: '2026-10-01' }),
      wo({ status: 'closed' }),
      wo({}),
    ], NOW);
    expect(m).toMatchObject({ workOrders: 4, completed: 3, medianDaysToComplete: 1.5 });
    expect(m.onTimeRate).toBeNull();
  });

  it('ages open work orders and skips finished or cancelled ones', () => {
    expect(openWorkOrderAging([
      wo({ created_at: '2026-10-02T00:00:00Z' }),
      wo({ created_at: '2026-09-10T00:00:00Z' }),
      wo({ created_at: '2026-07-01T00:00:00Z' }),
      wo({ created_at: '2026-07-01T00:00:00Z', status: 'cancelled' }),
      wo({ created_at: '2026-07-01T00:00:00Z', completed_date: '2026-07-05' }),
    ], NOW)).toEqual([
      { bucket: '0–7 days', count: 1 },
      { bucket: '8–30 days', count: 1 },
      { bucket: '31–60 days', count: 0 },
      { bucket: 'Over 60 days', count: 1 },
    ]);
  });

  it('exports one row per association plus a total', () => {
    const rows = responseExportRows(
      [req({ association_id: 'b', first_response_due_at: '2026-10-01T14:00:00Z', acknowledged_at: '2026-10-01T11:00:00Z' })],
      [wo({ association_id: 'a' })],
      new Map([['a', 'Alder'], ['b', 'Birch']]),
      NOW,
    );
    expect(rows.map((r) => r.association)).toEqual(['Alder', 'Birch', 'All associations']);
    expect(rows[1]).toMatchObject({ requests: 1, answered_on_time: 1, on_time_rate: 1, median_hours_to_respond: 1 });
    expect(rows[2]).toMatchObject({ requests: 1, work_orders: 1 });
  });
});
