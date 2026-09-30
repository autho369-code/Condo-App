import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireStaff: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/auth/me', () => ({ requireStaff: mocks.requireStaff }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/notifications/status-change', () => ({ notifyOwnerOfStatusChange: mocks.notify }));

import { bulkWorkOrderAction } from '@/lib/rpcs/work-order-bulk';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '44444444-4444-4444-8444-444444444444';
const V = '33333333-3333-4333-8333-333333333333';

type Row = { id: string; status: string; priority: string; vendor_id: string | null; portfolio_id: string };

/**
 * Fake work_orders table: `select ... in(ids)` returns the rows, and
 * `update(patch).in(ids)...select()` applies the patch and returns the ids.
 */
function fakeDb(rows: Row[], opts: { vendor?: { id: string; name: string; portfolio_id: string }; logError?: string } = {}) {
  const updates: Array<{ patch: Record<string, unknown>; ids: string[] }> = [];
  const inserted: unknown[] = [];
  const workOrders = () => {
    let mode: 'select' | 'update' = 'select';
    let patch: Record<string, unknown> = {};
    let ids: string[] = [];
    let portfolio: string | null = null;
    const q: any = {
      select: vi.fn(() => q),
      update: vi.fn((p: Record<string, unknown>) => { mode = 'update'; patch = p; return q; }),
      in: vi.fn((_c: string, v: string[]) => { ids = v; return q; }),
      is: vi.fn(() => q),
      eq: vi.fn((c: string, v: string) => { if (c === 'portfolio_id') portfolio = v; return q; }),
      then: (resolve: (v: unknown) => void) => {
        const hit = rows.filter((r) => ids.includes(r.id) && (!portfolio || r.portfolio_id === portfolio));
        if (mode === 'update') {
          updates.push({ patch, ids: hit.map((r) => r.id) });
          resolve({ data: hit.map((r) => ({ id: r.id })), error: null });
        } else resolve({ data: hit, error: null });
      },
    };
    return q;
  };
  const vendors = () => {
    const q: any = { select: () => q, eq: () => q, is: () => q, maybeSingle: async () => ({ data: opts.vendor ?? null, error: null }) };
    return q;
  };
  const db = {
    from: (t: string) => t === 'work_orders' ? workOrders()
      : t === 'vendors' ? vendors()
      : { insert: vi.fn(async (r: unknown) => { inserted.push(r); return { error: opts.logError ? { message: opts.logError } : null }; }) },
  };
  return { db, updates, inserted };
}

function form(fields: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const one of [v].flat()) f.append(k, one);
  return f;
}

const row = (id: string, status: string, extra: Partial<Row> = {}): Row =>
  ({ id, status, priority: 'normal', vendor_id: null, portfolio_id: 'p-a', ...extra });

describe('bulkWorkOrderAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaff.mockResolvedValue({});
    mocks.redirect.mockImplementation((path: string) => { throw new Error(`REDIRECT:${path}`); });
  });

  it('completes only orders that change, in one update, and leaves finished ones (and their dates) alone', async () => {
    const f = fakeDb([row(A, 'in_progress'), row(B, 'completed'), row(C, 'assigned')]);
    mocks.createClient.mockResolvedValue(f.db);

    await expect(bulkWorkOrderAction(form({ op: 'status', status: 'completed', work_order_id: [A, B, C, A, 'nope'] })))
      .rejects.toThrow('REDIRECT:/work-orders?bulk=status&done=2&same=1');
    expect(f.updates).toHaveLength(1);
    expect(f.updates[0].ids.sort()).toEqual([A, C].sort());
    expect(f.updates[0].patch).toMatchObject({ status: 'completed' });
    expect(f.inserted).toHaveLength(1); // one batched activity insert
    expect(mocks.notify).toHaveBeenCalledTimes(2);
  });

  it('assigns only within the vendor company and moves new orders to assigned', async () => {
    const f = fakeDb([row(A, 'new'), row(B, 'scheduled'), row(C, 'new', { portfolio_id: 'p-b' })], { vendor: { id: V, name: 'Vendor', portfolio_id: 'p-a' } });
    mocks.createClient.mockResolvedValue(f.db);

    await expect(bulkWorkOrderAction(form({ op: 'assign', vendor_id: V, work_order_id: [A, B, C] })))
      .rejects.toThrow(/done=2&failed=1/);
    expect(f.updates).toEqual([
      { patch: { vendor_id: V, status: 'assigned' }, ids: [A] },
      { patch: { vendor_id: V }, ids: [B] },
    ]);
    expect(mocks.notify).toHaveBeenCalledTimes(1);
  });

  it('reports a missing activity entry separately from a failed update', async () => {
    const f = fakeDb([row(A, 'assigned')], { logError: 'log down' });
    mocks.createClient.mockResolvedValue(f.db);

    await expect(bulkWorkOrderAction(form({ op: 'status', status: 'closed', work_order_id: A })))
      .rejects.toThrow('REDIRECT:/work-orders?bulk=status&done=1&nolog=1');
    expect(mocks.notify).toHaveBeenCalledTimes(1);
  });

  it('rejects an empty selection and an off-site return path', async () => {
    mocks.createClient.mockResolvedValue({ from: vi.fn() });
    await expect(bulkWorkOrderAction(form({ op: 'status', status: 'closed', back: 'https://evil.example' })))
      .rejects.toThrow('REDIRECT:/work-orders?error=');
  });
});
