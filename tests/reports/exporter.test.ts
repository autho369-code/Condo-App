import { describe, expect, it } from 'vitest';
import { buildReportCsv, reportDownloadPath } from '@/lib/reports/exporter';

describe('report export helpers', () => {
  it('serializes report rows as csv with escaped values', () => {
    const csv = buildReportCsv({
      title: 'Owner Ledger',
      generatedAt: '2026-05-13T00:00:00.000Z',
      parameters: { scope: 'association' },
      rows: [
        { unit: '101', owner: 'Ada, Inc.', balance: 120.5 },
        { unit: '102', owner: 'Grace "HOA"', balance: 0 },
      ],
    });

    expect(csv).toContain('Report,Owner Ledger');
    expect(csv).toContain('Parameters,"{""scope"":""association""}"');
    expect(csv).toContain('unit,owner,balance');
    expect(csv).toContain('101,"Ada, Inc.",120.5');
    expect(csv).toContain('102,"Grace ""HOA""",0');
  });

  it('builds an app download URL for completed runs', () => {
    expect(reportDownloadPath('run-1')).toBe('/reports/runs/run-1/download');
  });
});
