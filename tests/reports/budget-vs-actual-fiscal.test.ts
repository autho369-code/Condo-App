import { describe, expect, it } from 'vitest';

import { generateLiveExportRows } from '@/lib/reports/live-export';
import { prepareMonthlyPackageRows } from '@/lib/reports/monthly-package';

// Budget lines store monthly_amounts in the association's fiscal order
// (index 0 = the fiscal year's first month). The export must compare each
// with that calendar month's actuals and name the columns by calendar month.

const ASSOC = '22222222-2222-4222-8222-222222222222';
const GL = 'a0004100-0000-0000-0000-000000000000';

function fakeDb(rpcCalls: any[]) {
  const tables: Record<string, any[]> = {
    associations: [{ id: ASSOC, name: 'Bayview', fiscal_year_start: 7, portfolio_id: 'p1', archived_at: null }],
    budget_lines: [{
      id: 'bl-1', association_id: ASSOC, fiscal_year: 2026, category: 'income', notes: null,
      gl_account_id: GL,
      // Jul 2025 ... Jun 2026
      monthly_amounts: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200],
      gl_accounts: { number: 4100, name: 'Assessments', account_type: 'income', portfolio_id: 'p1', association_id: null },
    }],
  };
  function builder(table: string) {
    const filters: [string, any][] = [];
    const b: any = {
      select() { return b; },
      eq(col: string, val: any) { filters.push([col, val]); return b; },
      is(col: string, val: any) { filters.push([col, val]); return b; },
      order() { return b; },
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      then(resolve: any) { resolve({ data: rows(), error: null }); },
    };
    const rows = () => (tables[table] ?? []).filter((r) => filters.every(([col, val]) => {
      if (col.includes('.')) return true; // embedded filter (gl_accounts.portfolio_id)
      return (r[col] ?? null) === val;
    }));
    return b;
  }
  return {
    from: (t: string) => builder(t),
    rpc: async (name: string, args: any) => {
      rpcCalls.push({ name, args });
      // Income credited each month: 10 x the calendar month number.
      const month = Number(String(args.p_from).slice(5, 7));
      return { data: [{ gl_account_id: GL, debit_total: 0, credit_total: month * 10 }], error: null };
    },
  };
}

describe('budget vs actual in fiscal months', () => {
  it('compares each fiscal month with that calendar month, in the association fiscal year', async () => {
    const rpcCalls: any[] = [];
    const rows = await generateLiveExportRows(fakeDb(rpcCalls) as any, 'p1', 'budget_vs_actual', {
      association_id: ASSOC,
      date_to: '2025-12-31',
    });

    expect(rows).toHaveLength(1);
    const row = rows[0];
    // December 2025 is in FY2026 for a July start.
    expect(row['Fiscal year']).toBe(2026);
    expect(row['Jul budget']).toBe(100);
    expect(row['Jul actual']).toBe(70);
    expect(row['Jun budget']).toBe(1200);
    expect(row['Jun actual']).toBe(60);
    expect(row['Annual actual']).toBe(780);
    // Columns come in fiscal order: Jul first, Jun last.
    const monthKeys = Object.keys(row).filter((k) => / budget$/.test(k) && k !== 'Annual budget');
    expect(monthKeys[0]).toBe('Jul budget');
    expect(monthKeys[11]).toBe('Jun budget');
    // One ledger call per fiscal month, July 2025 through June 2026.
    expect(rpcCalls).toHaveLength(12);
    expect(rpcCalls[0].args).toMatchObject({ p_from: '2025-07-01', p_to: '2025-07-31' });
    expect(rpcCalls[11].args).toMatchObject({ p_from: '2026-06-01', p_to: '2026-06-30' });
  });

  it('adds up the year to date from the fiscal start in the monthly package', () => {
    const labels = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const row: Record<string, unknown> = { Category: 'income', 'Account #': 4100, Account: 'Assessments' };
    labels.forEach((label, i) => {
      row[`${label} budget`] = 100;
      row[`${label} actual`] = 90 + i;
    });

    const [compact] = prepareMonthlyPackageRows('budget_vs_actual', [row], '2025-09-30');
    expect(compact['Sep budget']).toBe(100);
    expect(compact['Sep actual']).toBe(92);
    // Jul + Aug + Sep, not Jan through Sep.
    expect(compact['YTD budget']).toBe(300);
    expect(compact['YTD actual']).toBe(90 + 91 + 92);
  });
});
