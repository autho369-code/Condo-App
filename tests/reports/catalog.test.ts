import { describe, expect, it } from 'vitest';
import { groupReports, serializeReportParams } from '@/lib/reports/catalog';
import { reportDefinitions } from '../fixtures/operations';

describe('report catalog helpers', () => {
  it('groups active reports by category', () => {
    const groups = groupReports(reportDefinitions);

    expect(groups.map((group) => group.title)).toEqual(['Accounting', 'Association', 'Compliance']);
  });

  it('serializes explicit scope into report parameters', () => {
    const params = serializeReportParams({
      scope: 'association',
      associationId: 'assoc-1',
      ownerId: '',
      unitId: '',
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
    });

    expect(params).toEqual({
      scope: 'association',
      association_id: 'assoc-1',
      date_from: '2026-04-01',
      date_to: '2026-04-30',
    });
  });
});
