import { fetchAllRows } from '@/lib/supabase/fetch-all';

export const GL_ACCOUNT_TYPES = [
  'asset', 'cash', 'accounts_receivable', 'fixed_asset', 'liability', 'accounts_payable', 'equity',
  'income', 'other_income', 'expense', 'cost_of_goods_sold', 'other_expense', 'non_operating',
];

// Accounts whose normal balance is a debit; the rest show credit-minus-debit.
const DEBIT_NORMAL = new Set(['asset', 'cash', 'accounts_receivable', 'fixed_asset', 'expense', 'cost_of_goods_sold', 'other_expense', 'non_operating']);
export const normalBalance = (accountType: string, debitMinusCredit: number) =>
  DEBIT_NORMAL.has(accountType) ? debitMinusCredit : -debitMinusCredit;

// Defaults system postings use (GL account map). Keys match gl_account_map.map_key.
export const GL_MAP_KEYS: Array<{ key: string; label: string; hint: string; types: string[] }> = [
  { key: 'accounts_receivable', label: 'Accounts receivable', hint: 'Homeowner charges and receipts post here. It can change only while no other A/R account holds a balance.', types: ['accounts_receivable'] },
  { key: 'accounts_payable', label: 'Accounts payable', hint: 'Bills accrue here and checks relieve it.', types: ['accounts_payable', 'liability'] },
  { key: 'assessment_income', label: 'Assessment income', hint: 'Posted assessments credit this account.', types: ['income', 'other_income'] },
  { key: 'late_fee_income', label: 'Late fee income', hint: 'Late fees credit this account.', types: ['income', 'other_income'] },
  { key: 'default_income', label: 'Other charge income', hint: 'Charges without their own GL account credit this account.', types: ['income', 'other_income'] },
  { key: 'undeposited_funds', label: 'Undeposited funds', hint: 'Receipts not tied to a bank account wait here until deposited.', types: ['cash', 'asset'] },
];

// Plain-language message for a failed gl_accounts write.
export function glWriteError(message: string): string {
  if (/gl_accounts_portfolio_id_association_id_number_key|duplicate key/i.test(message)) {
    return 'That account number is already used in this chart of accounts.';
  }
  return message;
}

// Posted balance per account (debit minus credit). Restricted to one
// association's lines when assoc is given. Paged past 1,000 rows.
export async function glBalances(db: any, accountIds: string[], assoc: string | null) {
  const totals = new Map<string, number>();
  for (let i = 0; i < accountIds.length; i += 300) {
    const ids = accountIds.slice(i, i + 300);
    const { rows, error } = await fetchAllRows<any>(() => db
      .rpc('gl_balances_by_association', { p_gl_account_ids: ids })
      .order('gl_account_id').order('association_id', { nullsFirst: true }));
    if (error) throw new Error(`Could not load GL balances: ${error}`);
    for (const r of rows) {
      if (assoc && r.association_id !== assoc) continue;
      totals.set(r.gl_account_id, (totals.get(r.gl_account_id) ?? 0) + Number(r.debit_minus_credit ?? 0));
    }
  }
  return totals;
}
