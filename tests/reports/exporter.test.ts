import { describe, expect, it } from 'vitest';
import {
  buildReportCsv,
  buildReportPdf,
  defaultReportFormat,
  orderedReportFormats,
  reportDownloadPath,
  reportFileExtension,
} from '@/lib/reports/exporter';

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

  it('prioritizes pdf as the default printable report format', () => {
    expect(defaultReportFormat(['csv', 'pdf', 'xlsx'])).toBe('pdf');
    expect(orderedReportFormats(['csv', 'pdf', 'xlsx'])).toEqual(['pdf', 'xlsx', 'csv']);
  });

  it('builds a valid pdf payload for printable reports', () => {
    const pdf = buildReportPdf({
      title: 'Income Statement',
      generatedAt: '2026-05-13T00:00:00.000Z',
      parameters: { scope: 'association' },
      rows: [{ account: 'Revenue', amount: 1200 }],
    });

    expect(pdf.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect(pdf.toString('latin1')).toContain('Income Statement');
    expect(reportFileExtension('pdf')).toBe('pdf');
  });
});
