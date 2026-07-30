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
  'ar_aging',
  'delinquency_summary',
  'ap_aging',
  'aged_payables',
  'aged_payables_summary',
  'budget_vs_actual',
  'budget_vs_actuals',
  'annual_budget_comparative',
  'bank_reconciliation',
  'bank_account_reconciliation',
  'bank_reconciliation_detail',
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

  const currentYearStart = `${dateTo.slice(0, 4)}-01-01`;
  const currentYearTotals = await loadLedgerTotals(
    db,
    accounts.map((account: any) => account.id),
    associationId,
    currentYearStart,
    dateTo,
  );
  const currentIncome = netIncome(accounts, currentYearTotals);
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
  const accountById = new Map<string, any>(
    accounts.map((account: any) => [String(account.id), account]),
  );
  const accountIds: string[] = accounts.map((account: any) => String(account.id));
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

  const openingDate = new Date(`${dateFrom}T00:00:00.000Z`);
  openingDate.setUTCDate(openingDate.getUTCDate() - 1);
  const openingTotals = await loadLedgerTotals(
    db,
    accountIds,
    associationId,
    null,
    openingDate.toISOString().slice(0, 10),
  );
  const orderedLines = [...(data ?? [])].sort((left: any, right: any) => {
    const leftAccount: any = accountById.get(left.gl_account_id) ?? {};
    const rightAccount: any = accountById.get(right.gl_account_id) ?? {};
    return Number(leftAccount.number ?? 0) - Number(rightAccount.number ?? 0)
      || String(left.journal_entries?.entry_date ?? '').localeCompare(
        String(right.journal_entries?.entry_date ?? ''),
      )
      || Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0)
      || String(left.id).localeCompare(String(right.id));
  });
  const runningByAccount = new Map<string, number>();

  return orderedLines.map((line: any) => {
    const account: any = accountById.get(line.gl_account_id) ?? {};
    const entry = line.journal_entries ?? {};
    const opening = runningByAccount.has(line.gl_account_id)
      ? runningByAccount.get(line.gl_account_id)!
      : normalBalance(account, openingTotals);
    const movement = normalBalance(account, {
      [line.gl_account_id]: {
        debit: Number(line.debit_amount ?? 0),
        credit: Number(line.credit_amount ?? 0),
      },
    });
    const running = opening + movement;
    runningByAccount.set(line.gl_account_id, running);
    return {
      Date: entry.entry_date,
      'Account #': account.number ?? '',
      Account: account.name ?? '',
      Description: entry.description ?? line.memo ?? '',
      Memo: entry.memo ?? line.memo ?? '',
      Reference: entry.reference_number ?? '',
      Debit: Number(line.debit_amount ?? 0),
      Credit: Number(line.credit_amount ?? 0),
      'Opening balance': opening,
      'Running balance': running,
      'Entry ID': line.entry_id,
    };
  });
}

export function agingBucket(dueDate: string | null, asOf: string): string {
  if (!dueDate || dueDate >= asOf) return 'Current';
  const due = Date.parse(`${dueDate}T00:00:00.000Z`);
  const reportDate = Date.parse(`${asOf}T00:00:00.000Z`);
  const days = Math.max(1, Math.floor((reportDate - due) / 86_400_000));
  if (days <= 30) return '1-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

async function apAgingRows(
  db: ServiceClient,
  portfolioId: string,
  associationId: string | null,
  asOf: string,
) {
  let associationsQuery = db
    .from('associations')
    .select('id')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null);
  if (associationId) associationsQuery = associationsQuery.eq('id', associationId);
  const { data: associations, error: associationsError } = await associationsQuery;
  if (associationsError) throw associationsError;
  const associationIds = (associations ?? []).map((association: any) => association.id);
  if (associationIds.length === 0) return [];

  const { data, error } = await db
    .from('payable_bills')
    .select('id, bill_number, bill_date, due_date, amount, memo, status, association_id, vendors(name), associations(name)')
    .in('association_id', associationIds)
    .not('status', 'in', '("paid","void")')
    .lte('bill_date', asOf)
    .order('due_date', { ascending: true, nullsFirst: false });
  if (error) throw error;

  return (data ?? []).map((bill: any) => ({
    Association: bill.associations?.name ?? '',
    Vendor: bill.vendors?.name ?? '',
    'Bill #': bill.bill_number ?? '',
    'Bill date': bill.bill_date,
    'Due date': bill.due_date,
    Memo: bill.memo ?? '',
    Status: bill.status,
    'Aging bucket': agingBucket(bill.due_date, asOf),
    'Balance due': Number(bill.amount ?? 0),
    'Bill ID': bill.id,
    'As of': asOf,
  }));
}

async function arAgingRows(
  db: ServiceClient,
  portfolioId: string,
  associationId: string | null,
) {
  let associationsQuery = db
    .from('associations')
    .select('id')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null);
  if (associationId) associationsQuery = associationsQuery.eq('id', associationId);
  const { data: associations, error: associationsError } = await associationsQuery;
  if (associationsError) throw associationsError;
  const associationIds = (associations ?? []).map((association: any) => association.id);
  if (associationIds.length === 0) return [];

  const { data, error } = await db
    .from('aged_receivables')
    .select('*')
    .in('association_id', associationIds)
    .order('due_date');
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    Association: row.association_name,
    Unit: row.unit_number,
    Description: row.description,
    'Due date': row.due_date,
    'Aging bucket': row.aging_bucket,
    Charged: Number(row.amount ?? 0),
    Paid: Number(row.total_paid ?? 0),
    'Balance due': Number(row.balance_due ?? 0),
    'Charge ID': row.charge_id,
  }));
}

async function delinquencySummaryRows(
  db: ServiceClient,
  portfolioId: string,
  associationId: string | null,
) {
  const detail = await arAgingRows(db, portfolioId, associationId);
  const summaries = new Map<string, {
    current: number;
    oneToThirty: number;
    thirtyOneToSixty: number;
    sixtyOneToNinety: number;
    overNinety: number;
    charges: number;
  }>();

  for (const row of detail) {
    const association = String(row.Association || 'Unassigned association');
    const summary = summaries.get(association) ?? {
      current: 0,
      oneToThirty: 0,
      thirtyOneToSixty: 0,
      sixtyOneToNinety: 0,
      overNinety: 0,
      charges: 0,
    };
    const amount = Number(row['Balance due'] ?? 0);
    switch (row['Aging bucket']) {
      case 'current': summary.current += amount; break;
      case '1_30': summary.oneToThirty += amount; break;
      case '31_60': summary.thirtyOneToSixty += amount; break;
      case '61_90': summary.sixtyOneToNinety += amount; break;
      case '90_plus': summary.overNinety += amount; break;
    }
    summary.charges += 1;
    summaries.set(association, summary);
  }

  return [...summaries.entries()].map(([association, summary]) => ({
    Association: association,
    Current: summary.current,
    '1-30 days': summary.oneToThirty,
    '31-60 days': summary.thirtyOneToSixty,
    '61-90 days': summary.sixtyOneToNinety,
    '90+ days': summary.overNinety,
    'Total delinquent': summary.current + summary.oneToThirty + summary.thirtyOneToSixty + summary.sixtyOneToNinety + summary.overNinety,
    'Open charges': summary.charges,
  }));
}

async function bankReconciliationRows(
  db: ServiceClient,
  portfolioId: string,
  associationId: string | null,
  dateTo: string,
  detail: boolean,
) {
  let accountsQuery = db
    .from('bank_accounts')
    .select('id, name, bank_name, association_id, last_reconciliation_date')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .order('name');
  if (associationId) accountsQuery = accountsQuery.eq('association_id', associationId);
  const { data: accounts, error: accountsError } = await accountsQuery;
  if (accountsError) throw accountsError;
  const accountIds = (accounts ?? []).map((account: any) => account.id);
  if (accountIds.length === 0) return [];
  const accountById = new Map((accounts ?? []).map((account: any) => [account.id, account]));

  const { data: reconciliations, error: reconciliationsError } = await db
    .from('bank_reconciliations')
    .select('*')
    .in('bank_account_id', accountIds)
    .lte('statement_date', dateTo)
    .order('statement_date', { ascending: false });
  if (reconciliationsError) throw reconciliationsError;

  if (!detail) {
    return (reconciliations ?? []).map((reconciliation: any) => {
      const account: any = accountById.get(reconciliation.bank_account_id) ?? {};
      return {
        Account: account.name ?? '',
        Bank: account.bank_name ?? '',
        'Statement date': reconciliation.statement_date,
        'Statement balance': Number(reconciliation.statement_balance ?? 0),
        'Book balance': Number(reconciliation.ending_book_balance ?? 0),
        Difference: Number(reconciliation.difference ?? 0),
        Status: reconciliation.status,
        'Completed at': reconciliation.completed_at,
        'Reconciliation ID': reconciliation.id,
      };
    });
  }

  const reconciliationIds = (reconciliations ?? []).map((row: any) => row.id);
  if (reconciliationIds.length === 0) return [];
  const reconciliationById = new Map(
    (reconciliations ?? []).map((row: any) => [row.id, row]),
  );
  const { data: items, error: itemsError } = await db
    .from('bank_reconciliation_items')
    .select('id, reconciliation_id, journal_line_id, description, amount, type, is_cleared, sort_order')
    .in('reconciliation_id', reconciliationIds)
    .order('sort_order');
  if (itemsError) throw itemsError;

  return (items ?? []).map((item: any) => {
    const reconciliation: any = reconciliationById.get(item.reconciliation_id) ?? {};
    const account: any = accountById.get(reconciliation.bank_account_id) ?? {};
    return {
      Account: account.name ?? '',
      Bank: account.bank_name ?? '',
      'Statement date': reconciliation.statement_date,
      Description: item.description ?? '',
      Type: item.type,
      Amount: Number(item.amount ?? 0),
      Cleared: Boolean(item.is_cleared),
      'Journal line ID': item.journal_line_id,
      'Reconciliation ID': item.reconciliation_id,
    };
  });
}

async function budgetVsActualRows(
  db: ServiceClient,
  portfolioId: string,
  associationId: string | null,
  fiscalYear: number,
) {
  let associationsQuery = db
    .from('associations')
    .select('id, name')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .order('name');
  if (associationId) associationsQuery = associationsQuery.eq('id', associationId);
  const { data: associations, error: associationsError } = await associationsQuery;
  if (associationsError) throw associationsError;

  const rows: Record<string, unknown>[] = [];
  for (const association of associations ?? []) {
    const { data, error } = await db
      .from('budget_lines')
      .select('id, category, notes, monthly_amounts, gl_account_id, gl_accounts!inner(number, name, account_type, portfolio_id, association_id)')
      .eq('association_id', association.id)
      .eq('fiscal_year', fiscalYear)
      .eq('gl_accounts.portfolio_id', portfolioId)
      .order('gl_account_id');
    if (error) throw error;
    for (const row of data ?? []) {
      const account = row.gl_accounts;
      if (!account || (account.association_id && account.association_id !== association.id)) {
        throw new Error('Budget account is outside the association scope.');
      }
      const monthlyBudget = row.monthly_amounts ?? [];
      const monthlyActuals: number[] = [];
      for (let month = 1; month <= 12; month += 1) {
        const dateFrom = `${fiscalYear}-${String(month).padStart(2, '0')}-01`;
        const nextMonth = month === 12
          ? `${fiscalYear + 1}-01-01`
          : `${fiscalYear}-${String(month + 1).padStart(2, '0')}-01`;
        const dateTo = new Date(`${nextMonth}T00:00:00.000Z`);
        dateTo.setUTCDate(dateTo.getUTCDate() - 1);
        const totals = await loadLedgerTotals(
          db,
          [row.gl_account_id],
          association.id,
          dateFrom,
          dateTo.toISOString().slice(0, 10),
        );
        monthlyActuals.push(normalBalance(account, totals));
      }
      const annualBudget = monthlyBudget.reduce(
        (sum: number, value: unknown) => sum + Number(value ?? 0),
        0,
      );
      const annualActual = monthlyActuals.reduce((sum, value) => sum + value, 0);
      const annualVariance = annualActual - annualBudget;
      rows.push({
        Association: association.name,
        'Fiscal year': fiscalYear,
        Category: row.category,
        'Account #': account.number,
        Account: account.name,
        Notes: row.notes ?? '',
        'Annual budget': annualBudget,
        'Annual actual': annualActual,
        'Annual variance': annualVariance,
        'Variance %': annualBudget === 0 ? 0 : (annualVariance / annualBudget) * 100,
        'Jan budget': Number(monthlyBudget[0] ?? 0),
        'Jan actual': Number(monthlyActuals[0] ?? 0),
        'Feb budget': Number(monthlyBudget[1] ?? 0),
        'Feb actual': Number(monthlyActuals[1] ?? 0),
        'Mar budget': Number(monthlyBudget[2] ?? 0),
        'Mar actual': Number(monthlyActuals[2] ?? 0),
        'Apr budget': Number(monthlyBudget[3] ?? 0),
        'Apr actual': Number(monthlyActuals[3] ?? 0),
        'May budget': Number(monthlyBudget[4] ?? 0),
        'May actual': Number(monthlyActuals[4] ?? 0),
        'Jun budget': Number(monthlyBudget[5] ?? 0),
        'Jun actual': Number(monthlyActuals[5] ?? 0),
        'Jul budget': Number(monthlyBudget[6] ?? 0),
        'Jul actual': Number(monthlyActuals[6] ?? 0),
        'Aug budget': Number(monthlyBudget[7] ?? 0),
        'Aug actual': Number(monthlyActuals[7] ?? 0),
        'Sep budget': Number(monthlyBudget[8] ?? 0),
        'Sep actual': Number(monthlyActuals[8] ?? 0),
        'Oct budget': Number(monthlyBudget[9] ?? 0),
        'Oct actual': Number(monthlyActuals[9] ?? 0),
        'Nov budget': Number(monthlyBudget[10] ?? 0),
        'Nov actual': Number(monthlyActuals[10] ?? 0),
        'Dec budget': Number(monthlyBudget[11] ?? 0),
        'Dec actual': Number(monthlyActuals[11] ?? 0),
      });
    }
  }
  return rows;
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
  const fiscalYearText = stringParam(rawParams, 'fiscal_year') ?? dateTo.slice(0, 4);
  const fiscalYear = Number.parseInt(fiscalYearText, 10);
  if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2200) {
    throw new Error('Fiscal year must be between 2000 and 2200.');
  }
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
    case 'ar_aging':
      return arAgingRows(db, portfolioId, associationId);
    case 'delinquency_summary':
      return delinquencySummaryRows(db, portfolioId, associationId);
    case 'ap_aging':
    case 'aged_payables':
    case 'aged_payables_summary':
      return apAgingRows(db, portfolioId, associationId, dateTo);
    case 'budget_vs_actual':
    case 'budget_vs_actuals':
    case 'annual_budget_comparative':
      return budgetVsActualRows(db, portfolioId, associationId, fiscalYear);
    case 'bank_reconciliation':
    case 'bank_account_reconciliation':
      return bankReconciliationRows(db, portfolioId, associationId, dateTo, false);
    case 'bank_reconciliation_detail':
      return bankReconciliationRows(db, portfolioId, associationId, dateTo, true);
  }
}
