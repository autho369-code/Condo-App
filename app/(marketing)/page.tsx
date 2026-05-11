import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Portier — Property management, refined.',
};

function Check() {
  return (
    <svg className="mt-0.5 h-4 w-4 flex-none text-champagne-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function Diamond() {
  return (
    <svg className="h-3 w-3 text-champagne-500" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <path d="M6 0l3 6-3 6-3-6z" />
    </svg>
  );
}

const features = [
  {
    title: 'Receivables, with restraint',
    desc: 'ACH at 0.8% (capped at $5), credit-card fees passed through transparently. Autopay enrolment in a single tap. Statements that look like correspondence — not invoices.',
  },
  {
    title: 'Disbursements, end to end',
    desc: 'AP queue → check-run wizard → printable #10 windowed checks. Sequential numbering, bank-grade audit trail, and stub memos that print exactly where treasurers expect.',
  },
  {
    title: 'Maintenance that closes itself',
    desc: 'Service request → work order → vendor → labour → bill → payment → archived. Webhook events keep your portfolio integrations in continuous sync.',
  },
  {
    title: 'Boards that are quietly informed',
    desc: 'Delinquency aging, insurance expirations, pending approvals, occupancy — surfaced once, never stale. Each board sees only their association.',
  },
  {
    title: 'Compliance, by composition',
    desc: '1099 generation, immutable audit log, GDPR / CCPA exports, soft-delete restore, privacy action tracking. Built into the platform, not bolted on.',
  },
  {
    title: 'A composable operating layer',
    desc: 'Scoped API keys with twenty-plus webhook events. Integrate QuickBooks, Mailchimp, lockbox feeds — your data, your rules, your pace.',
  },
];

const steps = [
  ['01', 'Apply', 'Tell us about your portfolio. We tailor onboarding to its accounting cadence.'],
  ['02', 'Import', 'Send a CSV; we land it within 48 hours, fully reconciled.'],
  ['03', 'Configure', 'Set assessments, late fees, and banking. Stripe linked in two minutes.'],
  ['04', 'Open', 'Invite team, owners, and board. Statements out by Friday.'],
];

const faqs: [string, string][] = [
  ['How does Portier differ from AppFolio or Buildium?',
   'Both were architected for the property-management market in the early 2000s, and the seams show. We rebuilt the entire workflow on a modern stack — Postgres, TypeScript, Stripe — with half the surface area, double the API coverage, and an editorial design language that respects the gravity of the work.'],
  ['Can our existing data move in?',
   'Yes. Send a CSV export from AppFolio, Buildium, Yardi, or QuickBooks and we land it in your account within 48 hours. We currently migrate ~30 associations and 1,200 units in a single weekend for a typical customer.'],
  ['How are payments handled?',
   '0.8% for ACH (capped at $5/transaction), 2.9% + 30¢ for cards — both via Stripe. You decide whether to absorb or pass-through the card fee. ACH remains free for the owner.'],
  ['Is it secure and compliant?',
   'Row-level security at the database for every query — no portfolio can ever read another portfolio. SOC 2 Type II in progress. GDPR + CCPA built in. Sensitive credentials live in Supabase Vault.'],
  ['Do you support HOAs, condominiums, and co-ops?',
   'Association management is our primary discipline. We also handle rental and mixed portfolios. Condos and co-ops use the same workflow with different labels.'],
];

const stats: [string, string][] = [
  ['1,200+', 'units under management'],
  ['$3M+',   'dues processed yearly'],
  ['30',     'partner portfolios'],
  ['99.98%', 'uptime SLA'],
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
              <span>Premium platform for community managers</span>
            </div>
            <h1 className="mt-8 font-display text-[2.5rem] leading-[1.1] tracking-tightest text-ink-900 sm:text-5xl md:text-7xl md:leading-[1.05]">
              Property management,<br />
              <span className="italic text-champagne-700">refined.</span>
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-lg text-ink-600 leading-relaxed md:text-xl">
              The operating platform for management companies who notice the
              details. Collect dues, write checks, manage work, keep boards
              informed — composed into one quietly-luxurious workspace.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link href="/request-access">
                <Button size="lg" variant="primary">Request access →</Button>
              </Link>
              <Link href="#demo">
                <Button size="lg" variant="outline">Watch the 2-minute tour</Button>
              </Link>
            </div>
            <p className="mt-4 text-xs uppercase tracking-[0.15em] text-ink-500">
              Concierge onboarding · Each tenant, their own URL · Your data, your portfolio
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
              The full surface, without the bloat.
            </h2>
            <p className="mt-5 text-base text-ink-600 leading-relaxed md:text-lg">
              Accounting, maintenance, communications, compliance, reporting —
              one login, one bill, no month-long onboarding.
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

      {/* ============ HOW IT WORKS ============ */}
      <section className="border-t border-ink-100 bg-cream-100 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="eyebrow">Onboarding</div>
            <h2 className="mt-3 font-display text-4xl tracking-editorial text-ink-900 md:text-5xl">
              An association, in an afternoon.
            </h2>
            <p className="mt-5 text-base text-ink-600 leading-relaxed md:text-lg">
              Most platforms take ninety days to implement. We take three hours,
              with a concierge alongside your team.
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
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <section id="pricing" className="border-t border-ink-100 bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="eyebrow">Pricing</div>
            <h2 className="mt-3 font-display text-4xl tracking-editorial text-ink-900 md:text-5xl">
              Composed for the size of your portfolio.
            </h2>
            <p className="mt-5 text-base text-ink-600 leading-relaxed md:text-lg">
              No per-unit fees. No implementation fees. Each tier ships with a concierge
              who walks your team through onboarding personally.
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-6xl gap-6 md:grid-cols-3">
            {/* CORE */}
            <div className="flex flex-col rounded-lg border border-ink-100 bg-white p-8 shadow-soft-sm transition-shadow hover:shadow-soft">
              <div className="eyebrow">Core</div>
              <h3 className="mt-2 font-display text-2xl tracking-editorial text-ink-900">For up to 5 associations</h3>
              <div className="mt-7 flex items-baseline gap-1">
                <span className="font-display text-5xl text-ink-900 number-plate">$149</span>
                <span className="text-sm text-ink-500">/ month</span>
              </div>
              <ul className="mt-7 flex-1 space-y-2.5 text-[14px] text-ink-700">
                {['Up to 5 user seats',
                  'Unlimited associations + units',
                  'ACH + card payment processing',
                  'Owner portal',
                  'Standard reports',
                  'Email support'].map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="/request-access?tier=core" className="mt-8">
                <Button size="md" variant="outline" className="w-full">Request access</Button>
              </Link>
            </div>

            {/* PLUS — featured */}
            <div className="relative flex flex-col rounded-lg bg-ink-gradient p-8 text-cream-100 shadow-soft-lg ring-1 ring-champagne-500/40">
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-champagne-shimmer px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-900 shadow-soft">
                Most chosen
              </span>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-champagne-200">Plus</div>
              <h3 className="mt-2 font-display text-2xl tracking-editorial text-cream-50">For growing companies</h3>
              <div className="mt-7 flex items-baseline gap-1">
                <span className="font-display text-5xl text-cream-50 number-plate">$299</span>
                <span className="text-sm text-cream-300">/ month</span>
              </div>
              <ul className="mt-7 flex-1 space-y-2.5 text-[14px] text-cream-200">
                {['Everything in Core, and:',
                  'Up to 15 user seats',
                  'Vendor portal + compliance tracking',
                  'Custom user roles',
                  'API access + webhooks',
                  'Scheduled reports',
                  'SMS texting inbox',
                  'Bill + PO approval workflows',
                  'Fixed assets + depreciation',
                  'Priority support'].map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="/request-access?tier=plus" className="mt-8">
                <Button size="md" variant="accent" className="w-full">Request access</Button>
              </Link>
            </div>

            {/* MAX */}
            <div className="flex flex-col rounded-lg border border-ink-100 bg-white p-8 shadow-soft-sm transition-shadow hover:shadow-soft">
              <div className="eyebrow">Max</div>
              <h3 className="mt-2 font-display text-2xl tracking-editorial text-ink-900">For enterprise operators</h3>
              <div className="mt-7 flex items-baseline gap-1">
                <span className="font-display text-5xl text-ink-900 number-plate">$699</span>
                <span className="text-sm text-ink-500">/ month</span>
              </div>
              <ul className="mt-7 flex-1 space-y-2.5 text-[14px] text-ink-700">
                {['Everything in Plus, and:',
                  'Unlimited seats',
                  'Per-role GL account permissions',
                  'SSO / SAML',
                  '7-year audit log retention',
                  'Full data export (JSON / CSV)',
                  'Custom domain + branding',
                  '24/7 support, 1-hour SLA',
                  'Dedicated implementation manager'].map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="/request-access?tier=max" className="mt-8">
                <Button size="md" variant="outline" className="w-full">Speak with us</Button>
              </Link>
            </div>
          </div>

          <p className="mx-auto mt-12 max-w-2xl text-center text-sm text-ink-500 leading-relaxed">
            For comparison: AppFolio at <span className="line-through">$1.40 / unit / month × 500 units = $700 / month</span>.
            Plus at $299 covers 15 users and as many units as you can manage —
            saving $400+ per month, every month.
          </p>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className="border-t border-ink-100 bg-cream-100 py-24">
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

      {/* ============ CTA ============ */}
      <section id="contact" className="bg-ink-gradient text-cream-100">
        <div className="mx-auto max-w-4xl px-6 py-24 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-champagne-200">Begin</div>
          <h2 className="mt-4 font-display text-4xl tracking-editorial text-cream-50 md:text-6xl md:leading-[1.05]">
            Give your portfolio<br />
            <span className="italic text-champagne-300">a finer instrument.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-cream-300 leading-relaxed">
            Request access. Add your first association today. Your team will notice
            the difference by Friday.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/request-access">
              <Button size="lg" variant="accent">Request access →</Button>
            </Link>
            <Link href="mailto:hello@portier369.com">
              <Button
                size="lg"
                variant="outline"
                className="border-cream-300/40 text-cream-100 hover:bg-white/5 hover:border-cream-200"
              >
                Speak with a concierge
              </Button>
            </Link>
          </div>
          <p className="mt-5 text-[11px] uppercase tracking-[0.18em] text-cream-400">
            No credit card · Cancel any time
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
