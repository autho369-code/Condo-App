import { parseAppfolioReport } from './appfolio';

// AppFolio general-ledger exports -> Portier369 shapes. Client-safe (no server
// imports): the import page parses in the browser to preview, and the server
// actions re-validate every account with normalizeGlAccount().
//
//   Chart of Accounts  (Accounting -> GL Accounts -> Export): one flat row per
//     account with Number, Account Name, Account Type, Sub Account of, ...
//   Trial Balance      (Reports -> Trial Balance -> Export as CSV): GL Account
//     ("1150: Operating"), Balance Forward, Debit, Credit, Ending Balance,
//     optional "-> Property" groups and a final Total row.

/** gl_accounts.account_type (enum public.gl_account_type). */
export type PortierGlAccountType =
  | 'asset' | 'cash' | 'accounts_receivable' | 'fixed_asset' | 'liability' | 'accounts_payable' | 'equity'
  | 'income' | 'other_income' | 'expense' | 'cost_of_goods_sold' | 'other_expense' | 'non_operating';

/** gl_accounts.fund_account (enum public.gl_fund_account). */
export type PortierFundAccount = 'operating' | 'reserve' | 'special_assessment';

// AppFolio account type (lower-cased) -> Portier account type.
const ACCOUNT_TYPE_MAP: Record<string, PortierGlAccountType> = {
  cash: 'cash',
  bank: 'cash',
  asset: 'asset',
  'current asset': 'asset',
  'other asset': 'asset',
  'fixed asset': 'fixed_asset',
  'accounts receivable': 'accounts_receivable',
  liability: 'liability',
  'current liability': 'liability',
  'long term liability': 'liability',
  'other liability': 'liability',
  'accounts payable': 'accounts_payable',
  equity: 'equity',
  capital: 'equity',
  "owner's equity": 'equity',
  'owners equity': 'equity',
  income: 'income',
  revenue: 'income',
  'other income': 'other_income',
  expense: 'expense',
  'other expense': 'other_expense',
  'cost of goods sold': 'cost_of_goods_sold',
  'non-operating': 'non_operating',
  'non operating': 'non_operating',
};

/** Portier account type for an AppFolio "Account Type" cell, or null when unknown. */
export function mapAppfolioAccountType(v: string | undefined): PortierGlAccountType | null {
  const key = (v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  return ACCOUNT_TYPE_MAP[key] ?? null;
}

/** "1700 BUILDING ASSETS" / "1700: Building Assets" / "1700" -> "1700". */
export function leadingAccountNumber(v: string | undefined): string | null {
  const m = (v ?? '').trim().match(/^([0-9][0-9.\-]*)\b/);
  return m ? m[1] : null;
}

const truthy = (v: string | undefined) => /^(yes|y|true|1|x|hidden)$/i.test((v ?? '').trim());

function fundAccount(v: string | undefined): PortierFundAccount | null {
  const s = (v ?? '').trim().toLowerCase();
  if (!s || s === 'no' || s === 'none') return null;
  if (s.includes('reserve')) return 'reserve';
  if (s.includes('special')) return 'special_assessment';
  if (s.includes('operating')) return 'operating';
  return null;
}

export type AppfolioGlAccount = {
  /** Spreadsheet line in the export (for error messages). */
  row: string;
  number: number;
  name: string;
  /** The AppFolio type as written, for the preview. */
  appfolio_type: string;
  account_type: PortierGlAccountType;
  /** Parent account number ("Sub Account of"), or null for a top-level account. */
  parent_number: number | null;
  include_on_cash_flow: boolean;
  subject_to_management_fees: boolean;
  fund_account: PortierFundAccount | null;
  /** AppFolio "Hidden" -> inactive in Portier369. */
  active: boolean;
  /** Settings AppFolio has that gl_accounts does not store (offset account, 1099 exclusion, tax authority). */
  not_imported: string[];
};

export const CHART_OF_ACCOUNTS_HEADERS = ['Number', 'Account Name', 'Account Type'] as const;
export const MAX_GL_ACCOUNTS = 2000;

/**
 * Validate one account (the browser's parse result, or anything a caller sends
 * the server action). Returns the cleaned account or a plain-language error.
 */
export function normalizeGlAccount(input: unknown): { account?: AppfolioGlAccount; error?: string } {
  const a = (input ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
  const row = str(a.row) || '?';
  const number = Number(str(a.number));
  if (!Number.isInteger(number) || number < 1000 || number > 9999) {
    return { error: `Line ${row}: account number "${str(a.number)}" must be a whole number from 1000 to 9999.` };
  }
  const name = str(a.name).slice(0, 200);
  if (!name) return { error: `Line ${row} (${number}): no account name.` };
  const type = str(a.account_type);
  if (!(Object.values(ACCOUNT_TYPE_MAP) as string[]).includes(type)) {
    return { error: `Line ${row} (${number}): unknown account type "${type}".` };
  }
  const parentRaw = a.parent_number == null || a.parent_number === '' ? null : Number(str(a.parent_number));
  if (parentRaw !== null && (!Number.isInteger(parentRaw) || parentRaw < 1000 || parentRaw > 9999)) {
    return { error: `Line ${row} (${number}): parent account "${str(a.parent_number)}" is not a 1000-9999 account number.` };
  }
  if (parentRaw === number) return { error: `Line ${row} (${number}): an account cannot be its own parent.` };
  const fund = str(a.fund_account);
  return {
    account: {
      row,
      number,
      name,
      appfolio_type: str(a.appfolio_type).slice(0, 60),
      account_type: type as PortierGlAccountType,
      parent_number: parentRaw,
      include_on_cash_flow: a.include_on_cash_flow === true,
      subject_to_management_fees: a.subject_to_management_fees === true,
      fund_account: (['operating', 'reserve', 'special_assessment'] as string[]).includes(fund) ? (fund as PortierFundAccount) : null,
      active: a.active !== false,
      not_imported: Array.isArray(a.not_imported) ? a.not_imported.map(str).filter(Boolean).slice(0, 10) : [],
    },
  };
}

/** Read AppFolio's Chart of Accounts export. Rows that cannot be imported are listed in `errors`. */
export function parseAppfolioChartOfAccounts(text: string): {
  accounts?: AppfolioGlAccount[];
  errors?: string[];
  error?: string;
} {
  const { report, error } = parseAppfolioReport(text);
  if (!report) return { error };
  const missing = CHART_OF_ACCOUNTS_HEADERS.filter((h) => !report.headers.includes(h));
  if (missing.length) {
    return { error: `This doesn't look like AppFolio's Chart of Accounts export (missing ${missing.join(', ')}).` };
  }
  const accounts: AppfolioGlAccount[] = [];
  const errors: string[] = [];
  const seen = new Set<number>();
  for (const g of report.groups) {
    for (const r of g.rows) {
      const rawNumber = r['Number'];
      if (!rawNumber && !r['Account Name']) continue;
      const appfolioType = r['Account Type'];
      const accountType = mapAppfolioAccountType(appfolioType);
      if (!accountType) {
        errors.push(`Line ${r.row} (${rawNumber || r['Account Name']}): unknown account type "${appfolioType}".`);
        continue;
      }
      const options = r['Options'] ?? '';
      const parentRaw = leadingAccountNumber(r['Sub Account of']);
      const notImported: string[] = [];
      if (r['Offset Account']) notImported.push(`offset account ${r['Offset Account']}`);
      if (/1099/i.test(options)) notImported.push('1099 exclusion');
      if (r['Subject To Tax Authority']) notImported.push(`tax authority ${r['Subject To Tax Authority']}`);
      const { account, error: rowError } = normalizeGlAccount({
        row: r.row,
        number: rawNumber,
        name: r['Account Name'],
        appfolio_type: appfolioType,
        account_type: accountType,
        parent_number: parentRaw,
        include_on_cash_flow: /include on cash flow/i.test(options),
        subject_to_management_fees: /management f/i.test(options),
        fund_account: fundAccount(r['Fund Account']),
        active: !truthy(r['Hidden']),
        not_imported: notImported,
      });
      if (!account) { errors.push(rowError!); continue; }
      if (seen.has(account.number)) {
        errors.push(`Line ${r.row}: account number ${account.number} appears more than once; kept the first.`);
        continue;
      }
      seen.add(account.number);
      accounts.push(account);
    }
  }
  if (!accounts.length && !errors.length) return { error: 'The file has no accounts.' };
  return { accounts, errors: errors.length ? errors : undefined };
}

/* ── Trial Balance ───────────────────────────────────────────────────── */

export type AppfolioTrialBalanceRow = {
  row: string;
  /** AppFolio "-> Property" group the row came from ('' when the report is not grouped). */
  group: string;
  number: number;
  name: string;
  balance_forward: number;
  debit: number;
  credit: number;
  /** Ending balance as AppFolio prints it (debits positive, credits negative). */
  ending: number;
};

export const TRIAL_BALANCE_HEADERS = ['GL Account', 'Ending Balance'] as const;

/** "612,137.24" / "-1,200.00" / "(1,200.00)" / "$5.00" / "" -> number (blank = 0); null when not a number. */
export function parseAmount(v: string | undefined): number | null {
  let s = (v ?? '').trim();
  if (!s) return 0;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  s = s.replace(/[$,\s]/g, '');
  if (s.endsWith('-')) { negative = !negative; s = s.slice(0, -1); }
  if (!/^-?\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round((negative ? -n : n) * 100) / 100;
}

/** "1150: Operating" / "1150 - Operating" / "1150 Operating" -> { number: 1150, name: 'Operating' }. */
export function splitGlAccountCell(v: string | undefined): { number: number; name: string } | null {
  const m = (v ?? '').trim().match(/^(\d{4})(?:\s*[:\-]\s*|\s+)(.*)$|^(\d{4})$/);
  if (!m) return null;
  return { number: Number(m[1] ?? m[3]), name: (m[2] ?? '').trim() };
}

const US_DATE = /(\d{1,2})\/(\d{1,2})\/(\d{4})/g;
const toIso = (m: RegExpMatchArray) => `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;

/** Read AppFolio's Trial Balance export. */
export function parseAppfolioTrialBalance(text: string): {
  rows?: AppfolioTrialBalanceRow[];
  /** Property groups in the export (more than one when it was run for several associations). */
  groups?: string[];
  /** End of the report's date range, when the export carries its title lines. */
  asOf?: string;
  basis?: 'cash' | 'accrual';
  /** Lines that are not account rows (headings, subtotals) or have unreadable amounts. */
  ignored?: string[];
  error?: string;
} {
  const clean = text.replace(/^﻿/, '');
  const lines = clean.split(/\r?\n/);
  // Exports can start with title lines (report name, Date Range, Accounting
  // Basis) before the column header; read those and start at the header.
  const headerAt = lines.findIndex((l) => /(^|,)\s*"?GL Account"?\s*(,|$)/i.test(l));
  if (headerAt < 0) {
    return { error: `This doesn't look like AppFolio's Trial Balance export (missing ${TRIAL_BALANCE_HEADERS.join(', ')}).` };
  }
  const preamble = lines.slice(0, headerAt).join('\n');
  let asOf: string | undefined;
  const dates = [...preamble.matchAll(US_DATE)];
  if (dates.length) asOf = toIso(dates[dates.length - 1]);
  const basisMatch = preamble.match(/basis\W*(cash|accrual)\b/i) ?? preamble.match(/\b(cash|accrual)\b/i);
  const basis = basisMatch ? (basisMatch[1].toLowerCase() as 'cash' | 'accrual') : undefined;

  const { report, error } = parseAppfolioReport(lines.slice(headerAt).join('\n'));
  if (!report) return { error };
  const missing = TRIAL_BALANCE_HEADERS.filter((h) => !report.headers.includes(h));
  if (missing.length) {
    return { error: `This doesn't look like AppFolio's Trial Balance export (missing ${missing.join(', ')}).` };
  }
  const offset = headerAt; // report rows count from the header line
  const rows: AppfolioTrialBalanceRow[] = [];
  const ignored: string[] = [];
  for (const g of report.groups) {
    for (const r of g.rows) {
      const line = String(Number(r.row) + offset);
      const acct = splitGlAccountCell(r['GL Account']);
      if (!acct) { if (r['GL Account']) ignored.push(`Line ${line}: "${r['GL Account']}"`); continue; }
      const bf = parseAmount(r['Balance Forward']);
      const debit = parseAmount(r['Debit']);
      const credit = parseAmount(r['Credit']);
      const ending = parseAmount(r['Ending Balance']);
      if (bf === null || debit === null || credit === null || ending === null) {
        ignored.push(`Line ${line} (${acct.number}): an amount could not be read.`);
        continue;
      }
      rows.push({ row: line, group: g.name, number: acct.number, name: acct.name, balance_forward: bf, debit, credit, ending });
    }
  }
  if (!rows.length) return { error: 'The file has no GL account rows.' };
  const groups = [...new Set(rows.map((r) => r.group))];
  return { rows, groups, asOf, basis, ignored: ignored.length ? ignored : undefined };
}
