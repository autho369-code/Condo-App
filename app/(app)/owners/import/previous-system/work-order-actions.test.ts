import { beforeEach, describe, expect, it, vi } from 'vitest';

// Re-importing the work-order file links a vendor added since the first
// import to the work orders that were imported without one. Made-up rows only.

const ASSOC = '11111111-1111-4111-8111-111111111111';
const VENDOR = 'vvvvvvvv-vvvv-4vvv-8vvv-vvvvvvvvvvvv';

const state = vi.hoisted(() => ({
  existing: [] as Array<{ id: string; description: string; vendor_id: string | null }>,
  updates: [] as Array<{ patch: Record<string, unknown>; filters: Array<[string, unknown]> }>,
  inserts: 0,
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth/me', () => ({ requireStaff: vi.fn().mockResolvedValue({ auth_user_id: 'staff' }) }));
vi.mock('@/lib/imports/import-lock', () => ({ withImportLock: (_db: unknown, _s: string, _k: string, fn: () => unknown) => fn() }));
vi.mock('@/lib/supabase/fetch-all', () => ({
  fetchAllRows: async (make: () => { table: string }) => {
    const { table } = make();
    if (table === 'units') return { rows: [], error: null };
    if (table === 'vendors') return { rows: [{ id: VENDOR, name: 'Ace Plumbing' }], error: null };
    return { rows: state.existing, error: null };
  },
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      let patch: Record<string, unknown> | null = null;
      const q: any = {
        table,
        select: () => q, or: () => q, order: () => q,
        eq: (c: string, v: unknown) => { filters.push([c, v]); return q; },
        is: (c: string, v: unknown) => { filters.push([c, v]); return q; },
        update: (p: Record<string, unknown>) => { patch = p; return q; },
        insert: async () => { state.inserts++; return { error: null }; },
        maybeSingle: async () => ({ data: { id: ASSOC, portfolio_id: 'co' }, error: null }),
        then: (ok: (v: unknown) => unknown) => {
          if (patch) state.updates.push({ patch, filters: [...filters] });
          return Promise.resolve({ data: [{ id: 'row' }], error: null }).then(ok);
        },
      };
      return q;
    },
  }),
}));

import { importAppfolioWorkOrders } from './work-order-actions';

const wo = (number: string, vendor: string | null) => ({
  row: '2', number, unit: null, vendor, status: 'completed', appfolio_status: 'Completed', priority: 'normal', appfolio_priority: 'Normal',
  type: null, issue: null, job_description: null, instructions: null, primary_resident: null, created_on: null, scheduled_date: null,
  scheduled_time: null, scheduled_end: null, work_done_on: null, completed_on: null,
}) as any;

describe('work-order re-import', () => {
  beforeEach(() => {
    state.existing = [];
    state.updates = [];
    state.inserts = 0;
  });

  it('sets the vendor on an imported work order that has none, only while it still has none', async () => {
    state.existing = [{ id: 'wo-1', description: 'Prior system WO #100-1', vendor_id: null }];
    const r = await importAppfolioWorkOrders(ASSOC, [wo('100-1', 'Ace  plumbing')]);
    expect(r.imported).toBe(0);
    expect(state.inserts).toBe(0);
    expect(state.updates).toEqual([{ patch: { vendor_id: VENDOR }, filters: [['id', 'wo-1'], ['association_id', ASSOC], ['vendor_id', null]] }]);
    expect(r.errors?.[0]).toMatch(/Vendor set on 1 of them/);
  });

  it('leaves a work order that already has a vendor, or whose vendor still is not found', async () => {
    state.existing = [
      { id: 'wo-1', description: 'Prior system WO #100-1', vendor_id: 'someone' },
      { id: 'wo-2', description: 'Prior system WO #100-2', vendor_id: null },
    ];
    await importAppfolioWorkOrders(ASSOC, [wo('100-1', 'Ace Plumbing'), wo('100-2', 'Unknown Co')]);
    expect(state.updates).toEqual([]);
  });
});
