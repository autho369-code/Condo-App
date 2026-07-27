export type LedgerTotals = Record<string, { debit: number; credit: number }>;

export type FinancialAccount = {
  id: string;
  account_type: string | null;
  number?: number | null;
};

const debitNormal = new Set(['asset', 'cash', 'accounts_receivable', 'fixed_asset', 'expense', 'cost_of_goods_sold', 'other_expense', 'non_operating']);
const assetTypes = new Set(['asset', 'cash', 'accounts_receivable', 'fixed_asset']);
const liabilityTypes = new Set(['liability', 'accounts_payable']);
const incomeTypes = new Set(['income', 'other_income']);
const expenseTypes = new Set(['expense', 'cost_of_goods_sold', 'other_expense', 'non_operating']);

export function addLedgerLine(totals: LedgerTotals, accountId: string, debit: unknown, credit: unknown): void {
  const row = totals[accountId] ?? { debit: 0, credit: 0 };
  row.debit += Number(debit ?? 0);
  row.credit += Number(credit ?? 0);
  totals[accountId] = row;
}

export function normalBalance(account: FinancialAccount, totals: LedgerTotals): number {
  const amounts = totals[account.id] ?? { debit: 0, credit: 0 };
  return debitNormal.has(account.account_type ?? '')
    ? amounts.debit - amounts.credit
    : amounts.credit - amounts.debit;
}

export function financialSection(account: FinancialAccount): 'asset' | 'liability' | 'equity' | 'income' | 'expense' | null {
  const type = account.account_type ?? '';
  if (assetTypes.has(type)) return 'asset';
  if (liabilityTypes.has(type)) return 'liability';
  if (type === 'equity') return 'equity';
  if (incomeTypes.has(type)) return 'income';
  if (expenseTypes.has(type)) return 'expense';
  return null;
}

export function netIncome(accounts: FinancialAccount[], totals: LedgerTotals): number {
  return accounts.reduce((sum, account) => {
    const section = financialSection(account);
    const amount = normalBalance(account, totals);
    if (section === 'income') return sum + amount;
    if (section === 'expense') return sum - amount;
    return sum;
  }, 0);
}

export function trialBalanceIsBalanced(totals: LedgerTotals, precision = 0.005): boolean {
  const sums = Object.values(totals).reduce((acc, line) => ({
    debit: acc.debit + line.debit,
    credit: acc.credit + line.credit,
  }), { debit: 0, credit: 0 });
  return Math.abs(sums.debit - sums.credit) < precision;
}
