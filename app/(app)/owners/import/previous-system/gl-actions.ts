'use server';

// AppFolio general-ledger imports:
//   importAppfolioChartOfAccounts — adds AppFolio's GL accounts to the
//     company-wide chart of accounts (gl_accounts). Never overwrites: an
//     account whose number is already in the company's chart is skipped.
//   tieOutAppfolioTrialBalance    — READ-ONLY comparison of AppFolio's Trial
//     Balance against one association's posted ledger, or every association
//     combined (an AppFolio trial balance run for all properties, ungrouped).
//   postOpeningBalancesFromTrialBalance — posts one opening journal entry for
//     one association: the tie-out's differences, through the journal entry
//     upload RPC (import_journal_entry_batch).
//
// All run through the signed-in finance user's session client, so RLS
// applies (gl_accounts_finance_all = can_manage_finance(portfolio_id));
// guard_gl_account_change() re-checks numbers, parent type and association.
import { revalidatePath } from 'next/cache';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { withImportLock } from '@/lib/imports/import-lock';
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

  // One chart import per company at a time: the existing-account snapshot and the
  // level-by-level inserts must not interleave with another run (parents would be lost).
  try {
    return await withImportLock(db, portfolioId, 'appfolio_chart', async () => {
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

        // Batches of 500: PostgREST returns at most 1,000 rows, and every inserted id is
        // needed as a parent for the next pass.
        for (let b = 0; b < ready.length; b += 500) {
          const chunk = ready.slice(b, b + 500);
          const insertRows = chunk.map(({ _a, ...r }) => r);
          const { data, error } = await db.from('gl_accounts').insert(insertRows).select('id, number, account_type');
          if (!error) {
            for (const r of (data ?? []) as Array<{ id: string; number: number; account_type: string }>) {
              parents.set(Number(r.number), { id: r.id, account_type: r.account_type });
            }
            imported += (data ?? []).length;
          } else {
            // One bad row fails the whole batch: retry one at a time to keep the rest.
            for (const r of chunk) {
              const { _a, ...insertRow } = r;
              const { data: one, error: oneErr } = await db.from('gl_accounts').insert(insertRow).select('id, number, account_type').single();
              if (oneErr || !one) { skipped++; errors.push(`Line ${_a.row} (${_a.number} ${_a.name}): ${glWriteError(oneErr?.message ?? 'not saved')}`); continue; }
              parents.set(Number(one.number), { id: one.id, account_type: one.account_type });
              imported++;
            }
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
    });
  } catch (e) {
    return { imported: 0, skipped: accounts.length, errors: [e instanceof Error ? e.message : 'The import failed. Try again.'] };
  }
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
  /** False when every ledger account with this number is hidden (inactive). */
  active?: boolean;
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
   * ledger's net income before incomeFrom plus the ledger's retained-earnings
   * accounts that are not in the file (`accounts`, e.g. where an opening
   * journal put that balance). Included in `totals`.
   */
  priorYears?: {
    appfolio: number | null;
    portier: number;
    difference: number;
    accounts?: Array<{ number: number; name: string; balance: number }>;
  };
  /**
   * One association only: active equity accounts named as prior years'
   * retained earnings that the file does not list, i.e. accounts the tie-out
   * counts on the prior-years line. Opening balances may post that line only
   * to one of these, so a second run finds nothing to post.
   */
  equityAccounts?: Array<{ id: string; number: number; name: string }>;
};

export type TieOutOptions = {
  incomeBasis?: 'fiscal_year' | 'all_time';
  /** AppFolio's "Calculated Prior Years Retained Earnings" ending balance (debit-positive). */
  priorYearsRetainedEarnings?: number | null;
};

const INCOME_STATEMENT_TYPES = new Set(['income', 'other_income', 'expense', 'cost_of_goods_sold', 'other_expense', 'non_operating']);
const MAX_TIE_OUT_ROWS = 5000;
const cents = (n: number) => Math.round(n * 100) / 100;
// A prior years' retained-earnings account is counted on the prior-years
// line only when its name says so: "prior" or "previous" ("Prior FY Retained
// Earnings") with nothing of this year's, or exactly "Retained Earnings" and
// no other word. Any other wording ("CY", "This FY", "2026", ...) keeps the
// account on its own row, so a name we cannot read shows as a difference
// instead of hiding a balance. Any separator between words.
const PRIOR_RETAINED_EARNINGS = /retained[\W_]*earnings/i;
const SAYS_PRIOR = /(^|[\W_])(prior|previous)([\W_]|$)/i;
const SAYS_THIS_YEAR = /(^|[\W_])(current|this|ytd|cy)([\W_]|$)/i;
const isPriorRetainedEarnings = (name: string) => {
  if (!PRIOR_RETAINED_EARNINGS.test(name) || SAYS_THIS_YEAR.test(name)) return false;
  if (SAYS_PRIOR.test(name)) return true;
  return name.replace(PRIOR_RETAINED_EARNINGS, '').replace(/[\W_]+/g, '') === '';
};

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
      .eq('portfolio_id', portfolioId).is('archived_at', null).order('name').order('id'));
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
  const { rows: accounts, error: accountsErr } = await fetchAllRows<{ id: string; number: number; name: string; account_type: string; active: boolean }>(() => {
    let q = db.from('gl_accounts').select('id, number, name, account_type, active').eq('portfolio_id', portfolioId);
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
  // `retained`/`retainedName`: the part of the balance on prior years'
  // retained-earnings accounts, classified per account before accounts that
  // share a number (association-own, combined view) are added up.
  const portier = new Map<number, { name: string; account_type: string; balance: number; retained: number; retainedName: string | null; otherName: string | null; otherType: string | null; active: boolean }>();
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
    const isRetained = a.account_type === 'equity' && isPriorRetainedEarnings(a.name);
    portier.set(Number(a.number), {
      name: prev?.name ?? a.name,
      account_type: prev?.account_type ?? a.account_type,
      balance: cents((prev?.balance ?? 0) + balance),
      retained: cents((prev?.retained ?? 0) + (isRetained ? balance : 0)),
      retainedName: prev?.retainedName ?? (isRetained ? a.name : null),
      otherName: prev?.otherName ?? (isRetained ? null : a.name),
      otherType: prev?.otherType ?? (isRetained ? null : a.account_type),
      active: Boolean(prev?.active) || a.active !== false,
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
    lines.push({ number, name: af.name || p.name, account_type: p.account_type, appfolio: af.ending, portier: p.balance, difference, status: difference === 0 ? 'match' : 'different', active: p.active });
  }
  // The file's prior-years line has no account number. A ledger
  // retained-earnings account the file does not list holds the same balance
  // (an opening journal puts it there), so it is counted on that line
  // instead of being flagged as missing from the file.
  const pyRaw = options.priorYearsRetainedEarnings;
  const pyAppfolio = typeof pyRaw === 'number' && Number.isFinite(pyRaw) ? cents(pyRaw) : null;
  const retainedAccounts: Array<{ number: number; name: string; balance: number }> = [];
  for (const [number, p] of portier) {
    if (appfolio.has(number)) continue;
    let rest = p.balance;
    let name = p.name;
    let accountType = p.account_type;
    if (pyAppfolio !== null && p.retainedName && p.retained !== 0) {
      retainedAccounts.push({ number, name: p.retainedName, balance: p.retained });
      rest = cents(p.balance - p.retained);
      name = p.otherName ?? p.name;
      accountType = p.otherType ?? p.account_type;
    }
    if (rest === 0) continue;
    lines.push({ number, name, account_type: accountType, appfolio: null, portier: rest, difference: cents(-rest), status: 'not_in_appfolio', active: p.active });
  }
  lines.sort((a, b) => a.number - b.number);

  // Prior fiscal years' net income: AppFolio prints it as its own line with
  // no account number; the ledger's equivalent is income and expense posted
  // before incomeFrom (zero when comparing all-time balances) plus the
  // retained-earnings accounts above.
  const pyPortier = cents(priorYearsNet + retainedAccounts.reduce((s, a) => s + a.balance, 0));
  const priorYears = pyAppfolio !== null || pyPortier !== 0
    ? {
        appfolio: pyAppfolio,
        portier: pyPortier,
        difference: cents((pyAppfolio ?? 0) - pyPortier),
        ...(retainedAccounts.length ? { accounts: retainedAccounts } : {}),
      }
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
    priorYearsNet: cents(priorYearsNet),
    priorYears,
    ...(combined ? {} : {
      // By account id: a number can belong to more than one account.
      equityAccounts: accounts
        .filter((a) => a.account_type === 'equity' && a.active !== false && isPriorRetainedEarnings(a.name) && !appfolio.has(Number(a.number)))
        .map((a) => ({ id: a.id, number: Number(a.number), name: a.name })),
    }),
  };
}

/* ── Opening balances from the trial balance ──────────────────────────── */

export type OpeningBalancesResult = {
  ok: boolean;
  message: string;
  errors?: string[];
  /** Lines posted (0 when every account already ties out). */
  lines?: number;
  total?: number;
};

export type OpeningBalancesOptions = TieOutOptions & {
  /** Equity account (id) for prior years' retained earnings, when the ledger has none the tie-out paired. */
  retainedEarningsAccountId?: string | null;
  /** The file's accounting basis: read from the file, or confirmed by the user when the file does not say. */
  basis?: 'cash' | 'accrual';
  /** Account or prior-years lines of this property whose amount could not be read (from the browser's parse). */
  unreadableRows?: boolean;
};

const OPENING_MEMO = 'Opening balance from previous system trial balance';
const fmtMoney = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Post one journal entry, dated `asOf`, that brings each account of one
 * association to the trial balance's ending balance: the tie-out's
 * differences, recomputed here (never taken from the browser), with prior
 * years' retained earnings posted to an equity account. Goes through the
 * journal entry upload (import_journal_entry_batch), so its validation and
 * permission checks apply. Once posted, a second run finds nothing to post.
 */
export async function postOpeningBalancesFromTrialBalance(
  associationId: string,
  asOf: string,
  rows: TieOutInputRow[],
  options: OpeningBalancesOptions = {},
): Promise<OpeningBalancesResult> {
  const me = await requireFinanceStaff();
  const portfolioId: string | undefined = me.portfolio?.id;
  if (!portfolioId) return { ok: false, message: 'Your account is not linked to a company.' };
  if (associationId === TIE_OUT_ALL_ASSOCIATIONS || typeof associationId !== 'string' || !UUID.test(associationId)) {
    return { ok: false, message: 'Opening balances post to one association. Choose the association the trial balance is for.' };
  }
  if (options.basis !== 'accrual') {
    return {
      ok: false,
      message: options.basis === 'cash'
        ? 'This is a cash-basis trial balance. Export it on the accrual basis to post opening balances.'
        : 'Confirm the trial balance is on the accrual basis before posting opening balances.',
    };
  }
  if (options.unreadableRows) {
    return { ok: false, message: 'Some account lines in the file have an amount that could not be read, so its balances are incomplete. Fix the file, then post.' };
  }
  const db = (await createClient()) as any;
  try {
    // The open-balance import writes the same accounts: hold its lock too, so
    // nothing lands between reading the ledger and posting.
    return await withImportLock(db, associationId, 'opening_balances', () => withImportLock(db, associationId, 'appfolio_receivables', async () => {
      // One opening entry per association. The tie-out only reads up to the
      // as-of date, so a run with an earlier date would not see an entry
      // already posted and would post the opening balances again.
      const { data: existing, error: existingErr } = await db
        .from('journal_lines').select('id').eq('association_id', associationId).eq('memo', OPENING_MEMO).limit(1);
      if (existingErr) return { ok: false, message: `Could not check for an earlier opening entry: ${existingErr.message}` };
      if (existing?.length) {
        return { ok: false, message: 'This association already has an opening balance entry. Make any corrections with a journal entry.' };
      }

      // Recompute against the ledger now; this also re-checks the association is the caller's.
      const tie = await tieOutAppfolioTrialBalance(associationId, asOf, rows, {
        incomeBasis: options.incomeBasis, priorYearsRetainedEarnings: options.priorYearsRetainedEarnings,
      });
      if (tie.error || !tie.lines) return { ok: false, message: tie.error ?? 'Could not compare the trial balance.' };
      // A file with a prior-years line has closed earlier years' income into
      // it; an all-time ledger still has that income in the income and
      // expense accounts, and posting their differences would move it into
      // this year.
      if (tie.incomeFrom === null && tie.priorYears?.appfolio != null) {
        return { ok: false, message: 'The file carries prior years\' retained earnings, so compare income and expense from the start of the fiscal year, not all time, before posting.' };
      }

      const missing = tie.lines.filter((l) => l.status === 'not_in_portier');
      if (missing.length) {
        return {
          ok: false,
          message: 'Some accounts in the file are not in your chart of accounts. Import the chart of accounts first, then post again.',
          errors: missing.map((l) => `${l.number} ${l.name}`),
        };
      }

      // The file is the opening position; a ledger balance it does not list
      // (something already posted here) is not ours to reverse.
      const ledgerOnly = tie.lines.filter((l) => l.status === 'not_in_appfolio');
      if (ledgerOnly.length) {
        return {
          ok: false,
          message: 'Your ledger has balances on accounts the file does not list. Check these first; opening balances are posted only when every ledger balance is in the file.',
          errors: ledgerOnly.map((l) => `${l.number} ${l.name}: ${fmtMoney(l.portier ?? 0)}`),
        };
      }
      const hidden = tie.lines.filter((l) => l.difference !== 0 && l.active === false);
      if (hidden.length) {
        return {
          ok: false,
          message: 'Some accounts that need an opening balance are hidden in your chart of accounts. Show them again, then post.',
          errors: hidden.map((l) => `${l.number} ${l.name}`),
        };
      }

      // Keyed by what the upload resolves: an account number (the file's own
      // rows), or an account id for prior years' retained earnings, so that
      // line reaches exactly the equity account chosen even when another
      // account shares its number.
      const amounts = new Map<string, { number: number; amount: number }>();
      const add = (gl: string, number: number, amount: number) =>
        amounts.set(gl, { number, amount: cents((amounts.get(gl)?.amount ?? 0) + amount) });
      for (const l of tie.lines) if (l.difference !== 0) add(String(l.number), l.number, l.difference);

      const py = tie.priorYears;
      if (py && py.difference !== 0) {
        if (py.appfolio === null) {
          return { ok: false, message: 'Your ledger has income and expense from before this fiscal year, and the file has no prior years\' retained earnings line to match it. Compare all-time balances instead, or check the file.' };
        }
        const paired = py.accounts ?? [];
        // Only an active account can take the line (the upload posts to active accounts only).
        const choices = tie.equityAccounts ?? [];
        const pairedChoices = paired.length === 1 ? choices.filter((a) => a.number === paired[0].number) : [];
        let target = pairedChoices.length === 1 ? pairedChoices[0] : null;
        if (target === null) {
          if (choices.length === 0) {
            return { ok: false, message: 'Add an equity account named "Prior Year Retained Earnings" (or "Retained Earnings") to your chart of accounts for prior years\' retained earnings, then post again.' };
          }
          target = choices.find((a) => a.id === options.retainedEarningsAccountId) ?? null;
          if (!target) return { ok: false, message: 'Choose the equity account for prior years\' retained earnings.' };
        }
        add(target.id, target.number, py.difference);
      }

      const posting = [...amounts].map(([gl, v]) => [gl, v.amount, v.number] as const)
        .filter(([, a]) => a !== 0).sort((a, b) => a[2] - b[2]);
      if (posting.length === 0) return { ok: true, message: 'Nothing to post: every account already matches the file.', lines: 0, total: 0 };
      const debits = cents(posting.reduce((s, [, a]) => s + (a > 0 ? a : 0), 0));
      const credits = cents(posting.reduce((s, [, a]) => s + (a < 0 ? -a : 0), 0));
      if (debits !== credits) {
        return { ok: false, message: `The differences do not balance (debits ${fmtMoney(debits)}, credits ${fmtMoney(credits)}). Check that the file balances and that it is for this association only.` };
      }

      const entry = `OPENING-${asOf}`;
      const { data, error } = await db.rpc('import_journal_entry_batch', {
        p_name: `Opening balances ${tie.association ?? ''} ${asOf}`.replace(/\s+/g, ' ').trim(),
        p_rows: posting.map(([gl, a], i) => ({
          row: String(i + 1),
          entry,
          date: asOf,
          association: associationId,
          gl,
          debit: a > 0 ? a.toFixed(2) : '',
          credit: a < 0 ? (-a).toFixed(2) : '',
          memo: OPENING_MEMO,
        })),
      });
      if (error) return { ok: false, message: `Nothing was posted: ${error.message}` };
      if (!data?.ok) {
        return { ok: false, message: `Nothing was posted — fix ${data?.error_count ?? 'the'} problem${data?.error_count === 1 ? '' : 's'} and try again.`, errors: data?.errors ?? [] };
      }
      revalidatePath('/journal-entries');
      return { ok: true, message: `Posted one opening entry with ${posting.length} lines, ${fmtMoney(debits)} on each side, against the ledger as it stood when you posted.`, lines: posting.length, total: debits };
    }));
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'The opening balances could not be posted. Try again.' };
  }
}
