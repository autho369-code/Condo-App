import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The 2026-10-31 Elephant-Goldfish review fixes (#420 + follow-up). The
// database tests read these two migrations only: they catch an edit to them,
// not a later migration that redefines the same function or policy. The
// server action is tested for real; the Stripe early stop is tested in
// tests/payments/stripe-webhook-route.test.ts.

vi.mock('server-only', () => ({}));
const redirects: string[] = [];
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { redirects.push(url); throw new Error(`REDIRECT ${url}`); },
}));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
vi.mock('@/lib/auth/me', () => ({ requireStaff: vi.fn(async () => ({ is_staff: true })) }));

const rpcCalls: Array<{ fn: string; args: unknown }> = [];
let requestRow: unknown = { id: 'r' };
let moneyIds: string[] = [];
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => {
      const b: any = { select: () => b, eq: () => b, maybeSingle: async () => ({ data: requestRow, error: null }) };
      return b;
    },
    rpc: async (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args });
      if (fn === 'money_approval_request_ids') return { data: moneyIds, error: null };
      return { data: null, error: null };
    },
  }),
}));

import { recordApprovalRequestDecision } from '@/lib/rpcs/approval-requests';

const read = (f: string) => readFileSync(resolve(process.cwd(), 'supabase/migrations', f), 'utf8').replace(/\r\n/g, '\n');
const first = read('20261031110358_egm_review_fixes.sql');
const followup = read('20261031114852_egm_followups.sql');
const both = `${first}\n${followup}`;
const section = (sql: string, from: string, to: string) => sql.slice(sql.indexOf(from), sql.indexOf(to, sql.indexOf(from)));

const ASSOC = '11111111-1111-4111-8111-111111111111';
const REQ = '22222222-2222-4222-8222-222222222222';
function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

beforeEach(() => {
  redirects.length = 0;
  rpcCalls.length = 0;
  requestRow = { id: REQ };
  moneyIds = [];
});

describe('2026-10-31 review: database rules', () => {
  it('a buyer reads payment applications only from move-in on or on charges they can see, as a resident', () => {
    expect(followup).toMatch(/create policy payment_apps_resident_read[\s\S]*is_portal_resident\(\)[\s\S]*resident_visible_payment_ids\(\)[\s\S]*resident_visible_charge_ids\(\)/);
  });

  it('operator writes on the email hold and platform switch need an admin', () => {
    expect(first).toMatch(/create policy operator_writes_need_admin_insert on public\.email_hold_associations/);
    expect(followup).toMatch(/create policy operator_writes_need_admin_update on public\.platform_flags/);
    expect(followup).toMatch(/create trigger operator_write_guard\s+before insert or update or delete on public\.platform_flags/);
  });

  it('work order message authors are set by the database, only as owner/vendor/staff, and frozen on edit', () => {
    expect(followup).toContain("not in ('owner', 'vendor', 'staff') then");
    expect(followup).toContain("new.author_role = 'owner' and not public.is_portal_resident()");
    expect(followup).toContain('new.author_id := auth.uid();');
    expect(followup).toContain('new.author_role := old.author_role;');
    expect(followup).toMatch(/create trigger work_order_messages_author\s+before insert or update on public\.work_order_messages/);
    expect(followup).toMatch(/create policy wo_msg_vendor_insert[\s\S]*rls_private\.vendor_postable_work_order_ids\(\)/);
  });

  it('pets and tenants stay in their unit, owner and tenant company, checking only links that changed', () => {
    expect(followup).toContain("raise exception 'That unit is not in this company'");
    expect(followup).toContain("raise exception 'That owner is not in this company'");
    expect(followup).toContain("raise exception 'That tenant is not in this company'");
    expect(followup).toContain('new.owner_id is distinct from old.owner_id');
  });

  it('vendors read calendar events only through the vendor-safe function, upcoming first', () => {
    expect(first).toMatch(/create policy calendar_events_vendor_read on public\.calendar_events\s+for select to authenticated\s+using \(false\)/);
    const fn = section(followup, 'create or replace function public.vendor_calendar_events', '$$;');
    expect(fn).not.toMatch(/internal_notes|attendees|notification_recipients|maintenance_instructions/);
    expect(fn).toMatch(/order by \(e\.start_datetime < now\(\)\),\s+case when e\.start_datetime >= now\(\) then e\.start_datetime end,\s+e\.start_datetime desc/);
  });

  it('the email hold over-holds (substring match), never whole-address only', () => {
    const fn = section(followup, 'create or replace function public.email_is_held', '$function$;');
    expect(fn).toContain('position((select addr from a) in lower(coalesce(t.email');
    expect(fn).not.toContain('email_list_has');
  });

  it('vendor logins are never linked by email', () => {
    const relink = section(followup, 'create or replace function public.relink_all_portal_users', '$function$;');
    expect(relink).toContain('n_vendors := 0;');
    expect(relink).not.toContain('public.vendors');
    const link = section(first, 'create or replace function public.link_portal_user', '$function$;');
    expect(link).not.toContain('public.vendors');
  });

  it('a new approval request starts pending with no votes or decision', () => {
    expect(first).toMatch(/create policy approval_requests_insert_guard[\s\S]*status = 'pending'::public\.approval_request_status[\s\S]*decision_at is null/);
  });

  it('bills re-check the board setting at submit, before the board-approved PO exemption', () => {
    const fn = section(followup, 'create or replace function public.request_payable_bill_approval', '$function$;');
    const recheck = fn.indexOf('select coalesce(s.sends_bills_to_board');
    const poExemption = fn.indexOf('payable_bill_within_board_approved_po');
    expect(recheck).toBeGreaterThan(0);
    expect(poExemption).toBeGreaterThan(recheck);
  });

  it('the chart of accounts is written only by this company admin or an operator', () => {
    for (const cmd of ['insert', 'update', 'delete']) {
      expect(followup).toMatch(new RegExp(`create policy gl_accounts_admin_${cmd} on public\\.gl_accounts\\s+as restrictive[\\s\\S]*?my_admin_portfolio\\(\\)[\\s\\S]*?portfolio_id is not null`));
    }
  });

  it('unused helpers cannot be called', () => {
    expect(followup).toContain('revoke execute on function rls_private.resident_payment_ids() from authenticated');
    expect(followup).toContain('revoke execute on function public.email_list_has(text, text) from public, anon, authenticated');
    expect(both).toMatch(/grant execute on function public\.money_approval_request_ids\(uuid\[\]\) to authenticated/);
  });
});

describe('recording a general board approval decision', () => {
  it('records the decision through the database function', async () => {
    await expect(recordApprovalRequestDecision(form({ association_id: ASSOC, approval_request_id: REQ, decision: 'approved', note: 'March meeting' }))).rejects.toThrow(/REDIRECT/);
    expect(rpcCalls.map((c) => c.fn)).toEqual(['money_approval_request_ids', 'record_approval_decision']);
    expect(rpcCalls[1].args).toEqual({ p_request_id: REQ, p_decision: 'approved', p_note: 'March meeting' });
    expect(redirects.at(-1)).toBe(`/associations/${ASSOC}/approvals?saved=decision`);
  });

  it('sends a request behind a bill or purchase order back to that page', async () => {
    moneyIds = [REQ];
    await expect(recordApprovalRequestDecision(form({ association_id: ASSOC, approval_request_id: REQ, decision: 'approved' }))).rejects.toThrow(/REDIRECT/);
    expect(rpcCalls.map((c) => c.fn)).toEqual(['money_approval_request_ids']);
    expect(redirects.at(-1)).toContain('error=');
  });

  it('refuses a request from another association and a missing decision', async () => {
    requestRow = null;
    await expect(recordApprovalRequestDecision(form({ association_id: ASSOC, approval_request_id: REQ, decision: 'approved' }))).rejects.toThrow(/REDIRECT/);
    expect(rpcCalls).toHaveLength(0);

    requestRow = { id: REQ };
    await expect(recordApprovalRequestDecision(form({ association_id: ASSOC, approval_request_id: REQ, decision: 'maybe' }))).rejects.toThrow(/REDIRECT/);
    expect(rpcCalls).toHaveLength(0);
  });
});
