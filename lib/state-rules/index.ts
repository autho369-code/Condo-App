// State rules: each management company records the rules it follows in each
// state (company_state_rules). Where it has none for a state, the built-in
// collection profile (collection_jurisdiction_profiles) applies.

import { STATE_LAWS } from '@/lib/seo/hoa-states';

export const US_STATES: { code: string; name: string }[] = STATE_LAWS
  .map((s) => ({ code: s.abbr, name: s.name }))
  .sort((a, b) => a.name.localeCompare(b.name));

const STATE_NAME = new Map(US_STATES.map((s) => [s.code, s.name]));

/** Two-letter code from an association's free-text state ("il", "Illinois"). */
export function stateCodeOf(value: string | null | undefined): string | null {
  const v = (value ?? '').trim();
  if (!v) return null;
  const upper = v.toUpperCase();
  if (STATE_NAME.has(upper)) return upper;
  return US_STATES.find((s) => s.name.toUpperCase() === upper)?.code ?? null;
}

export function stateName(code: string | null | undefined): string {
  return (code && STATE_NAME.get(code)) || code || 'Unknown state';
}

export const STATE_RULE_COLUMNS =
  'id, state_code, pre_referral_notice_days, notice_method, payment_plan_offer_required, payment_plan_min_months, board_vote_required, foreclosure_min_balance, foreclosure_min_months, summary, other_rules, citations, updated_at';

export type StateRule = {
  state_code: string;
  pre_referral_notice_days: number;
  notice_method: string;
  payment_plan_offer_required: boolean;
  payment_plan_min_months: number | null;
  board_vote_required: boolean;
  foreclosure_min_balance: number | null;
  foreclosure_min_months: number | null;
  summary: string;
  other_rules: string | null;
  citations: string[];
};

/** The collection gates of a rule, in plain words. */
export function collectionRequirements(rule: Pick<StateRule, 'notice_method' | 'pre_referral_notice_days' | 'payment_plan_offer_required' | 'payment_plan_min_months' | 'board_vote_required' | 'foreclosure_min_balance' | 'foreclosure_min_months'>): string[] {
  return [
    `${rule.notice_method === 'certified_mail' ? 'Certified-mail' : 'Written'} notice delivered at least ${rule.pre_referral_notice_days} days before referral`,
    rule.payment_plan_offer_required ? `Payment plan offered${rule.payment_plan_min_months ? ` (at least ${rule.payment_plan_min_months} months)` : ''}` : null,
    rule.board_vote_required ? 'Board vote approving referral' : null,
    rule.foreclosure_min_balance != null ? `Foreclosure only at $${Number(rule.foreclosure_min_balance).toLocaleString()} or more owed` : null,
    rule.foreclosure_min_months != null ? `Foreclosure only after ${rule.foreclosure_min_months} months delinquent` : null,
  ].filter(Boolean) as string[];
}

/**
 * The rules for one state: the company's own when it has them, otherwise the
 * built-in collection profile for the state (or the default). `source` says
 * which. Reads through the caller's RLS session.
 */
export async function loadStateRule(
  db: any,
  portfolioId: string | null | undefined,
  stateCode: string | null,
): Promise<{ rule: StateRule | null; source: 'company' | 'built_in' | 'default' | null; error: string | null }> {
  if (stateCode && portfolioId) {
    const { data, error } = await db.from('company_state_rules').select(STATE_RULE_COLUMNS)
      .eq('portfolio_id', portfolioId).eq('state_code', stateCode).maybeSingle();
    if (error) return { rule: null, source: null, error: error.message };
    if (data) return { rule: data as StateRule, source: 'company', error: null };
  }
  const codes = stateCode ? [stateCode, 'DEFAULT'] : ['DEFAULT'];
  const { data, error } = await db.from('collection_jurisdiction_profiles')
    .select('state_code, pre_referral_notice_days, notice_method, payment_plan_offer_required, payment_plan_min_months, board_vote_required, foreclosure_min_balance, foreclosure_min_months, summary, citations')
    .in('state_code', codes);
  if (error) return { rule: null, source: null, error: error.message };
  const own = (data ?? []).find((p: any) => p.state_code === stateCode);
  const fallback = (data ?? []).find((p: any) => p.state_code === 'DEFAULT');
  const profile = own ?? fallback;
  if (!profile) return { rule: null, source: null, error: null };
  return { rule: { ...profile, other_rules: null } as StateRule, source: own ? 'built_in' : 'default', error: null };
}

/** A starting draft of "other state requirements" for a state the company has no rule for yet. */
export function starterOtherRules(stateCode: string): { otherRules: string; citations: string[] } {
  const law = STATE_LAWS.find((s) => s.abbr === stateCode);
  if (!law) return { otherRules: '', citations: [] };
  return {
    otherRules: [...law.keyPoints, `Resale: ${law.resale}`].map((line) => `- ${line}`).join('\n'),
    citations: [law.condoAct, law.hoaAct].filter(Boolean) as string[],
  };
}
