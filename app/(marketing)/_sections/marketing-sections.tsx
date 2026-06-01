import Link from 'next/link';
import { DollarSign, Zap, Users, Building2, HeartHandshake, FileCheck, ArrowRight, Phone, Globe, ShieldAlert, TrendingDown } from 'lucide-react';

function Check() {
  return (
    <svg className="h-4 w-4 flex-none text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FEATURES
   ═══════════════════════════════════════════════════════════════════ */
export function FeaturesSection() {
  return (
    <section className="border-t border-slate-800 bg-[#0B1121] py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">The Operating System</span>
          <h2 className="mt-4 text-4xl font-light tracking-tight text-white md:text-5xl">
            Every workflow. One platform.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-400">
            Accounting, maintenance, violations, communication, compliance, reporting — one login, one bill, no month-long onboarding.
          </p>
        </div>

        <div className="mt-20 grid gap-6 md:grid-cols-3">
          {[
            {
              title: 'Assessment billing & collections',
              desc: 'ACH and card processing with autopay enrollment. Late fee automation, delinquency tracking, payment plans, and lockbox integration. Owners pay online in seconds.',
            },
            {
              title: 'Work orders & maintenance',
              desc: 'Service request → work order → vendor assignment → completion → billing → done. Full lifecycle tracking with photo uploads, labor entries, and vendor management.',
            },
            {
              title: 'Violation tracking & enforcement',
              desc: 'Log violations, generate notices, schedule hearings, track fines, monitor compliance deadlines. Owner-submitted violations with photo uploads and complete repeat offender history.',
            },
            {
              title: 'Board & owner portals',
              desc: 'Dedicated portals for board members and owners. Financial reporting, document library, violation status, work order tracking — each role sees only what they need.',
            },
            {
              title: 'Financial reporting',
              desc: 'GL accounts, journal entries, bank reconciliation, receivables aging, AP management. Export to Excel or PDF with your company branding. Audit-ready at all times.',
            },
            {
              title: 'Vendor management',
              desc: 'Track vendor contacts, compliance documents, insurance certificates, and payment history. Assign vendors to work orders and manage the full procurement cycle.',
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

/* ═══════════════════════════════════════════════════════════════════
   HOW IT WORKS
   ═══════════════════════════════════════════════════════════════════ */
export function HowItWorksSection() {
  return (
    <section className="border-t border-slate-800 bg-[#0B1121] py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">How it works</span>
          <h2 className="mt-4 text-4xl font-light tracking-tight text-white md:text-5xl">
            Go live in days, not months.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-400">
            Most clients are fully operational in days — not months.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-4">
          {[
            ['1', 'Request a demo', 'See the platform in action. We\'ll walk you through every feature tailored to your portfolio.'],
            ['2', 'We migrate', 'We import your units, owners, vendors, balances, and documents so your team stays focused on operations.'],
            ['3', 'Configure', 'Set assessments, late fees, banking, and communication preferences.'],
            ['4', 'Go live', 'Invite your team, owners, and board members. Send your first statements.'],
          ].map(([n, title, desc]) => (
            <div key={n}>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-lg font-light text-emerald-400">
                {n}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SAVINGS COMPARISON — "How Much Are You Overpaying?"
   ═══════════════════════════════════════════════════════════════════ */
export function SavingsSection() {
  const rows = [
    { units: '250', legacy: '$1.00/unit', legacyCost: '$250/mo', portier: '$0.62/unit', portierCost: '$157/mo', annual: '$1,116' },
    { units: '1,000', legacy: '$1.00/unit', legacyCost: '$1,000/mo', portier: '$0.53/unit', portierCost: '$532/mo', annual: '$5,616' },
    { units: '4,000', legacy: '$1.00/unit', legacyCost: '$4,000/mo', portier: '$0.45/unit', portierCost: '$1,800/mo', annual: '$26,400' },
    { units: '10,000', legacy: '$1.00/unit', legacyCost: '$10,000/mo', portier: '$0.36/unit', portierCost: '$3,600/mo', annual: '$76,800', highlight: true },
  ];

  return (
    <section className="border-t border-slate-800 bg-[#060B18] py-24">
      <div className="mx-auto max-w-4xl px-6">
        {/* Hero callout */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <TrendingDown className="h-3.5 w-3.5" /> Compare &amp; Save
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-white md:text-5xl">
            How Much Are You Overpaying?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">
            See how Portier369 stacks up against AppFolio, Buildium &amp; Vantaca.
          </p>
        </div>

        {/* Big savings callout */}
        <div className="mx-auto mt-10 max-w-md rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/10 to-transparent p-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">Save Up To</p>
          <p className="mt-2 text-5xl font-extrabold tracking-tight text-white md:text-6xl">$76,800<span className="text-3xl md:text-4xl">/yr</span></p>
          <p className="mt-2 text-base text-slate-400">at 10,000 units vs. legacy platforms</p>
        </div>

        {/* Comparison table */}
        <div className="mt-12 overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#0B1121]">
                <th className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Units</th>
                <th className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Legacy Platform</th>
                <th className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-emerald-400">Portier369</th>
                <th className="whitespace-nowrap px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-emerald-400">Annual Savings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {rows.map((r) => (
                <tr key={r.units} className={`transition-colors hover:bg-[#0B1121]/50 ${r.highlight ? 'bg-emerald-500/5' : 'bg-[#060B18]'}`}>
                  <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-white">{r.units}</td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <span className="text-sm text-slate-500 line-through">{r.legacyCost}</span>
                    <span className="ml-2 text-xs text-slate-500">({r.legacy})</span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <span className="text-sm font-semibold text-emerald-400">{r.portierCost}</span>
                    <span className="ml-2 text-xs text-emerald-400/70">({r.portier})</span>
                  </td>
                  <td className={`whitespace-nowrap px-5 py-4 text-right text-sm font-bold ${r.highlight ? 'text-emerald-300 text-base' : 'text-emerald-400'}`}>{r.annual}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-10 text-center">
          <Link href="#contact" className="inline-flex h-14 items-center gap-2 rounded-xl bg-emerald-500 px-8 text-base font-semibold text-black transition-all hover:bg-emerald-400">
            See What You Could Save <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PRICING — Slim cards, max 8 features, cost-per-unit prominent
   ═══════════════════════════════════════════════════════════════════ */
export function PricingSection() {
  const plans: {
    name: string; price: string; period: string; unitRange: string;
    costPerUnit: string | null; savings: string | null; features: string[];
    cta: string; href: string; featured: boolean; note: string | null;
  }[] = [
    {
      name: 'Foundation',
      price: '$157',
      period: '/month',
      unitRange: 'Up to 250 Units',
      costPerUnit: '$0.62/unit',
      savings: null,
      features: [
        'Unlimited Users & Board Members',
        'Owner & Board Portals',
        'Accounting & Financial Reporting',
        'Assessment Billing & Collections',
        'Work Orders & Maintenance',
        'Document Library & Vendor Mgmt',
        'Announcements & Calendar',
        'Mobile Friendly Access',
      ],
      note: null,
      cta: 'Request More Info',
      href: '#contact',
      featured: false,
    },
    {
      name: 'Growth',
      price: '$157',
      period: '/mo + $0.50/unit',
      unitRange: '251–1,000 Units',
      costPerUnit: null,
      savings: null,
      features: [
        'Everything in Foundation',
        'Multi-Association Management',
        'Portfolio & Department Dashboards',
        'Board Packet Generation',
        'Bulk Communications',
        'Advanced Financial Reporting',
        'Full Violation Management',
      ],
      note: '500 units = $282/mo · 1,000 units = $532/mo',
      cta: 'Request More Info',
      href: '#contact',
      featured: true,
    },
    {
      name: 'Portfolio',
      price: '$0.45',
      period: '/unit',
      unitRange: '1,001–4,000 Units',
      costPerUnit: null,
      savings: 'Save 55% vs AppFolio',
      features: [
        'Everything in Growth',
        'Regional Manager Dashboards',
        'White-Labeled Portal',
        'Executive & Portfolio Reporting',
        'Vendor Performance Tracking',
      ],
      note: '2,000 units = $900/mo · 4,000 units = $1,800/mo',
      cta: 'Talk to Sales',
      href: '#contact',
      featured: false,
    },
    {
      name: 'Enterprise',
      price: '$0.36',
      period: '/unit',
      unitRange: '4,001–10,000+ Units',
      costPerUnit: null,
      savings: 'Save 64% vs AppFolio',
      features: [
        'Everything in Portfolio',
        'SSO & Enterprise Security',
        'Dedicated Account Manager',
        'API Access & Custom Integrations',
        'Enterprise SLA & Training',
      ],
      note: '10,000 units = $3,600/mo',
      cta: 'Schedule a Demo',
      href: '#contact',
      featured: false,
    },
  ];

  return (
    <section id="pricing" className="border-t border-slate-800 bg-[#0B1121] py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Pricing</span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-5xl">
            Simple, Transparent Pricing
          </h2>
          <p className="mt-3 text-base text-slate-400">
            No per-user fees. No hidden costs. Unlimited users included.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-7xl gap-5 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                plan.featured
                  ? 'border-emerald-500/30 bg-[#0A1628] shadow-[0_0_60px_-15px_rgba(16,185,129,0.15)]'
                  : 'border-slate-800 bg-[#111827]'
              }`}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-emerald-500/30 bg-emerald-500/20 px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                  Most Popular
                </span>
              )}

              <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
              <p className="mt-1 text-xs font-medium text-slate-400">{plan.unitRange}</p>

              {/* Price block */}
              <div className="mt-4">
                <span className="text-3xl font-bold tracking-tight text-white">{plan.price}</span>
                <span className="ml-1 text-sm text-slate-400">{plan.period}</span>
              </div>

              {plan.costPerUnit && (
                <p className="mt-1 text-sm font-semibold text-emerald-400">{plan.costPerUnit}</p>
              )}

              {plan.savings && (
                <span className="mt-2 inline-block w-fit rounded-full bg-emerald-500/15 px-3 py-0.5 text-xs font-bold text-emerald-400">
                  {plan.savings}
                </span>
              )}

              {/* Features */}
              <ul className="mt-5 flex-1 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5"><Check /></span>
                    <span className="text-slate-300">{f}</span>
                  </li>
                ))}
              </ul>

              {plan.note && (
                <p className="mt-4 text-xs text-slate-500">{plan.note}</p>
              )}

              <Link
                href={plan.href}
                className={`mt-6 flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition-all ${
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
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MOST POPULAR ADD-ONS (featured 3 + View All)
   ═══════════════════════════════════════════════════════════════════ */
export function AddOnsSection() {
  const featured = [
    {
      icon: ShieldAlert,
      name: 'ViolationFlow™',
      price: '$157–$1,800/yr',
      tagline: 'End-to-end compliance & enforcement management.',
      highlights: ['Automated Notices', 'Hearing Scheduling', 'Fine & Repeat Offender Tracking'],
    },
    {
      icon: Phone,
      name: 'AI Receptionist',
      price: '$2,388/yr',
      tagline: '24/7 AI phone answering, routing & lead capture.',
      highlights: ['Call Answering & Message Taking', 'Maintenance & Vendor Routing', 'Appointment Scheduling'],
    },
    {
      icon: Globe,
      name: 'AI Website & SEO',
      price: '$5,988/yr',
      tagline: 'Professional website, SEO, blogging & lead generation.',
      highlights: ['Custom Website & Unlimited Updates', 'AI Search Optimization', 'Blog Publishing & Lead Tracking'],
    },
  ];

  return (
    <section className="border-t border-slate-800 bg-[#060B18] py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Add-Ons</span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-5xl">
            Most Popular Add-Ons
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-base text-slate-400">
            Extend your platform with powerful optional services.
          </p>
        </div>

        <div className="mx-auto mt-14 grid gap-6 sm:grid-cols-3">
          {featured.map((addon) => {
            const Icon = addon.icon;
            return (
              <div key={addon.name} className="flex flex-col rounded-xl border border-slate-800 bg-[#0B1121] p-6 transition-colors hover:border-emerald-500/30">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500/15">
                  <Icon className="h-5 w-5 text-emerald-400" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">{addon.name}</h3>
                <p className="mt-1 text-sm font-bold text-emerald-400">{addon.price}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{addon.tagline}</p>
                <ul className="mt-4 space-y-1.5">
                  {addon.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="mt-0.5"><Check /></span>
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <Link href="#contact" className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400 transition-colors hover:text-emerald-300">
            View All Add-Ons <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   WHY COMPANIES CHOOSE PORTIER369
   ═══════════════════════════════════════════════════════════════════ */
export function WhySwitchSection() {
  const reasons = [
    { icon: DollarSign, title: 'Save Up to 60%', desc: 'Cut software costs compared to legacy platforms.' },
    { icon: Users, title: 'Unlimited Users', desc: 'No per-seat pricing. No surprise charges.' },
    { icon: Building2, title: 'Built for Associations', desc: 'Purpose-built for condos, townhomes & HOAs.' },
    { icon: HeartHandshake, title: 'White-Glove Migration', desc: 'We move owners, units, vendors, docs & balances.' },
    { icon: Zap, title: 'Live in Days', desc: 'Most companies are operational within days.' },
    { icon: FileCheck, title: 'No Long-Term Contracts', desc: 'Stay because you love it, not because you\'re locked in.' },
  ];

  return (
    <section className="border-t border-slate-800 bg-[#0B1121] py-20">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">The Portier369 Difference</span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl">
            Why Companies Choose Portier369
          </h2>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {reasons.map((r) => {
            const Icon = r.icon;
            return (
              <div key={r.title} className="flex items-start gap-4">
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-emerald-500/15">
                  <Icon className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{r.title}</h3>
                  <p className="mt-1 text-sm text-slate-400">{r.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FAQ
   ═══════════════════════════════════════════════════════════════════ */
export function FAQSection() {
  return (
    <section className="border-t border-slate-800 bg-[#0B1121] py-28">
      <div className="mx-auto max-w-3xl px-6">
        <h2 className="text-center text-4xl font-light tracking-tight text-white md:text-5xl">Frequently asked</h2>
        <dl className="mt-14 space-y-10">
          {[
            ['Can we migrate our existing data?',
             'Absolutely. We handle the migration — units, owners, vendors, balances, and documents. Most portfolios go live within a week. Your team stays focused on operations while we do the heavy lifting.'],
            ['What about payment processing fees?',
             '0.8% for ACH (capped at $5/transaction), 2.9% + 30¢ for cards — both via Stripe. You choose whether to absorb or pass through the card fee to owners as a convenience fee.'],
            ['Is it secure?',
             'Row-level security enforced at the database. No one outside a portfolio can see another portfolio\'s data. SOC 2 Type II (in progress). GDPR + CCPA compliance built-in.'],
            ['Do you support HOAs, condos, and townhomes?',
             'Yes — condominium, HOA, and townhome association management is our primary market. The platform is designed specifically for community associations, not apartments.'],
            ['How does violation tracking work?',
             'Foundation includes basic violation logging. Growth and above include the full workflow — owner-submitted violations, manager review queue, notices, hearings, fines, compliance deadlines, and repeat offender history. The advanced ViolationFlow™ Enforcement Suite add-on adds enforcement automation.'],
            ['Are there per-user fees?',
             'Never. Every plan includes unlimited users — managers, board members, owners, vendors. You pay based on portfolio size, not headcount.'],
            ['How do I get started?',
             'Request more info or schedule a demo. We\'ll walk you through the platform, discuss your portfolio needs, and handle the full migration and setup for you.'],
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

/* ═══════════════════════════════════════════════════════════════════
   CONTACT / REQUEST MORE INFO
   ═══════════════════════════════════════════════════════════════════ */
export function ContactSection() {
  return (
    <section className="border-t border-slate-800 bg-[#060B18] py-28">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Request More Info</span>
        <h2 className="mt-4 text-4xl font-light tracking-tight text-white md:text-5xl">
          Let&apos;s talk about your portfolio.
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-slate-400">
          Whether you manage 3 associations or 300, we&apos;d love to show you how Portier can simplify your operations and cut your software costs.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4">
          <a href="mailto:hello@portier369.com" className="inline-flex h-14 items-center rounded-xl bg-emerald-500 px-8 text-base font-semibold text-black transition-all hover:bg-emerald-400">
            hello@portier369.com
          </a>
          <p className="text-sm text-slate-400">We typically respond within 4 hours during business hours.</p>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CTA
   ═══════════════════════════════════════════════════════════════════ */
export function CTASection() {
  return (
    <section className="border-t border-slate-800 bg-[#060B18]">
      <div className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h2 className="text-4xl font-light tracking-tight text-white md:text-5xl">
          Ready to modernize your portfolio operations?
        </h2>
        <p className="mt-4 text-lg text-slate-400">
          See how Portier can reduce your costs and streamline every workflow.
        </p>
        <Link
          href="#contact"
          className="mt-8 inline-flex h-14 items-center rounded-xl bg-emerald-500 px-8 text-base font-semibold text-black transition-all hover:bg-emerald-400"
        >
          Request a Demo →
        </Link>
        <p className="mt-4 text-sm text-slate-400">No long-term contracts · Unlimited users · Your data stays yours</p>
      </div>
    </section>
  );
}