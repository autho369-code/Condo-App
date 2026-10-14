import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn(), createClient: vi.fn() }));

import { existingWorkOrder, activeWorkOrder } from '@/lib/maintenance/intake';
import { mergeSourceRef, workOrderRef } from '@/lib/maintenance/comms-refs';
import { vendorAssignmentEmail } from '@/lib/notifications/vendor-assignment';
import { workOrderPredatesOwner } from '@/lib/notifications/status-change';

const root = process.cwd();
const read = (p: string) => readFileSync(resolve(root, p), 'utf8').replace(/\r\n/g, '\n');
const migration = read('supabase/migrations/20261015170000_work_orders_fixes.sql');

describe('20261015170000_work_orders_fixes migration', () => {
  it('never gives a request a second work order once one exists', () => {
    expect(migration).toContain("raise exception 'This request already has a work order'");
    expect(migration).toContain("and wo.status::text <> 'cancelled'");
    // The open work order is still returned first (a double click lands on it).
    expect(migration).toContain("execute replace(d, a, a || $new$");
  });

  it('keeps the request in step with its work orders, without a backfill', () => {
    const trigger = migration.slice(migration.indexOf('create or replace function public.work_order_sync_request_triage()'));
    // Completed when the last open work order leaves (finished, cancelled, archived, deleted, moved).
    expect(trigger).toContain("(tg_op = 'DELETE' or not v_new_open or new.service_request_id is distinct from old.service_request_id)");
    expect(trigger).toContain("set status = 'completed'");
    // Reopened: back to waiting, unless the request was cancelled.
    expect(trigger).toContain("old.status::text in ('done', 'completed', 'billed', 'closed') then");
    expect(trigger).toMatch(/set status = 'waiting',\s+resolved_at = null[\s\S]*?and s\.status = 'completed';/);
    // No backfill: it would fire the resolved webhook for old requests.
    expect(migration).not.toMatch(/^update public\.service_requests/m);
  });

  it('keeps resolved_at on nested updates by non-staff callers', () => {
    expect(migration).toContain("pg_get_functiondef('public.service_request_guard_update()'::regprocedure)");
    expect(migration).toContain('new.resolved_at := v_resolved;');
  });

  it('shows permission to enter only to the assigned vendor', () => {
    expect(migration).toContain('create or replace function public.vendor_work_order_permission_to_enter(p_work_order_id uuid)');
    expect(migration).toContain('and w.vendor_id in (select public.current_vendor_ids())');
    expect(migration).toContain('revoke all on function public.vendor_work_order_permission_to_enter(uuid) from public, anon;');
    expect(migration).toContain('grant execute on function public.vendor_work_order_permission_to_enter(uuid) to authenticated;');
  });

  it('dates requests and tenure by the association calendar, not the server date', () => {
    expect(migration).toContain("a1 text := E'    new.created_at := now(); new.created_on := current_date;\\n';");
    expect(migration).toContain('new.created_on := public.association_local_date(new.association_id, coalesce(new.created_at, now()));');
    // An explicit staff date is kept; the server-date default is gone.
    expect(migration).toContain('if (not v_is_staff and auth.uid() is not null) or new.created_on is null then');
    expect(migration).toContain('alter table public.service_requests alter column created_on set default null;');
    const helpers = migration.slice(
      migration.indexOf('create or replace function public.current_resident_unit_ids()'),
      migration.indexOf('revoke all on function public.current_resident_unit_ids()'),
    );
    expect(helpers).not.toMatch(/current_date|created_at::date/);
    expect(helpers.match(/coalesce\(nullif\(a\.timezone, ''\), 'America\/Chicago'\)/g)?.length).toBe(9);
    // RLS helpers stay PL/pgSQL (a nested SQL helper is re-planned per call).
    expect(helpers).not.toMatch(/language sql/i);
    expect(migration).toContain('public.association_local_date(wo.association_id, wo.created_at) >= public.current_resident_unit_since(wo.unit_id)) /* work_orders_fixes */');
  });

  it('lets residents post only as themselves, on unarchived work orders they can see', () => {
    expect(migration).toContain('alter policy wo_msg_resident_insert on public.work_order_messages');
    expect(migration).toContain('and author_id = (select auth.uid())');
    expect(migration).toContain('and work_order_id in (select rls_private.resident_postable_work_order_ids())');
    const postable = migration.slice(migration.indexOf('create or replace function rls_private.resident_postable_work_order_ids()'));
    expect(postable).toContain('where w.archived_at is null');
  });

  it('reads resident requests and payment plans through once-per-query id sets', () => {
    expect(migration).toContain('or id in (select rls_private.resident_visible_service_request_ids()))');
    expect(migration).toContain('using (id in (select rls_private.resident_visible_payment_plan_ids()));');
    const policies = migration.match(/alter policy[^;]*;/g) ?? [];
    expect(policies.length).toBe(3);
    for (const p of policies) expect(p).not.toContain('current_resident_unit_since(');
  });

  it('is re-runnable and drops or deletes nothing', () => {
    expect(migration).not.toMatch(/\bdrop\s+(table|column|view|function|policy|trigger)\b/i);
    expect(migration).not.toMatch(/\bdelete\s+from\b/i);
    const patches = migration.match(/position\('work_orders_fixes' in d\) > 0 then return/g) ?? [];
    expect(patches.length).toBe(4);
    const anchors = migration.match(/anchor not found exactly once/g) ?? [];
    expect(anchors.length).toBe(7);
  });
});

describe('existingWorkOrder', () => {
  it('prefers the open work order, then a finished one, never a cancelled one', () => {
    const open = { id: 'o', status: 'in_progress' };
    const done = { id: 'd', status: 'completed' };
    const cancelled = { id: 'c', status: 'cancelled' };
    expect(existingWorkOrder({ work_orders: [done, open] })).toBe(open);
    expect(existingWorkOrder({ work_orders: [cancelled, done] })).toBe(done);
    expect(existingWorkOrder({ work_orders: [cancelled] })).toBeNull();
    expect(existingWorkOrder({ work_orders: null })).toBeNull();
    expect(activeWorkOrder({ work_orders: [done] })).toBeNull();
  });
});

describe('vendor bulk message references', () => {
  it('lists every selected work order once', () => {
    const a = workOrderRef({ id: '1', number: 101, title: 'Leak' });
    const b = workOrderRef({ id: '2', number: 102, title: 'Light' });
    expect(a).toBe('WO #101 — Leak');
    expect(mergeSourceRef(mergeSourceRef(mergeSourceRef(null, a), b), a)).toBe('WO #101 — Leak; WO #102 — Light');
  });
});

describe('vendorAssignmentEmail', () => {
  const job = {
    id: 'w1', number: 42, title: 'Kitchen faucet', associationName: 'Granville Tower', unitNumber: '4B',
    scheduledDate: '2026-10-20', scheduledTime: '9:00 AM', link: 'https://acme.example.com/vendor/work-orders/w1',
  };

  it('names the job, property, date and company link, signed by the company', () => {
    const { subject, text } = vendorAssignmentEmail({ vendorName: 'Acme Plumbing', brandName: 'Lakeside Management', supportEmail: 'help@lakeside.example', jobs: [job] });
    expect(subject).toBe('New work order #42 Kitchen faucet');
    expect(text).toContain('Lakeside Management has assigned you a work order.');
    expect(text).toContain('Property: Granville Tower, Unit 4B');
    expect(text).toContain('Scheduled: October 20, 2026 at 9:00 AM');
    expect(text).toContain('https://acme.example.com/vendor/work-orders/w1');
    expect(text).toContain('— Lakeside Management\nhelp@lakeside.example');
    expect(text).not.toMatch(/portier369/i);
  });

  it('lists several jobs in one email', () => {
    const { subject, text } = vendorAssignmentEmail({
      vendorName: 'Acme', brandName: 'Lakeside Management', supportEmail: null,
      jobs: [job, { ...job, id: 'w2', number: 43, title: 'Hallway light', scheduledDate: null, scheduledTime: null }],
    });
    expect(subject).toBe('2 new work orders from Lakeside Management');
    expect(text).toContain('#43 Hallway light');
    expect(text).toContain('Scheduled: Not scheduled yet');
  });
});

describe('workOrderPredatesOwner', () => {
  it("compares the association's local date with the move-in date", () => {
    // 02:00 UTC on Oct 15 is still Oct 14 in Chicago.
    expect(workOrderPredatesOwner('2026-10-15T02:00:00Z', '2026-10-15', 'America/Chicago')).toBe(true);
    expect(workOrderPredatesOwner('2026-10-15T02:00:00Z', '2026-10-15', 'UTC')).toBe(false);
    expect(workOrderPredatesOwner('2026-10-16T15:00:00Z', '2026-10-15', null)).toBe(false);
  });
});
