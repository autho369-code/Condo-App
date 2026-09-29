import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260929140000_state_aware_delinquency_gates.sql'),
  'utf8',
).toLowerCase();

describe('state-aware delinquency gates migration', () => {
  it('seeds cited jurisdiction profiles including a conservative default', () => {
    for (const state of ["('default'", "('ca'", "('co'", "('fl'", "('il'", "('tx'"]) expect(migration).toContain(state);
    expect(migration).toContain('§ 5660');
    expect(migration).toContain('38-33.3-316.3');
    expect(migration).toContain('209.0064');
  });

  it('enforces the readiness blockers wherever a case enters legal review or counsel approval', () => {
    const guard = migration.slice(migration.indexOf('create or replace function public.guard_delinquency_legal_transition'));
    expect(guard.match(/public\.delinquency_referral_blockers\(new\.id\)/g)?.length).toBe(2);
  });

  it('checks notice age, method, payment plan length, and the latest board vote', () => {
    const b = migration.slice(migration.indexOf('create or replace function public.delinquency_referral_blockers'));
    expect(b).toContain('make_interval(days => p.pre_referral_notice_days)');
    expect(b).toContain("m.provider = 'manual_usps'");
    expect(b).toContain('payment_plan_min_months');
    expect(b).toContain("order by e.created_at desc limit 1");
  });

  it('restricts compliance changes to portfolio admins and keeps internals private', () => {
    for (const fn of ['apply_delinquency_jurisdiction', 'save_delinquency_compliance']) {
      const body = migration.slice(migration.indexOf(`create or replace function public.${fn}`));
      expect(body.slice(0, 1200)).toContain('public.can_admin_portfolio(v_portfolio)');
    }
    expect(migration).toContain('revoke all on function public.delinquency_referral_blockers(uuid) from authenticated');
    expect(migration).toContain('revoke insert, update, delete on public.collection_jurisdiction_profiles from authenticated, anon');
  });
});
