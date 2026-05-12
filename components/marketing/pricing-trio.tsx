'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

// =============================================================================
// Pricing trio — units-based, monthly/annual toggle
// =============================================================================
// Annual billing is 17% cheaper (rounded so the math is clean for the buyer):
//   Starter   $149/mo  → $1,490/yr  (2 months free)
//   Growth    $499/mo  → $4,990/yr  (2 months free)
//   Enterprise from $1,500/mo → from $15,000/yr (2 months free)
// =============================================================================

type Tier = {
  id: 'starter' | 'growth' | 'enterprise';
  name: string;
  tagline: string;
  monthly: number | null;       // null = custom pricing
  annual:  number | null;
  units:   string;              // "Up to 100 units" etc.
  unitOverage: string | null;
  features: string[];
  cta: { label: string; href: string; variant: 'primary' | 'outline' | 'accent' };
  featured?: boolean;
};

const TIERS: Tier[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For self-managed HOAs and small portfolios.',
    monthly: 149,
    annual:  1490,
    units: 'Up to 100 units',
    unitOverage: '$1.50 / additional unit',
    features: [
      'Online payments — ACH + card',
      'Owner portal + statements',
      'Violations + service requests',
      'Standard accounting + reports',
      'Email support, 1 business day',
    ],
    cta: { label: 'Plan your migration', href: '/request-access?tier=starter', variant: 'outline' },
  },
  {
    id: 'growth',
    name: 'Growth',
    tagline: 'For scaling property-management companies.',
    monthly: 499,
    annual:  4990,
    units: 'Up to 500 units',
    unitOverage: '$1.00 / additional unit',
    features: [
      'Everything in Starter, and:',
      'Vendor management + work orders',
      'Approval workflows for bills + POs',
      'SMS texting inbox',
      'Automated monthly owner reporting',
      'Integrate with existing accounting + vendor stack',
      'Priority support, same business day',
    ],
    cta: { label: 'Plan your migration', href: '/request-access?tier=growth', variant: 'accent' },
    featured: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'For multi-entity operators and regulated portfolios.',
    monthly: null,
    annual:  null,
    units: 'Unlimited units',
    unitOverage: null,
    features: [
      'Everything in Growth, and:',
      'SSO / SAML',
      'Per-role GL account permissions',
      '7-year audit retention',
      'Multi-entity rollup reporting',
      'Dedicated implementation manager',
      '24/7 support, 1-hour SLA',
    ],
    cta: { label: 'Schedule a portfolio review', href: '/request-access?tier=enterprise', variant: 'outline' },
  },
];

export function PricingTrio() {
  const [annual, setAnnual] = useState(false);

  return (
    <div>
      {/* Monthly / Annual toggle */}
      <div className="mx-auto flex max-w-xs items-center justify-center gap-3">
        <ToggleBtn active={!annual} onClick={() => setAnnual(false)}>Monthly</ToggleBtn>
        <ToggleBtn active={annual}  onClick={() => setAnnual(true)}>
          Annual <span className="ml-1.5 inline-flex h-5 items-center rounded-full bg-sage-100 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-sage-700">2 months free</span>
        </ToggleBtn>
      </div>

      {/* Free-under-20 callout */}
      <div className="mx-auto mt-6 max-w-md text-center text-[13px] text-ink-600">
        <span className="font-medium text-ink-900">Free under 20 units</span> — perfect for self-managed HOAs and condo associations.
      </div>

      {/* Three cards */}
      <div className="mx-auto mt-12 grid max-w-6xl gap-6 md:grid-cols-3">
        {TIERS.map((t) => (
          <TierCard key={t.id} tier={t} annual={annual} />
        ))}
      </div>

      {/* Money-back banner */}
      <div className="mx-auto mt-12 max-w-4xl rounded-lg border border-champagne-300 bg-champagne-50/80 px-6 py-5 text-center">
        <div className="eyebrow">Migration guarantee</div>
        <div className="mt-2 font-display text-lg tracking-editorial text-ink-900">
          If we can&apos;t migrate your AppFolio or Buildium data in 14 days, you get a full refund.
        </div>
        <div className="mt-1 text-xs text-ink-500">No fine print. No exceptions.</div>
      </div>
    </div>
  );
}

function TierCard({ tier, annual }: { tier: Tier; annual: boolean }) {
  const featured = !!tier.featured;
  const cardCls = featured
    ? 'relative flex flex-col rounded-lg bg-ink-gradient p-8 text-cream-100 shadow-soft-lg ring-1 ring-champagne-500/40'
    : 'flex flex-col rounded-lg border border-ink-100 bg-white p-8 shadow-soft-sm transition-shadow hover:shadow-soft';
  const eyebrowCls = featured ? 'text-[11px] font-semibold uppercase tracking-[0.18em] text-champagne-200' : 'eyebrow';
  const titleCls = featured ? 'mt-2 font-display text-2xl tracking-editorial text-cream-50' : 'mt-2 font-display text-2xl tracking-editorial text-ink-900';
  const priceCls = featured ? 'font-display text-5xl text-cream-50 number-plate' : 'font-display text-5xl text-ink-900 number-plate';
  const perCls   = featured ? 'text-sm text-cream-300' : 'text-sm text-ink-500';
  const unitsCls = featured ? 'mt-3 text-sm text-cream-300' : 'mt-3 text-sm text-ink-600';
  const overageCls = featured ? 'text-[12px] text-cream-400' : 'text-[12px] text-ink-500';
  const featureCls = featured ? 'flex items-start gap-2.5 text-[14px] text-cream-200' : 'flex items-start gap-2.5 text-[14px] text-ink-700';

  const displayPrice = tier.monthly === null
    ? null
    : annual
      ? Math.round(tier.annual! / 12)
      : tier.monthly;
  const billedSuffix = tier.monthly === null
    ? ''
    : annual
      ? `Billed $${tier.annual!.toLocaleString()} / year`
      : 'Billed monthly';

  return (
    <div className={cardCls}>
      {featured && (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-champagne-shimmer px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-900 shadow-soft">
          Most chosen
        </span>
      )}

      <div className={eyebrowCls}>{tier.name}</div>
      <h3 className={titleCls}>{tier.tagline}</h3>

      <div className="mt-7">
        {displayPrice === null ? (
          <>
            <span className={priceCls}>From $1,500</span>
            <span className={perCls}> / month</span>
          </>
        ) : (
          <>
            <span className={priceCls}>${displayPrice.toLocaleString()}</span>
            <span className={perCls}> / month</span>
          </>
        )}
        <div className={`${perCls} mt-1 text-[12px]`}>{billedSuffix}</div>
      </div>

      <div className={unitsCls}>
        {tier.units}
        {tier.unitOverage && (
          <div className={overageCls}>{tier.unitOverage}</div>
        )}
      </div>

      <ul className="mt-7 flex-1 space-y-2.5">
        {tier.features.map((f) => (
          <li key={f} className={featureCls}>
            <Check featured={featured} />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Link href={tier.cta.href} className="mt-8">
        <Button size="md" variant={tier.cta.variant} className="w-full">
          {tier.cta.label}
        </Button>
      </Link>
    </div>
  );
}

function ToggleBtn({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium transition-all ' +
        (active
          ? 'border-ink-900 bg-ink-900 text-cream-50 shadow-soft-sm'
          : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-cream-50')
      }
    >
      {children}
    </button>
  );
}

function Check({ featured }: { featured: boolean }) {
  return (
    <svg className={`mt-0.5 h-4 w-4 flex-none ${featured ? 'text-champagne-300' : 'text-champagne-600'}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" />
    </svg>
  );
}
