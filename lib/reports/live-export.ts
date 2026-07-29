import {
  addLedgerLine,
  financialSection,
  netIncome,
  normalBalance,
  type LedgerTotals,
} from '@/lib/reports/financial';

type ServiceClient = any;
type LiveExportSlug = (typeof LIVE_EXPORT_SLUGS)[number];

export const LIVE_EXPORT_SLUGS = [
  'trial_balance',
  'balance_sheet',
  'income_statement',
  'general_ledger',
] as const;

export function supportsLiveExport(slug: unknown): slug is LiveExportSlug {
  return typeof slug === 'string'
    && (LIVE_EXPORT_SLUGS as readonly string[]).includes(slug);
}

function stringParam(params: Record<string, unknown>, name: string): string | null {
  const value = params[name];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function validateAssociation(
  db: ServiceClient,
  portfolioId: string,
  associationId: string | null,
): Promise<void> {
  if (!associationId) return;
  const { data, error } = await db
    .from('associations')
    .select('id')
    .eq('id', associationId)
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Association is not in this portfolio.');
}

async function loadAccounts(
  db: ServiceClient,
  portfolioId: string,
  associationId: string | null,
) {
  let query = db
    .from('gl_accounts')
    .select('id, number, name, account_type')
    .eq('portfolio_id', portfolioId)
    .eq('active', true)
    .order('number');
  if (associationId) {
    query = query.or(`association_id.is.null,association_id.eq.${associationId}`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function loadLedgerTotals(
  db: ServiceClient,
  accountIds: string[],
  associationId: string | null,
  dateFrom: string | null,
  dateTo: string,
): Promise<LedgerTotals> {
  const totals: LedgerTotals = {};
  for (const accountId of accountIds) totals[accountId] = { debit: 0, credit: 0 };
  if (accountIds.length === 0) return totals;

  let query = db
    .from('journal_lines')
    .select('gl_account_id, debit_amount, credit_amount, journal_entries!inner(entry_date, posted)')
    .in('gl_account_id', accountIds)
    .eq('journal_entries.posted', true)
    .lte('journal_entries.entry_date', dateTo);
  if (dateFrom) query = query.gte('journal_entries.entry_date', dateFrom);
  if (associationId) query = query.eq('association_id', associationId);

  const { data, error } = await query;
  if (error) throw error;
  for (const line of data ?? []) {
    addLedgerLine(totals, line.gl_account_id, line.debit_amount, line.credit_amount);
  }
  return totals;
}

function accountRow(account: any, amount: number, section: string, dateLabel: string) {
  return {
    Section: section,
    'Account #': account.number,
    Account: account.name,
    Type: account.account_type,
    Amount: amount,
    Period: dateLabel,
  };
}

async function trialBalanceRows(
  db: ServiceClient,
  portfolioId: string,
  associationId: string | null,
  dateTo: string,
) {
  const accounts = await loadAccounts(db, portfolioId, associationId);
  const totals = await loadLedgerTotals(db, accounts.map((a: any) => a.id), associationId, null, dateTo);
  const rows = accounts.map((account: any) => {
    const total = totals[account.id] ?? { debit: 0, credit: 0 };
    return {
      'Account #': account.number,
      Account: account.name,
      Type: account.account_type,
      Debit: total.debit,
      Credit: total.credit,
      'Net balance': total.debit - total.credit,
      'As of': dateTo,
    };
  });
  const totalDebit = rows.reduce((sum: number, row: any) => sum + Number(row.Debit), 0);
  const totalCredit = rows.reduce((sum: number, row: any) => sum + Number(row.Credit), 0);
  rows.push({
    'Account #': '',
    Account: 'Totals',
    Type: '',
    Debit: totalDebit,
    Credit: totalCredit,
    'Net balance': totalDebit - totalCredit,
    'As of': dateTo,
  });
  return rows;
}

async function balanceSheetRows(
  db: ServiceClient,
  portfolioId: string,
  associationId: string | null,
  dateTo: string,
) {
  const accounts = await loadAccounts(db, portfolioId, associationId);
  const totals = await loadLedgerTotals(db, accounts.map((a: any) => a.id), associationId, null, dateTo);
  const sections = ['asset', 'liability', 'equity'] as const;
  const rows: Record<string, unknown>[] = [];

  for (const section of sections) {
    const sectionAccounts = accounts.filter((account: any) => financialSection(account) === section);
    for (const account of sectionAccounts) {
      rows.push(accountRow(account, normalBalance(account, totals), section, `As of ${dateTo}`));
    }
  }

  const currentIncome = netIncome(accounts, totals);
  rows.push(accountRow(
    { number: 3650, name: 'Current Year Net Income', account_type: 'equity' },
    currentIncome,
    'equity',
    `As of ${dateTo}`,
  ));

  const total = (section: string) => rows
    .filter((row) => row.Section === section)
    .reduce((sum, row) => sum + Number(row.Amount ?? 0), 0);
  const assets = total('asset');
  const liabilities = total('liability');
  const equity = total('equity');
  rows.push({
    Section: 'balance_check',
    'Account #': '',
    Account: 'Assets minus Liabilities and Equity',
    Type: '',
    Amount: assets - liabilities - equity,
    Period: `As of ${dateTo}`,
  });
  return rows;
}

async function incomeStatementRows(
  db: ServiceClient,
  portfolioId: string,
  associationId: string | null,
  dateFrom: string,
  dateTo: string,
) {
  const accounts = await loadAccounts(db, portfolioId, associationId);
  const totals = await loadLedgerTotals(
    db,
    accounts.map((a: any) => a.id),
    associationId,
    dateFrom,
    dateTo,
  );
  const rows: Record<string, unknown>[] = [];
  for (const account of accounts) {
    const section = financialSection(account);
    if (section !== 'income' && section !== 'expense') continue;
    rows.push(accountRow(
      account,
      normalBalance(account, totals),
      section,
      `${dateFrom} to ${dateTo}`,
    ));
  }
  const revenue = rows
    .filter((row) => row.Section === 'income')
    .reduce((sum, row) => sum + Number(row.Amount ?? 0), 0);
  const expenses = rows
    .filter((row) => row.Section === 'expense')
    .reduce((sum, row) => sum + Number(row.Amount ?? 0), 0);
  rows.push({
    Section: 'summary',
    'Account #': '',
    Account: 'Net Income',
    Type: '',
    Amount: revenue - expenses,
    Period: `${dateFrom} to ${dateTo}`,
  });
  return rows;
}

async function generalLedgerRows(
  db: ServiceClient,
  portfolioId: string,
  associationId: string | null,
  dateFrom: string,
  dateTo: string,
) {
  const accounts = await loadAccounts(db, portfolioId, associationId);
  const accountById = new Map(accounts.map((account: any) => [account.id, account]));
  const accountIds = [...accountById.keys()];
  if (accountIds.length === 0) return [];

  let query = db
    .from('journal_lines')
    .select('id, debit_amount, credit_amount, memo, gl_account_id, entry_id, sort_order, journal_entries!inner(entry_date, description, memo, reference_number, posted)')
    .in('gl_account_id', accountIds)
    .eq('journal_entries.posted', true)
    .gte('journal_entries.entry_date', dateFrom)
    .lte('journal_entries.entry_date', dateTo)
    .order('sort_order');
  if (associationId) query = query.eq('association_id', associationId);
  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((line: any) => {
    const account: any = accountById.get(line.gl_account_id) ?? {};
    const entry = line.journal_entries ?? {};
    return {
      Date: entry.entry_date,
      'Account #': account.number ?? '',
      Account: account.name ?? '',
      Description: entry.description ?? line.memo ?? '',
      Memo: entry.memo ?? line.memo ?? '',
      Reference: entry.reference_number ?? '',
      Debit: Number(line.debit_amount ?? 0),
      Credit: Number(line.credit_amount ?? 0),
      'Entry ID': line.entry_id,
    };
  });
}

export async function generateLiveExportRows(
  db: ServiceClient,
  portfolioId: string,
  slug: LiveExportSlug,
  rawParams: Record<string, unknown>,
): Promise<Record<string, unknown>[]> {
  const associationId = stringParam(rawParams, 'association_id');
  const dateTo = stringParam(rawParams, 'date_to') ?? new Date().toISOString().slice(0, 10);
  const dateFrom = stringParam(rawParams, 'date_from') ?? `${dateTo.slice(0, 4)}-01-01`;
  if (dateFrom > dateTo) throw new Error('Report start date must not be after end date.');
  await validateAssociation(db, portfolioId, associationId);

  switch (slug) {
    case 'trial_balance':
      return trialBalanceRows(db, portfolioId, associationId, dateTo);
    case 'balance_sheet':
      return balanceSheetRows(db, portfolioId, associationId, dateTo);
    case 'income_statement':
      return incomeStatementRows(db, portfolioId, associationId, dateFrom, dateTo);
    case 'general_ledger':
      return generalLedgerRows(db, portfolioId, associationId, dateFrom, dateTo);
  }
}
