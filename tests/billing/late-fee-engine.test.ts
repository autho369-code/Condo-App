import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { describeLateFeeRule } from '@/components/owners/late-fee-overrides';

const sql = readFileSync('supabase/migrations/20260929210000_single_late_fee_engine_owner_overrides.sql', 'utf8');
const fn = (name: string) => sql.split(`create or replace function public.${name}(`)[1]?.split('end $$;')[0] ?? '';

describe('single late-fee engine', () => {
  it('unschedules the legacy portfolio-wide job', () => {
    expect(sql).toContain("perform cron.unschedule('apply-late-fees-daily')");
  });

  it('routes the legacy entry point through assess_late_fee and only for enabled associations', () => {
    const body = fn('apply_late_fees');
    expect(body).toContain('public.assess_late_fee(r.id)');
    expect(body).toContain('a.late_fee_enabled');
    expect(body).not.toMatch(/insert into public\.charges/);
  });

  it('applies owner exemptions before computing the fee', () => {
    const body = fn('assess_late_fee');
    expect(body.indexOf('unit_late_fee_override')).toBeGreaterThan(0);
    expect(body.indexOf('if coalesce(v_ovr.exempt, false)')).toBeLessThan(body.indexOf('v_fee := case'));
  });

  it('requires finance permission and a reason for overrides, and audits them', () => {
    const body = fn('set_owner_late_fee_override');
    expect(body).toContain('can_manage_finance(o.pid)');
    expect(body).toContain('Give a reason for the late-fee exception');
    expect(body).toContain("'late_fee_override_updated'");
  });

  it('keeps internal helpers off the authenticated role', () => {
    expect(sql).toMatch(/array\['public\.unit_late_fee_override\(uuid\)', 'public\.apply_late_fees\(\)'\][\s\S]*revoke all on function %s from public, anon, authenticated/);
  });
});

describe('late-fee rule labels', () => {
  const base = { id: 'o', status: 'current', occupancy_type: 'owner', late_fee_exempt: false, late_fee_override_amount: null, late_fee_override_is_percent: false, late_fee_override_until: null, late_fee_override_reason: null };
  it('describes default, exempt, custom and expired rules', () => {
    expect(describeLateFeeRule(base).label).toBe('Association default');
    expect(describeLateFeeRule({ ...base, late_fee_exempt: true, late_fee_override_reason: 'Plan' }).label).toBe('Exempt');
    expect(describeLateFeeRule({ ...base, late_fee_override_amount: 5, late_fee_override_is_percent: true }).label).toBe('Custom: 5% of the overdue balance');
    expect(describeLateFeeRule({ ...base, late_fee_exempt: true, late_fee_override_until: '2026-01-01' }, '2026-09-29').label).toBe('Association default');
  });
});
