import { beforeEach, describe, expect, it, vi } from 'vitest';

// Trial balance tie-out: the file's "Calculated Prior Years Retained Earnings"
// line has no account number. A ledger retained-earnings account the file
// does not list (where an opening journal put that balance) is counted on
// that line instead of being flagged as missing from the file. Made-up rows.

const ASSOC = '11111111-1111-4111-8111-111111111111';

const state = vi.hoisted(() => ({
  accounts: [] as Array<{ id: string; number: number; name: string; account_type: string; active?: boolean }>,
  totals: {} as Record<string, { debit: number; credit: number }>,
  rpcs: [] as Array<{ fn: string; args: any }>,
  openingLines: [] as Array<{ id: string }>,
  locks: [] as string[],
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth/me', () => ({ requireFinanceStaff: vi.fn().mockResolvedValue({ portfolio: { id: 'co' } }) }));
vi.mock('@/lib/imports/import-lock', () => ({
  withImportLock: (_db: unknown, _s: string, kind: string, fn: () => unknown) => { state.locks.push(kind); return fn(); },
}));
vi.mock('@/lib/finance/totals', () => ({ ledgerTotalsByAccount: async (_db: unknown, o: { to: string }) => (o.to === '2026-10-08' ? state.totals : {}) }));
vi.mock('@/lib/supabase/fetch-all', () => ({ fetchAllRows: async () => ({ rows: state.accounts, error: null }) }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    const q: any = {
      select: () => q, eq: () => q, or: () => q, is: () => q, order: () => q, limit: () => q,
      then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: state.openingLines, error: null }).then(ok),
      maybeSingle: async () => ({ data: { id: ASSOC, name: 'Sample', portfolio_id: 'co', fiscal_year_start: 1 }, error: null }),
    };
    return {
      from: () => q,
      rpc: async (fn: string, args: any) => {
        state.rpcs.push({ fn, args });
        return { data: { ok: true, batch_id: 'b1', entries: 1 }, error: null };
      },
    };
  },
}));

import { postOpeningBalancesFromTrialBalance, tieOutAppfolioTrialBalance } from './gl-actions';

const rows = [
  { number: 1150, name: 'Operating', ending: 1000 },
  { number: 4101, name: 'Assessments', ending: -400 },
];

describe('trial balance tie-out: prior years retained earnings', () => {
  beforeEach(() => {
    state.accounts = [
      { id: 'cash', number: 1150, name: 'Operating', account_type: 'cash' },
      { id: 'inc', number: 4101, name: 'Assessments', account_type: 'income' },
      { id: 're', number: 3350, name: 'Prior Year Retained Earnings', account_type: 'equity' },
      { id: 'cy', number: 3360, name: 'Current Year Retained Earnings', account_type: 'equity' },
    ];
    state.totals = { cash: { debit: 1000, credit: 0 }, inc: { debit: 0, credit: 400 }, re: { debit: 0, credit: 600 } };
  });

  it('counts a retained-earnings account the file does not list on the prior-years line', async () => {
    const r = await tieOutAppfolioTrialBalance(ASSOC, '2026-10-08', rows, { priorYearsRetainedEarnings: -600 });
    expect(r.lines?.map((l) => l.number)).toEqual([1150, 4101]);
    expect(r.priorYears).toEqual({
      appfolio: -600, portier: -600, difference: 0,
      accounts: [{ number: 3350, name: 'Prior Year Retained Earnings', balance: -600 }],
    });
    expect(r.priorYearsNet).toBe(0);
    expect(r.totals).toMatchObject({ difference: 0, matched: 2, different: 0, notInAppfolio: 0 });
  });

  it('still flags it when the file has no prior-years line', async () => {
    const r = await tieOutAppfolioTrialBalance(ASSOC, '2026-10-08', rows);
    expect(r.lines?.find((l) => l.number === 3350)?.status).toBe('not_in_appfolio');
    expect(r.priorYears).toBeUndefined();
  });

  it('compares it normally when the file lists the account', async () => {
    const r = await tieOutAppfolioTrialBalance(ASSOC, '2026-10-08', [...rows, { number: 3350, name: 'Prior Year Retained Earnings', ending: -600 }], { priorYearsRetainedEarnings: 0 });
    expect(r.lines?.find((l) => l.number === 3350)?.status).toBe('match');
    expect(r.priorYears?.accounts).toBeUndefined();
  });

  it('leaves the current year account and other equity as their own lines', async () => {
    state.totals.cy = { debit: 0, credit: 50 };
    state.totals.cash = { debit: 1050, credit: 0 };
    const r = await tieOutAppfolioTrialBalance(ASSOC, '2026-10-08', rows, { priorYearsRetainedEarnings: -600 });
    expect(r.lines?.find((l) => l.number === 3360)?.status).toBe('not_in_appfolio');
    expect(r.priorYears?.accounts?.map((a) => a.number)).toEqual([3350]);
  });

  it('classifies each account before adding up accounts that share a number (all associations)', async () => {
    // Two associations' own 3350s: one prior years', one current year's.
    state.accounts = [
      ...state.accounts.filter((a) => a.number !== 3360),
      { id: 'cy2', number: 3350, name: 'Current Year Retained Earnings', account_type: 'equity' },
    ];
    state.totals.cy2 = { debit: 0, credit: 50 };
    state.totals.cash = { debit: 1050, credit: 0 };
    const r = await tieOutAppfolioTrialBalance(ASSOC, '2026-10-08', rows, { priorYearsRetainedEarnings: -600 });
    expect(r.priorYears).toMatchObject({ portier: -600, difference: 0, accounts: [{ number: 3350, name: 'Prior Year Retained Earnings', balance: -600 }] });
    expect(r.lines?.find((l) => l.number === 3350)).toMatchObject({ name: 'Current Year Retained Earnings', portier: -50, status: 'not_in_appfolio' });
  });

  it('reads a current-year name written with punctuation', async () => {
    state.accounts = state.accounts.map((a) => (a.number === 3360 ? { ...a, name: 'Current-Year Retained_Earnings' } : a));
    state.totals.cy = { debit: 0, credit: 50 };
    state.totals.cash = { debit: 1050, credit: 0 };
    const r = await tieOutAppfolioTrialBalance(ASSOC, '2026-10-08', rows, { priorYearsRetainedEarnings: -600 });
    expect(r.lines?.find((l) => l.number === 3360)?.status).toBe('not_in_appfolio');
    expect(r.priorYears?.accounts?.map((a) => a.number)).toEqual([3350]);
  });

  it('never counts an account that says it is this year\'s', async () => {
    for (const name of ['Current Fiscal Year Retained Earnings', 'Retained Earnings - This Year', 'YTD Retained Earnings', 'Retained Earnings Year-to-Date', 'This FY Retained Earnings', 'Retained Earnings - This FY', 'Retained Earnings (FY)', 'Retained Earnings 2026', 'Prior and Current Year Retained Earnings', 'CY Retained Earnings', 'Retained Earnings - CY', 'Retained Earnings Reserve']) {
      state.accounts = state.accounts.map((a) => (a.number === 3360 ? { ...a, name } : a));
      state.totals.cy = { debit: 0, credit: 50 };
      state.totals.cash = { debit: 1050, credit: 0 };
      const r = await tieOutAppfolioTrialBalance(ASSOC, '2026-10-08', rows, { priorYearsRetainedEarnings: -600 });
      expect(r.lines?.find((l) => l.number === 3360)?.status, name).toBe('not_in_appfolio');
      expect(r.priorYears?.accounts?.map((a) => a.number), name).toEqual([3350]);
    }
  });

  it('counts an account that says prior, even with FY or year in the name', async () => {
    for (const name of ['Prior FY Retained Earnings', 'Retained Earnings - Previous Years', 'Retained Earnings', 'Retained_Earnings', 'RETAINED EARNINGS:']) {
      state.accounts = state.accounts.map((a) => (a.number === 3350 ? { ...a, name } : a));
      const r = await tieOutAppfolioTrialBalance(ASSOC, '2026-10-08', rows, { priorYearsRetainedEarnings: -600 });
      expect(r.priorYears, name).toMatchObject({ difference: 0, accounts: [{ number: 3350, balance: -600 }] });
      expect(r.lines?.find((l) => l.number === 3350), name).toBeUndefined();
    }
  });

  it('keeps the other account\'s name and type on the rest of a shared number', async () => {
    state.accounts = [...state.accounts, { id: 'exp', number: 3350, name: 'Repairs', account_type: 'expense' }];
    state.totals.exp = { debit: 25, credit: 0 };
    state.totals.cash = { debit: 975, credit: 0 };
    const r = await tieOutAppfolioTrialBalance(ASSOC, '2026-10-08', rows, { priorYearsRetainedEarnings: -600 });
    expect(r.lines?.find((l) => l.number === 3350)).toMatchObject({ name: 'Repairs', account_type: 'expense', portier: 25 });
  });
});

describe('opening balances from the trial balance', () => {
  // A new association: the chart exists, nothing posted except an imported receivable.
  const file = [
    { number: 1150, name: 'Operating', ending: 1000 },
    { number: 1300, name: 'Receivable', ending: 50 },
    { number: 4101, name: 'Assessments', ending: -300 },
    { number: 6101, name: 'Electricity', ending: 100 },
  ];
  beforeEach(() => {
    state.rpcs = [];
    state.openingLines = [];
    state.locks = [];
    state.accounts = [
      { id: 'cash', number: 1150, name: 'Operating', account_type: 'cash' },
      { id: 'ar', number: 1300, name: 'Receivable', account_type: 'accounts_receivable' },
      { id: 'inc', number: 4101, name: 'Assessments', account_type: 'income' },
      { id: 'exp', number: 6101, name: 'Electricity', account_type: 'expense' },
      { id: 're', number: 3350, name: 'Prior Year Retained Earnings', account_type: 'equity' },
      { id: 'own', number: 3000, name: 'Owner Equity', account_type: 'equity' },
    ];
    // Open balances already posted: Dr 1300 50 / Cr 4101 50.
    state.totals = { ar: { debit: 50, credit: 0 }, inc: { debit: 0, credit: 50 } };
  });
  const post = (opts: Record<string, unknown> = {}) =>
    postOpeningBalancesFromTrialBalance(ASSOC, '2026-10-08', file, { priorYearsRetainedEarnings: -850, retainedEarningsNumber: 3350, ...opts });

  it('posts one balanced entry of the differences, prior years to the retained-earnings account', async () => {
    const r = await post();
    expect(r).toMatchObject({ ok: true, lines: 4, total: 1100 });
    const call = state.rpcs.find((c) => c.fn === 'import_journal_entry_batch');
    expect(call?.args.p_name).toBe('Opening balances Sample 2026-10-08');
    expect(call?.args.p_rows.map((x: any) => [x.gl, x.debit, x.credit])).toEqual([
      ['1150', '1000.00', ''], ['3350', '', '850.00'], ['4101', '', '250.00'], ['6101', '100.00', ''],
    ]);
    for (const x of call?.args.p_rows ?? []) {
      expect(x).toMatchObject({ entry: 'OPENING-2026-10-08', date: '2026-10-08', association: ASSOC, memo: 'Opening balance from previous system trial balance' });
    }
    expect(JSON.stringify(call?.args)).not.toMatch(/appfolio/i);
    // Holds its own lock and the open-balance import's.
    expect(state.locks).toEqual(['opening_balances', 'appfolio_receivables']);
  });

  it('refuses a second opening entry for the association, whatever the date', async () => {
    state.openingLines = [{ id: 'l1' }];
    const r = await postOpeningBalancesFromTrialBalance(ASSOC, '2026-05-31', file, { priorYearsRetainedEarnings: -850, retainedEarningsNumber: 3350 });
    expect(r.ok).toBe(false);
    expect(r.message).toContain('already has an opening balance entry');
    expect(state.rpcs).toEqual([]);
  });

  it('posts nothing when every account already matches', async () => {
    state.totals = {
      cash: { debit: 1000, credit: 0 }, ar: { debit: 50, credit: 0 }, inc: { debit: 0, credit: 300 },
      exp: { debit: 100, credit: 0 }, re: { debit: 0, credit: 850 },
    };
    const r = await post({ retainedEarningsNumber: null });
    expect(r).toMatchObject({ ok: true, lines: 0 });
    expect(state.rpcs).toEqual([]);
  });

  it('only posts prior years to an account the tie-out will then match', async () => {
    expect((await post({ retainedEarningsNumber: 3000 })).ok).toBe(false);
    expect((await post({ retainedEarningsNumber: null })).message).toContain('Choose the equity account');
    state.accounts = state.accounts.filter((a) => a.id !== 're');
    expect((await post()).message).toContain('Add an equity account named');
    expect(state.rpcs).toEqual([]);
  });

  it('refuses the all-associations view, cash basis, all-time balances and missing or hidden accounts', async () => {
    expect((await postOpeningBalancesFromTrialBalance('all', '2026-10-08', file)).ok).toBe(false);
    expect((await post({ basis: 'cash' })).message).toContain('cash-basis');
    expect((await post({ incomeBasis: 'all_time' })).message).toContain('not all time');
    expect((await postOpeningBalancesFromTrialBalance(ASSOC, '2026-10-08', [...file, { number: 9999, name: 'Unknown', ending: 0.01 }], { priorYearsRetainedEarnings: -850.01, retainedEarningsNumber: 3350 })).errors)
      .toEqual(['9999 Unknown']);
    state.accounts = state.accounts.map((a) => (a.number === 6101 ? { ...a, active: false } : a));
    expect((await post()).errors).toEqual(['6101 Electricity']);
    expect(state.rpcs).toEqual([]);
  });

  it('never reverses a ledger balance the file does not list', async () => {
    state.totals.own = { debit: 0, credit: 20 };
    state.totals.cash = { debit: 20, credit: 0 };
    const r = await post();
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual(['3000 Owner Equity: -20.00']);
    expect(state.rpcs).toEqual([]);
  });

  it('refuses all-time balances when the file has a prior-years line, even one that matches', async () => {
    state.totals.re = { debit: 0, credit: 850 };
    state.totals.cash = { debit: 850, credit: 0 };
    const r = await post({ incomeBasis: 'all_time', retainedEarningsNumber: null });
    expect(r.message).toContain('not all time');
    expect(state.rpcs).toEqual([]);
  });

  it('never posts prior years to a hidden paired account; asks for an active one', async () => {
    // A hidden retained-earnings account with a balance is paired, and an active one exists.
    state.accounts = [
      ...state.accounts.map((a) => (a.id === 're' ? { ...a, active: false } : a)),
      { id: 're2', number: 3360, name: 'Retained Earnings', account_type: 'equity' },
    ];
    state.totals.re = { debit: 0, credit: 100 };
    state.totals.cash = { debit: 100, credit: 0 };
    expect((await post({ retainedEarningsNumber: null })).message).toContain('Choose the equity account');
    expect((await post({ retainedEarningsNumber: 3350 })).ok).toBe(false);
    const r = await post({ retainedEarningsNumber: 3360 });
    expect(r.ok).toBe(true);
    const rows = state.rpcs.find((c) => c.fn === 'import_journal_entry_batch')?.args.p_rows ?? [];
    expect(rows.find((x: any) => x.gl === '3360')).toMatchObject({ credit: '750.00' });
    expect(rows.some((x: any) => x.gl === '3350')).toBe(false);
  });
});

