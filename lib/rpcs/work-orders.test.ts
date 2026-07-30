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

import { assignVendor, updateWorkOrderStatus } from '@/lib/rpcs/work-orders';

function readableRow(data: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
    update: vi.fn().mockReturnThis(),
  };
}

describe('work-order mutation boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaff.mockResolvedValue({ portfolio: { id: 'portfolio-a' } });
    mocks.redirect.mockImplementation((path: string) => {
      throw new Error(`REDIRECT:${path}`);
    });
  });

  it('does not write activity or notify when RLS updates no work-order row', async () => {
    const workOrders = readableRow(null);
    const activityInsert = vi.fn();
    const db = {
      from: vi.fn((table: string) => table === 'work_orders'
        ? workOrders
        : { insert: activityInsert }),
    };
    mocks.createClient.mockResolvedValue(db);

    await expect(updateWorkOrderStatus('wo-1', 'completed')).rejects.toThrow('REDIRECT:');

    expect(workOrders.update).toHaveBeenCalled();
    expect(activityInsert).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it('rejects an accessible vendor from a different portfolio before mutation', async () => {
    const workOrders = readableRow({ id: 'wo-1', portfolio_id: 'portfolio-a' });
    const vendors = readableRow({ id: 'vendor-1', name: 'Other Vendor', portfolio_id: 'portfolio-b' });
    const activityInsert = vi.fn();
    const db = {
      from: vi.fn((table: string) => {
        if (table === 'work_orders') return workOrders;
        if (table === 'vendors') return vendors;
        return { insert: activityInsert };
      }),
    };
    mocks.createClient.mockResolvedValue(db);
    const form = new FormData();
    form.set('vendor_id', 'vendor-1');

    await expect(assignVendor('wo-1', form)).rejects.toThrow('REDIRECT:');

    expect(workOrders.update).not.toHaveBeenCalled();
    expect(activityInsert).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});
