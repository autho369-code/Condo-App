'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

type Tier = {
  id: 'starter' | 'growth' | 'professional' | 'enterprise';
  name: string;
  tagline: string;
  monthly: number | null;
  annual: number | null;
  units: string;
  unitOverage: string | null;
  featureGroups: { title: string; items: string[] }[];
  cta: { label: string; href: string; variant: 'primary' | 'outline' | 'accent' };
  featured?: boolean;
};

const TIERS: Tier[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For smaller associations transitioning from spreadsheets.',
    monthly: 99,
    annual: 990,
    units: 'Includes 50 units',
    unitOverage: '$2 / additional unit',
    featureGroups: [
      {
        title: 'Core operations',
        items: [
          'Owner portal and statements',
          'Online dues payments',
          'Violation tracking',
          'Service requests',
        ],
      },
      {
        title: 'Support',
        items: ['Email support within 1 business day'],
      },
    ],
    cta: { label: 'Start onboarding', href: '/request-access?tier=starter', variant: 'outline' },
  },
  {
    id: 'growth',
    name: 'Growth',
    tagline: 'For modern property management teams scaling operations.',
    monthly: 299,
    annual: 2990,
    units: 'Includes 150 units',
    unitOverage: '$1.25 / additional unit',
    featureGroups: [
      {
        title: 'Operations',
        items: [
          'Vendor management',
          'Work orders',
          'Bill and PO approval workflows',
        ],
      },
      {
        title: 'Communication',
        items: ['SMS inbox', 'Owner announcements'],
      },
      {
        title: 'Reporting',
        items: ['Automated monthly owner reporting'],
      },
      {
        title: 'Support',
        items: ['Same-day support'],
      },
    ],
    cta: { label: 'Book migration consultation', href: '/request-access?tier=growth', variant: 'accent' },
    featured: true,
  },
  {
    id: 'professional',
    name: 'Professional',
    tagline: 'For established operators managing complex portfolios.',
    monthly: 699,
    annual: 6990,
    units: 'Includes 500 units',
    unitOverage: '$0.75 / additional unit',
    featureGroups: [
      {
        title: 'Portfolio control',
        items: [
          'Multi-association rollup reporting',
          'Advanced approval routing',
          'Board packet automation',
        ],
      },
      {
        title: 'Integrations',
        items: [
          'Accounting integrations',
          'API access',
          'Vendor and bank workflow support',
        ],
      },
      {
        title: 'Support',
        items: ['Priority success support'],
      },
    ],
    cta: { label: 'Schedule portfolio review', href: '/request-access?tier=professional', variant: 'outline' },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'For multi-entity operators with advanced compliance and reporting needs.',
    monthly: null,
    annual: null,
    units: 'Custom unit volume',
    unitOverage: 'Custom commercial terms',
    featureGroups: [
      {
        title: 'Governance',
        items: [
          'SSO / SAML',
          'Per-role GL permissions',
          '7-year audit retention',
        ],
      },
      {
        title: 'Scale',
        items: [
          'Custom reporting workflows',
          'Dedicated implementation manager',
          'Executive success reviews',
        ],
      },
      {
        title: 'Support',
        items: ['1-hour priority SLA'],
      },
    ],
    cta: { label: 'Schedule portfolio review', href: '/request-access?tier=enterprise', variant: 'outline' },
  },
];

export function PricingTrio() {
  const [annual, setAnnual] = useState(false);

  return (
    <div>
      <div className="mx-auto flex max-w-xs items-center justify-center gap-3">
        <ToggleBtn active={!annual} onClick={() => setAnnual(false)}>Monthly</ToggleBtn>
        <ToggleBtn active={annual} onClick={() => setAnnual(true)}>
          Annual <span className="ml-1.5 inline-flex h-5 items-center rounded-full bg-sage-100 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-sage-700">2 months free</span>
        </ToggleBtn>
      </div>

      <div className="mx-auto mt-6 max-w-2xl text-center text-[13px] text-ink-600">
        <span className="font-medium text-ink-900">Software scales by unit count.</span>{' '}
        Implementation and migration are scoped separately so teams know exactly what is included.
      </div>

      <div className="mx-auto mt-12 grid max-w-7xl gap-6 md:grid-cols-2 xl:grid-cols-4">
        {TIERS.map((t) => (
          <TierCard key={t.id} tier={t} annual={annual} />
        ))}
      </div>

      <div className="mx-auto mt-12 max-w-5xl rounded-lg border border-champagne-300 bg-champagne-50/80 px-6 py-5 text-center">
        <div className="eyebrow">Implementation is separate</div>
        <div className="mt-2 font-display text-lg tracking-editorial text-ink-900">
          Concierge migration packages start at $2,500 and include source-platform migration, banking setup, imports, onboarding, and training.
        </div>
        <div className="mt-1 text-xs text-ink-500">
          Software subscription stays clean. Implementation scope is quoted before work begins.
        </div>
      </div>
    </div>
  );
}

function TierCard({ tier, annual }: { tier: Tier; annual: boolean }) {
  const featured = !!tier.featured;
  const cardCls = featured
    ? 'relative flex flex-col rounded-lg bg-ink-gradient p-7 text-cream-100 shadow-soft-lg ring-1 ring-champagne-500/40'
    : 'flex flex-col rounded-lg border border-ink-100 bg-white p-7 shadow-soft-sm transition-shadow hover:shadow-soft';
  const eyebrowCls = featured ? 'text-[11px] font-semibold uppercase tracking-[0.18em] text-champagne-200' : 'eyebrow';
  const titleCls = featured ? 'mt-2 font-display text-xl tracking-editorial text-cream-50' : 'mt-2 font-display text-xl tracking-editorial text-ink-900';
  const priceCls = featured ? 'font-display text-4xl text-cream-50 number-plate' : 'font-display text-4xl text-ink-900 number-plate';
  const perCls = featured ? 'text-sm text-cream-300' : 'text-sm text-ink-500';
  const unitsCls = featured ? 'mt-3 text-sm text-cream-300' : 'mt-3 text-sm text-ink-600';
  const overageCls = featured ? 'text-[12px] text-cream-400' : 'text-[12px] text-ink-500';
  const groupCls = featured
    ? 'text-[11px] font-semibold uppercase tracking-[0.16em] text-champagne-200'
    : 'text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-500';
  const featureCls = featured ? 'flex items-start gap-2.5 text-[14px] text-cream-200' : 'flex items-start gap-2.5 text-[14px] text-ink-700';

  const displayPrice = tier.monthly === null
    ? null
    : annual
      ? Math.round(tier.annual! / 12)
      : tier.monthly;
  const billedSuffix = tier.monthly === null
    ? 'Priced around portfolio complexity'
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
          <span className={priceCls}>Custom</span>
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

      <div className="mt-7 flex-1 space-y-5">
        {tier.featureGroups.map((group) => (
          <div key={group.title}>
            <div className={groupCls}>{group.title}</div>
            <ul className="mt-2.5 space-y-2.5">
              {group.items.map((f) => (
                <li key={f} className={featureCls}>
                  <Check featured={featured} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

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
