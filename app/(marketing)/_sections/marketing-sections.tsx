import Link from 'next/link';

function Check() {
  return (
    <svg className="h-5 w-5 flex-none text-brand-600" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" />
    </svg>
  );
}

export function FeaturesSection() {
  return (
    <section className="border-t border-gray-100 bg-white py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">Everything AppFolio does. Without the bloat.</h2>
          <p className="mt-4 text-gray-600">
            Accounting, maintenance, communication, compliance, reporting — one login, one bill,
            no month-long onboarding.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {[
            {
              title: 'Collect dues without bleeding on fees',
              desc: 'ACH at 0.8% (capped $5), card convenience fees passed through to the owner. Autopay enrollment in one tap. Paper checks still welcome via manual entry or lockbox scan.',
              icon: '💳',
            },
            {
              title: 'Write checks that actually print',
              desc: 'AP queue to check-run wizard to #10 window-envelope ready printable. Sequential check numbers assigned automatically. Memo prints on the stub.',
              icon: '🧾',
            },
            {
              title: 'Maintenance that closes itself',
              desc: 'Service request → work order → vendor assignment → labor entry → vendor bill → payment → done. With webhook events so your tools stay in sync.',
              icon: '🔧',
            },
            {
              title: 'Dashboards your board members actually read',
              desc: 'Delinquency aging, insurance expirations, pending approvals, occupancy — surfaced once, never stale. Board portal shows their association only.',
              icon: '📊',
            },
            {
              title: 'Compliance that does itself',
              desc: '1099 generation, audit log, GDPR/CCPA data exports, soft-delete restore, privacy action tracking — built in, not bolted on.',
              icon: '🛡️',
            },
            {
              title: 'APIs and webhooks, not a walled garden',
              desc: 'Scoped API keys with 20+ webhook events. Integrate QuickBooks, Mailchimp, whatever your operators already use. Your data, your rules.',
              icon: '🔌',
            },
          ].map((f) => (
            <div key={f.title} className="rounded-lg border border-gray-200 p-6">
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-4 font-semibold text-gray-900">{f.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PricingSection() {
  return (
    <section className="border-t border-gray-100 bg-white py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">Simple pricing, scaled to your portfolio.</h2>
          <p className="mt-4 text-gray-600">
            No per-unit fees. No implementation fees. No &quot;call sales for pricing.&quot; Pick a tier and go.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
          {/* CORE */}
          <div className="flex flex-col rounded-lg border border-gray-200 p-8">
            <h3 className="text-lg font-semibold text-gray-900">Core</h3>
            <p className="mt-1 text-sm text-gray-500">For managers with up to 5 associations.</p>
            <div className="mt-6">
              <span className="text-4xl font-bold">$149</span>
              <span className="ml-1 text-gray-500">/month</span>
            </div>
            <ul className="mt-6 flex-1 space-y-2 text-sm text-gray-700">
              {[
                'Up to 5 user seats',
                'Unlimited associations + units',
                'ACH + card payment processing',
                'Owner portal',
                'Standard reports',
                'Email support',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2"><Check />{f}</li>
              ))}
            </ul>
            <Link href="/signup?tier=core"
              className="mt-8 inline-flex h-11 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-900 hover:bg-gray-50">
              Start free trial
            </Link>
          </div>

          {/* PLUS — featured */}
          <div className="flex flex-col rounded-lg border-2 border-brand-600 p-8 shadow-lg relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold uppercase text-white">Most popular</span>
            <h3 className="text-lg font-semibold text-gray-900">Plus</h3>
            <p className="mt-1 text-sm text-gray-500">For growing management companies.</p>
            <div className="mt-6">
              <span className="text-4xl font-bold">$299</span>
              <span className="ml-1 text-gray-500">/month</span>
            </div>
            <ul className="mt-6 flex-1 space-y-2 text-sm text-gray-700">
              {[
                'Everything in Core, plus:',
                'Up to 15 user seats',
                'Vendor portal + compliance tracking',
                'Custom user roles',
                'API access + webhooks',
                'Scheduled reports',
                'SMS texting inbox',
                'Bill + PO approval workflows',
                'Fixed assets + depreciation',
                'Priority support',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2"><Check />{f}</li>
              ))}
            </ul>
            <Link href="/signup?tier=plus"
              className="mt-8 inline-flex h-11 items-center justify-center rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
              Start free trial
            </Link>
          </div>

          {/* MAX */}
          <div className="flex flex-col rounded-lg border border-gray-200 p-8">
            <h3 className="text-lg font-semibold text-gray-900">Max</h3>
            <p className="mt-1 text-sm text-gray-500">For enterprise operators &amp; regulated verticals.</p>
            <div className="mt-6">
              <span className="text-4xl font-bold">$699</span>
              <span className="ml-1 text-gray-500">/month</span>
            </div>
            <ul className="mt-6 flex-1 space-y-2 text-sm text-gray-700">
              {[
                'Everything in Plus, plus:',
                'Unlimited seats',
                'Per-role GL account permissions',
                'SSO / SAML',
                '7-year audit log retention',
                'Full data export (JSON/CSV)',
                'Custom domain + branding',
                '24/7 support with 1hr SLA',
                'Dedicated implementation manager',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2"><Check />{f}</li>
              ))}
            </ul>
            <Link href="/signup?tier=max"
              className="mt-8 inline-flex h-11 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-900 hover:bg-gray-50">
              Talk to sales
            </Link>
          </div>
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-gray-500">
          Compare to AppFolio: <span className="line-through">$1.40/unit/month × 500 units = $700/month</span>.
          With us, Plus at $299/month covers 15 users and as many units as you can manage.
          Save $400+/month from day one.
        </p>
      </div>
    </section>
  );
}

export function FAQSection() {
  return (
    <section className="border-t border-gray-100 bg-gray-50 py-20">
      <div className="mx-auto max-w-3xl px-6">
        <h2 className="text-3xl font-bold text-gray-900 md:text-4xl text-center">Frequently asked</h2>
        <dl className="mt-12 space-y-8">
          {[
            ['How do you compare to AppFolio and Buildium?',
             'AppFolio and Buildium built for the property-management market in the 2000s, and it shows. We rebuilt the same feature set — accounting, maintenance, comms, compliance — on a modern stack (Postgres + TypeScript + Stripe) with half the surface area and double the API coverage. Price is ~40% lower at similar scale.'],
            ['Can we migrate our existing data?',
             'Yes. Send us a CSV export from your current system (AppFolio, Buildium, Yardi, or QuickBooks) and we\'ll land it in your account within 48 hours. We currently migrate ~30 associations / 1,200 units in a single weekend for a typical customer.'],
            ['What about payment processing fees?',
             '0.8% for ACH (capped at $5/transaction), 2.9% + 30¢ for cards — both via Stripe. You choose whether to absorb or pass through the card fee to owners as a "convenience fee." Most customers pass it through. ACH remains free to the owner.'],
            ['Is it secure? What about compliance?',
             'Row-level security is enforced at the database for every query. No one outside a portfolio can ever see another portfolio\'s data. SOC 2 Type II (in progress). GDPR + CCPA compliance: data export, right-to-delete, anonymization — built-in. All sensitive credentials (bank routing + account numbers, taxpayer IDs) stored in Supabase Vault.'],
            ['Can owners pay by check?',
             'Absolutely. Manual check entry takes 20 seconds per payment. For high-volume associations, we integrate with lockbox services (CheckAlt, Remit Plus) that scan paper checks and ACH-deposit them automatically. You get a CSV feed we import into your run.'],
            ['Do you support HOAs, condos, and co-ops?',
             'Yes — association management is our primary market. We also handle rental property management (single-family, multi-family), and mixed portfolios. Condos and co-ops use the same workflow with different labels.'],
          ].map(([q, a]) => (
            <div key={q}>
              <dt className="font-semibold text-gray-900">{q}</dt>
              <dd className="mt-2 text-sm text-gray-600">{a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function CTASection() {
  return (
    <section className="bg-brand-600">
      <div className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h2 className="text-3xl font-bold text-white md:text-4xl">Ready to give your portfolio a better OS?</h2>
        <p className="mt-4 text-brand-100">
          Start free. Add your first association today. Your team will notice by Friday.
        </p>
        <Link href="/signup"
          className="mt-8 inline-flex h-12 items-center rounded-md bg-white px-6 text-base font-semibold text-brand-700 hover:bg-brand-50">
          Start your 30-day free trial →
        </Link>
        <p className="mt-3 text-xs text-brand-200">No credit card · Cancel any time</p>
      </div>
    </section>
  );
}
