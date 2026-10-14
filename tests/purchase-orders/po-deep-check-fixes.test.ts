import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireFinanceStaff: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
  po: null as null | { approval_request_id: string | null },
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/auth/me', () => ({ requireFinanceStaff: mocks.requireFinanceStaff, requireStaff: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

import { recordPurchaseOrderBoardDecision } from '@/lib/rpcs/purchase-orders';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
const PO = '11111111-1111-4111-8111-111111111111';
const REQ = '22222222-2222-4222-8222-222222222222';

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

async function run(fields: Record<string, string>) {
  try {
    await recordPurchaseOrderBoardDecision(form(fields));
  } catch (e: any) {
    return String(e.message);
  }
  return 'no redirect';
}

describe('recordPurchaseOrderBoardDecision', () => {
  beforeEach(() => {
    mocks.requireFinanceStaff.mockReset();
    mocks.rpc.mockReset().mockResolvedValue({ error: null });
    mocks.po = { approval_request_id: REQ };
    const q: any = {};
    q.select = vi.fn(() => q);
    q.eq = vi.fn(() => q);
    q.maybeSingle = vi.fn(async () => ({ data: mocks.po, error: null }));
    mocks.createClient.mockResolvedValue({ from: vi.fn(() => q), rpc: mocks.rpc });
  });

  it('re-checks finance access and records the decision on the PO\'s own request', async () => {
    const out = await run({ id: PO, approval_request_id: REQ, decision: 'approved', note: 'Board meeting 10/14' });
    expect(mocks.requireFinanceStaff).toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith('record_approval_decision', { p_request_id: REQ, p_decision: 'approved', p_note: 'Board meeting 10/14' });
    expect(out).toBe(`REDIRECT:/purchase-orders/${PO}`);
  });

  it('refuses a request that is not the PO\'s', async () => {
    const out = await run({ id: PO, approval_request_id: '33333333-3333-4333-8333-333333333333', decision: 'approved' });
    expect(out).toContain('has%20no%20open%20board%20approval%20request');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('refuses an unknown decision', async () => {
    const out = await run({ id: PO, approval_request_id: REQ, decision: 'maybe' });
    expect(out).toContain(`/purchase-orders/${PO}?error=`);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('fails loudly when the database refuses', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'This approval request is already decided' } });
    const out = await run({ id: PO, approval_request_id: REQ, decision: 'rejected' });
    expect(out).toContain('already%20decided');
  });
});

describe('purchase order page and form', () => {
  it('shows a board decision form while the request is pending', () => {
    const page = read('app/(app)/purchase-orders/[id]/page.tsx');
    expect(page).toContain('<form action={recordPurchaseOrderBoardDecision}');
    expect(page).toContain("{request.status === 'pending' && (");
    expect(page).not.toContain('They vote from the board portal');
  });

  it('dates default to the association\'s own day', () => {
    const page = read('app/(app)/purchase-orders/[id]/page.tsx');
    expect(page).toContain('associations(id, name, timezone)');
    expect(page).toContain('todayInZone(typeof zone === \'string\' && isValidTimeZone(zone) ? zone : undefined)');
  });

  it('editing keeps the PO\'s own work order in the list', () => {
    expect(read('lib/purchase-orders/form-options.ts')).toContain('keepWorkOrderId && !workOrderRows.some((w) => w.id === keepWorkOrderId)');
    expect(read('app/(app)/purchase-orders/[id]/edit/page.tsx')).toContain('loadPurchaseOrderFormOptions(db, me.portfolio?.id, po.work_order_id)');
  });
});

describe('20261015230000_purchase_orders_fixes migration', () => {
  const m = read('supabase/migrations/20261015230000_purchase_orders_fixes.sql');

  it('a bill from a PO carries the PO work order (project spend)', () => {
    expect(m).toContain('work_order_id = coalesce(work_order_id, po.work_order_id)');
  });

  it('board routing is decided at submit time', () => {
    expect(m).toContain("po_row.approval_required := v_mode = 'always' or (v_mode = 'over_threshold' and po_row.po_total >= coalesce(v_threshold, 0));");
  });

  it('approval request decisions can only be changed through the decision functions', () => {
    expect(m).toContain("coalesce(current_setting('app.approval_decision', true), '') = 'on'");
    expect(m).toContain('before update or delete on public.approval_requests');
    expect(m).toContain("raise exception 'Approval requests can''t be deleted'");
    expect(m).toContain('new.request_type is distinct from old.request_type');
    expect(m).toContain('as restrictive for insert to authenticated, anon');
  });

  it('fixed assets keep their reserve component scope', () => {
    expect(m).toContain('asset_association is distinct from new.association_id');
    expect(m).toContain('before update of association_id, portfolio_id on public.fixed_assets');
  });

  it('uses the association local date', () => {
    expect(m.match(/public\.association_local_date\(/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('drops or deletes no data', () => {
    expect(m).not.toMatch(/\bdrop\s+(table|column|view|function)\b/i);
    // The only policy drop re-creates the policy it adds.
    expect(m.match(/\bdrop\s+policy\b[^;]*/gi)).toEqual(['drop policy if exists approval_votes_no_signed_in_insert on public.approval_votes']);
    expect(m).not.toMatch(/\bdelete\s+from\b/i);
  });
});
