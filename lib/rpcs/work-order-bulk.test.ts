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
const V = '33333333-3333-4333-8333-333333333333';

/** A chainable query builder whose terminal maybeSingle returns queued results. */
function builder(results: unknown[], inRows: unknown[] = []) {
  const q: any = {};
  for (const m of ['select', 'update', 'eq', 'is']) q[m] = vi.fn(() => q);
  q.maybeSingle = vi.fn(async () => ({ data: results.shift() ?? null, error: null }));
  q.in = vi.fn(async () => ({ data: inRows, error: null }));
  return q;
}

function form(fields: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const one of [v].flat()) f.append(k, one);
  return f;
}

describe('bulkWorkOrderAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaff.mockResolvedValue({});
    mocks.redirect.mockImplementation((path: string) => { throw new Error(`REDIRECT:${path}`); });
  });

  it('changes status on each selected order, logs it and notifies the owner', async () => {
    const workOrders = builder([{ id: A, status: 'completed' }, { id: B, status: 'completed' }]);
    const insert = vi.fn(async () => ({ error: null }));
    mocks.createClient.mockResolvedValue({ from: (t: string) => (t === 'work_orders' ? workOrders : { insert }) });

    await expect(bulkWorkOrderAction(form({ op: 'status', status: 'completed', work_order_id: [A, B, A, 'not-a-uuid'] })))
      .rejects.toThrow('REDIRECT:/work-orders?bulk=status&done=2');
    expect(workOrders.update).toHaveBeenCalledTimes(2);
    expect(insert).toHaveBeenCalledTimes(2);
    expect(mocks.notify).toHaveBeenCalledTimes(2);
  });

  it('never assigns a vendor from another company', async () => {
    // The management company passes the association check; the company check still applies.
    const vendors = builder([{ id: V, name: 'Vendor', portfolio_id: 'p-b', association_id: null, is_management_company: true }]);
    const workOrders = builder([{ id: A, status: 'new', portfolio_id: 'p-a' }]);
    const insert = vi.fn();
    mocks.createClient.mockResolvedValue({ from: (t: string) => (t === 'vendors' ? vendors : t === 'work_orders' ? workOrders : { insert }) });

    await expect(bulkWorkOrderAction(form({ op: 'assign', vendor_id: V, work_order_id: A })))
      .rejects.toThrow(/done=0&failed=1/);
    expect(workOrders.update).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('refuses a selection outside the vendor\'s association before updating anything', async () => {
    const vendors = builder([{ id: V, name: 'Vendor', portfolio_id: 'p-a', association_id: 'as-a', is_management_company: false }]);
    const workOrders = builder([], [{ id: A, association_id: 'as-a' }, { id: B, association_id: 'as-b' }]);
    const insert = vi.fn();
    mocks.createClient.mockResolvedValue({ from: (t: string) => (t === 'vendors' ? vendors : t === 'work_orders' ? workOrders : { insert }) });

    await expect(bulkWorkOrderAction(form({ op: 'assign', vendor_id: V, work_order_id: [A, B] })))
      .rejects.toThrow(/REDIRECT:\/work-orders\?error=Vendor%20is%20a%20vendor%20of%20one%20association/);
    expect(workOrders.update).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('rejects an empty selection and an off-site return path', async () => {
    mocks.createClient.mockResolvedValue({ from: vi.fn() });
    await expect(bulkWorkOrderAction(form({ op: 'status', status: 'closed', back: 'https://evil.example' })))
      .rejects.toThrow('REDIRECT:/work-orders?error=');
  });
});
