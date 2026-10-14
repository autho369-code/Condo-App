import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toneForStatus } from '@/components/ui/shell';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
const migration = read('supabase/migrations/20261015130000_removed_late_fee_status.sql');

describe('20261015130000_removed_late_fee_status migration', () => {
  it('labels a late fee covered by a removal credit as removed', () => {
    expect(migration).toContain("then 'removed'::text");
    expect(migration).toContain("c.charge_type = 'late_fee'");
    expect(migration).toContain("rp.reference = 'Late fee removed'");
    expect(migration).toContain('rp.reversed_at is null');
  });

  it('keeps the view security_invoker with one sum per charge', () => {
    expect(migration).toContain('with (security_invoker = true)');
    expect(migration.match(/left join lateral/g)?.length).toBe(1);
  });

  it('uses the association local date for past due', () => {
    expect(migration).toContain("(pg_catalog.now() at time zone coalesce(nullif(a.timezone, ''), 'America/Chicago'))::date");
    expect(migration).not.toMatch(/c\.due_date < current_date/);
  });

  it('only database functions can mark a credit as a removed late fee', () => {
    expect(migration).toContain("current_user in ('authenticated', 'anon')");
    expect(migration).toContain('before insert or update of reference, method on public.payments');
  });

  it('says the reference is reserved (20261015140000)', () => {
    const message = read('supabase/migrations/20261015140000_removed_late_fee_marker_message.sql');
    expect(message).toContain('The reference "Late fee removed" is reserved. Remove late fees from the unit page');
    expect(message).toContain("current_user in ('authenticated', 'anon')");
  });

  it('a removal credit counts only for its own fee and its applications are guarded (Codex on #383)', () => {
    const guard = read('supabase/migrations/20261015150000_removed_late_fee_applications.sql');
    expect(guard).toContain('and rp.charge_id = c.id');
    expect(guard).toContain('before insert or update of reference, method, charge_id on public.payments');
    expect(guard).toContain('before insert or update on public.payment_applications');
    expect(guard).toContain('public.is_late_fee_removal_credit(new.payment_id)');
    expect(guard).not.toMatch(/\bdrop\s+(table|column|view|function|policy)\b/i);
  });

  it('drops or deletes nothing', () => {
    expect(migration).not.toMatch(/\bdrop\s+(table|column|view|function|policy)\b/i);
    expect(migration).not.toMatch(/\bdelete\s+from\b/i);
  });
});

describe('removed late fee display', () => {
  it('shows removed in a neutral tone', () => {
    expect(toneForStatus('removed')).toBe('inactive');
  });

  it('the unit page uses the shared Badge for charge status', () => {
    const page = read('app/(app)/units/[id]/page.tsx');
    expect(page).toContain("<Badge status={c.payment_status} tone={c.is_past_due ? 'danger' : undefined} />");
    expect(page).not.toContain("c.payment_status === 'paid' ? 'bg-green-100");
  });
});
