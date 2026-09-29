import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { RATABLE_STATUSES, summarize } from '@/components/work-orders/rating';

describe('rating summary', () => {
  it('averages scores and computes would-hire-again from answered ratings only', () => {
    expect(summarize([])).toEqual({ count: 0, average: null, hireAgainPct: null });
    expect(summarize([
      { score: 5, would_hire_again: true },
      { score: 4, would_hire_again: null },
      { score: 2, would_hire_again: false },
    ])).toEqual({ count: 3, average: 3.7, hireAgainPct: 50 });
  });

  it('only offers ratings on finished jobs', () => {
    expect(RATABLE_STATUSES.has('completed')).toBe(true);
    expect(RATABLE_STATUSES.has('in_progress')).toBe(false);
  });
});

describe('work order ratings migration', () => {
  const sql = readFileSync('supabase/migrations/20260930010000_work_order_ratings.sql', 'utf8');
  const rpc = sql.split('create or replace function public.rate_work_order(')[1]?.split('end $$;')[0] ?? '';

  it('decides the rater role inside the database and rejects everyone else', () => {
    expect(rpc).toContain("v_role := 'staff'");
    expect(rpc).toContain("v_role := 'board'");
    expect(rpc).toContain("v_role := 'owner'");
    expect(rpc).toMatch(/else\s+raise exception 'Work order not found'/);
  });

  it('never exposes rater identity to vendors', () => {
    const fn = sql.split('create or replace function public.my_vendor_ratings(')[1]?.split('$$;')[0] ?? '';
    expect(fn).not.toContain('rated_by');
    expect(sql).not.toMatch(/create policy [a-z_]+ on public\.work_order_ratings[^;]*current_vendor_id/);
  });

  it('has no direct write grants', () => {
    expect(sql).toContain('grant select on public.work_order_ratings to authenticated;');
    expect(sql).not.toMatch(/grant (insert|update|delete)[^;]*work_order_ratings/);
  });

  it('only accepts redirects back to a work order page', () => {
    const action = readFileSync('lib/rpcs/work-order-ratings.ts', 'utf8');
    expect(action).toContain('BACK_RE');
    expect(action).toMatch(/\(work-orders\|portal\\\/work-orders\|board\\\/work-orders\)/);
  });
});
