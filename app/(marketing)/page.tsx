import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PricingTrio } from '@/components/marketing/pricing-trio';

export const metadata = {
  title: 'Portier — Modern property management with concierge onboarding.',
  description:
    'Replace AppFolio or Buildium without painful migrations, broken workflows, or weeks of setup. Units-based pricing, concierge migration, AI-assisted operations.',
};

function Diamond() {
  return (
    <svg className="h-3 w-3 text-champagne-500" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <path d="M6 0l3 6-3 6-3-6z" />
    </svg>
  );
}

// Outcome-based feature copy — every line ties software to operator value.
const features = [
  {
    title: 'Migrated in 14 days',
    desc: 'Send a CSV export from AppFolio, Buildium, Yardi, or QuickBooks. A concierge lands your portfolio in 48–72 hours, fully reconciled. Go live in two weeks — guaranteed in writing.',
  },
  {
    title: 'Collect dues without bleeding on fees',
    desc: 'ACH at 0.8% (capped $5), card fees passed through transparently. Autopay enrolment in a single tap. Statements that look like correspondence, not invoices.',
  },
  {
    title: 'Automated monthly owner reporting',
    desc: 'Board packets, statements, delinquency reports, insurance expirations — generated, signed, and delivered on the first of the month. Your team doesn&apos;t touch them.',
  },
  {
    title: 'Maintenance that closes itself',
    desc: 'Service request → work order → vendor → labour → bill → payment → archived. AI-assisted triage classifies and routes requests the moment they come in.',
  },
  {
    title: 'Integrate with the stack you already use',
    desc: 'Webhooks into QuickBooks, lockbox feeds, Mailchimp, Slack. Scoped API keys with twenty-plus event types. Your data, your tools, your pace.',
  },
  {
    title: 'Compliance, by composition',
    desc: '1099 generation, immutable audit log, GDPR / CCPA exports, soft-delete restore. SOC 2 Type II in progress. Built into the platform, not bolted on.',
  },
];

const steps = [
  ['01', 'Discovery call', 'A concierge reviews your portfolio, current platform, and timeline. We map your accounting cadence to ours before you commit.'],
  ['02', 'Migration', 'Send your data export. We land it in 48–72 hours, fully reconciled. You review every balance against the source-of-truth.'],
  ['03', 'Launch concierge', 'Workflows configured, vendors onboarded, owners announced. Your team trained, your SOPs documented. Live within 14 days.'],
  ['04', 'Operate', 'Day one onward, you have a dedicated success contact. Fractional ops support available when you want a partner, not just software.'],
];

const switchReasons: [string, string][] = [
  ['Slow support',          'Same-business-day response on Growth, 1-hour SLA on Enterprise. Real people, not bots.'],
  ['Generic onboarding',    'Each migration assigned to a named concierge. We learn your portfolio before you sign.'],
  ['Hidden fees',           'Unit-based pricing on the page. No setup fees, no per-feature pricing, no surprises at renewal.'],
  ['Locked data exports',   'Full JSON / CSV export anytime, even on the lowest tier. Your data is yours, always.'],
  ['Old user interface',    'A modern editorial design language built for operators who notice details. Mobile-first resident portal.'],
];

const faqs: [string, string][] = [
  ['How does the migration actually work?',
   'You send a data export from AppFolio, Buildium, Yardi, or QuickBooks (a CSV or our partner connectors). Within 48–72 hours we land it in your tenant, fully reconciled against source-of-truth. You review balances unit by unit. If anything doesn&apos;t match, we fix it before you go live. Our 14-day guarantee covers the entire process.'],
  ['What if my portfolio outgrows the unit count on my plan?',
   'You stay on the plan; the per-unit overage rate kicks in. Starter is $1.50 / unit over 100. Growth is $1.00 / unit over 500. We never auto-upgrade your plan without a conversation.'],
  ['Are there setup or implementation fees baked into the monthly price?',
   'No. The monthly price covers the platform only. Implementation, migration, and operational onboarding are priced separately and transparently on the Services page — you see exactly what you&apos;re paying for.'],
  ['How are payment-processing fees handled?',
   'ACH at 0.8% (capped at $5 per transaction). Cards at 2.9% + 30¢. You decide whether to absorb the card fee or pass it through to owners as a convenience charge. ACH stays free for the owner.'],
  ['Is the platform secure and compliant?',
   'Row-level security at the database for every query — no portfolio can read another portfolio&apos;s data. SOC 2 Type II is in progress. GDPR + CCPA exports, right-to-delete, and audit log are built in.'],
  ['Do you support HOAs, condominiums, co-ops, and rental portfolios?',
   'Association management is our primary discipline. We also handle rental and mixed portfolios. Condos and co-ops use the same workflow with different labels.'],
];

const stats: [string, string][] = [
  ['14 days', 'average migration timeline'],
  ['48 hrs',  'data landed + reconciled'],
  ['$3M+',    'dues processed yearly'],
  ['99.98%',  'uptime SLA'],
];

export default function Landing() {
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
        <div className="mx-auto max-w-7xl px-6 pt-20 pb-24 md:pt-28 md:pb-32">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-champagne-300 bg-cream-50/80 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-700 backdrop-blur-sm">
              <Diamond />
              <span>Concierge property management platform</span>
            </div>
            <h1 className="mt-8 font-display text-[2.5rem] leading-[1.1] tracking-tightest text-ink-900 sm:text-5xl md:text-7xl md:leading-[1.05]">
              Modern property operations.<br />
              <span className="italic text-champagne-700">Migrated in 14 days.</span>
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-lg text-ink-600 leading-relaxed md:text-xl">
              Replace AppFolio or Buildium without painful migrations, broken
              workflows, or weeks of setup. Unit-based pricing, concierge
              onboarding, AI-assisted operations — engineered for the way your
              team actually works.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link href="/request-access">
                <Button size="lg" variant="primary">Plan your migration →</Button>
              </Link>
              <Link href="/request-access?intent=quote">
                <Button size="lg" variant="outline">Get a migration quote</Button>
              </Link>
            </div>
            <p className="mt-4 text-xs uppercase tracking-[0.15em] text-ink-500">
              14-day migration guarantee · No setup fees · Cancel any time
            </p>
            <p className="mt-7 text-sm text-ink-600">
              Already a customer?{' '}
              <Link
                href="/login"
                className="font-medium text-champagne-700 underline decoration-champagne-300 decoration-1 underline-offset-4 hover:decoration-champagne-500 transition-colors"
              >
                Sign in to your workspace →
              </Link>
            </p>
          </div>

          {/* Editorial proof strip */}
          <div className="mx-auto mt-20 max-w-5xl">
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-ink-100 bg-ink-100 shadow-soft md:grid-cols-4">
              {stats.map(([n, l]) => (
                <div key={l} className="bg-white px-6 py-7 text-center">
                  <div className="font-display text-3xl text-ink-900 number-plate md:text-4xl">{n}</div>
                  <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-500">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section id="features" className="border-t border-ink-100 bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="eyebrow">Platform</div>
            <h2 className="mt-3 font-display text-4xl tracking-editorial text-ink-900 md:text-5xl">
              Built for the operator, not the demo.
            </h2>
            <p className="mt-5 text-base text-ink-600 leading-relaxed md:text-lg">
              Accounting, maintenance, communications, compliance, reporting —
              one login, one bill, one team that runs better by Friday.
            </p>
          </div>

          <div className="mt-20 grid gap-x-12 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <article key={f.title} className="group">
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-xl text-champagne-600 number-plate">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="h-px flex-1 bg-ink-100 group-hover:bg-champagne-300 transition-colors" />
                </div>
                <h3 className="mt-5 font-display text-xl tracking-editorial text-ink-900">
                  {f.title}
                </h3>
                <p className="mt-3 text-[15px] text-ink-600 leading-relaxed">{f.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============ WHY SWITCH (TEASER) ============ */}
      <section className="border-t border-ink-100 bg-cream-100 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-12 md:grid-cols-2 md:items-start">
            <div>
              <div className="eyebrow">Migration</div>
              <h2 className="mt-3 font-display text-4xl tracking-editorial text-ink-900 md:text-5xl">
                Why teams switch from{' '}
                <span className="italic text-champagne-700">AppFolio and Buildium.</span>
              </h2>
              <p className="mt-5 max-w-md text-base text-ink-600 leading-relaxed">
                Every operator we&apos;ve onboarded comes with the same five gripes.
                We rebuilt the platform around fixing them.
              </p>
              <Link href="/why-switch" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-champagne-700 underline decoration-champagne-300 underline-offset-4 hover:decoration-champagne-500 transition-colors">
                Read the full comparison <span aria-hidden="true">→</span>
              </Link>
            </div>
            <ul className="space-y-5 border-l-2 border-champagne-300 pl-7">
              {switchReasons.map(([pain, fix]) => (
                <li key={pain}>
                  <div className="font-display text-lg tracking-editorial text-ink-900">
                    {pain}
                    <span className="ml-2 text-champagne-600">→</span>
                    <span className="ml-2 font-sans text-[15px] font-normal text-ink-600">{fix}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section className="border-t border-ink-100 bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="eyebrow">Onboarding</div>
            <h2 className="mt-3 font-display text-4xl tracking-editorial text-ink-900 md:text-5xl">
              An association, in an afternoon.
            </h2>
            <p className="mt-5 text-base text-ink-600 leading-relaxed md:text-lg">
              Most platforms take ninety days to implement. We take fourteen,
              with a concierge alongside your team the entire time.
            </p>
          </div>

          <div className="mt-20 grid gap-10 md:grid-cols-4">
            {steps.map(([n, title, desc]) => (
              <div key={n} className="border-l-2 border-champagne-300 pl-5">
                <div className="font-display text-2xl text-champagne-600 number-plate">{n}</div>
                <h3 className="mt-4 font-display text-lg tracking-editorial text-ink-900">{title}</h3>
                <p className="mt-2 text-sm text-ink-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 text-center">
            <Link href="/services" className="inline-flex items-center gap-2 text-sm font-semibold text-champagne-700 underline decoration-champagne-300 underline-offset-4 hover:decoration-champagne-500 transition-colors">
              Implementation &amp; concierge services →
            </Link>
          </div>
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <section id="pricing" className="border-t border-ink-100 bg-cream-100 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="eyebrow">Pricing</div>
            <h2 className="mt-3 font-display text-4xl tracking-editorial text-ink-900 md:text-5xl">
              Priced by units, not by seats.
            </h2>
            <p className="mt-5 text-base text-ink-600 leading-relaxed md:text-lg">
              The same way your portfolio scales. No per-feature pricing, no setup
              fees, no surprises at renewal. Implementation is priced separately
              and transparently on the{' '}
              <Link href="/services" className="font-medium text-champagne-700 underline decoration-champagne-300 underline-offset-4 hover:decoration-champagne-500 transition-colors">
                Services page
              </Link>.
            </p>
          </div>

          <div className="mt-14">
            <PricingTrio />
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className="border-t border-ink-100 bg-white py-24">
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-center">
            <div className="eyebrow">Questions</div>
            <h2 className="mt-3 font-display text-4xl tracking-editorial text-ink-900 md:text-5xl">
              Everything we get asked.
            </h2>
          </div>
          <dl className="mt-14 space-y-10">
            {faqs.map(([q, a]) => (
              <div key={q} className="border-b border-ink-100 pb-10 last:border-b-0">
                <dt className="font-display text-xl tracking-editorial text-ink-900">{q}</dt>
                <dd className="mt-3 text-[15px] text-ink-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: a }} />
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section id="contact" className="bg-ink-gradient text-cream-100">
        <div className="mx-auto max-w-4xl px-6 py-24 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-champagne-200">Begin</div>
          <h2 className="mt-4 font-display text-4xl tracking-editorial text-cream-50 md:text-6xl md:leading-[1.05]">
            Give your portfolio<br />
            <span className="italic text-champagne-300">a finer instrument.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-cream-300 leading-relaxed">
            A concierge will walk you through migration, configuration, and your
            first month — so your team notices the difference by Friday, not Q4.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/request-access">
              <Button size="lg" variant="accent">Plan your migration →</Button>
            </Link>
            <Link href="/request-access?intent=quote">
              <Button
                size="lg"
                variant="outline"
                className="border-cream-300/40 text-cream-100 hover:bg-white/5 hover:border-cream-200"
              >
                Get a migration quote
              </Button>
            </Link>
          </div>
          <p className="mt-5 text-[11px] uppercase tracking-[0.18em] text-cream-400">
            14-day migration guarantee · No setup fees
          </p>
          <p className="mt-7 text-sm text-cream-300">
            Already a customer?{' '}
            <Link
              href="/login"
              className="font-medium text-champagne-300 underline decoration-champagne-500/60 decoration-1 underline-offset-4 hover:text-champagne-200 hover:decoration-champagne-400 transition-colors"
            >
              Sign in to your workspace →
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
