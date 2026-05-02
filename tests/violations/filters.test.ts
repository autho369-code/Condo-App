import { describe, expect, it } from 'vitest';
import { normalizeViolationStatusFilter } from '@/lib/violations/filters';
import { buildViolationFilterSummary } from '@/lib/violations/queries';

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
