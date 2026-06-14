import Link from 'next/link'
import { Check } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing — Simple Door-Based Plans',
  description: 'Transparent door-based pricing for property management companies. Plans from $157/mo. Everything included — no hidden modules, no implementation fees, no long-term contracts.',
  alternates: { canonical: '/pricing' },
}

const plans = [
  {
    name: 'Foundation', price: '$157', doors: 'Up to 200 Units',
    desc: 'For self-managed associations and smaller management companies.',
    cta: 'Request Proposal', href: '/demo',
    features: ['Owner Portal', 'Board Portal', 'Manager Dashboard', 'Work Orders', 'Violations', 'Document Management', 'Assessment Tracking', 'Email Communications', 'White Glove Setup'],
  },
  {
    name: 'Growth', price: '$382', doors: 'Up to 600 Units',
    desc: 'For growing management companies that need stronger operational control.',
    cta: 'Request Proposal', href: '/demo', featured: true,
    features: ['Everything in Foundation', 'Vendor Portal', 'Maintenance Calendar', 'Compliance Tracking', 'Vendor Coordination', 'Association Health Scores', 'SMS Notifications', 'Portfolio Visibility', 'Priority Support'],
  },
  {
    name: 'Portfolio', price: '$642', doors: 'Up to 1,000 Units',
    desc: 'For established management companies managing multiple associations.',
    cta: 'Request Proposal', href: '/demo',
    features: ['Everything in Growth', 'Company Admin Dashboard', 'Architectural Reviews', 'Board Management Tools', 'AI Automation', 'Advanced Reporting', 'API Access', 'Multi-Manager Oversight', 'Dedicated Success Manager'],
  },
  {
    name: 'Enterprise', price: 'Custom', doors: '1,000+ Units',
    desc: 'For large management companies and multi-office operations.',
    cta: 'Request Proposal', href: '/demo',
    features: ['Everything in Portfolio', 'Multi-Office Support', 'Custom Integrations', 'Custom AI Workflows', 'Enterprise Security Controls', 'Dedicated Support Team', 'SLA Guarantee', 'Custom Onboarding', 'Volume Pricing'],
  },
]

const faqs = [
  { q: 'Is pricing based on doors or users?', a: 'Pricing is based on active doors and units under management. Owners, board members, and vendors are unlimited on every plan.' },
  { q: 'Are owners, board members, and vendors unlimited?', a: 'Yes. Every plan includes unlimited owners, unlimited board members, and unlimited vendors.' },
  { q: 'Are maintenance and compliance tools included?', a: 'Yes. Preventive maintenance planning, work order management, and vendor compliance tracking — including insurance, license, and certification expiration monitoring — are included in Foundation and above.' },
  { q: 'Can we use our own AI API key?', a: 'Yes. Management companies can connect their own OpenAI, Claude, or Gemini API key. AI assists with drafting notices, summarizing meetings, and preparing responses — all running on your credentials.' },
  { q: 'Are there long-term contracts?', a: 'No long-term contract is required. You can cancel anytime. We earn your business every month.' },
  { q: 'Do you offer a free trial?', a: 'We do not offer self-service free trials. Instead, we provide guided demos and white-glove onboarding to ensure every management company is properly set up from day one.' },
]

export default function PricingPage() {
  return (
    <div className="bg-white font-sans antialiased">
      {/* Hero — dark to match landing */}
      <section className="relative overflow-hidden bg-[#060709] pt-20 pb-16 sm:pt-28 sm:pb-20">
        <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-[0.14]" style={{ background: 'radial-gradient(circle, #6d8dff 0%, transparent 70%)' }} />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '88px 88px' }} />
        <div className="relative mx-auto max-w-[1180px] px-6 lg:px-8 text-center">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-5 py-2 text-[13px] font-medium text-emerald-300">
            <Check className="h-4 w-4" />
            Everything included. No hidden modules. No implementation fees. No long-term contracts.
          </div>
          <h1 className="text-[40px] font-semibold leading-[1.04] tracking-[-0.03em] text-white sm:text-6xl lg:text-[64px]">
            Simple door-based pricing.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-8 text-zinc-400 sm:text-lg">
            Every Portier369 plan includes the Owner, Board, and Vendor portals, the Manager Dashboard, work orders,
            violations, architectural reviews, maintenance calendar, compliance tracking, document management,
            association health scores, white-glove setup, and Bring Your Own AI — with unlimited owners, board members,
            and vendors.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-16 sm:pb-20">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
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

      {/* White Glove */}
      <section className="py-16 sm:py-20 bg-[#1E3A5F]">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-white sm:text-5xl">White Glove Setup Included</h2>
          <p className="mt-4 text-lg text-gray-300 max-w-2xl mx-auto">We help you launch successfully.</p>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {['Association Setup', 'Owner Import', 'Vendor Import', 'Document Migration', 'Initial Configuration', 'Manager Training', 'Board Training', 'Launch Assistance'].map(item => (
              <div key={item} className="rounded-xl bg-white/8 border border-white/10 px-5 py-3.5 text-base font-medium text-white/90">{item}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Bring Your Own AI */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-5xl">Bring Your Own AI</h2>
          <p className="mt-4 text-lg text-gray-500 max-w-3xl mx-auto">Connect your own OpenAI, Claude, Gemini, or other AI provider. Use AI to assist with owner communications, violation drafts, meeting summaries, architectural review summaries, board notices, vendor follow-up, and administrative workflows. Your API key. Your data. Your control.</p>
        </div>
      </section>

      {/* Why */}
      <section className="py-16 sm:py-20" style={{ backgroundColor: '#F5F4F1' }}>
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-5xl">Why Management Companies Choose Portier369</h2>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">Built by property managers, not software developers. Portier369 was designed around the realities of condominium, HOA, and townhome management.</p>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {['Association Health Scores', 'Maintenance Planning', 'Compliance Tracking', 'Board Governance', 'Vendor Coordination', 'White Glove Operations'].map(item => (
              <div key={item} className="rounded-xl bg-white border border-gray-200 px-5 py-4 text-sm font-medium text-gray-700 shadow-sm">{item}</div>
            ))}
          </div>
          <p className="mt-8 text-lg text-gray-700 font-semibold">Everything in one platform.</p>
        </div>
      </section>

      {/* Premium Services */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-5xl">Premium Services</h2>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">Expert hands-on services for management companies that need more than software.</p>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {['Data migration — full portfolio migration from any legacy system', 'AI document assistant — custom AI workflows trained on your documents', 'Custom website development — branded sites, portals, communication hubs', 'White-label mobile app — your brand on iOS and Android', 'Accounting outsourcing — assessments, payables, reconciliation, reporting', 'Full-service onboarding — setup, import, training, go live running', 'Bulk document digitization — scan, OCR, organize decades of records', 'Dedicated account manager — named contact who knows your portfolio'].map(svc => (
              <div key={svc} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm text-sm text-gray-600 leading-relaxed">{svc}</div>
            ))}
          </div>
          <div className="mt-10">
            <a href="mailto:hello@portier369.com" className="inline-flex items-center gap-2 rounded-xl border-2 border-[#1E3A5F]/20 bg-[#1E3A5F]/5 px-8 py-4 text-base font-semibold text-[#1E3A5F] hover:bg-[#1E3A5F]/10 transition">
              Contact hello@portier369.com for service pricing
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-20" style={{ backgroundColor: '#F5F4F1' }}>
        <div className="mx-auto max-w-3xl px-6 lg:px-8">
          <h2 className="text-center text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-5xl mb-12">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqs.map(faq => (
              <details key={faq.q} className="group rounded-xl border border-gray-200 bg-white shadow-sm">
                <summary className="flex cursor-pointer items-center justify-between px-6 py-4 text-base font-semibold text-gray-900 hover:text-[#1E3A5F] transition">
                  {faq.q}
                  <svg className="h-4 w-4 flex-shrink-0 text-gray-300 group-open:rotate-45 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </summary>
                <div className="px-6 pb-5 text-base text-gray-500 leading-relaxed">{faq.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-gray-100 bg-white py-16">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-5xl">Run your entire portfolio from one platform.</h2>
          <p className="mt-4 text-lg text-gray-500">White glove setup included. No long-term contract required.</p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/demo" className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A5F] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-[#1E3A5F]/20 hover:bg-[#152940] transition">Request Proposal</Link>
            <a href="mailto:hello@portier369.com" className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-8 py-4 text-base font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition">Contact sales</a>
          </div>
        </div>
      </section>
    </div>
  )
}
