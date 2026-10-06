import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import {
  reportFormatLabel,
  reportTitle,
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
    expect(supportedReportOutputFormats(['pdf', 'xlsx', 'csv', 'html'])).toEqual(['pdf', 'xlsx', 'csv']);
    expect(supportedReportOutputFormats([])).toEqual(['csv']);
    expect(reportFormatLabel('xlsx')).toBe('Excel');
  });

  it('creates a real PDF payload when PDF is selected', async () => {
    const output = await serializeReportOutput('pdf', [{ account: '1000 Cash', ending_balance: 13500 }], {
      title: 'Balance Sheet',
      scope: 'Harbor View HOA',
      dateFrom: '2026-07-01',
      dateTo: '2026-07-31',
    });
    expect(output.contentType).toBe('application/pdf');
    expect(output.extension).toBe('pdf');
    expect(new TextDecoder().decode(output.body.slice(0, 4))).toBe('%PDF');
  });

  it('creates a real Excel workbook with a header block, typed numbers and no formulas', async () => {
    const output = await serializeReportOutput('xlsx', [
      { account: '1000 Cash', ending_balance: 13500.5, memo: '=HYPERLINK("http://x")' },
      { account: '2000 AP', ending_balance: -250, memo: null },
    ], { title: 'Balance Sheet: July/2026', scope: 'Harbor View HOA', dateTo: '2026-07-31' });

    expect(output.extension).toBe('xlsx');
    expect(output.contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(new TextDecoder().decode(output.body.slice(0, 2))).toBe('PK');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(output.body) as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    expect(sheet.name).toBe('Balance Sheet  July 2026');
    expect(sheet.getCell('A1').value).toBe('Balance Sheet: July/2026');
    expect(sheet.getCell('A2').value).toBe('Scope: Harbor View HOA');
    expect(sheet.getCell('A3').value).toBe('Reporting period: As of 2026-07-31');
    expect(sheet.getRow(5).values).toEqual([undefined, 'Account', 'Ending balance', 'Memo']);
    expect(sheet.getCell('B6').value).toBe(13500.5);
    expect(sheet.getCell('B7').value).toBe(-250);
    // A formula-looking string is stored as text, never as a formula.
    expect(sheet.getCell('C6').value).toBe('=HYPERLINK("http://x")');
    expect(sheet.getCell('C6').type).toBe(ExcelJS.ValueType.String);
    expect(sheet.getCell('C6').formula).toBeUndefined();
  });

  it('writes a "No data" row for an empty Excel report', async () => {
    const output = await serializeReportOutput('xlsx', [], { title: 'Empty' });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(output.body) as unknown as ExcelJS.Buffer);
    expect(workbook.worksheets[0].getCell('A6').value).toBe('No data');
  });

  it('names the company, never the platform, in report files', async () => {
    expect(reportTitle({ title: 'Balance Sheet', companyName: 'Stellar Property Group' })).toBe('Balance Sheet');
    expect(reportTitle({ companyName: 'Stellar Property Group' })).toBe('Stellar Property Group report');
    expect(reportTitle({})).toBe('Report');

    const xlsx = await serializeReportOutput('xlsx', [{ a: 1 }], { title: 'Aging', companyName: 'Stellar Property Group' });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(xlsx.body as Uint8Array) as any);
    expect(workbook.creator).toBe('Stellar Property Group');

    const pdf = await serializeReportOutput('pdf', [{ a: 1 }], { companyName: 'Stellar Property Group' });
    const text = Buffer.from(pdf.body as Uint8Array).toString('latin1');
    expect(text).toContain('Stellar Property Group');
    expect(text).not.toContain('Portier369');
  });
});
