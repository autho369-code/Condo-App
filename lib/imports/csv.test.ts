import { describe, expect, it } from 'vitest';
import { canonicalHeader, parseImportCsv } from './csv';

describe('parseImportCsv', () => {
  it('maps common header spellings, strips a BOM and numbers rows like the spreadsheet', () => {
    const csv = '﻿Entry #,Entry Date,Property,GL Account,Debit,Credit\nA,2026-09-30,Granville,5000,100,\nA,2026-09-30,Granville,1150,,100\n';
    const { rows } = parseImportCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows?.[0]).toMatchObject({ entry: 'A', date: '2026-09-30', association: 'Granville', gl: '5000', debit: '100', row: '2' });
    expect(rows?.[1]).toMatchObject({ gl: '1150', credit: '100', row: '3' });
  });

  it('maps bill headers and keeps unknown columns', () => {
    expect(canonicalHeader('Invoice Number')).toBe('bill_number');
    expect(canonicalHeader('due_date')).toBe('due_date');
    expect(canonicalHeader(' Payee ')).toBe('vendor');
    expect(canonicalHeader('Custom')).toBe('custom');
  });

  it('maps lockbox bank file headers', () => {
    const { rows } = parseImportCsv('Check #,Check Amount,Remitter,Account Number\n1001,350.00,Jane Smith,101\n');
    expect(rows?.[0]).toMatchObject({ check_number: '1001', amount: '350.00', payer: 'Jane Smith', unit: '101', row: '2' });
  });

  it('rejects an empty file', () => {
    expect(parseImportCsv('vendor,amount\n').error).toMatch(/no rows/);
  });
});
