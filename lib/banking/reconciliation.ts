export type PaymentRow = {
  id: string;
  amount: number | string | null;
  payment_date: string | null;
  method: string | null;
  reference: string | null;
  notes: string | null;
};

export type PayableBillRow = {
  id: string;
  amount: number | string | null;
  paid_at: string | null;
  due_date: string | null;
  bill_number: string | null;
  memo: string | null;
  vendors?: { name?: string | null } | null;
};

export type BankTransferRow = {
  id: string;
  amount: number | string | null;
  transfer_date: string | null;
  reference_number: string | null;
  memo: string | null;
  from_bank_account_id: string | null;
  to_bank_account_id: string | null;
  from?: { name?: string | null } | null;
  to?: { name?: string | null } | null;
};

export type ReconciliationTransaction = {
  id: string;
  sourceId?: string;
  date: string;
  type: string;
  description: string;
  reference: string;
  amount: number;
};

export type ReconciliationSummary = {
  statementDate: string;
  statementBalance: number;
  cleared: ReconciliationTransaction[];
  uncleared: ReconciliationTransaction[];
  clearedBalance: number;
  bookBalance: number;
  unclearedDeposits: number;
  unclearedWithdrawals: number;
  adjustedStatementBalance: number;
  difference: number;
  differenceLabel: string;
};

export function parseStatementBalance(value: string | number | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? roundCurrency(value) : null;
  const normalized = value?.replace(/[$,\s]/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? roundCurrency(parsed) : null;
}

export function buildReconciliationTransactions({
  bankAccountId,
  payments = [],
  payableBills = [],
  transfers = [],
}: {
  bankAccountId: string;
  payments?: PaymentRow[];
  payableBills?: PayableBillRow[];
  transfers?: BankTransferRow[];
}) {
  const rows: ReconciliationTransaction[] = [];

  for (const payment of payments) {
    const amount = numericAmount(payment.amount);
    if (!payment.payment_date || amount === 0) continue;
    rows.push({
      id: `payment-${payment.id}`,
      sourceId: payment.id,
      date: payment.payment_date,
      type: 'Owner payment',
      description: payment.notes || payment.method || 'Owner payment',
      reference: payment.reference || '-',
      amount,
    });
  }

  for (const bill of payableBills) {
    const amount = numericAmount(bill.amount);
    if (!amount) continue;
    const transactionDate = bill.paid_at || bill.due_date;
    if (!transactionDate) continue;
    rows.push({
      id: `bill-${bill.id}`,
      sourceId: bill.id,
      date: transactionDate.slice(0, 10),
      type: 'Bill payment',
      description: bill.vendors?.name || bill.memo || 'Vendor bill',
      reference: bill.bill_number || '-',
      amount: -Math.abs(amount),
    });
  }

  for (const transfer of transfers) {
    const amount = numericAmount(transfer.amount);
    if (!transfer.transfer_date || amount === 0) continue;
    if (transfer.from_bank_account_id === bankAccountId) {
      rows.push({
        id: `transfer-${transfer.id}-out`,
        sourceId: transfer.id,
        date: transfer.transfer_date,
        type: 'Transfer out',
        description: transfer.to?.name ? `To ${transfer.to.name}` : transfer.memo || 'Bank transfer',
        reference: transfer.reference_number || '-',
        amount: -Math.abs(amount),
      });
    }
    if (transfer.to_bank_account_id === bankAccountId) {
      rows.push({
        id: `transfer-${transfer.id}-in`,
        sourceId: transfer.id,
        date: transfer.transfer_date,
        type: 'Transfer in',
        description: transfer.from?.name ? `From ${transfer.from.name}` : transfer.memo || 'Bank transfer',
        reference: transfer.reference_number || '-',
        amount: Math.abs(amount),
      });
    }
  }

  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function calculateReconciliationSummary({
  statementDate,
  statementBalance,
  transactions,
}: {
  statementDate: string;
  statementBalance: number;
  transactions: ReconciliationTransaction[];
}): ReconciliationSummary {
  const cleared = transactions.filter((row) => row.date <= statementDate);
  const uncleared = transactions.filter((row) => row.date > statementDate);
  const clearedBalance = sumAmounts(cleared);
  const bookBalance = sumAmounts(transactions);
  const unclearedDeposits = sumAmounts(uncleared.filter((row) => row.amount > 0));
  const unclearedWithdrawals = Math.abs(sumAmounts(uncleared.filter((row) => row.amount < 0)));
  const adjustedStatementBalance = roundCurrency(statementBalance + unclearedDeposits - unclearedWithdrawals);
  const difference = roundCurrency(adjustedStatementBalance - bookBalance);

  return {
    statementDate,
    statementBalance: roundCurrency(statementBalance),
    cleared,
    uncleared,
    clearedBalance,
    bookBalance,
    unclearedDeposits,
    unclearedWithdrawals,
    adjustedStatementBalance,
    difference,
    differenceLabel: formatDifferenceLabel(difference),
  };
}

export function getReconciliationGuardrails({
  hasAccount,
  statementDate,
  statementBalance,
  summary,
}: {
  hasAccount: boolean;
  statementDate: string;
  statementBalance: number | null;
  summary: ReconciliationSummary;
}) {
  const blockers: string[] = [];
  if (!hasAccount) blockers.push('Select a bank account.');
  if (!statementDate) blockers.push('Enter a statement date.');
  if (statementBalance === null) blockers.push('Enter the ending balance from the statement.');
  if (summary.difference !== 0) {
    blockers.push(`Resolve the ${formatCurrency(Math.abs(summary.difference))} over-under difference before reconciling.`);
  }

  return {
    canSaveDraft: hasAccount && Boolean(statementDate) && statementBalance !== null,
    canReconcile: blockers.length === 0,
    blockers,
  };
}

function numericAmount(value: number | string | null | undefined) {
  const parsed = parseStatementBalance(value);
  return parsed ?? 0;
}

function sumAmounts(rows: ReconciliationTransaction[]) {
  return roundCurrency(rows.reduce((total, row) => total + row.amount, 0));
}

function formatDifferenceLabel(difference: number) {
  if (difference === 0) return 'Balanced';
  return difference > 0
    ? `Statement over by ${formatCurrency(difference)}`
    : `Statement under by ${formatCurrency(Math.abs(difference))}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
