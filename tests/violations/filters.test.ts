import { describe, expect, it } from 'vitest';
import { normalizeViolationStatusFilter } from '@/lib/violations/filters';

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
