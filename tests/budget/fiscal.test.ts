import { describe, expect, it } from 'vitest';
import {
  adjustByPercent, fiscalMonthLabels, fiscalMonthsElapsed, fiscalWindow, fiscalYearFor,
  parseWorksheetCsv, spreadEvenly, sum, worksheetToCsv,
} from '@/lib/budget/fiscal';
import { readFileSync } from 'node:fs';

describe('fiscal calendar', () => {
  it('labels months in fiscal order', () => {
    expect(fiscalMonthLabels(1)[0]).toBe('Jan');
    expect(fiscalMonthLabels(7)).toEqual(['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']);
    expect(fiscalMonthLabels(null)[0]).toBe('Jan');
    expect(fiscalMonthLabels(13)[0]).toBe('Jan');
  });

  it('matches association_fiscal_window: FY N ends in calendar year N', () => {
    expect(fiscalWindow(2026, 1)).toEqual({ start: '2026-01-01', end: '2026-12-31' });
    expect(fiscalWindow(2027, 7)).toEqual({ start: '2026-07-01', end: '2027-06-30' });
    expect(fiscalWindow(2028, 3)).toEqual({ start: '2027-03-01', end: '2028-02-29' });
  });

  it('finds the fiscal year containing a date', () => {
    expect(fiscalYearFor(new Date(2026, 8, 29), 1)).toBe(2026);
    expect(fiscalYearFor(new Date(2026, 8, 29), 7)).toBe(2027);
    expect(fiscalYearFor(new Date(2026, 5, 30), 7)).toBe(2026);
  });

  it('counts elapsed fiscal months', () => {
    expect(fiscalMonthsElapsed(2026, 1, new Date(2026, 8, 29))).toBe(9);
    expect(fiscalMonthsElapsed(2027, 7, new Date(2026, 8, 29))).toBe(3);
    expect(fiscalMonthsElapsed(2025, 1, new Date(2026, 8, 29))).toBe(12);
    expect(fiscalMonthsElapsed(2028, 1, new Date(2026, 8, 29))).toBe(0);
  });
});

describe('worksheet math', () => {
  it('spreads an annual amount so months add up exactly', () => {
    const m = spreadEvenly(1000);
    expect(m).toHaveLength(12);
    expect(sum(m)).toBe(1000);
    expect(m[0]).toBe(83.33);
    expect(m[11]).toBe(83.37);
    expect(sum(spreadEvenly(24000.04))).toBe(24000.04);
    expect(spreadEvenly(-5)).toEqual(Array(12).fill(0));
  });

  it('adjusts by a percentage without going negative', () => {
    expect(adjustByPercent([100, 200], 3)).toEqual([103, 206]);
    expect(adjustByPercent([100], -150)).toEqual([0]);
    expect(adjustByPercent([33.33], 10)).toEqual([36.66]);
  });

  it('round-trips the CSV export and reports unknown accounts', () => {
    const labels = fiscalMonthLabels(1);
    const csv = worksheetToCsv([
      { glAccountId: 'a', number: 4020, name: 'Dues, monthly', amounts: spreadEvenly(24000), notes: 'Board "draft"' },
      { glAccountId: 'b', number: 5200, name: 'Insurance', amounts: Array(12).fill(200), notes: '' },
    ], labels);
    const extra = `${csv}\n9999,Mystery,${Array(12).fill(1).join(',')},12,\n5300,Bad,${Array(12).fill('x').join(',')},0,`;
    const { byNumber, unknown, invalid } = parseWorksheetCsv(extra, new Set([4020, 5200, 5300]));
    expect(sum(byNumber.get(4020)!.amounts)).toBe(24000);
    expect(byNumber.get(4020)!.notes).toBe('Board "draft"');
    expect(byNumber.get(5200)!.amounts[0]).toBe(200);
    expect(unknown).toEqual(['9999']);
    expect(invalid).toEqual(['5300']);
  });
});

describe('budget migration safety', () => {
  const sql = readFileSync('supabase/migrations/20260929180000_budget_worksheet_and_assessment_update.sql', 'utf8');

  it('checks finance authorization in every write RPC', () => {
    for (const fn of ['save_budget_worksheet', 'adopt_budget', 'reopen_budget', 'assessment_allocation', 'apply_assessment_update']) {
      const body = sql.split(`create or replace function public.${fn}(`)[1]?.split('end $$;')[0] ?? '';
      expect(body, fn).toContain('can_mutate_association_budget');
    }
  });

  it('locks down post_dues_increase and keeps writes off the header table', () => {
    expect(sql).toMatch(/revoke all on function public\.post_dues_increase\(uuid\) from public, anon, authenticated/);
    expect(sql).toMatch(/grant select on public\.association_budgets to authenticated;/);
    expect(sql).not.toMatch(/grant (insert|update|delete)[^;]*association_budgets/);
  });
});
