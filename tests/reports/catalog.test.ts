import { describe, expect, it } from 'vitest';
import { groupReports, normalizeReportDefinitions, serializeReportParams } from '@/lib/reports/catalog';
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

  it('normalizes legacy report labels and removes lease reports from the active catalog', () => {
    const normalized = normalizeReportDefinitions([
      {
        id: '1',
        slug: 'homeowner_directory',
        name: 'Homeowner Directory',
        category: 'people',
        description: 'Homeowner contact list by property.',
      },
      {
        id: '2',
        slug: 'lease_expiration',
        name: 'Lease Expiration',
        category: 'people',
        description: 'Lease report',
      },
    ]);

    expect(normalized).toHaveLength(1);
    expect(normalized[0].name).toBe('Owner Directory');
    expect(normalized[0].description).toBe('Owner contact list by association.');
  });
});
