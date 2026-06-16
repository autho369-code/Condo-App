// Single source of truth for subscription plans — mirrors the public pricing
// page (portier369.com/pricing). Tier ids match the `portfolio_tier` Postgres
// enum (foundation | growth | portfolio | enterprise).

export type PlanId = 'foundation' | 'growth' | 'portfolio' | 'enterprise';

export interface Plan {
  id: PlanId;
  name: string;
  /** Monthly price in cents; null = custom (Enterprise). */
  priceMonthlyCents: number | null;
  /** Included unit cap; null = custom / 1,000+. */
  unitsLimit: number | null;
  custom: boolean;
  blurb: string;
}

export const PLANS: Plan[] = [
  { id: 'foundation', name: 'Foundation', priceMonthlyCents: 15700, unitsLimit: 200,  custom: false, blurb: 'Up to 200 units' },
  { id: 'growth',     name: 'Growth',     priceMonthlyCents: 38200, unitsLimit: 600,  custom: false, blurb: 'Up to 600 units' },
  { id: 'portfolio',  name: 'Portfolio',  priceMonthlyCents: 64200, unitsLimit: 1000, custom: false, blurb: 'Up to 1,000 units' },
  { id: 'enterprise', name: 'Enterprise', priceMonthlyCents: null,  unitsLimit: null, custom: true,  blurb: '1,000+ units' },
];

export const PLAN_BY_ID: Record<PlanId, Plan> = Object.fromEntries(
  PLANS.map((p) => [p.id, p]),
) as Record<PlanId, Plan>;

/** Dropdown label, e.g. "Foundation — $157/mo · Up to 200 units". */
export function planOptionLabel(p: Plan): string {
  const price = p.custom || p.priceMonthlyCents == null
    ? 'Custom'
    : `$${(p.priceMonthlyCents / 100).toLocaleString()}/mo`;
  return `${p.name} — ${price} · ${p.blurb}`;
}

export function planFromTier(tier: string | null | undefined): Plan | undefined {
  return tier ? PLAN_BY_ID[tier as PlanId] : undefined;
}
