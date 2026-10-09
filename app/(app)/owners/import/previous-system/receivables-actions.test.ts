import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Credits (prepayments) in the previous system's open-balance file are posted as
// homeowner credits (import_opening_credit) and recorded as negative imported
// balances, so a re-import skips them. Made-up rows only.

const ASSOC = '11111111-1111-4111-8111-111111111111';
const UNIT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const state = vi.hoisted(() => ({
  imported: [] as Array<{ unit_id: string; imported_balance: number; memo: string }>,
  rpcs: [] as Array<{ fn: string; args: Record<string, unknown> }>,
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth/me', () => ({ requireFinanceStaff: vi.fn().mockResolvedValue({}) }));
vi.mock('@/lib/imports/import-lock', () => ({ withImportLock: (_db: unknown, _s: string, _k: string, fn: () => unknown) => fn() }));
vi.mock('@/lib/supabase/fetch-all', () => ({
  fetchAllRows: async () => ({ rows: [{ id: UNIT_A, unit_number: '101' }], error: null }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      state.rpcs.push({ fn, args });
      return { data: 'new-id', error: null };
    },
    from(table: string) {
      const result = () => {
        if (table === 'associations') return { data: { id: ASSOC, portfolio_id: 'co' }, error: null };
        if (table === 'charge_categories') return { data: [{ id: 'cat-other' }], error: null };
        if (table === 'imported_balances') return { data: state.imported, error: null };
        return { data: [], error: null };
      };
      const q: any = {
        select: () => q, eq: () => q, is: () => q, or: () => q, order: () => q, limit: () => q, range: () => q,
        maybeSingle: async () => result(),
        then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(result()).then(ok, bad),
      };
      return q;
    },
  }),
}));

import { importAppfolioReceivables } from './receivables-actions';

const items = [
  { row: '2', unit_number: '101', charge_date: '2026-09-01', gl_name: 'Assessment', amount: 250 },
  { row: '3', unit_number: '101', charge_date: '2026-09-15', gl_name: 'Prepaid', amount: -75.5 },
];

describe('open-balance import: credits', () => {
  beforeEach(() => {
    state.imported = [];
    state.rpcs = [];
  });

  it('posts a credit as a homeowner credit, never as a negative charge', async () => {
    const r = await importAppfolioReceivables(ASSOC, '2026-09-30', items, { complete: true });
    expect(r.imported).toBe(1);
    expect(r.totalImported).toBe(250);
    expect(r.creditsImported).toBe(1);
    expect(r.totalCredits).toBe(75.5);
    const credit = state.rpcs.find((c) => c.fn === 'import_opening_credit');
    expect(credit?.args).toMatchObject({
      p_unit_id: UNIT_A, p_charge_category_id: 'cat-other', p_amount: 75.5,
      p_description: 'Prior system: Prepaid (credit dated 2026-09-15)',
    });
    expect(state.rpcs.filter((c) => c.fn === 'import_opening_balance').map((c) => c.args.p_amount)).toEqual([250]);
  });

  it('skips a credit already imported on a re-import', async () => {
    state.imported = [
      { unit_id: UNIT_A, imported_balance: 250, memo: 'Prior system: Assessment (charged 2026-09-01)' },
      { unit_id: UNIT_A, imported_balance: -75.5, memo: 'Prior system: Prepaid (credit dated 2026-09-15)' },
    ];
    const r = await importAppfolioReceivables(ASSOC, '2026-09-30', items, { confirmDuplicate: true, complete: true });
    expect(state.rpcs.filter((c) => c.fn.startsWith('import_opening'))).toEqual([]);
    expect(r.imported).toBe(0);
    expect(r.creditsImported).toBe(0);
    expect(r.errors?.some((e) => e.includes('2 items were already imported earlier'))).toBe(true);
  });

  it('reports a credit whose amount changed instead of posting it again', async () => {
    state.imported = [{ unit_id: UNIT_A, imported_balance: -50, memo: 'Prior system: Prepaid (credit dated 2026-09-15)' }];
    const r = await importAppfolioReceivables(ASSOC, '2026-09-30', [items[1]], { confirmDuplicate: true, complete: true });
    expect(state.rpcs.filter((c) => c.fn === 'import_opening_credit')).toEqual([]);
    expect(r.errors?.some((e) => e.includes('was imported earlier as -$50.00'))).toBe(true);
  });
});

describe('import_opening_credit migration', () => {
  const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261009080000_import_opening_credit.sql'), 'utf8');

  it('mirrors an imported charge and records a negative imported balance', () => {
    // charge_gl_accounts is service_role only: a definer helper that checks finance access.
    const helper = sql.slice(sql.indexOf('create or replace function public.import_credit_income_account('), sql.indexOf('create or replace function public.import_opening_credit('));
    expect(helper).toContain('security definer');
    expect(helper).toContain('not public.can_manage_finance(v_pid) or not public.can_manage_association(v_assoc)');
    expect(helper).toContain('and cc.portfolio_id = v_pid');
    expect(helper).toContain('return (public.charge_gl_accounts(v_probe)).income;');
    const rpc = sql.slice(sql.indexOf('create or replace function public.import_opening_credit('));
    // Runs as the caller, so the imported_balances insert stays under RLS.
    expect(rpc).toContain('security invoker');
    expect(rpc).not.toMatch(/security definer/i);
    expect(rpc).not.toContain('charge_gl_accounts(');
    expect(rpc).toContain('v_income := public.import_credit_income_account(p_unit_id, p_charge_category_id);');
    expect(rpc).toContain('v_payment := public.post_homeowner_credit(p_unit_id, p_amount, p_as_of, v_income, v_memo, null);');
    expect(rpc).toContain('values (v_pid, v_assoc, p_unit_id, p_as_of, -round(p_amount, 2), v_memo, null, auth.uid());');
    expect(rpc).toContain("if p_as_of is null then raise exception");
    for (const fn of ['import_credit_income_account(uuid, uuid)', 'import_opening_credit(uuid, uuid, numeric, text, date)']) {
      expect(sql).toContain(`revoke all on function public.${fn} from public, anon;`);
    }
    expect(sql).not.toMatch(/drop |delete from/i);
    // eslint-disable-next-line no-control-regex
    expect(sql).not.toMatch(/[^\x00-\x7f]/);
  });
});
