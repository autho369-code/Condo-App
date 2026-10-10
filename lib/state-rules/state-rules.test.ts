import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { US_STATES, collectionRequirements, starterOtherRules, stateCodeOf, stateName } from './index';

describe('state rules helpers', () => {
  it('covers the 50 states and DC', () => {
    expect(US_STATES).toHaveLength(51);
    expect(US_STATES.some((s) => s.code === 'DC')).toBe(true);
  });

  it('reads an association state written as a code or a name', () => {
    expect(stateCodeOf('IL')).toBe('IL');
    expect(stateCodeOf(' il ')).toBe('IL');
    expect(stateCodeOf('Illinois')).toBe('IL');
    expect(stateCodeOf('')).toBeNull();
    expect(stateCodeOf('Ontario')).toBeNull();
    expect(stateName('TX')).toBe('Texas');
  });

  it('describes the collection gates in plain words', () => {
    const gates = collectionRequirements({
      notice_method: 'certified_mail', pre_referral_notice_days: 30, payment_plan_offer_required: true,
      payment_plan_min_months: 18, board_vote_required: true, foreclosure_min_balance: 1800, foreclosure_min_months: null,
    });
    expect(gates).toEqual([
      'Certified-mail notice delivered at least 30 days before referral',
      'Payment plan offered (at least 18 months)',
      'Board vote approving referral',
      'Foreclosure only at $1,800 or more owed',
    ]);
  });

  it('drafts other requirements from the state summary', () => {
    const { otherRules, citations } = starterOtherRules('IL');
    expect(otherRules).toMatch(/^- /);
    expect(citations.length).toBeGreaterThan(0);
    expect(starterOtherRules('ZZ')).toEqual({ otherRules: '', citations: [] });
  });
});

describe('company_state_rules migration', () => {
  const sql = readFileSync(path.join(__dirname, '../../supabase/migrations/20261010010000_company_state_rules.sql'), 'utf8');

  it('lets company admins write and the company read', () => {
    expect(sql).toContain('enable row level security');
    expect(sql).toMatch(/for select to authenticated using \(public\.can_access_portfolio\(portfolio_id\)\)/);
    for (const cmd of ['insert', 'update', 'delete']) {
      const policy = sql.slice(sql.indexOf(`create policy company_state_rules_${cmd}`));
      expect(policy.slice(0, policy.indexOf(';'))).toContain('public.can_admin_portfolio(portfolio_id)');
    }
    expect(sql).toContain('revoke all on public.company_state_rules from anon');
  });

  it('applies the company rule before the built-in profile and the default', () => {
    const fn = sql.slice(sql.indexOf('create or replace function public.apply_delinquency_jurisdiction'));
    expect(fn.indexOf('from public.company_state_rules r')).toBeLessThan(fn.indexOf("where p.state_code = v_code"));
    expect(fn.indexOf("where p.state_code = v_code")).toBeLessThan(fn.indexOf("where p.state_code = 'DEFAULT'"));
    expect(fn).toContain('r.portfolio_id = v_portfolio');
  });

  it('removes nothing', () => {
    expect(sql).not.toMatch(/\bdrop\s+(table|column|function)\b|\bdelete\s+from\b|\btruncate\b/i);
  });
});
