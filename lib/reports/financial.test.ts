import { describe, expect, it } from 'vitest';
import { addLedgerLine, financialSection, netIncome, normalBalance, trialBalanceIsBalanced } from '@/lib/reports/financial';

describe('financial report calculations', () => {
  it('uses normal balances from account type rather than account number', () => {
    const totals = {};
    addLedgerLine(totals, 'cash', 13500, 0);
    addLedgerLine(totals, 'income', 0, 15000);
    addLedgerLine(totals, 'expense', 2050, 0);

    expect(normalBalance({ id: 'cash', account_type: 'cash', number: 9999 }, totals)).toBe(13500);
    expect(normalBalance({ id: 'income', account_type: 'income', number: 1000 }, totals)).toBe(15000);
    expect(netIncome([
      { id: 'income', account_type: 'income' },
      { id: 'expense', account_type: 'expense' },
    ], totals)).toBe(12950);
  });

  it('classifies the balance sheet from the chart-of-accounts type', () => {
    expect(financialSection({ id: 'ar', account_type: 'accounts_receivable' })).toBe('asset');
    expect(financialSection({ id: 'ap', account_type: 'accounts_payable' })).toBe('liability');
    expect(financialSection({ id: 'equity', account_type: 'equity' })).toBe('equity');
  });

  it('detects out-of-balance journal totals', () => {
    expect(trialBalanceIsBalanced({ cash: { debit: 100, credit: 0 }, income: { debit: 0, credit: 100 } })).toBe(true);
    expect(trialBalanceIsBalanced({ cash: { debit: 100, credit: 0 } })).toBe(false);
  });
});
