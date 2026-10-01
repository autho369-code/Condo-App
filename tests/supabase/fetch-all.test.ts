import { describe, expect, it } from 'vitest';
import { fetchAllRows } from '@/lib/supabase/fetch-all';

function source(total: number, failAt?: number) {
  const calls: Array<[number, number]> = [];
  const build = () => ({
    range: async (from: number, to: number) => {
      calls.push([from, to]);
      if (failAt !== undefined && from >= failAt) return { data: null, error: { message: 'boom' } };
      const rows = Array.from({ length: Math.max(0, Math.min(to, total - 1) - from + 1) }, (_, i) => ({ n: from + i }));
      return { data: rows, error: null };
    },
  });
  return { build, calls };
}

describe('fetchAllRows', () => {
  it('pages past the 1,000-row cap until a short page', async () => {
    const { build, calls } = source(2500);
    const r = await fetchAllRows(build);
    expect(r.rows).toHaveLength(2500);
    expect(r.truncated).toBe(false);
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it('stops at maxRows and reports truncation', async () => {
    const { build } = source(5000);
    const r = await fetchAllRows(build, { maxRows: 2000 });
    expect(r.rows).toHaveLength(2000);
    expect(r.truncated).toBe(true);
  });

  it('returns the error with the rows read so far', async () => {
    const { build } = source(5000, 1000);
    const r = await fetchAllRows(build);
    expect(r.rows).toHaveLength(1000);
    expect(r.error).toBe('boom');
  });
});
