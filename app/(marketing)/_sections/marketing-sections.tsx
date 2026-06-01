import Link from 'next/link';
import { DollarSign, Zap, Users, Building2, HeartHandshake } from 'lucide-react';

function Check() {
  return (
    <svg className="h-4 w-4 flex-none text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" />
    </svg>
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

/* ═══════════════════════════════════════════════════════════════════════════
   HOW IT WORKS
   ═══════════════════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════════════════
   SAVINGS COMPARISON TABLE
   ═══════════════════════════════════════════════════════════════════════════ */
export function SavingsSection() {
  const rows = [
    { units: '500', legacy: '$500/mo', portier: '$282/mo', savings: '$2,616' },
    { units: '1,000', legacy: '$1,000/mo', portier: '$532/mo', savings: '$5,616' },
    { units: '4,000', legacy: '$4,000/mo', portier: '$1,800/mo', savings: '$26,400' },
    { units: '10,000', legacy: '$10,000/mo', portier: '$3,600/mo', savings: '$76,800' },
  ];

  return (
    <section className="border-t border-slate-800 bg-[#060B18] py-28">
      <div className="mx-auto max-w-4xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Compare Your Savings</span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-5xl">
            Save Up To 60% Compared to the Other Major Providers (Using 20 Year Old Software).
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-400">
            That single number is why management companies are switching. See what your portfolio would save.
          </p>
        </div>

        <div className="mt-12">
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full">
              <thead>
                <tr className="bg-[#0B1121]">
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Units</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Typical Legacy Platform</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-emerald-400">Portier</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-emerald-400">Annual Savings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {rows.map((row) => (
                  <tr key={row.units} className="bg-[#060B18] transition-colors hover:bg-[#0B1121]/50">
                    <td className="px-6 py-4 text-sm font-semibold text-white">{row.units}</td>
                    <td className="px-6 py-4 text-sm text-slate-400 line-through decoration-slate-600">{row.legacy}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-emerald-400">{row.portier}</td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-emerald-400">{row.savings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link href="#contact" className="inline-flex h-14 items-center rounded-xl bg-emerald-500 px-8 text-base font-semibold text-black transition-all hover:bg-emerald-400">
            See What You Could Save →
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRICING
   ═══════════════════════════════════════════════════════════════════════════ */
export function PricingSection() {
  const plans = [
    {
      name: 'Foundation',
      price: '$157',
      period: '/month',
      description: 'Perfect for self-managed associations and smaller management portfolios.',
      features: [
        'Up to 250 units',
        'Unlimited owners',
        'Unlimited board members',
        'Owner Portal',
        'Board Portal',
        'Work Orders',
        'Maintenance Tracking',
        'Basic Violations',
        'Architectural Reviews',
        'Vendor Management',
        'Announcements & Communications',
        'Document Library',
        'Financial Reporting',
        'Assessment Billing & Collections',
      ],
      note: 'Effective Cost: $0.62 per unit at 250 units',
      cta: 'Request More Info',
      href: '#contact',
      featured: false,
      examples: null,
    },
    {
      name: 'Growth',
      price: '$157',
      period: '/mo + $0.50/unit above 250',
      description: 'Built for growing management companies managing multiple associations.',
      features: [
        'Everything in Foundation, plus:',
        'Multi-association management',
        'Portfolio dashboard',
        'Manager permissions',
        'Full violation workflow',
        'Vendor compliance tracking',
        'Advanced reporting',
        'Bulk communications',
        'Automated workflows',
        'Custom user roles',
      ],
      note: null,
      cta: 'Request More Info',
      href: '#contact',
      featured: true,
      examples: [
        '500 Units = $282/month',
        '750 Units = $407/month',
        '1,000 Units = $532/month',
      ],
    },
    {
      name: 'Portfolio',
      price: '$0.45',
      period: '/unit per month',
      description: 'For established management companies operating between 1,001 and 4,000 units.',
      features: [
        'Everything in Growth, plus:',
        'Portfolio-level analytics',
        'Regional manager dashboards',
        'Advanced board reporting',
        'Full violation workflow + reporting',
        'White-label owner portal',
        'API access',
        'Workflow automation',
        'Priority support',
      ],
      note: null,
      cta: 'Talk to Sales',
      href: '#contact',
      featured: false,
      examples: [
        '2,000 Units = $900/month',
        '3,000 Units = $1,350/month',
        '4,000 Units = $1,800/month',
      ],
    },
    {
      name: 'Enterprise',
      price: '$0.36',
      period: '/unit per month',
      description: 'For large management firms operating 4,001–10,000+ units.',
      features: [
        'Everything in Portfolio, plus:',
        'Single Sign-On (SSO)',
        'Enterprise security controls',
        'Dedicated implementation manager',
        'Advanced audit logs',
        'Full violation workflow + reporting',
        'Custom integrations',
        'Custom reporting',
        'Data migration assistance',
        'Enterprise SLA',
      ],
      note: 'Example: 10,000 Units = $3,600/month',
      cta: 'Schedule a Demo',
      href: '#contact',
      featured: false,
      examples: null,
    },
  ];

  return (
    <section className="border-t border-slate-800 bg-[#0B1121] py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Pricing</span>
          <h2 className="mt-4 text-4xl font-light tracking-tight text-white md:text-5xl">
            Pricing Built for Portfolios, Not Per-User Fees
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-400">
            Run your condominium, HOA, and townhome communities on a modern operating system while saving up to 60% compared to legacy platforms.
          </p>
          <p className="mt-3 text-base font-medium text-slate-300">
            No implementation fees. No long-term contracts. Unlimited users included.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-7xl gap-5 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-7 ${
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
              <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
              <p className="mt-2 min-h-[48px] text-sm leading-relaxed text-slate-400">{plan.description}</p>
              <div className="mt-5">
                <span className="text-4xl font-light tracking-tight text-white">{plan.price}</span>
                <span className="ml-1 text-sm text-slate-400">{plan.period}</span>
              </div>

              {plan.examples && (
                <div className="mt-4 space-y-1">
                  {plan.examples.map((ex) => (
                    <div key={ex} className="text-xs text-slate-400">{ex}</div>
                  ))}
                </div>
              )}

              {plan.note && (
                <p className="mt-3 text-xs font-medium text-emerald-400/80">{plan.note}</p>
              )}

              <ul className="mt-6 flex-1 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    {f.endsWith('plus:') ? (
                      <span className="font-medium text-slate-300">{f}</span>
                    ) : (
                      <>
                        <span className="mt-0.5"><Check /></span>
                        <span className="text-slate-300">{f}</span>
                      </>
                    )}
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
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ADD-ON SERVICES
   ═══════════════════════════════════════════════════════════════════════════ */
export function AddOnsSection() {
  const addOns = [
    {
      name: 'AI Receptionist',
      price: '$157–$3,600/year',
      desc: '24/7 AI-powered phone answering, lead capture, and call routing.',
    },
    {
      name: 'AI Website & SEO Platform',
      price: '$1,988/year',
      desc: 'Custom website, ongoing SEO optimization, AI search visibility, blog publishing, and lead generation.',
    },
    {
      name: 'Online Voting & Election Suite',
      price: '$157–$3,600/year',
      desc: 'Secure owner voting, proxies, election tracking, and reporting.',
    },
    {
      name: 'White-Labeled Mobile App',
      price: '$157–$3,600/year',
      desc: 'Branded owner and board mobile experience under your company name.',
    },
    {
      name: 'Advanced Analytics & Executive Reporting',
      price: '$157–$3,600/year',
      desc: 'Portfolio performance dashboards and executive-level reporting.',
    },
    {
      name: 'AI Collections Assistant',
      price: '$157–$3,600/year',
      desc: 'Automated collection workflows, reminders, payment follow-up, and delinquency tracking.',
    },
    {
      name: 'Violation Management & Enforcement Suite',
      price: '$157–$3,600/year',
      desc: 'Complete violation tracking, owner notices, photo uploads, compliance deadlines, hearing scheduling, board decisions, fine tracking, repeat violation history, and reporting.',
      expanded: [
        'Owner-submitted violations',
        'Manager violation review queue',
        'Photo and document uploads',
        'Notice generation',
        'Hearing scheduling',
        'Board decision tracking',
        'Fine and charge tracking',
        'Repeat offender history',
        'Compliance deadline reminders',
        'Violation reports by association',
      ],
    },
  ];

  return (
    <section className="border-t border-slate-800 bg-[#060B18] py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Annual Add-On Services</span>
          <h2 className="mt-4 text-4xl font-light tracking-tight text-white md:text-5xl">
            Enhance your portfolio
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-400">
            Specialized services to extend your platform.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {addOns.map((addon) => (
            <div key={addon.name} className="flex flex-col rounded-xl border border-slate-800 bg-[#0B1121] p-6 transition-colors hover:border-slate-700">
              <h3 className="text-lg font-semibold text-white">{addon.name}</h3>
              <p className="mt-1 text-sm font-semibold text-emerald-400">{addon.price}</p>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-400">{addon.desc}</p>
              {addon.expanded && (
                <ul className="mt-4 space-y-1.5 border-t border-slate-800 pt-4">
                  {addon.expanded.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-slate-400">
                      <span className="mt-0.5"><Check /></span>
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WHY SWITCH
   ═══════════════════════════════════════════════════════════════════════════ */
export function WhySwitchSection() {
  const reasons = [
    {
      icon: DollarSign,
      title: 'Save More',
      desc: 'Many management companies reduce software costs by 40–60% compared to the other major providers still running 20 year old software.',
    },
    {
      icon: Zap,
      title: 'Go Live Faster',
      desc: 'Most clients are fully operational in days — not months.',
    },
    {
      icon: Users,
      title: 'Unlimited Users',
      desc: 'No per-seat pricing. No surprise user fees.',
    },
    {
      icon: Building2,
      title: 'Built for Associations',
      desc: 'Designed specifically for condominium, HOA, and townhome management — not apartments.',
    },
    {
      icon: HeartHandshake,
      title: 'White-Glove Migration',
      desc: 'We import your units, owners, vendors, balances, and documents so your team can stay focused on operations.',
    },
  ];

  return (
    <section className="border-t border-slate-800 bg-[#0B1121] py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">The Portier Difference</span>
          <h2 className="mt-4 text-4xl font-light tracking-tight text-white md:text-5xl">
            Why Management Companies Switch to Portier
          </h2>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {reasons.map((r) => {
            const Icon = r.icon;
            return (
              <div key={r.title} className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-500/20">
                  <Icon className="h-7 w-7 text-emerald-400" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">{r.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{r.desc}</p>
              </div>
            );
          })}
        </div>
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
             'Absolutely. We handle the migration — units, owners, vendors, balances, and documents. Most portfolios go live within a week. Your team stays focused on operations while we do the heavy lifting.'],
            ['What about payment processing fees?',
             '0.8% for ACH (capped at $5/transaction), 2.9% + 30¢ for cards — both via Stripe. You choose whether to absorb or pass through the card fee to owners as a convenience fee.'],
            ['Is it secure?',
             'Row-level security enforced at the database. No one outside a portfolio can see another portfolio\'s data. SOC 2 Type II (in progress). GDPR + CCPA compliance built-in.'],
            ['Do you support HOAs, condos, and townhomes?',
             'Yes — condominium, HOA, and townhome association management is our primary market. The platform is designed specifically for community associations, not apartments.'],
            ['How does violation tracking work?',
             'Foundation includes basic violation logging. Growth and above include the full workflow — owner-submitted violations, manager review queue, notices, hearings, fines, compliance deadlines, and repeat offender history. The advanced Violation Management Suite add-on adds enforcement automation.'],
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

/* ═══════════════════════════════════════════════════════════════════════════
   CONTACT / REQUEST MORE INFO
   ═══════════════════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════════════════
   CTA
   ═══════════════════════════════════════════════════════════════════════════ */
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
