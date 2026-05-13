import { describe, expect, it } from 'vitest';
import { computeNextScheduledReportRun } from '@/lib/reports/schedule';

describe('scheduled report helpers', () => {
  it('computes the next weekly run at the selected UTC hour', () => {
    expect(computeNextScheduledReportRun({
      frequency: 'weekly',
      hourUtc: 14,
      dayOfWeek: 3,
      now: new Date('2026-05-13T10:00:00.000Z'),
    })).toBe('2026-05-13T14:00:00.000Z');
  });

  it('rolls monthly runs into the next month when the day already passed', () => {
    expect(computeNextScheduledReportRun({
      frequency: 'monthly',
      hourUtc: 8,
      dayOfMonth: 5,
      now: new Date('2026-05-13T10:00:00.000Z'),
    })).toBe('2026-06-05T08:00:00.000Z');
  });
});
