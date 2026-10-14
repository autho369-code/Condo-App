import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn(), createClient: vi.fn() }));

import { purchaseOrderApprovedEmail, purchaseOrderPageAfterApproval } from '@/lib/notifications/purchase-order-approved';

const root = process.cwd();
const read = (p: string) => readFileSync(resolve(root, p), 'utf8').replace(/\r\n/g, '\n');
const migration = read('supabase/migrations/20261016220000_po_decisions.sql');
const actions = read('lib/rpcs/purchase-orders.ts');

describe('20261016220000_po_decisions migration', () => {
  it('skips the board for bills within a board-approved PO amount', () => {
    const helper = migration.slice(migration.indexOf('create or replace function public.payable_bill_within_board_approved_po'));
    expect(helper).toContain("r.status = 'approved'::public.approval_request_status");
    expect(helper).toContain('return v_billed <= po.po_total;');
    expect(migration).toContain('revoke all on function public.payable_bill_within_board_approved_po(uuid) from public, anon, authenticated;');
    // Both the bill-from-PO path and a later submit check it.
    expect(migration.match(/public\.payable_bill_within_board_approved_po\((v_bill|p_bill_id)\)/g)?.length).toBe(2);
  });

  it('creates only the current recurring period (latest date on or before today), by the association day', () => {
    const gen = migration.slice(migration.indexOf('create or replace function public.generate_recurring_purchase_orders()'));
    // Advances only while the NEXT date is still on or before today, so a
    // missed run keeps the current period instead of jumping to the next.
    expect(gen).toContain('exit when v_next is null or v_next <= v_date or v_next > v_today or v_guard >= 10000;');
    expect(gen).not.toContain('while v_date < v_today');
    // A schedule not yet due is not selected at all.
    expect(gen).toContain('and r.next_post_date <= coalesce(public.association_local_date(r.association_id), current_date)');
    expect(gen).toContain('public.association_local_date(t.association_id)');
    // One app_po_from_recurring call, not a catch-up loop.
    expect(gen.slice(0, gen.indexOf('end $function$')).match(/app_po_from_recurring\(/g)?.length).toBe(1);
  });

  it('counts committed (open approved PO balances + unpaid bills) and spent (paid bills)', () => {
    for (const fn of ['capital_project_cost_totals()', 'project_cost_by_category(p_project_id uuid)']) {
      const body = migration.slice(migration.indexOf(`create or replace function public.${fn}`));
      expect(body).toContain("po.approval_status = 'approved'");
      expect(body).toContain("po.status::text <> 'cancelled'");
      expect(body).toContain("b.status::text in ('draft', 'pending_approval', 'approved')");
      expect(body).toContain("b.status::text = 'paid'");
      expect(body).toContain('greatest(least(pl.line_total, pl.running - coalesce(pl.po_billed, 0)), 0)');
    }
    expect(migration).toContain('revoke all on function public.capital_project_cost_totals() from public, anon;');
    // Purchase orders are finance-only: their amounts count only for finance staff.
    const totals = migration.slice(migration.indexOf('create or replace function public.capital_project_cost_totals()'));
    expect(totals).toContain('v_fin boolean := v_op or coalesce(public.my_finance_portfolio() = v_pf, false);');
    const byCat = migration.slice(migration.indexOf('create or replace function public.project_cost_by_category(p_project_id uuid)'));
    expect(byCat).toContain('or coalesce(public.my_finance_portfolio() = p.portfolio_id, false);');
    for (const body of [totals, byCat]) {
      const poLines = body.slice(body.indexOf('po_lines as ('), body.indexOf('end $function$'));
      expect(poLines).toMatch(/where v_fin\n\s+and po\.archived_at is null/);
    }
    expect(migration).toContain('revoke all on function public.project_cost_by_category(uuid) from public, anon;');
  });

  it('numbers blank POs per company and keeps numbers unique', () => {
    expect(migration).toContain("v_number := 'PO-' || lpad(v_n::text, 5, '0');");
    expect(migration).toContain('alter table public.purchase_order_number_counters enable row level security;');
    expect(migration).toContain('on public.purchase_orders (portfolio_id, lower(number))');
    expect(migration).toContain('before insert or update of number, portfolio_id on public.purchase_orders');
  });

  it('limits purchase orders and their lines to finance staff, once per query', () => {
    const policies = migration.match(/alter policy[^;]*;/g) ?? [];
    expect(policies.length).toBe(2);
    for (const p of policies) {
      expect(p).toContain('( SELECT public.my_finance_portfolio() AS my_finance_portfolio)');
      expect(p).not.toContain('my_access_portfolio');
      expect(p).not.toMatch(/can_manage_finance\(/);
    }
    expect(migration).toContain("if v_slug ~ '^purchase_order' and not public.can_manage_finance(p_portfolio_id) then");
  });

  it('writes non-ASCII characters as chr()', () => {
    expect(migration).toMatch(/^[\x00-\x7F]*$/);
  });
});

describe('purchase order approval email', () => {
  it('emails the vendor after approval, from each approval path', () => {
    expect(actions.match(/notifyVendorOfPurchaseOrderApproval\(/g)?.length).toBe(3);
    expect(actions).toContain("if (data === 'approved') {");
    expect(actions).toContain("const emailed = decision === 'approved'");
    // The platform operator has no company: the PO's own company stands in.
    expect(actions).toContain('portfolioId: me.portfolio?.id ?? po?.portfolio_id');
    expect(actions).toContain('portfolioId: me.portfolio?.id ?? po.portfolio_id');
    expect(actions.match(/redirect\(purchaseOrderPageAfterApproval\(/g)?.length).toBe(3);
  });

  it('tells staff when an approved PO\'s vendor was not emailed', () => {
    expect(purchaseOrderPageAfterApproval('po-1', null)).toBe('/purchase-orders/po-1');
    expect(purchaseOrderPageAfterApproval('po-1', { sent: true, reason: null })).toBe('/purchase-orders/po-1');
    // Not approved yet (went to the board): nothing to report.
    expect(purchaseOrderPageAfterApproval('po-1', { sent: false, reason: null })).toBe('/purchase-orders/po-1');
    const url = purchaseOrderPageAfterApproval('po-1', { sent: false, reason: 'the vendor has no email address on file' });
    expect(decodeURIComponent(url.split('?warning=')[1])).toBe('Approved \u2014 vendor not emailed: the vendor has no email address on file.');
    const page = read('app/(app)/purchase-orders/[id]/page.tsx');
    expect(page).toContain('{sp.warning && <Alert tone="warning" className="mb-5">{sp.warning}</Alert>}');
  });

  it('carries the order under the company name, with no link', () => {
    const { subject, text } = purchaseOrderApprovedEmail({
      vendorName: 'Acme Roofing',
      brandName: 'Lakeside Management',
      supportEmail: 'help@lakeside.example',
      number: 'PO-00007',
      associationName: 'Harbor Point',
      description: 'Roof repair',
      neededBy: '2026-11-02',
      total: 1000,
      lines: [{ description: 'Labor', qty: 1, unitPrice: 600, lineTotal: 600 }, { description: 'Shingles', qty: 2, unitPrice: 200, lineTotal: 400 }],
    });
    expect(subject).toBe('Purchase order PO-00007 approved - Harbor Point');
    expect(text).toContain('Lakeside Management has approved purchase order PO-00007 for you.');
    expect(text).toContain('Needed by: November 2, 2026');
    expect(text).toContain('- Shingles: 2 x $200.00 = $400.00');
    expect(text).toContain('Total: $1,000.00');
    expect(text).toContain('help@lakeside.example');
    expect(text).not.toMatch(/https?:\/\//);
    expect(text).not.toMatch(/portier369/i);
  });
});

describe('20261016235000_po_cost_by_billed_gl (Codex on #397)', () => {
  const fix = read('supabase/migrations/20261016235000_po_cost_by_billed_gl.sql');

  it('uses up PO lines by the bill GL account first, then the rest in order', () => {
    expect(fix).toContain('create or replace function public.project_cost_by_category(p_project_id uuid)');
    expect(fix).toContain('left join po_bill_gl pb on pb.po_id = g.po_id and pb.gl is not distinct from g.gl');
    expect(fix).toContain('sum(greatest(pb.billed - coalesce(g.lines, 0), 0)) as extra');
    expect(fix).toContain('greatest(least(o.open_gl, o.running - coalesce(e.extra, 0)), 0)');
    // Finance-only PO amounts are kept.
    expect(fix).toContain('where v_fin');
    expect(fix).toContain('revoke all on function public.project_cost_by_category(uuid) from public, anon;');
  });
});

describe('savePurchaseOrder queues the vendor email before the notes write (Codex on #397)', () => {
  it('notifies the vendor before saving private notes', () => {
    const save = actions.slice(actions.indexOf('export async function savePurchaseOrder'), actions.indexOf('export async function submitPurchaseOrder'));
    expect(save.indexOf('notifyVendorOfPurchaseOrderApproval')).toBeGreaterThan(-1);
    expect(save.indexOf('notifyVendorOfPurchaseOrderApproval')).toBeLessThan(save.indexOf('savePrivateFields'));
    expect(save).toContain('The vendor was not emailed:');
  });
});
