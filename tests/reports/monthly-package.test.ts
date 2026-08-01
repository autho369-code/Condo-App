import { describe, expect, it } from 'vitest';
import { generateMonthlyFinancialPackagePdf, prepareMonthlyPackageRows } from '@/lib/reports/monthly-package';

describe('monthly financial package PDF', () => {
  it('creates a cover plus one section per financial statement', () => {
    const pdf = generateMonthlyFinancialPackagePdf({
      associationName: 'Harbor View HOA',
      companyName: 'Harbor Management',
      dateFrom: '2026-06-01',
      dateTo: '2026-06-30',
      sections: [
        { title: 'Balance Sheet', rows: [{ account: '1000 Cash', balance: 10000 }] },
        { title: 'Income Statement', rows: [{ account: '4000 Assessments', amount: 7000 }] },
      ],
    });
    expect(Buffer.from(pdf.subarray(0, 4)).toString()).toBe('%PDF');
    expect(pdf.byteLength).toBeGreaterThan(4_000);
    expect(Buffer.from(pdf).toString('latin1')).toContain('/Count 3');
  });

  it('formats financial values and uses management-company branding', () => {
    const pdf = generateMonthlyFinancialPackagePdf({
      associationName: 'Harbor View HOA',
      companyName: 'Harbor Management',
      dateFrom: '2026-06-01',
      dateTo: '2026-06-30',
      sections: [{ title: 'Balance Sheet', rows: [{ Account: 'Cash', Amount: 1234.5 }] }],
    });
    const source = Buffer.from(pdf).toString('latin1');
    expect(source).not.toContain('Portier369');
    expect(pdf.byteLength).toBeGreaterThan(4_000);
  });

  it('compacts a wide annual budget export to the selected month and YTD values', () => {
    const rows = prepareMonthlyPackageRows('budget_vs_actual', [{
      Category: 'income',
      'Account #': 4000,
      Account: 'Assessments',
      'Jan budget': 100,
      'Jan actual': 90,
      'Feb budget': 100,
      'Feb actual': 110,
      'Mar budget': 100,
      'Mar actual': 80,
    }], '2026-03-31');
    expect(rows).toEqual([{
      Category: 'income',
      'Account #': 4000,
      Account: 'Assessments',
      'Mar budget': 100,
      'Mar actual': 80,
      'Mar variance': -20,
      'YTD budget': 300,
      'YTD actual': 280,
      'YTD variance': -20,
    }]);
  });
});
