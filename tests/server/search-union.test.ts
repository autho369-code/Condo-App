import { describe, expect, it } from 'vitest';
import { descNullsLast, unionSearch } from '@/lib/supabase/search-union';

type Row = { id: string; d: string | null };
const ok = (data: Row[]) => Promise.resolve({ data, error: null });

describe('unionSearch', () => {
  it('merges branches by id, sorts and limits', async () => {
    const { rows, error } = await unionSearch<Row>(
      [ok([{ id: 'a', d: '2026-01-02' }, { id: 'b', d: null }]), ok([{ id: 'a', d: '2026-01-02' }, { id: 'c', d: '2026-03-01' }])],
      (x, y) => descNullsLast(x.d, y.d),
      2,
    );
    expect(error).toBeNull();
    expect(rows.map((r) => r.id)).toEqual(['c', 'a']);
  });

  it('fails loudly when any branch fails', async () => {
    const { rows, error } = await unionSearch<Row>(
      [ok([{ id: 'a', d: null }]), Promise.resolve({ data: null, error: { message: 'boom' } })],
      () => 0,
      10,
    );
    expect(rows).toEqual([]);
    expect(error).toBe('boom');
  });
});
