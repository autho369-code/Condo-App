import { describe, expect, it, vi } from 'vitest';

const fetchAllRows = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase/fetch-all', () => ({ fetchAllRows }));

import { loadUnappliedCredits } from '@/lib/reports/receivables';

describe('loadUnappliedCredits', () => {
  it('refuses a truncated credit list instead of totalling part of it', async () => {
    fetchAllRows.mockReset().mockResolvedValueOnce({ rows: [], truncated: true, error: null });
    await expect(loadUnappliedCredits({ from: () => ({}) }, null)).rejects.toThrow(/too many rows/);
  });

  it('refuses a truncated unit list for chosen associations', async () => {
    fetchAllRows.mockReset().mockResolvedValueOnce({ rows: [], truncated: true, error: null });
    await expect(loadUnappliedCredits({ from: () => ({}) }, ['a1'])).rejects.toThrow(/too many rows/);
  });

  it('returns credits when nothing is truncated', async () => {
    fetchAllRows.mockReset()
      .mockResolvedValueOnce({ rows: [{ payment_id: 'p1', unit_id: 'u1', payment_date: '2026-10-01', unapplied_amount: 25 }], truncated: false, error: null })
      .mockResolvedValueOnce({ rows: [{ id: 'u1', unit_number: '101', buildings: { association_id: 'a1', associations: { name: 'A' } } }], truncated: false, error: null });
    const out = await loadUnappliedCredits({ from: () => ({}) }, null);
    expect(out).toEqual([expect.objectContaining({ paymentId: 'p1', unapplied: 25, unitNumber: '101' })]);
  });
});
