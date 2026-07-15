import Link from 'next/link'
import { Check } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing — Transparent Door-Based Plans',
  description: 'Transparent door-based pricing from $157/mo. Every subscription includes the complete core Portier369 platform and standard onboarding. No hidden software modules. Professional services quoted separately.',
  alternates: { canonical: '/pricing' },
}

const plans = [
  {
    name: 'Foundation', price: '$157', doors: 'Up to 200 Units',
    desc: 'For self-managed associations and smaller management companies.',
    cta: 'Request Proposal', href: '/demo',
    features: ['Complete core platform', 'Up to 200 units under management', 'Standard support', 'Standard usage allowances', 'Guided onboarding included'],
  },
  {
    name: 'Growth', price: '$382', doors: 'Up to 600 Units',
    desc: 'For growing management companies that need stronger operational control.',
    cta: 'Request Proposal', href: '/demo', featured: true,
    features: ['Complete core platform', 'Up to 600 units under management', 'Priority support', 'Higher usage allowances', 'Guided onboarding included'],
  },
  {
    name: 'Portfolio', price: '$642', doors: 'Up to 1,000 Units',
    desc: 'For established management companies managing multiple associations.',
    cta: 'Request Proposal', href: '/demo',
    features: ['Complete core platform', 'Up to 1,000 units under management', 'Priority support', 'Dedicated success manager', 'API access', 'Highest standard usage allowances', 'Guided onboarding included'],
  },
  {
    name: 'Enterprise', price: 'Custom', doors: '1,000+ Units',
    desc: 'For large management companies and multi-office operations.',
    cta: 'Request Proposal', href: '/demo',
    features: ['Complete core platform', 'Custom door capacity', 'SLA guarantee', 'Multi-office support', 'Dedicated support team', 'Custom usage allowances', 'Custom onboarding', 'Volume pricing'],
  },
]

const corePlatform = [
  'Association management',
  'Accounting — double-entry, budgets, late fees',
  'Owner portal',
  'Board portal',
  'Vendor portal',
  'Maintenance & work orders',
  'Violations',
  'Architectural reviews',
  'Document storage',
  'Communications',
  'Standard reports',
  'Workflow automation (Flows)',
  'AI assistance on your own provider key',
  'Mobile-responsive',
  'Security & updates',
  'Standard support',
]

const standardOnboarding = [
  'Company account configuration',
  'Creation of associations',
  'Import of units and current owners from a properly formatted spreadsheet',
  'Import of vendors from a properly formatted spreadsheet',
  'One remote administrator training session',
  'Standard launch assistance',
]

const professionalServices = [
  'Retrieving or exporting data from AppFolio or another provider',
  'Cleaning incomplete or inconsistent data',
  'Uploading and categorizing association documents',
  'Historical document migration',
  'Historical financial transaction migration',
  'Reconstructing owner ledgers',
  'Scanning and OCR of paper documents',
  'Custom integrations',
  'Custom reports',
  'White-label applications',
  'Custom websites',
  'Custom AI workflows',
  'Additional training',
  'Accounting conversion or cleanup',
  'On-site onboarding',
  'Dedicated account management',
]

const usageServices = [
  { name: 'AI Receptionist', desc: 'Voice minutes, phone numbers, and transcription for AI-answered owner calls.', href: '/ai-receptionist' },
  { name: 'SMS', desc: 'Text notifications to owners, boards, and vendors.' },
  { name: 'Email overages', desc: 'Email volume beyond your plan allowance.' },
  { name: 'Document storage', desc: 'Storage beyond your plan allowance.' },
  { name: 'OCR', desc: 'Optical character recognition for scanned documents.' },
  { name: 'Payment processing', desc: 'Processing fees for payment transactions.' },
]

const faqs = [
  {
    q: 'What is included in every plan?',
    a: 'Every subscription includes the complete core Portier369 platform: association management, double-entry accounting with budgets and late fees, the owner, board, and vendor portals, maintenance and work orders, violations, architectural reviews, document storage, communications, standard reports, workflow automation (Flows), AI assistance on your own provider key, and standard support. Standard onboarding is also included with every subscription.',
  },
  {
    q: 'What costs extra?',
    a: 'Two things: professional services and usage-based services. Professional services — such as data retrieval from a previous provider, historical document and financial migration, data cleanup, custom integrations, and additional training — are quoted separately. Usage-based services — such as AI Receptionist voice minutes, SMS, email overages, document storage beyond your allowance, OCR, and payment processing — are billed by usage, with plan allowances published in the order form.',
  },
  {
    q: 'How does onboarding work?',
    a: 'Standard onboarding is a guided four-week process: account creation and configuration, import of units, owners, and vendors from properly formatted spreadsheets, one remote administrator training session, and launch assistance. See the full timeline on our onboarding page.',
  },
  {
    q: 'Can you migrate us from AppFolio?',
    a: 'Standard onboarding is included; professional migration of historical documents and financials is available as a quoted service.',
  },
  {
    q: 'Do you charge setup fees?',
    a: 'Standard onboarding is included with every subscription; professional services are quoted separately.',
  },
  {
    q: 'How much training is included?',
    a: 'Every subscription includes one remote administrator training session as part of standard onboarding. Additional training sessions, board workshops, and on-site training are available as quoted professional services.',
  },
  {
    q: 'Can Portier answer owner phone calls?',
    a: 'Yes. The AI Receptionist add-on answers owner calls with an AI voice agent, billed by usage (voice minutes, phone numbers, and transcription). See the AI Receptionist page for details.',
  },
]

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(faq => ({
    '@type': 'Question',
    name: faq.q,
    acceptedAnswer: { '@type': 'Answer', text: faq.a },
  })),
}

export default function PricingPage() {
  return (
    <div className="bg-white font-sans antialiased">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      {/* Hero — dark to match landing */}
      <section className="relative overflow-hidden bg-[#060709] pt-20 pb-16 sm:pt-28 sm:pb-20">
        <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-[0.14]" style={{ background: 'radial-gradient(circle, #6d8dff 0%, transparent 70%)' }} />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '88px 88px' }} />
        <div className="relative mx-auto max-w-[1180px] px-6 lg:px-8 text-center">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-5 py-2 text-[13px] font-medium text-emerald-300">
            <Check className="h-4 w-4" />
            No hidden software modules.
          </div>
          <h1 className="text-[40px] font-semibold leading-[1.04] tracking-[-0.03em] text-white sm:text-6xl lg:text-[64px]">
            Transparent Pricing
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-8 text-zinc-400 sm:text-lg">
            Every subscription includes the complete core Portier369 platform. Data conversion, historical document
            migration, custom integrations, premium AI services, and other hands-on professional services are quoted
            separately.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-16 sm:pb-20 pt-14">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
          <p className="mx-auto mb-10 max-w-2xl text-center text-base text-gray-500">
            Every plan runs the same core platform. Tiers differ only by door capacity, support level, and usage
            allowances.
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map(plan => (
              <div key={plan.name} className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${plan.featured ? 'border-[#1E3A5F] ring-2 ring-[#1E3A5F] shadow-[0_12px_40px_rgba(30,58,95,0.12)] scale-[1.03]' : 'border-gray-200 shadow-[0_4px_20px_rgba(0,0,0,0.04)]'}`}>
                {plan.featured && <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#1E3A5F] px-4 py-1 text-xs font-semibold text-white">Most Popular</div>}
                <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  {plan.price !== 'Custom' && <span className="text-base text-gray-400">/month</span>}
                </div>
                <p className="mt-2 text-sm text-gray-500">{plan.doors}</p>
                <p className="mt-3 text-sm text-gray-500 leading-relaxed">{plan.desc}</p>
                <Link href={plan.href} className={`mt-5 flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition w-full ${plan.featured ? 'bg-[#1E3A5F] text-white hover:bg-[#152940]' : 'border-2 border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'}`}>
                  {plan.cta}
                </Link>
                <div className="mt-5 pt-4 border-t border-gray-100 flex-1">
                  <ul className="space-y-2">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-xs text-gray-500 leading-relaxed">
                        <Check className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-emerald-500" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Every plan includes — the core platform */}
      <section className="py-16 sm:py-20" style={{ backgroundColor: '#F5F4F1' }}>
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-5xl">Every plan includes</h2>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">The complete core Portier369 platform — the same software on every tier.</p>
          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {corePlatform.map(item => (
              <div key={item} className="flex items-start gap-2.5 rounded-xl bg-white border border-gray-200 px-5 py-4 text-left text-sm font-medium text-gray-700 shadow-sm">
                <Check className="h-4 w-4 mt-0.5 flex-shrink-0 text-emerald-500" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Standard onboarding included */}
      <section className="py-16 sm:py-20 bg-[#1E3A5F]">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-white sm:text-5xl">Standard onboarding included</h2>
          <p className="mt-4 text-lg text-gray-300 max-w-2xl mx-auto">Guided onboarding included. Advanced migration available.</p>
          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {standardOnboarding.map(item => (
              <div key={item} className="rounded-xl bg-white/8 border border-white/10 px-5 py-3.5 text-base font-medium text-white/90">{item}</div>
            ))}
          </div>
          <div className="mt-8">
            <Link href="/onboarding" className="inline-flex items-center gap-2 text-base font-semibold text-white/90 hover:text-white underline underline-offset-4 transition">
              See how onboarding works
            </Link>
          </div>
        </div>
      </section>

      {/* Professional services — quoted separately */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-5xl">Professional services — quoted separately</h2>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">Hands-on work beyond standard onboarding is scoped and quoted before we begin. No surprises in either direction.</p>
          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {professionalServices.map(svc => (
              <div key={svc} className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-left text-sm text-gray-600 leading-relaxed shadow-sm">{svc}</div>
            ))}
          </div>
          <div className="mt-10">
            <Link href="/professional-services" className="inline-flex items-center gap-2 rounded-xl border-2 border-[#1E3A5F]/20 bg-[#1E3A5F]/5 px-8 py-4 text-base font-semibold text-[#1E3A5F] hover:bg-[#1E3A5F]/10 transition">
              Explore professional services
            </Link>
          </div>
        </div>
      </section>

      {/* Usage-based services */}
      <section className="py-16 sm:py-20" style={{ backgroundColor: '#F5F4F1' }}>
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-5xl">Usage-based services</h2>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">Each plan carries usage allowances; the allowances for your plan are published in the order form. Beyond them, these services are billed by usage.</p>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {usageServices.map(svc => (
              <div key={svc.name} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm text-left">
                <div className="text-sm font-semibold text-gray-900">
                  {svc.href ? <Link href={svc.href} className="hover:text-[#1E3A5F] hover:underline transition">{svc.name}</Link> : svc.name}
                </div>
                <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">{svc.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="mx-auto max-w-3xl px-6 lg:px-8">
          <h2 className="text-center text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-5xl mb-12">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqs.map(faq => (
              <details key={faq.q} className="group rounded-xl border border-gray-200 bg-white shadow-sm">
                <summary className="flex cursor-pointer items-center justify-between px-6 py-4 text-base font-semibold text-gray-900 hover:text-[#1E3A5F] transition">
                  {faq.q}
                  <svg className="h-4 w-4 flex-shrink-0 text-gray-300 group-open:rotate-45 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </summary>
                <div className="px-6 pb-5 text-base text-gray-500 leading-relaxed">
                  {faq.a}
                  {faq.q === 'How does onboarding work?' && <> <Link href="/onboarding" className="text-[#1E3A5F] font-medium hover:underline">How onboarding works &rarr;</Link></>}
                  {faq.q === 'Can you migrate us from AppFolio?' && <> <Link href="/professional-services" className="text-[#1E3A5F] font-medium hover:underline">Professional services &rarr;</Link></>}
                  {faq.q === 'Can Portier answer owner phone calls?' && <> <Link href="/ai-receptionist" className="text-[#1E3A5F] font-medium hover:underline">AI Receptionist &rarr;</Link></>}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-gray-100 bg-white py-16">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-5xl">Run your entire portfolio from one platform.</h2>
          <p className="mt-4 text-lg text-gray-500">Standard onboarding included. No long-term contract required.</p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/demo" className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A5F] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-[#1E3A5F]/20 hover:bg-[#152940] transition">Request Proposal</Link>
            <a href="mailto:hello@portier369.com" className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-8 py-4 text-base font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition">Contact sales</a>
          </div>
        </div>
      </section>
    </div>
  )
}
