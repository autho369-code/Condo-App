import { describe, expect, it } from 'vitest';
import { buildActivityRows, maskBankNumber } from '@/lib/banking/bank-format';

describe('bank formatting helpers', () => {
  it('masks account numbers', () => {
    expect(maskBankNumber('1234567890')).toBe('******7890');
    expect(maskBankNumber(null)).toBe('Not provided');
  });

  it('builds running balances in date order', () => {
    const rows = buildActivityRows([
      { id: '1', date: '2026-04-02', cashIn: 100, cashOut: 0, description: 'Deposit' },
      { id: '2', date: '2026-04-01', cashIn: 0, cashOut: 25, description: 'Check' },
    ], 500);

    expect(rows.map((row) => row.runningBalance)).toEqual([475, 575]);
  });
});
