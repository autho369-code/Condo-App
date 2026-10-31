import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Smaller items from the 2026-10-31 Elephant-Goldfish review. These read this
// migration only: they catch an edit to it, not a later migration that
// redefines the same function, trigger or policy.
const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261031120503_egm_small_fixes.sql'), 'utf8').replace(/\r\n/g, '\n');
const section = (from: string, to: string) => sql.slice(sql.indexOf(from), sql.indexOf(to, sql.indexOf(from)));
const page = (f: string) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('2026-10-31 review: smaller fixes', () => {
  it('AutoPay claims a run from the association local date', () => {
    const fn = section('create or replace function public.claim_stripe_autopay_run', '$function$;');
    expect(fn).toContain('p_scheduled_for > public.association_local_date(v_mandate.association_id, now())');
    expect(fn).not.toContain('p_scheduled_for > current_date');
  });

  it('owner items end on every way an owner occupancy ends, and only then', () => {
    const fn = section('create or replace function public.end_owner_unit_items_when_occupancy_ends', '$function$;');
    expect(fn).toContain("if tg_op = 'INSERT' then");
    expect(fn).toContain("old.status in ('current', 'future')");
    expect(fn).toContain('new.owner_id is not distinct from old.owner_id');
    expect(fn).toContain('new.unit_id is not distinct from old.unit_id');
    expect(fn).toContain("o.status in ('current', 'future')");
    expect(sql).toMatch(/create or replace trigger trg_occupancies_end_owner_unit_items\s+after insert or update of status, owner_id, unit_id, occupancy_type or delete on public\.occupancies/);
  });

  it('the four policies read through invoker helpers and are altered, not dropped', () => {
    expect(sql).not.toMatch(/\bdrop (policy|trigger)\b/i);
    for (const helper of ['finance_purchase_order_ids', 'my_company_vendor_ids', 'resident_arc_request_ids']) {
      const fn = section(`create or replace function rls_private.${helper}()`, '$$;');
      expect(fn).toContain('security invoker');
      expect(sql).toContain(`grant execute on function rls_private.${helper}() to authenticated`);
    }
    expect(sql).toMatch(/alter policy po_line_items_staff_all[\s\S]*finance_purchase_order_ids/);
    expect(sql).toMatch(/alter policy mgr_assoc_scope on public\.document_requests\s+using \(\s+\(vendor_id is null or vendor_id in \(select rls_private\.my_company_vendor_ids\(\)\)\)/);
    expect(sql).toMatch(/alter policy arch_msg_resident_insert[\s\S]*resident_arc_request_ids/);
    expect(sql).toMatch(/alter policy wo_updates_vendor_insert[\s\S]*vendor_postable_work_order_ids/);
  });

  it('purchase-order lookup calls its helpers once per query', () => {
    const fn = section('create or replace function rls_private.finance_purchase_order_ids()', '$$;');
    expect(fn).toContain('(select public.my_finance_portfolio())');
    expect(fn).toContain('(select public.is_platform_operator())');
  });

  it('operator account and invitation actions ask before acting', () => {
    const company = page('app/platform-operator/companies/[id]/page.tsx');
    for (const label of ['Send Reset', 'Reactivate', 'New Link', 'Unlock']) {
      expect(company).toMatch(new RegExp(`<PendingSubmit[^>]*confirm=[^>]*>${label}</PendingSubmit>`));
    }
    const invitations = page('app/platform-operator/invitations/page.tsx');
    expect(invitations).toMatch(/<PendingSubmit[^>]*confirm=[^>]*>New Link<\/PendingSubmit>/);
    expect(invitations).toMatch(/<PendingSubmit[^>]*confirm=[^>]*>Cancel<\/PendingSubmit>/);
    const owner = page('app/(app)/owners/[id]/page.tsx');
    expect(owner).toMatch(/<PendingSubmit[^>]*confirm=[^>]*>Reset password<\/PendingSubmit>/);
    expect(owner).toMatch(/<PendingSubmit[^>]*confirm=[^>]*>Enable portal<\/PendingSubmit>/);
  });

  it('pages fall back to "Your management company"', () => {
    for (const f of ['app/(app)/bills/page.tsx', 'app/(app)/charges/page.tsx', 'app/(app)/owners/page.tsx', 'app/(app)/violations/page.tsx', 'app/(app)/work-orders/page.tsx', 'app/(app)/architectural-reviews/page.tsx', 'app/(app)/service-requests/page.tsx', 'app/(app)/payments/[id]/receipt/page.tsx']) {
      expect(page(f)).not.toMatch(/company_name \?\? '(Management company|Management office)'/);
    }
  });
});
