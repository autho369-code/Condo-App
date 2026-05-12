import { describe, expect, it } from 'vitest';
import {
  buildReconciliationTransactions,
  calculateReconciliationSummary,
  getReconciliationGuardrails,
  parseStatementBalance,
} from '@/lib/banking/reconciliation';

describe('bank reconciliation helpers', () => {
  it('normalizes payments, paid bills, and transfers into signed reconciliation transactions', () => {
    const rows = buildReconciliationTransactions({
      bankAccountId: 'operating',
      payments: [
        { id: 'pay-1', amount: 125, payment_date: '2026-04-03', method: 'ach', reference: 'PMT-1', notes: 'Unit 2A' },
      ],
      payableBills: [
        { id: 'bill-1', amount: 75, paid_at: '2026-04-04', due_date: '2026-04-01', bill_number: 'B-100', memo: 'Landscaping', vendors: { name: 'Green Co' } },
      ],
      transfers: [
        { id: 'transfer-out', amount: 40, transfer_date: '2026-04-05', reference_number: 'T-1', memo: 'Reserve funding', from_bank_account_id: 'operating', to_bank_account_id: 'reserve', from: { name: 'Operating' }, to: { name: 'Reserve' } },
        { id: 'transfer-in', amount: 20, transfer_date: '2026-04-06', reference_number: 'T-2', memo: 'Reimbursement', from_bank_account_id: 'reserve', to_bank_account_id: 'operating', from: { name: 'Reserve' }, to: { name: 'Operating' } },
      ],
    });

    expect(rows.map((row) => [row.id, row.type, row.amount])).toEqual([
      ['payment-pay-1', 'Owner payment', 125],
      ['bill-bill-1', 'Bill payment', -75],
      ['transfer-transfer-out-out', 'Transfer out', -40],
      ['transfer-transfer-in-in', 'Transfer in', 20],
    ]);
  });

  it('calculates cleared and uncleared balances from a statement date and balance', () => {
    const summary = calculateReconciliationSummary({
      statementDate: '2026-04-30',
      statementBalance: 1030,
      transactions: [
        { id: '1', date: '2026-04-10', type: 'Owner payment', description: 'Assessment', reference: 'P1', amount: 100 },
        { id: '2', date: '2026-04-11', type: 'Bill payment', description: 'Repair', reference: 'C1', amount: -70 },
        { id: '3', date: '2026-05-01', type: 'Owner payment', description: 'Late deposit', reference: 'P2', amount: 50 },
        { id: '4', date: '2026-05-02', type: 'Bill payment', description: 'Outstanding check', reference: 'C2', amount: -20 },
      ],
    });

    expect(summary.clearedBalance).toBe(30);
    expect(summary.bookBalance).toBe(60);
    expect(summary.unclearedDeposits).toBe(50);
    expect(summary.unclearedWithdrawals).toBe(20);
    expect(summary.adjustedStatementBalance).toBe(1060);
    expect(summary.difference).toBe(1000);
    expect(summary.differenceLabel).toBe('Statement over by $1,000.00');
  });

  it('marks reconciliation ready only when required statement inputs exist and the difference is zero', () => {
    const balanced = calculateReconciliationSummary({
      statementDate: '2026-04-30',
      statementBalance: 30,
      transactions: [
        { id: '1', date: '2026-04-10', type: 'Owner payment', description: 'Assessment', reference: 'P1', amount: 100 },
        { id: '2', date: '2026-04-11', type: 'Bill payment', description: 'Repair', reference: 'C1', amount: -70 },
      ],
    });

    expect(getReconciliationGuardrails({
      hasAccount: true,
      statementDate: '2026-04-30',
      statementBalance: 30,
      summary: balanced,
    })).toMatchObject({
      canSaveDraft: true,
      canReconcile: true,
      blockers: [],
    });

    expect(getReconciliationGuardrails({
      hasAccount: true,
      statementDate: '2026-04-30',
      statementBalance: 31,
      summary: { ...balanced, statementBalance: 31, difference: 1, differenceLabel: 'Statement over by $1.00' },
    })).toMatchObject({
      canSaveDraft: true,
      canReconcile: false,
      blockers: ['Resolve the $1.00 over-under difference before reconciling.'],
    });
  });

  it('parses currency-like statement balance inputs', () => {
    expect(parseStatementBalance('$1,234.56')).toBe(1234.56);
    expect(parseStatementBalance('')).toBeNull();
    expect(parseStatementBalance('abc')).toBeNull();
  });
});
