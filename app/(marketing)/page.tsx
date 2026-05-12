import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PricingTrio } from '@/components/marketing/pricing-trio';

export const metadata = {
  title: 'Portier - Association operations with concierge onboarding.',
  description:
    'Association management software with unit-based pricing, separate implementation packages, and concierge migration from AppFolio, Buildium, or spreadsheets.',
};

function Diamond() {
  return (
    <svg className="h-3 w-3 text-champagne-500" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <path d="M6 0l3 6-3 6-3-6z" />
    </svg>
  );
}

const features = [
  {
    title: 'Replace disconnected tools',
    desc: 'Dues, violations, work orders, board reporting, vendor records, and owner communication live in one operating workspace instead of eight separate tools.',
  },
  {
    title: 'Reduce monthly reporting time',
    desc: 'Board packets, statements, delinquency reports, insurance expirations, and owner summaries can be generated from the same source of truth.',
  },
  {
    title: 'Collect dues without fee confusion',
    desc: 'ACH and card processing are clearly separated from software pricing, with owner-facing payment flows that make autopay easier to adopt.',
  },
  {
    title: 'Coordinate vendors and maintenance',
    desc: 'Service requests move into work orders, approvals, vendor communication, bill review, payment, and history without losing the thread.',
  },
  {
    title: 'Keep association accounting visible',
    desc: 'GL accounts, bank workflow, owner balances, dues roll, and board reporting stay close to the daily work instead of hiding in exports.',
  },
  {
    title: 'Go live with real help',
    desc: 'Migration, banking setup, imports, vendor onboarding, and staff training are scoped as implementation services before launch begins.',
  },
];

const steps = [
  ['01', 'Discovery call', 'We review portfolio size, current software, association complexity, accounting cadence, and launch timeline.'],
  ['02', 'Implementation quote', 'Software subscription and implementation scope are separated so you can see exactly what is included.'],
  ['03', 'Migration and setup', 'Your AppFolio, Buildium, or spreadsheet data is imported, reconciled, and reviewed before go-live.'],
  ['04', 'Launch support', 'Your team is trained, owner communication is staged, and operating workflows are configured for the first month.'],
];

const switchReasons: [string, string][] = [
  ['Slow support', 'Same-day support on Growth, priority success on Professional, and 1-hour SLA paths for Enterprise.'],
  ['Generic onboarding', 'Implementation is scoped around your associations, bank accounts, vendors, owners, and reporting cadence.'],
  ['Pricing confusion', 'Software is unit-based. Implementation is quoted separately. No pretending migration is free.'],
  ['Locked data exports', 'Full export paths for owner, unit, accounting, and operational data. Your data remains yours.'],
  ['Operational blind spots', 'Tasks, reporting, activity, and financial work stay connected in the same association workspace.'],
];

const faqs: [string, string][] = [
  [
    'How does the unit-based pricing work?',
    'Each paid plan includes a unit allowance, then charges a clear per-unit rate above that allowance. Starter includes 50 units at $99/month with $2/additional unit. Growth includes 150 units at $299/month with $1.25/additional unit. Professional includes 500 units at $699/month with $0.75/additional unit.',
  ],
  [
    'What would a 1,000-unit operator pay?',
    'On Professional, a 1,000-unit operator would pay $699/month plus 500 additional units at $0.75, or about $1,074/month before implementation and payment-processing costs.',
  ],
  [
    'Are implementation and migration included in the monthly subscription?',
    'No. The monthly price covers the software subscription. Concierge migration and implementation are quoted separately, with packages starting at $2,500. That keeps the subscription clean and prevents hidden setup assumptions.',
  ],
  [
    'What does implementation include?',
    'Implementation can include AppFolio or Buildium migration, banking setup, GL account configuration, owner and unit imports, vendor onboarding, staff training, and launch support.',
  ],
  [
    'Who is Starter for?',
    'Starter is for smaller associations moving away from spreadsheets or lightweight tools. It is not positioned as a tiny version of the platform; it is a clean entry point into real association operations.',
  ],
  [
    'Do you support HOAs, condominiums, and co-ops?',
    'Yes. Association management is the primary discipline. HOAs, condominium associations, and co-ops use the association workflow with configuration differences where needed.',
  ],
];

const stats: [string, string][] = [
  ['8+', 'tools replaced'],
  ['14 days', 'target launch window'],
  ['$2,500+', 'implementation packages'],
  ['1,000 units', 'priced around $1,074/mo'],
];

const outcomes: [string, string][] = [
  ['Replace 8+ disconnected tools', 'Dues, violations, work orders, documents, statements, vendors, reports, and owner communication in one place.'],
  ['Reduce reporting drag', 'Board packets and owner reporting come from live association data instead of monthly spreadsheet assembly.'],
  ['Go live in 14 days', 'A scoped implementation plan turns migration into a managed project, not a vague promise.'],
];

const implementationIncludes = [
  'AppFolio and Buildium migration',
  'Spreadsheet imports for units and homeowners',
  'Banking and GL account setup',
  'Vendor onboarding',
  'Staff training',
  'Launch support',
];

export default function Landing() {
  return (
    <>
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
              <span>Concierge association operations platform</span>
            </div>
            <h1 className="mt-8 font-display text-[2.5rem] leading-[1.1] tracking-tightest text-ink-900 sm:text-5xl md:text-7xl md:leading-[1.05]">
              Serious association operations.<br />
              <span className="italic text-champagne-700">Launched with real help.</span>
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-lg text-ink-600 leading-relaxed md:text-xl">
              Replace spreadsheets, AppFolio gaps, or disconnected tools with unit-based software pricing and separately scoped implementation.
              Built for teams that need cleaner accounting, faster reporting, and better owner communication.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link href="/request-access">
                <Button size="lg" variant="primary">Start onboarding</Button>
              </Link>
              <Link href="/request-access?intent=quote">
                <Button size="lg" variant="outline">Book migration consultation</Button>
              </Link>
            </div>
            <p className="mt-4 text-xs uppercase tracking-[0.15em] text-ink-500">
              Unit-based software pricing / Implementation quoted separately / No hidden migration assumptions
            </p>
            <p className="mt-7 text-sm text-ink-600">
              Already a customer?{' '}
              <Link
                href="/login"
                className="font-medium text-champagne-700 underline decoration-champagne-300 decoration-1 underline-offset-4 transition-colors hover:decoration-champagne-500"
              >
                Sign in to your workspace
              </Link>
            </p>
          </div>

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

      <section id="features" className="border-t border-ink-100 bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="eyebrow">Platform</div>
            <h2 className="mt-3 font-display text-4xl tracking-editorial text-ink-900 md:text-5xl">
              Built around operational outcomes.
            </h2>
            <p className="mt-5 text-base text-ink-600 leading-relaxed md:text-lg">
              Property managers and association boards buy fewer headaches, faster close cycles, fewer support tickets, and clearer visibility. The feature set should prove those outcomes.
            </p>
          </div>

          <div className="mt-20 grid gap-x-12 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <article key={f.title} className="group">
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-xl text-champagne-600 number-plate">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="h-px flex-1 bg-ink-100 transition-colors group-hover:bg-champagne-300" />
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
                The pain is rarely one missing feature. It is support delay, reporting drag, migration uncertainty, and scattered operational work.
              </p>
              <Link href="/why-switch" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-champagne-700 underline decoration-champagne-300 underline-offset-4 transition-colors hover:decoration-champagne-500">
                Read the full comparison
              </Link>
            </div>
            <ul className="space-y-5 border-l-2 border-champagne-300 pl-7">
              {switchReasons.map(([pain, fix]) => (
                <li key={pain}>
                  <div className="font-display text-lg tracking-editorial text-ink-900">
                    {pain}
                    <span className="ml-2 text-champagne-600">-</span>
                    <span className="ml-2 font-sans text-[15px] font-normal text-ink-600">{fix}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t border-ink-100 bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="eyebrow">Onboarding</div>
            <h2 className="mt-3 font-display text-4xl tracking-editorial text-ink-900 md:text-5xl">
              Software and implementation stay separate.
            </h2>
            <p className="mt-5 text-base text-ink-600 leading-relaxed md:text-lg">
              The platform subscription covers the product. Migration, banking setup, data import, and launch work are quoted as services so nobody assumes complex implementation is free.
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
            <Link href="/services" className="inline-flex items-center gap-2 text-sm font-semibold text-champagne-700 underline decoration-champagne-300 underline-offset-4 transition-colors hover:decoration-champagne-500">
              Implementation and concierge services
            </Link>
          </div>
        </div>
      </section>

      <section id="pricing" className="border-t border-ink-100 bg-cream-100 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="eyebrow">Pricing</div>
            <h2 className="mt-3 font-display text-4xl tracking-editorial text-ink-900 md:text-5xl">
              Unit-based pricing for different buyers.
            </h2>
            <p className="mt-5 text-base text-ink-600 leading-relaxed md:text-lg">
              Smaller associations, scaling management teams, and established operators have different economics. The pricing now scales with unit count instead of forcing every buyer into one ladder.
            </p>
          </div>

          <div className="mt-14">
            <PricingTrio />
          </div>
        </div>
      </section>

      <section className="border-t border-ink-100 bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="eyebrow">ROI</div>
            <h2 className="mt-3 font-display text-4xl tracking-editorial text-ink-900 md:text-5xl">
              Sell the operating result, not the checklist.
            </h2>
          </div>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {outcomes.map(([title, desc]) => (
              <article key={title} className="border-l-2 border-champagne-300 pl-6">
                <h3 className="font-display text-xl tracking-editorial text-ink-900">{title}</h3>
                <p className="mt-3 text-[15px] text-ink-600 leading-relaxed">{desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-ink-100 bg-cream-100 py-24">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 md:grid-cols-[1fr_1.1fr] md:items-start">
          <div>
            <div className="eyebrow">Concierge migration and implementation</div>
            <h2 className="mt-3 font-display text-4xl tracking-editorial text-ink-900 md:text-5xl">
              Migration packages start at $2,500.
            </h2>
            <p className="mt-5 text-base text-ink-600 leading-relaxed md:text-lg">
              This keeps Portier positioned as a serious operator platform, not a cheap replacement. Buyers see the subscription price and the implementation project as two different decisions.
            </p>
            <Link href="/services" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-champagne-700 underline decoration-champagne-300 underline-offset-4 transition-colors hover:decoration-champagne-500">
              View implementation services
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {implementationIncludes.map((item) => (
              <div key={item} className="rounded-lg border border-ink-100 bg-white px-5 py-4 text-[14px] text-ink-700 shadow-soft-sm">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

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
                <dd className="mt-3 text-[15px] text-ink-600 leading-relaxed">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="contact" className="bg-ink-gradient text-cream-100">
        <div className="mx-auto max-w-4xl px-6 py-24 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-champagne-200">Begin</div>
          <h2 className="mt-4 font-display text-4xl tracking-editorial text-cream-50 md:text-6xl md:leading-[1.05]">
            Choose the right starting point<br />
            <span className="italic text-champagne-300">for your association portfolio.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-cream-300 leading-relaxed">
            Start onboarding if you are moving from spreadsheets. Book a migration consultation if your team is switching from AppFolio, Buildium, or a larger existing stack.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/request-access?tier=starter">
              <Button size="lg" variant="accent">Start onboarding</Button>
            </Link>
            <Link href="/request-access?intent=migration">
              <Button
                size="lg"
                variant="outline"
                className="border-cream-300/40 text-cream-100 hover:border-cream-200 hover:bg-white/5"
              >
                Book migration consultation
              </Button>
            </Link>
          </div>
          <p className="mt-5 text-[11px] uppercase tracking-[0.18em] text-cream-400">
            Software subscription and implementation scope are quoted separately
          </p>
          <p className="mt-7 text-sm text-cream-300">
            Already a customer?{' '}
            <Link
              href="/login"
              className="font-medium text-champagne-300 underline decoration-champagne-500/60 decoration-1 underline-offset-4 transition-colors hover:text-champagne-200 hover:decoration-champagne-400"
            >
              Sign in to your workspace
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
