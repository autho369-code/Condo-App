import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  notifyVendor: vi.fn(),
  rows: [] as unknown[],
  error: null as null | { message: string },
}));

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock('@/lib/notifications/vendor-assignment', () => ({ notifyVendorOfAssignment: mocks.notifyVendor }));

import { GET } from '@/app/api/work-orders/notify-recurring/route';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
const SECRET = 'x'.repeat(40);
const req = (auth = `Bearer ${SECRET}`) =>
  new Request('https://example.test/api/work-orders/notify-recurring', { headers: { authorization: auth } }) as any;

function query() {
  const q: any = {};
  for (const m of ['select', 'eq', 'not', 'is', 'gte', 'update']) q[m] = vi.fn(() => q);
  q.limit = vi.fn(async () => ({ data: mocks.rows, error: mocks.error }));
  q.in = vi.fn(async () => ({ error: null }));
  return q;
}

describe('/api/work-orders/notify-recurring', () => {
  let q: any;
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', SECRET);
    mocks.rows = [];
    mocks.error = null;
    mocks.notifyVendor.mockReset().mockResolvedValue(true);
    q = query();
    mocks.createServiceClient.mockReturnValue({ from: vi.fn(() => q) });
  });

  it('refuses without the cron secret', async () => {
    const res = await GET(req('Bearer wrong'));
    expect(res.status).toBe(401);
    expect(mocks.notifyVendor).not.toHaveBeenCalled();
  });

  it('emails each vendor once with all its new recurring jobs', async () => {
    mocks.rows = [
      { id: 'w1', vendor_id: 'v1' },
      { id: 'w2', vendor_id: 'v2' },
      { id: 'w3', vendor_id: 'v1' },
    ];
    const res = await GET(req());
    expect(await res.json()).toEqual({ workOrders: 3, vendors: 2, emailed: 2 });
    expect(mocks.notifyVendor).toHaveBeenCalledWith({ vendorId: 'v1', workOrderIds: ['w1', 'w3'] });
    expect(mocks.notifyVendor).toHaveBeenCalledWith({ vendorId: 'v2', workOrderIds: ['w2'] });
    expect(q.update).toHaveBeenCalledWith({ vendor_notified_at: expect.any(String) });
    expect(q.in).toHaveBeenCalledWith('id', ['w1', 'w3']);
  });

  it('marks jobs emailed only when the email was queued', async () => {
    mocks.rows = [{ id: 'w1', vendor_id: 'v1' }];
    mocks.notifyVendor.mockResolvedValue(false);
    const res = await GET(req());
    expect(await res.json()).toEqual({ workOrders: 1, vendors: 1, emailed: 0 });
    expect(q.update).not.toHaveBeenCalled();
  });

  it('reads only open nightly-generated jobs with a vendor', async () => {
    await GET(req());
    expect(q.select).toHaveBeenCalledWith('id, vendor_id, service_requests!inner(source)');
    expect(q.eq).toHaveBeenCalledWith('service_requests.source', 'recurring');
    expect(q.eq).toHaveBeenCalledWith('status', 'assigned');
    expect(q.not).toHaveBeenCalledWith('vendor_id', 'is', null);
    expect(q.is).toHaveBeenCalledWith('archived_at', null);
    expect(q.is).toHaveBeenCalledWith('vendor_notified_at', null);
  });

  it('fails loudly when the read fails', async () => {
    mocks.error = { message: 'boom' };
    const res = await GET(req());
    expect(res.status).toBe(500);
    expect(mocks.notifyVendor).not.toHaveBeenCalled();
  });
});

describe('recurring work order wiring', () => {
  it('runs daily after the database generator and is reachable by the cron', () => {
    const vercel = JSON.parse(read('vercel.json'));
    expect(vercel.crons).toContainEqual({ path: '/api/work-orders/notify-recurring', schedule: '0 12 * * *' });
    expect(read('lib/server/public-paths.ts')).toContain("'/api/work-orders/notify-recurring',");
  });

  it('"Generate now" emails the plan vendor', () => {
    const route = read('app/api/recurring-work-orders/generate/route.ts');
    expect(route).toContain('if (tpl.vendor_id) await notifyVendorOfAssignment({ vendorId: tpl.vendor_id, workOrderIds: [woId] });');
  });
});

describe('20261015220000_work_orders_followups migration', () => {
  const m = read('supabase/migrations/20261015220000_work_orders_followups.sql');

  it('a completed request is waiting again when an open work order appears in it', () => {
    expect(m).toContain("(tg_op = 'INSERT' or not v_old_open\n          or new.service_request_id is distinct from old.service_request_id)");
    expect(m).toContain("set status = 'waiting',\n           resolved_at = null,\n           resolved_by = null");
    expect(m).not.toMatch(/resolution_note\s*=\s*null/);
  });

  it('adds vendor_notified_at so each recurring job is emailed once', () => {
    expect(m).toContain('alter table public.work_orders add column if not exists vendor_notified_at timestamptz;');
  });

  it('the guard keeps the trigger resolved_by', () => {
    expect(m).toContain('new.resolved_by := v_resolved_by;');
  });

  it('drops and deletes nothing', () => {
    expect(m).not.toMatch(/\bdrop\s+(table|column|view|function|policy|trigger)\b/i);
    expect(m).not.toMatch(/\bdelete\s+from\b/i);
  });
});
