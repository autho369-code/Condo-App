import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { workOrderMatch } from '@/lib/inventory/work-order-match';
import { companyAdminModules } from '@/lib/navigation/role-modules';

const root = process.cwd();
const read = (p: string) => readFileSync(resolve(root, p), 'utf8').replace(/\r\n/g, '\n');
const migration = read('supabase/migrations/20261016230000_inventory_reactivation_decisions.sql');
const fn = (name: string) => {
  const start = migration.indexOf(`create or replace function public.${name}(`);
  expect(start, name).toBeGreaterThan(-1);
  return migration.slice(start, migration.indexOf('$function$;', start));
};

describe('20261016230000: company admins use inventory', () => {
  it('scopes every inventory policy with the once-per-query staff-or-admin helper', () => {
    for (const policy of ['inventory_items_staff_select', 'inventory_items_staff_insert', 'inventory_items_staff_update', 'inventory_movements_staff_select']) {
      const start = migration.indexOf(`alter policy ${policy} `);
      expect(start, policy).toBeGreaterThan(-1);
      const body = migration.slice(start, migration.indexOf(';', start));
      expect(body).toContain('(select public.my_access_portfolio())');
      expect(body).toContain('coalesce(');
      expect(body).not.toMatch(/can_access_portfolio\(|is_any_staff/);
    }
  });

  it('lets a company admin record a movement, nobody else new', () => {
    expect(fn('record_inventory_movement')).toContain('if not (public.is_any_staff() or public.is_company_admin()) then');
  });

  it('opens the inventory pages and actions to company admins and lists them in their menu', () => {
    for (const p of ['app/(app)/inventory/page.tsx', 'app/(app)/inventory/new/page.tsx', 'app/(app)/inventory/bulk/page.tsx', 'app/(app)/inventory/[id]/page.tsx', 'lib/rpcs/inventory.ts']) {
      const src = read(p);
      expect(src, p).toContain('requireWorkspaceStaff');
      expect(src, p).not.toMatch(/\brequireStaff\b/);
    }
    expect(companyAdminModules.map((m) => m.href)).toContain('/inventory');
  });
});

describe('inventory "used on work order #N"', () => {
  it('looks only inside the item\'s company and refuses an ambiguous number', () => {
    const src = read('lib/rpcs/inventory.ts');
    expect(src).toContain(".eq('portfolio_id', item.portfolio_id)");
    expect(src).toContain('.limit(2)');
    expect(src).not.toMatch(/\.limit\(1\)\.maybeSingle\(\)/);
  });

  it('resolves one match, refuses none or several', () => {
    expect(workOrderMatch([{ id: 'a' }], '12-1')).toEqual({ id: 'a' });
    expect(workOrderMatch([], '12-1')).toEqual({ error: 'Work order #12-1 not found.' });
    expect(workOrderMatch(null, '12-1')).toHaveProperty('error');
    const many = workOrderMatch([{ id: 'a' }, { id: 'b' }], '12-1');
    expect('error' in many && many.error).toMatch(/More than one work order is numbered #12-1/);
  });
});

describe('20261016230000: late fees on the reactivation day', () => {
  it('adds portfolios.reactivated_at, recorded when a suspension is lifted and frozen for signed-in users', () => {
    expect(migration).toContain('alter table public.portfolios add column if not exists reactivated_at timestamptz;');
    const guard = fn('portfolios_guard_platform_columns');
    expect(guard).toMatch(/if current_user in \('authenticated', 'anon'\)\s+and new\.reactivated_at is distinct from old\.reactivated_at then\s+raise exception/);
    expect(guard).toMatch(/if old\.suspended_at is not null and new\.suspended_at is null then\s+new\.reactivated_at := now\(\);/);
    // Recorded before the early return for service-role and operator-admin updates.
    expect(guard.indexOf('new.reactivated_at := now()')).toBeLessThan(guard.indexOf('if auth.uid() is null'));
    // Everything the 20261016130000 guard froze is still frozen.
    for (const column of ['tier', 'entitlements', 'archived_at', 'suspended_at', 'suspension_reason', 'slug', 'custom_domain', 'created_by',
      'management_fee_auto_last_month', 'management_fee_auto_enabled', 'custom_domain_verified_at']) {
      expect(guard, column).toContain(`new.${column} is distinct from old.${column}`);
    }
    expect(guard).not.toContain('Portier369');
    const columns = JSON.parse(read('supabase/schema-columns.json'));
    expect(columns.portfolios).toContain('reactivated_at');
  });

  it('skips due AutoPay units for 24 hours after reactivation, units with money in flight, and still holds suspended companies', () => {
    const job = fn('cron_assess_late_fees');
    expect(job).toContain("pf.reactivated_at > now() - interval '24 hours'");
    expect(job).toMatch(/if \(a\.just_reactivated and exists \(\s+select 1 from public\.autopay_mandates am\s+where am\.unit_id = c\.unit_id\s+and am\.status = 'active'/);
    // Only mandates actually due today (the AutoPay run's own skip rule).
    expect(job).toContain('and am.next_run_date <= a.today');
    expect(job).toContain('and (am.skip_until is null or am.skip_until < a.today)');
    // Money in flight holds the fee in every company (not tied to a
    // reactivation): processing under 14 days, or an AutoPay intent pending
    // under a day. An unpaid portal checkout is not money in flight.
    expect(job).not.toContain('a.reactivated_at');
    expect(job).not.toContain('created_at >= ');
    const holdStart = job.search(/or exists \(\s+select 1 from public\.payment_intents pi/);
    expect(holdStart).toBeGreaterThan(-1);
    const hold = job.slice(holdStart, job.indexOf('v_autopay_held := v_autopay_held + 1;'));
    expect(hold).toContain('where pi.unit_id = c.unit_id');
    expect(hold).toContain("(pi.status = 'processing' and pi.created_at > now() - interval '14 days')");
    expect(hold).toMatch(/pi\.status = 'pending' and pi\.created_at > now\(\) - interval '1 day'[\s\S]*and exists \(select 1 from public\.stripe_autopay_runs r where r\.id = pi\.id\)/);
    expect(migration).toContain("create index if not exists payment_intents_unit_inflight_idx\n  on public.payment_intents (unit_id) where status in ('pending', 'processing');");
    expect(job).toContain('pf.suspended_at is not null');
    expect(job).toContain("'autopay_held', v_autopay_held");
  });
});
