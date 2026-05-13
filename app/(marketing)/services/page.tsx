import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Services - Migration, onboarding, and operational support | Portier',
  description:
    'Implementation, migration, and fractional operations support for association operators, priced transparently and delivered by named specialists.',
};

type Package = {
  eyebrow: string;
  title: string;
  hook: string;
  priceRanges: { label: string; range: string }[];
  includes: string[];
  cta: { label: string; href: string };
  featured?: boolean;
};

const PACKAGES: Package[] = [
  {
    eyebrow: 'Migration',
    title: 'Migrated in 14 days, guaranteed in writing.',
    hook:
      'A named migration concierge takes ownership of every association record. AppFolio, Buildium, Yardi, TOPS, QuickBooks, and spreadsheets are exported, reconciled, audited, and staged for launch.',
    priceRanges: [
      { label: 'Small portfolio (< 200 units)',     range: '$2,500 – $5,000' },
      { label: 'Mid-market (200 – 1,500 units)',    range: '$5,000 – $15,000' },
      { label: 'Enterprise (1,500+ units)',         range: '$15,000 – $50,000+' },
    ],
    includes: [
      'Source-platform data extract + reconciliation',
      'Association, unit, and owner imports',
      'Vendor records + W9s + insurance certificates',
      'Ledger migration with historical balances',
      'Banking setup + first reconciliation',
      'Owner / resident portal activation',
      'Pre-launch QA against source-of-truth',
      '14-day money-back guarantee',
    ],
    cta: { label: 'Get a migration quote', href: '/request-access?intent=quote' },
    featured: true,
  },
  {
    eyebrow: 'Launch concierge',
    title: 'Go live in 14 days without disrupting operations.',
    hook:
      'Workflow configuration, vendor onboarding, owner announcements, and team training handled by a concierge who knows association operations, not just software.',
    priceRanges: [
      { label: 'Standard launch',  range: '$1,500 – $4,000' },
      { label: 'Premium launch',   range: '$4,000 – $10,000' },
    ],
    includes: [
      'Workflow + approval rule configuration',
      'Custom letter + statement templates',
      'Vendor portal onboarding',
      'Resident announcement campaign (email + SMS)',
      'Owner onboarding sequence',
      'Live team training sessions',
      'Standard operating procedures (SOPs) documented',
      'Two weeks of hyper-care after launch',
    ],
    cta: { label: 'Schedule a launch consultation', href: '/request-access?intent=launch' },
  },
  {
    eyebrow: 'Fractional operations',
    title: 'Operational support, on retainer.',
    hook:
      'For firms post-migration who want a partner, not just software, during the first 90 days. A monthly retainer with a named operations specialist.',
    priceRanges: [
      { label: 'SMB retainer',         range: '$1,000 – $3,000 / month' },
      { label: 'Mid-market retainer',  range: '$3,000 – $7,500 / month' },
      { label: 'Enterprise retainer',  range: '$7,500 – $15,000 / month' },
    ],
    includes: [
      'Monthly accounting review + close',
      'Workflow + automation optimisation',
      'Quarterly reporting cadence setup',
      'Vendor compliance management',
      'Custom report building',
      'AI workflow implementation',
      'Direct Slack / email channel with your team',
      'Cancel any time, 30-day notice',
    ],
    cta: { label: 'Explore retainer pricing', href: '/request-access?intent=retainer' },
  },
];

const PROCESS = [
  ['01', 'Discovery',     'A 30-minute call to understand portfolio size, current platform, accounting cadence, and timeline. We write you a fixed-scope proposal within two business days.'],
  ['02', 'Proposal',      'You see exactly what you&apos;re paying for. Migration scope, launch concierge scope, and SaaS subscription are itemized line by line. No surprises.'],
  ['03', 'Migration',     'Your concierge runs the data import, reconciles every balance, and pre-stages your account in a private sandbox you review before signing off.'],
  ['04', 'Launch',        'Go-live date locked. Team trained, owners announced, statements queued. Day-one operations supported by a named contact.'],
  ['05', 'Optimise',      'First 30 days: weekly check-ins. Day 30 onward: monthly. Fractional ops retainer optional from month two.'],
];

export default function ServicesPage() {
  return (
    <>
      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(60% 60% at 50% 0%, rgba(212, 189, 134, 0.18) 0%, rgba(251, 249, 244, 0) 60%), linear-gradient(180deg, #FBF9F4 0%, #F8F4EC 100%)',
          }}
        />
        <div className="mx-auto max-w-7xl px-6 pt-20 pb-16 md:pt-28 md:pb-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="eyebrow">Implementation &amp; concierge services</div>
            <h1 className="mt-5 font-display text-[2.5rem] leading-[1.1] tracking-tightest text-ink-900 sm:text-5xl md:text-6xl md:leading-[1.05]">
              Software you buy.<br />
              <span className="italic text-champagne-700">Operations we help you run.</span>
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-lg text-ink-600 leading-relaxed md:text-xl">
              Migration, launch, and operational support — priced transparently
              and delivered by named specialists. The work most platforms hide
              in “implementation fees,” itemised line by line.
            </p>
          </div>
        </div>
      </section>

      {/* ============ THREE PACKAGES ============ */}
      <section className="border-t border-ink-100 bg-white py-20">
        <div className="mx-auto max-w-7xl px-6 space-y-16">
          {PACKAGES.map((p) => (
            <PackageCard key={p.title} pkg={p} />
          ))}
        </div>
      </section>

      {/* ============ PROCESS ============ */}
      <section className="border-t border-ink-100 bg-cream-100 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="eyebrow">How it works</div>
            <h2 className="mt-3 font-display text-4xl tracking-editorial text-ink-900 md:text-5xl">
              From first call to live in two weeks.
            </h2>
            <p className="mt-5 text-base text-ink-600 leading-relaxed md:text-lg">
              The exact sequence every Portier migration follows. No mystery
              meat. No “we&apos;ll figure it out as we go.”
            </p>
          </div>
          <ol className="mx-auto mt-16 max-w-3xl space-y-7">
            {PROCESS.map(([n, title, desc]) => (
              <li key={n} className="grid grid-cols-[auto_1fr] gap-6 border-b border-ink-100 pb-7 last:border-b-0">
                <div className="font-display text-3xl text-champagne-600 number-plate">{n}</div>
                <div>
                  <h3 className="font-display text-xl tracking-editorial text-ink-900">{title}</h3>
                  <p className="mt-2 text-[15px] text-ink-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: desc }} />
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="bg-ink-gradient text-cream-100">
        <div className="mx-auto max-w-4xl px-6 py-24 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-champagne-200">Begin</div>
          <h2 className="mt-4 font-display text-4xl tracking-editorial text-cream-50 md:text-6xl md:leading-[1.05]">
            Ready to plan your<br />
            <span className="italic text-champagne-300">portfolio&apos;s next move?</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-cream-300 leading-relaxed">
            Tell us about your portfolio. A specialist will return a fixed-scope
            proposal within two business days.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/request-access?intent=quote">
              <Button size="lg" variant="accent">Get a migration quote</Button>
            </Link>
            <Link href="/request-access">
              <Button
                size="lg"
                variant="outline"
                className="border-cream-300/40 text-cream-100 hover:bg-white/5 hover:border-cream-200"
              >
                Schedule a portfolio review
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function PackageCard({ pkg }: { pkg: Package }) {
  return (
    <article className={
      'rounded-lg border bg-white p-8 shadow-soft-sm md:p-12 ' +
      (pkg.featured ? 'border-champagne-400 ring-1 ring-champagne-300' : 'border-ink-100')
    }>
      <div className="grid gap-8 md:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="eyebrow">{pkg.eyebrow}</div>
          <h2 className="mt-3 font-display text-3xl tracking-editorial text-ink-900 md:text-4xl">
            {pkg.title}
          </h2>
          <p className="mt-5 text-[15px] text-ink-600 leading-relaxed md:text-base">{pkg.hook}</p>

          <div className="mt-7">
            <div className="eyebrow">Pricing</div>
            <div className="mt-3 space-y-2">
              {pkg.priceRanges.map((p) => (
                <div key={p.label} className="flex items-baseline justify-between gap-4 border-b border-ink-100 pb-2 last:border-b-0">
                  <span className="text-[14px] text-ink-700">{p.label}</span>
                  <span className="font-display text-base text-ink-900 number-plate whitespace-nowrap">{p.range}</span>
                </div>
              ))}
            </div>
          </div>

          <Link href={pkg.cta.href} className="mt-8 inline-block">
            <Button size="md" variant={pkg.featured ? 'primary' : 'outline'}>{pkg.cta.label} →</Button>
          </Link>
        </div>

        <div className="rounded-lg bg-cream-100 p-6 md:p-7">
          <div className="eyebrow">What&apos;s included</div>
          <ul className="mt-4 space-y-2.5">
            {pkg.includes.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-[14px] text-ink-700">
                <svg className="mt-0.5 h-4 w-4 flex-none text-champagne-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" />
                </svg>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}
