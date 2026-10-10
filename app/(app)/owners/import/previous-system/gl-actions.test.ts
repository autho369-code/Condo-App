import { beforeEach, describe, expect, it, vi } from 'vitest';

// Trial balance tie-out: the file's "Calculated Prior Years Retained Earnings"
// line has no account number. A ledger retained-earnings account the file
// does not list (where an opening journal put that balance) is counted on
// that line instead of being flagged as missing from the file. Made-up rows.

const ASSOC = '11111111-1111-4111-8111-111111111111';

const state = vi.hoisted(() => ({
  accounts: [] as Array<{ id: string; number: number; name: string; account_type: string }>,
  totals: {} as Record<string, { debit: number; credit: number }>,
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth/me', () => ({ requireFinanceStaff: vi.fn().mockResolvedValue({ portfolio: { id: 'co' } }) }));
vi.mock('@/lib/imports/import-lock', () => ({ withImportLock: vi.fn() }));
vi.mock('@/lib/finance/totals', () => ({ ledgerTotalsByAccount: async (_db: unknown, o: { to: string }) => (o.to === '2026-10-08' ? state.totals : {}) }));
vi.mock('@/lib/supabase/fetch-all', () => ({ fetchAllRows: async () => ({ rows: state.accounts, error: null }) }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    const q: any = {
      select: () => q, eq: () => q, or: () => q, is: () => q, order: () => q,
      maybeSingle: async () => ({ data: { id: ASSOC, name: 'Sample', portfolio_id: 'co', fiscal_year_start: 1 }, error: null }),
    };
    return { from: () => q };
  },
}));

import { tieOutAppfolioTrialBalance } from './gl-actions';

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
    for (const name of ['Current Fiscal Year Retained Earnings', 'Retained Earnings - This Year', 'YTD Retained Earnings', 'Retained Earnings Year-to-Date', 'Retained Earnings (FY)']) {
      state.accounts = state.accounts.map((a) => (a.number === 3360 ? { ...a, name } : a));
      state.totals.cy = { debit: 0, credit: 50 };
      state.totals.cash = { debit: 1050, credit: 0 };
      const r = await tieOutAppfolioTrialBalance(ASSOC, '2026-10-08', rows, { priorYearsRetainedEarnings: -600 });
      expect(r.lines?.find((l) => l.number === 3360)?.status, name).toBe('not_in_appfolio');
      expect(r.priorYears?.accounts?.map((a) => a.number), name).toEqual([3350]);
    }
  });
});
