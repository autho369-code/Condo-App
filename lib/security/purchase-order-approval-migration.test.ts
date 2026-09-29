import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260929100000_purchase_order_approval_workflow.sql'),
  'utf8',
).toLowerCase();

describe('purchase order approval workflow migration', () => {
  it('routes every PO write through audited, scoped RPCs', () => {
    expect(migration).toContain('revoke insert, update, delete on public.purchase_orders from authenticated');
    expect(migration).toContain('revoke insert, update, delete on public.purchase_order_line_items from authenticated');
    for (const fn of ['save_purchase_order', 'submit_purchase_order', 'cancel_purchase_order', 'set_board_approval_settings']) {
      expect(migration).toContain(`create or replace function public.${fn}`);
    }
    expect(migration.match(/security definer/g)?.length).toBeGreaterThanOrEqual(6);
    expect(migration.match(/set search_path = pg_catalog, public/g)?.length).toBeGreaterThanOrEqual(6);
  });

  it('checks finance permission and tenant scope inside each RPC', () => {
    expect(migration.match(/public\.can_manage_finance\(/g)?.length).toBeGreaterThanOrEqual(3);
    expect(migration).toContain('a.portfolio_id = p_portfolio_id');
    expect(migration).toContain('v.portfolio_id = p_portfolio_id');
    expect(migration).toContain('w.association_id = p_association_id');
    expect(migration).toContain('g.association_id is null or g.association_id = p_association_id');
  });

  it('keeps the board-vote helper and decision trigger off the public API', () => {
    expect(migration).toMatch(/revoke all on function public\.open_board_approval_request\([^)]*\) from public, anon, authenticated/);
    expect(migration).toMatch(/revoke all on function public\.sync_purchase_order_board_decision\(\) from public, anon, authenticated/);
  });

  it('only lets vendors see approved purchase orders', () => {
    expect(migration).toMatch(/create policy purchase_orders_vendor_read[\s\S]*approval_status = 'approved'/);
    expect(migration).toMatch(/create policy po_line_items_vendor_read[\s\S]*p\.approval_status = 'approved'/);
  });

  it('audits approval-rule changes and restricts them to full-access staff', () => {
    expect(migration).toContain("'board_approval_settings_updated'");
    expect(migration).toContain('public.is_full_access_staff()');
  });
});
