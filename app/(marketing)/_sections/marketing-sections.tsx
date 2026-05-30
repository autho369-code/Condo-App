import Link from 'next/link';

function Check() {
  return (
    <svg className="h-4 w-4 flex-none text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" />
    </svg>
  );
}

function ProductPreview({ items }: { items: string[] }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-1.5">
      {items.map((item) => (
        <div key={item} className="flex items-center gap-1.5 rounded bg-[#0F172A] px-2 py-1.5 text-[11px] font-medium text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/70" />
          {item}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FEATURES
   ═══════════════════════════════════════════════════════════════════════════ */
export function FeaturesSection() {
  return (
    <section className="border-t border-slate-800 bg-[#0B1121] py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">The Operating System</span>
          <h2 className="mt-4 text-4xl font-light tracking-tight text-white md:text-5xl">
            Every workflow. One platform.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-400">
            Accounting, maintenance, communication, compliance, reporting — one login, one bill, no month-long onboarding.
          </p>
        </div>

        <div className="mt-20 grid gap-6 md:grid-cols-3">
          {[
            {
              title: 'Collect dues without bleeding on fees',
              desc: 'ACH at 0.8% (capped $5), card convenience fees passed through to the owner. Autopay enrollment in one tap. Paper checks still welcome via manual entry or lockbox scan.',
            },
            {
              title: 'Write checks that actually print',
              desc: 'AP queue to check-run wizard to #10 window-envelope ready printable. Sequential check numbers assigned automatically. Memo prints on the stub.',
            },
            {
              title: 'Maintenance that closes itself',
              desc: 'Service request → work order → vendor assignment → labor entry → vendor bill → payment → done. With webhook events so your tools stay in sync.',
            },
            {
              title: 'Dashboards your board members actually read',
              desc: 'Delinquency aging, insurance expirations, pending approvals, occupancy — surfaced once, never stale. Board portal shows their association only.',
            },
            {
              title: 'Compliance that does itself',
              desc: '1099 generation, audit log, GDPR/CCPA data exports, soft-delete restore, privacy action tracking — built in, not bolted on.',
            },
            {
              title: 'APIs and webhooks, not a walled garden',
              desc: 'Scoped API keys with 20+ webhook events. Integrate QuickBooks, Mailchimp, whatever your operators already use. Your data, your rules.',
            },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-slate-800 bg-[#111827] p-7 transition-colors hover:border-slate-700">
              <h3 className="text-lg font-semibold text-white">{f.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRICING — Foundation / Professional / Portfolio
   ═══════════════════════════════════════════════════════════════════════════ */
export function PricingSection() {
  const plans = [
    {
      name: 'Foundation',
      price: '$349',
      period: '/month',
      description: 'For self-managed associations and small portfolios getting started with professional operations.',
      features: [
        'Up to 3 associations',
        'Unlimited units & owners',
        'ACH + card payment processing',
        'Owner portal with ledger & autopay',
        'Board portal — read-only',
        'Work orders & maintenance tracking',
        'Standard reports & AR aging',
        'Email support (48hr response)',
      ],
      productPreview: ['Owner Portal', 'Board Portal', 'Work Orders'],
      cta: 'Start free trial',
      href: '/signup?tier=foundation',
      featured: false,
    },
    {
      name: 'Professional',
      price: '$749',
      period: '/month',
      description: 'For management companies running multiple associations with staff, vendors, and compliance requirements.',
      features: [
        'Everything in Foundation',
        'Up to 25 associations',
        'Full board portal — voting, documents, minutes',
        'Violation tracking & enforcement',
        'Architectural review workflow',
        'Vendor management & compliance',
        'Bill approval workflows',
        'Custom user roles & permissions',
        'API access + webhooks',
        'Priority support (4hr response)',
      ],
      productPreview: ['Board Portal', 'Violations', 'Architectural Reviews', 'Vendor Management', 'Owner Portal'],
      cta: 'Start free trial',
      href: '/signup?tier=professional',
      featured: true,
    },
    {
      name: 'Portfolio',
      price: '$1,499',
      period: '/month',
      description: 'For enterprise operators managing 25+ associations with dedicated implementation and compliance needs.',
      features: [
        'Everything in Professional',
        'Unlimited associations',
        'SSO / SAML authentication',
        '7-year audit log retention',
        'Full data export (JSON/CSV)',
        'Custom domain & white-label branding',
        'Dedicated implementation manager',
        '24/7 support with 1hr SLA',
        'Custom reporting & BI integration',
        'Bulk owner communication campaigns',
      ],
      productPreview: ['Board Portal', 'Violations', 'Architectural Reviews', 'Vendor Management', 'Owner Portal'],
      cta: 'Talk to sales',
      href: '/contact',
      featured: false,
    },
  ];

  return (
    <section className="border-t border-slate-800 bg-[#060B18] py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Pricing</span>
          <h2 className="mt-4 text-4xl font-light tracking-tight text-white md:text-5xl">
            Pricing built for portfolios, not seats.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-400">
            No per-unit fees. No implementation charges. No hidden costs. Every plan includes unlimited units and owners — you pay based on the workflows your portfolio needs, not how many doors you manage.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-8 ${
                plan.featured
                  ? 'border-emerald-500/30 bg-[#0A1628] shadow-[0_0_60px_-15px_rgba(16,185,129,0.15)]'
                  : 'border-slate-800 bg-[#0B1121]'
              }`}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                  Most Popular
                </span>
              )}

              <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{plan.description}</p>

              <div className="mt-6">
                <span className="text-5xl font-light tracking-tight text-white">{plan.price}</span>
                <span className="ml-1 text-lg text-slate-500">{plan.period}</span>
              </div>

              {/* Product preview badges */}
              <ProductPreview items={plan.productPreview} />

              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-0.5"><Check /></span>
                    <span className="text-slate-300">{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`mt-8 flex h-12 items-center justify-center rounded-xl text-sm font-semibold transition-all ${
                  plan.featured
                    ? 'bg-emerald-500 text-black hover:bg-emerald-400'
                    : 'border border-slate-700 bg-transparent text-white hover:border-slate-500'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-xl text-center text-sm text-slate-600">
          All plans include a 30-day free trial. No credit card required. Migrate your data in 48 hours. Cancel any time.
        </p>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FAQ
   ═══════════════════════════════════════════════════════════════════════════ */
export function FAQSection() {
  return (
    <section className="border-t border-slate-800 bg-[#0B1121] py-28">
      <div className="mx-auto max-w-3xl px-6">
        <h2 className="text-center text-4xl font-light tracking-tight text-white md:text-5xl">Frequently asked</h2>
        <dl className="mt-14 space-y-10">
          {[
            ['Can we migrate our existing data?',
             'Yes. Send us a CSV export from your current system and we\'ll land it in your account within 48 hours. We regularly migrate portfolios of 30+ associations and 1,200+ units over a single weekend.'],
            ['What about payment processing fees?',
             '0.8% for ACH (capped at $5/transaction), 2.9% + 30¢ for cards — both via Stripe. You choose whether to absorb or pass through the card fee to owners as a convenience fee. ACH remains free to the owner.'],
            ['Is it secure? What about compliance?',
             'Row-level security is enforced at the database for every query. No one outside a portfolio can ever see another portfolio\'s data. SOC 2 Type II (in progress). GDPR + CCPA compliance: data export, right-to-delete, anonymization — built-in. All sensitive credentials stored in Supabase Vault.'],
            ['Can owners pay by check?',
             'Absolutely. Manual check entry takes 20 seconds per payment. For high-volume associations, we integrate with lockbox services that scan paper checks and ACH-deposit them automatically. You get a CSV feed we import into your run.'],
            ['Do you support HOAs, condos, and co-ops?',
             'Yes — association management is our primary market. We also handle rental property management (single-family, multi-family), and mixed portfolios. Condos and co-ops use the same workflow with different labels.'],
            ['What does implementation look like?',
             'Most customers are fully operational within one week. We import your data, configure your chart of accounts, set up payment processing, and train your team. No 90-day consulting engagements.'],
          ].map(([q, a]) => (
            <div key={q}>
              <dt className="text-lg font-semibold text-white">{q}</dt>
              <dd className="mt-3 text-sm leading-relaxed text-slate-400">{a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CTA
   ═══════════════════════════════════════════════════════════════════════════ */
export function CTASection() {
  return (
    <section className="border-t border-slate-800 bg-[#060B18]">
      <div className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h2 className="text-4xl font-light tracking-tight text-white md:text-5xl">
          Ready to give your portfolio a better operating system?
        </h2>
        <p className="mt-4 text-lg text-slate-400">
          Start free. Add your first association today. Your team will notice by Friday.
        </p>
        <Link
          href="/signup"
          className="mt-8 inline-flex h-14 items-center rounded-xl bg-emerald-500 px-8 text-base font-semibold text-black transition-all hover:bg-emerald-400"
        >
          Start your 30-day free trial &rarr;
        </Link>
        <p className="mt-4 text-sm text-slate-600">No credit card · Cancel any time · Your data stays yours</p>
      </div>
    </section>
  );
}
