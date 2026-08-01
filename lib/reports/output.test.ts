import { describe, expect, it } from 'vitest';
import {
  rowsToCsv,
  serializeReportOutput,
  supportedReportOutputFormats,
} from '@/lib/reports/output';

describe('report output serialization', () => {
  it('keeps CSV columns stable and escapes spreadsheet values correctly', () => {
    expect(rowsToCsv([
      { account: '1000', memo: 'Repair, lobby', amount: 25 },
      { account: '2000', amount: 0 },
    ])).toBe('account,memo,amount\n1000,"Repair, lobby",25\n2000,,0\n');
  });

  it('only exposes formats the service can actually generate', () => {
    expect(supportedReportOutputFormats(['pdf', 'xlsx', 'csv', 'html'])).toEqual(['pdf', 'csv']);
    expect(supportedReportOutputFormats([])).toEqual(['csv']);
  });

  it('creates a real PDF payload when PDF is selected', () => {
    const output = serializeReportOutput('pdf', [{ account: '1000 Cash', ending_balance: 13500 }], {
      title: 'Balance Sheet',
      scope: 'Harbor View HOA',
      dateFrom: '2026-07-01',
      dateTo: '2026-07-31',
    });
    expect(output.contentType).toBe('application/pdf');
    expect(output.extension).toBe('pdf');
    expect(new TextDecoder().decode(output.body.slice(0, 4))).toBe('%PDF');
  });
});
