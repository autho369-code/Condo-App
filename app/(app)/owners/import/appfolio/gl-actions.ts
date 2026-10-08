'use server';

// AppFolio general-ledger imports:
//   importAppfolioChartOfAccounts — adds AppFolio's GL accounts to the
//     company-wide chart of accounts (gl_accounts). Never overwrites: an
//     account whose number is already in the company's chart is skipped.
//   tieOutAppfolioTrialBalance    — READ-ONLY comparison of AppFolio's Trial
//     Balance against one association's posted ledger, or every association
//     combined (an AppFolio trial balance run for all properties, ungrouped).
//
// Both run through the signed-in finance user's session client, so RLS
// applies (gl_accounts_finance_all = can_manage_finance(portfolio_id));
// guard_gl_account_change() re-checks numbers, parent type and association.
import { revalidatePath } from 'next/cache';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { ledgerTotalsByAccount } from '@/lib/finance/totals';
import { fiscalWindow, fiscalYearFor } from '@/lib/budget/fiscal';
import { glWriteError } from '@/lib/gl/accounts';
import { MAX_GL_ACCOUNTS, TIE_OUT_ALL_ASSOCIATIONS, normalizeGlAccount, type AppfolioGlAccount } from '@/lib/imports/appfolio-gl';

export type GlImportSummary = { imported: number; skipped: number; errors?: string[]; notes?: string[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type ExistingAccount = { id: string; number: number; account_type: string; association_id: string | null };

export async function importAppfolioChartOfAccounts(accounts: AppfolioGlAccount[]): Promise<GlImportSummary> {
  const me = await requireFinanceStaff();
  const portfolioId: string | undefined = me.portfolio?.id;
  if (!portfolioId) return { imported: 0, skipped: 0, errors: ['Your account is not linked to a company.'] };
  if (!Array.isArray(accounts) || accounts.length === 0) return { imported: 0, skipped: 0, errors: ['The file has no accounts.'] };
  if (accounts.length > MAX_GL_ACCOUNTS) {
    return { imported: 0, skipped: accounts.length, errors: [`Import at most ${MAX_GL_ACCOUNTS} accounts at a time.`] };
  }

  const supabase = await createClient();
  const db = supabase as any;
  const errors: string[] = [];
  const notes: string[] = [];
  let skipped = 0;

  // Re-validate everything the browser sent.
  const incoming: AppfolioGlAccount[] = [];
  const seen = new Set<number>();
  for (const raw of accounts) {
    const { account, error } = normalizeGlAccount(raw);
    if (!account) { skipped++; errors.push(error!); continue; }
    if (seen.has(account.number)) { skipped++; errors.push(`Line ${account.row}: account number ${account.number} appears more than once.`); continue; }
    seen.add(account.number);
    incoming.push(account);
  }

  // Every account number already in the company's chart, company-wide or an
  // association's own: the number guard rejects reusing either.
  const { rows: existingRows, error: existingErr } = await fetchAllRows<ExistingAccount>(() => db
    .from('gl_accounts').select('id, number, account_type, association_id')
    .eq('portfolio_id', portfolioId).order('number').order('id'));
  if (existingErr) return { imported: 0, skipped: accounts.length, errors: [`Could not load the chart of accounts: ${existingErr}`] };
  const usedNumbers = new Set(existingRows.map((a) => Number(a.number)));
  // Parents a company-wide account may sit under: company-wide accounts only.
  const parents = new Map<number, { id: string; account_type: string }>();
  for (const a of existingRows) if (!a.association_id) parents.set(Number(a.number), { id: a.id, account_type: a.account_type });

  let pending: AppfolioGlAccount[] = [];
  for (const a of incoming) {
    if (usedNumbers.has(a.number)) { skipped++; continue; }
    pending.push(a);
  }
  const alreadyThere = incoming.length - pending.length;
  if (alreadyThere > 0) notes.push(`${alreadyThere} account${alreadyThere === 1 ? ' was' : 's were'} already in the chart of accounts and left unchanged.`);

  const inFile = new Map(pending.map((a) => [a.number, a]));
  const row = (a: AppfolioGlAccount, parentId: string | null) => ({
    portfolio_id: portfolioId,
    association_id: null,
    number: a.number,
    name: a.name,
    account_type: a.account_type,
    sub_account_of_id: parentId,
    include_on_cash_flow: a.include_on_cash_flow,
    subject_to_management_fees: a.subject_to_management_fees,
    fund_account: a.fund_account,
    active: a.active,
  });

  let imported = 0;
  // Insert level by level so each parent exists before its sub-accounts.
  for (let pass = 0; pending.length > 0 && pass < 20; pass++) {
    const ready: Array<ReturnType<typeof row> & { _a: AppfolioGlAccount }> = [];
    const waiting: AppfolioGlAccount[] = [];
    for (const a of pending) {
      let parentId: string | null = null;
      if (a.parent_number !== null) {
        const parent = parents.get(a.parent_number);
        if (!parent) {
          if (inFile.has(a.parent_number)) { waiting.push(a); continue; }
          notes.push(`${a.number} ${a.name}: parent ${a.parent_number} is not in the chart of accounts; imported as a top-level account.`);
        } else if (parent.account_type !== a.account_type) {
          // Portier requires a sub-account to share its parent's type.
          notes.push(`${a.number} ${a.name}: parent ${a.parent_number} is a different account type; imported as a top-level account.`);
        } else {
          parentId = parent.id;
        }
      }
      ready.push({ ...row(a, parentId), _a: a });
    }
    if (ready.length === 0) {
      // Only cycles remain (an account under its own sub-account).
      for (const a of waiting) { skipped++; errors.push(`Line ${a.row} (${a.number}): its parent chain loops back to itself.`); }
      pending = [];
      break;
    }

    const insertRows = ready.map(({ _a, ...r }) => r);
    const { data, error } = await db.from('gl_accounts').insert(insertRows).select('id, number, account_type');
    if (!error) {
      for (const r of (data ?? []) as Array<{ id: string; number: number; account_type: string }>) {
        parents.set(Number(r.number), { id: r.id, account_type: r.account_type });
      }
      imported += (data ?? []).length;
    } else {
      // One bad row fails the whole batch: retry one at a time to keep the rest.
      for (const r of ready) {
        const { _a, ...insertRow } = r;
        const { data: one, error: oneErr } = await db.from('gl_accounts').insert(insertRow).select('id, number, account_type').single();
        if (oneErr || !one) { skipped++; errors.push(`Line ${_a.row} (${_a.number} ${_a.name}): ${glWriteError(oneErr?.message ?? 'not saved')}`); continue; }
        parents.set(Number(one.number), { id: one.id, account_type: one.account_type });
        imported++;
      }
    }
    // Everything in `ready` has been tried; sub-accounts whose parent failed
    // stop waiting and go in as top-level accounts on the next pass.
    for (const r of ready) inFile.delete(r._a.number);
    pending = waiting;
  }
  for (const a of pending) { skipped++; errors.push(`Line ${a.row} (${a.number}): nested too deeply under other sub-accounts; not imported.`); }

  if (imported > 0) revalidatePath('/gl-accounts');
  return {
    imported,
    skipped,
    errors: errors.length ? errors : undefined,
    notes: notes.length ? notes : undefined,
  };
}

/* ── Trial balance tie-out (read-only) ────────────────────────────────── */

export type TieOutInputRow = { number: number; name: string; ending: number };

export type TieOutLine = {
  number: number;
  name: string;
  account_type: string | null;
  appfolio: number | null;
  portier: number | null;
  difference: number;
  status: 'match' | 'different' | 'not_in_portier' | 'not_in_appfolio';
};

export type TieOutResult = {
  error?: string;
  association?: string;
  asOf?: string;
  /** First day of the fiscal year income and expense balances are counted from (null = all time). */
  incomeFrom?: string | null;
  lines?: TieOutLine[];
  totals?: { appfolio: number; portier: number; difference: number; matched: number; different: number; notInPortier: number; notInAppfolio: number };
  /** Net income posted before incomeFrom (debit-positive): AppFolio shows it in retained earnings. */
  priorYearsNet?: number;
  /**
   * AppFolio's "Calculated Prior Years Retained Earnings" line against the
   * ledger's net income before incomeFrom. Included in `totals`.
   */
  priorYears?: { appfolio: number | null; portier: number; difference: number };
};

export type TieOutOptions = {
  incomeBasis?: 'fiscal_year' | 'all_time';
  /** AppFolio's "Calculated Prior Years Retained Earnings" ending balance (debit-positive). */
  priorYearsRetainedEarnings?: number | null;
};

const INCOME_STATEMENT_TYPES = new Set(['income', 'other_income', 'expense', 'cost_of_goods_sold', 'other_expense', 'non_operating']);
const MAX_TIE_OUT_ROWS = 5000;
const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * Compare AppFolio's trial balance ending balances with the posted ledger as
 * of `asOf`, for one association or (associationId = TIE_OUT_ALL_ASSOCIATIONS) all of
 * the company's associations combined. Balances are debit-positive on both
 * sides: AppFolio's export prints debits positive and credits negative
 * (liabilities, equity and income show as negatives; the ending balances plus
 * "Calculated Prior Years Retained Earnings" sum to 0.00). Income and expense
 * accounts count from the start of the fiscal year unless `incomeBasis` is
 * 'all_time'. Reads only; writes nothing.
 */
export async function tieOutAppfolioTrialBalance(
  associationId: string,
  asOf: string,
  rows: TieOutInputRow[],
  options: TieOutOptions = {},
): Promise<TieOutResult> {
  const me = await requireFinanceStaff();
  const portfolioId: string | undefined = me.portfolio?.id;
  if (!portfolioId) return { error: 'Your account is not linked to a company.' };
  const combined = associationId === TIE_OUT_ALL_ASSOCIATIONS;
  if (typeof associationId !== 'string' || (!combined && !UUID.test(associationId))) return { error: 'Choose an association.' };
  if (typeof asOf !== 'string' || !ISO_DATE.test(asOf) || Number.isNaN(Date.parse(`${asOf}T00:00:00Z`))) return { error: 'Choose an as-of date.' };
  if (!Array.isArray(rows) || rows.length === 0) return { error: 'The trial balance has no rows.' };
  if (rows.length > MAX_TIE_OUT_ROWS) return { error: `Compare at most ${MAX_TIE_OUT_ROWS} accounts at a time.` };

  const supabase = await createClient();
  const db = supabase as any;

  type AssociationRow = { id: string; name: string; portfolio_id: string; fiscal_year_start: number | null };
  let associations: AssociationRow[];
  if (combined) {
    const { rows: all, error: allErr } = await fetchAllRows<AssociationRow>(() => db
      .from('associations').select('id, name, portfolio_id, fiscal_year_start')
      .eq('portfolio_id', portfolioId).order('name').order('id'));
    if (allErr) return { error: `Could not load the associations: ${allErr}` };
    if (all.length === 0) return { error: 'Your company has no associations yet.' };
    associations = all;
  } else {
    const { data: association, error: assocErr } = await db
      .from('associations').select('id, name, portfolio_id, fiscal_year_start').eq('id', associationId).maybeSingle();
    if (assocErr) return { error: `Could not check the association: ${assocErr.message}` };
    if (!association || association.portfolio_id !== portfolioId) return { error: 'That association was not found or is outside your access.' };
    associations = [association];
  }
  const associationIds = associations.map((a) => a.id);
  const label = combined ? `All associations (${associations.length})` : associations[0].name;

  // AppFolio side: one balance per account number (summed if repeated).
  const appfolio = new Map<number, { name: string; ending: number }>();
  for (const r of rows) {
    const number = Number(r?.number);
    const ending = Number(r?.ending);
    if (!Number.isInteger(number) || !Number.isFinite(ending)) continue;
    const name = typeof r?.name === 'string' ? r.name.slice(0, 200) : '';
    const prev = appfolio.get(number);
    appfolio.set(number, { name: prev?.name || name, ending: cents((prev?.ending ?? 0) + ending) });
  }
  if (appfolio.size === 0) return { error: 'The trial balance has no readable account rows.' };

  // Accounts the association(s) can post to: company-wide plus their own
  // (every account in the company when combined).
  const { rows: accounts, error: accountsErr } = await fetchAllRows<{ id: string; number: number; name: string; account_type: string }>(() => {
    let q = db.from('gl_accounts').select('id, number, name, account_type').eq('portfolio_id', portfolioId);
    if (!combined) q = q.or(`association_id.is.null,association_id.eq.${associationId}`);
    return q.order('number').order('id');
  });
  if (accountsErr) return { error: `Could not load the chart of accounts: ${accountsErr}` };

  let incomeFrom: string | null = null;
  if ((options.incomeBasis ?? 'fiscal_year') === 'fiscal_year') {
    const [y, m, d] = asOf.split('-').map(Number);
    const starts = new Set(associations.map((a) => {
      const fy = a.fiscal_year_start;
      return fiscalWindow(fiscalYearFor(new Date(y, m - 1, d), fy), fy).start;
    }));
    if (starts.size > 1) {
      return { error: 'Your associations have different fiscal years, so their income and expense cannot be combined from one start date. Export the trial balance one property at a time, or compare all-time balances.' };
    }
    incomeFrom = [...starts][0];
  }

  let allTime: Record<string, { debit: number; credit: number }>;
  let beforeFiscal: Record<string, { debit: number; credit: number }> = {};
  try {
    allTime = await ledgerTotalsByAccount(db, { portfolioId, associationIds, to: asOf });
    if (incomeFrom) {
      const [y, m, d] = incomeFrom.split('-').map(Number);
      const dayBefore = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
      beforeFiscal = await ledgerTotalsByAccount(db, {
        portfolioId, associationIds, to: dayBefore, accountTypes: [...INCOME_STATEMENT_TYPES],
      });
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not load ledger balances.' };
  }

  let priorYearsNet = 0;
  const portier = new Map<number, { name: string; account_type: string; balance: number }>();
  for (const a of accounts) {
    const t = allTime[a.id] ?? { debit: 0, credit: 0 };
    let balance = t.debit - t.credit;
    if (incomeFrom && INCOME_STATEMENT_TYPES.has(a.account_type)) {
      const before = beforeFiscal[a.id] ?? { debit: 0, credit: 0 };
      balance -= before.debit - before.credit;
      priorYearsNet += before.debit - before.credit;
    }
    // Association-own accounts can share a number across associations; combined, they add up.
    const prev = portier.get(Number(a.number));
    portier.set(Number(a.number), {
      name: prev?.name ?? a.name,
      account_type: prev?.account_type ?? a.account_type,
      balance: cents((prev?.balance ?? 0) + balance),
    });
  }

  const lines: TieOutLine[] = [];
  for (const [number, af] of appfolio) {
    const p = portier.get(number);
    if (!p) {
      lines.push({ number, name: af.name, account_type: null, appfolio: af.ending, portier: null, difference: af.ending, status: af.ending === 0 ? 'match' : 'not_in_portier' });
      continue;
    }
    const difference = cents(af.ending - p.balance);
    lines.push({ number, name: af.name || p.name, account_type: p.account_type, appfolio: af.ending, portier: p.balance, difference, status: difference === 0 ? 'match' : 'different' });
  }
  for (const [number, p] of portier) {
    if (appfolio.has(number) || p.balance === 0) continue;
    lines.push({ number, name: p.name, account_type: p.account_type, appfolio: null, portier: p.balance, difference: cents(-p.balance), status: 'not_in_appfolio' });
  }
  lines.sort((a, b) => a.number - b.number);

  // Prior fiscal years' net income: AppFolio prints it as its own line with
  // no account number; the ledger's equivalent is income and expense posted
  // before incomeFrom (zero when comparing all-time balances).
  const pyRaw = options.priorYearsRetainedEarnings;
  const pyAppfolio = typeof pyRaw === 'number' && Number.isFinite(pyRaw) ? cents(pyRaw) : null;
  const pyPortier = cents(priorYearsNet);
  const priorYears = pyAppfolio !== null || pyPortier !== 0
    ? { appfolio: pyAppfolio, portier: pyPortier, difference: cents((pyAppfolio ?? 0) - pyPortier) }
    : undefined;

  const sum = (f: (l: TieOutLine) => number) => cents(lines.reduce((s, l) => s + f(l), 0));
  return {
    association: label,
    asOf,
    incomeFrom,
    lines,
    totals: {
      appfolio: cents(sum((l) => l.appfolio ?? 0) + (priorYears?.appfolio ?? 0)),
      portier: cents(sum((l) => l.portier ?? 0) + (priorYears?.portier ?? 0)),
      difference: cents(sum((l) => l.difference) + (priorYears?.difference ?? 0)),
      matched: lines.filter((l) => l.status === 'match').length,
      different: lines.filter((l) => l.status === 'different').length,
      notInPortier: lines.filter((l) => l.status === 'not_in_portier').length,
      notInAppfolio: lines.filter((l) => l.status === 'not_in_appfolio').length,
    },
    priorYearsNet: pyPortier,
    priorYears,
  };
}
