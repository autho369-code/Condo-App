import { describe, expect, it } from 'vitest';
import { generateMonthlyFinancialPackagePdf } from '@/lib/reports/monthly-package';

describe('monthly financial package PDF', () => {
  it('creates a cover plus one section per financial statement', () => {
    const pdf = generateMonthlyFinancialPackagePdf({
      associationName: 'Harbor View HOA',
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
});
