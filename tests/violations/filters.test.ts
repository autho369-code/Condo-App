import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeViolationStatusFilter } from '@/lib/violations/filters';
import { buildViolationFilterSummary } from '@/lib/violations/queries';
import {
  ACTIVE_VIOLATION_STATUSES,
  CLOSED_VIOLATION_STATUSES,
  isHearingPendingViolationStatus,
  isOpenViolationStatus,
} from '@/lib/violations/queries';

describe('normalizeViolationStatusFilter', () => {
  it('allows dashboard-backed violation status filters', () => {
    expect(normalizeViolationStatusFilter('open')).toBe('open');
    expect(normalizeViolationStatusFilter('overdue')).toBe('overdue');
  });

  it('ignores unknown filter values', () => {
    expect(normalizeViolationStatusFilter('paid')).toBeUndefined();
    expect(normalizeViolationStatusFilter(undefined)).toBeUndefined();
  });
});

describe('buildViolationFilterSummary', () => {
  it('summarizes active filters', () => {
    expect(buildViolationFilterSummary({ associationId: 'a1', status: 'open', escalation: 'overdue' })).toEqual([
      'Association selected',
      'Status: open',
      'Escalation: overdue',
    ]);
  });
});

describe('violation workflow status groups', () => {
  it('uses only database-backed statuses for active and closed workflows', () => {
    expect(ACTIVE_VIOLATION_STATUSES).toEqual(['open', 'notice_sent', 'hearing_pending', 'fined']);
    expect(CLOSED_VIOLATION_STATUSES).toEqual(['cured', 'closed']);
    expect(isOpenViolationStatus('hearing_pending')).toBe(true);
    expect(isOpenViolationStatus('fined')).toBe(true);
    expect(isOpenViolationStatus('hearing_scheduled')).toBe(false);
  });

  it('recognizes the database hearing status used by oversight dashboards', () => {
    expect(isHearingPendingViolationStatus('hearing_pending')).toBe(true);
    expect(isHearingPendingViolationStatus('hearing_scheduled')).toBe(false);
  });

  it('keeps oversight queries on the shared database-backed active statuses', () => {
    const queryConsumers = [
      'app/board/page.tsx',
      'app/board/owners/page.tsx',
      'app/company-admin/overview/page.tsx',
      'app/company-admin/compliance/page.tsx',
      'app/company-admin/performance/page.tsx',
      'lib/ai/board-snapshot.ts',
    ];

    for (const path of queryConsumers) {
      const source = readFileSync(resolve(process.cwd(), path), 'utf8');
      expect(source, path).toContain('ACTIVE_VIOLATION_STATUSES');
      expect(source, path).not.toContain('violation_dismissed');
    }
  });
});
