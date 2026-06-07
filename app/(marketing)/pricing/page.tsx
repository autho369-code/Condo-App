import Link from 'next/link'
import { Check, ArrowRight, Building2, Wrench, Shield, MessageSquare, FileText, BarChart3 } from 'lucide-react'

const plans = [
  {
    name: 'Foundation',
    price: '$157',
    period: '/month',
    doors: 'Up to 250 units',
    best: 'Small management companies and self-managed associations',
    cta: 'Schedule Demo',
    href: '/demo',
    featured: false,
    features: ['Owner Portal', 'Board Portal', 'Manager Dashboard', 'Work Orders', 'Violations', 'Document Management', 'Email Support', 'White Glove Setup'],
  },
  {
    name: 'Growth',
    price: '$282',
    period: '/month',
    doors: '251 – 1,000 units',
    best: 'Growing management companies scaling their portfolio',
    cta: 'Schedule Demo',
    href: '/demo',
    featured: true,
    features: ['Everything in Foundation', 'Vendor Portal', 'Maintenance Calendar', 'Compliance Tracking', 'Vendor Coordination', 'Association Health Scores', 'SMS Notifications', 'Priority Support'],
  },
  {
    name: 'Portfolio',
    price: '$1,800',
    period: '/month',
    doors: 'Up to 4,000 units',
    best: 'Established management companies',
    cta: 'Schedule Demo',
    href: '/demo',
    featured: false,
    features: ['Everything in Growth', 'Company Admin Dashboard', 'Architectural Reviews', 'Board Management', 'AI Automation', 'Advanced Reporting', 'API Access', 'Dedicated Account Manager'],
  },
  {
    name: 'Enterprise',
    price: '$3,600',
    period: '/month',
    doors: 'Up to 10,000 units',
    best: 'Large management companies and multi-office portfolios',
    cta: 'Schedule Demo',
    href: '/demo',
    featured: false,
    features: ['Everything in Portfolio', 'Multi-Office Support', 'Custom Integrations', 'Custom AI Workflows', 'SLA Guarantee', 'Custom Onboarding', 'Dedicated Support Team', 'Volume Pricing'],
  },
]

const featureGroups = [
  {
    title: 'Operations',
    icon: Building2,
    items: ['Work Orders', 'Violations', 'Architectural Reviews', 'Maintenance Calendar', 'Association Health Scores'],
  },
  {
    title: 'Communications',
    icon: MessageSquare,
    items: ['Owner Messaging', 'Board Announcements', 'Vendor Coordination', 'Email & SMS', 'Document Sharing'],
  },
  {
    title: 'Governance',
    icon: Shield,
    items: ['Board Portal', 'Meeting Management', 'Document Center', 'Owner Voting (coming soon)', 'Compliance Tracking'],
  },
  {
    title: 'AI Automation',
    icon: BarChart3,
    items: ['Bring Your Own AI Key', 'Auto Draft Responses', 'Violation Detection', 'Meeting Summaries', 'Notice Generation'],
  },
]

const faqs = [
  { q: 'Is pricing based on users or doors?', a: 'Pricing is based on active doors/units, not owner seats. Owners, board members, and vendors are unlimited on every plan.' },
  { q: 'Are owners, board members, and vendors unlimited?', a: 'Yes. Every plan includes unlimited owners, unlimited board members, and unlimited vendors.' },
  { q: 'Are maintenance and compliance tools included?', a: 'Yes. Preventive maintenance planning, work order management, and vendor compliance tracking are included in every plan.' },
  { q: 'Can we use our own AI API key?', a: 'Yes. Management companies can connect their own OpenAI, Claude, Gemini, or compatible API key. AI is an automation tool — not the product.' },
  { q: 'Are there long-term contracts?', a: 'No long-term contract is required. You can cancel anytime. We earn your business every month.' },
  { q: 'Can pricing change as our door count changes?', a: 'Yes. Billing adjusts based on your active door count. If you grow, your plan grows with you. If your portfolio contracts, billing can decrease.' },
]

export default function PricingPage() {
  return (
    <div className="bg-white">
      {/* ── Hero ─────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-gray-50 to-white py-20 lg:py-28">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm text-gray-600 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Everything Included. No Hidden Modules. No Long-Term Contracts.
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            Simple Door-Based Pricing for<br />
            <span className="text-[#1E3A5F]">Property Management Companies</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-600">
            Everything you need to manage associations, boards, owners, vendors, maintenance, compliance, and operations — included in every plan.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/demo" className="inline-flex items-center gap-2 rounded-lg bg-[#1E3A5F] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#162D4A] transition">
              Schedule Demo <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/pricing" className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition">
              View pricing
            </Link>
          </div>
        </div>
      </section>

      {/* ── Pricing Cards ───────────────────────────── */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {plans.map(plan => (
              <div key={plan.name} className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md ${
                plan.featured ? 'border-[#1E3A5F] ring-1 ring-[#1E3A5F] scale-[1.02]' : 'border-gray-200'
              }`}>
                {plan.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#1E3A5F] px-4 py-1 text-xs font-semibold text-white">
                    Most Popular
                  </div>
                )}
                <div className="mb-5">
                  <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                  <p className="mt-1 text-sm text-gray-500">{plan.doors}</p>
                </div>
                <div className="mb-1">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-gray-500">{plan.period}</span>
                </div>
                <p className="mb-6 text-sm text-gray-500">{plan.best}</p>
                <Link
                  href={plan.href}
                  className={`mb-6 inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                    plan.featured
                      ? 'bg-[#1E3A5F] text-white hover:bg-[#162D4A]'
                      : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {plan.cta}
                </Link>
                <ul className="space-y-2.5 flex-1 border-t border-gray-100 pt-5">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Everything Included ─────────────────────── */}
      <section className="bg-gray-50 py-16 lg:py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              No paid modules. No surprise charges. No long-term contracts.
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Every feature below is included across all plans. Your price is based on doors — not which features you unlock.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featureGroups.map(group => (
              <div key={group.title} className="rounded-xl bg-white border border-gray-200 p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1E3A5F]/10 mb-4">
                  <group.icon className="h-5 w-5 text-[#1E3A5F]" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-3">{group.title}</h3>
                <ul className="space-y-2">
                  {group.items.map(item => (
                    <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                      <Check className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-10 rounded-xl bg-white border border-gray-200 p-6 text-center shadow-sm">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">Unlimited on every plan:</span> Owners · Board Members · Vendors · Work Orders · Documents · Support
            </p>
          </div>
        </div>
      </section>

      {/* ── Bring Your Own AI ───────────────────────── */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1E3A5F]/10">
            <BarChart3 className="h-7 w-7 text-[#1E3A5F]" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Bring Your Own AI Key
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Connect your own OpenAI, Claude, Gemini, or compatible API key. Portier369 uses AI to automate drafts, notices, reminders, summaries, and manager workflows — but AI is a supporting automation feature, not the product.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 text-left">
            {[
              { title: 'Auto-Draft Notices', desc: 'Generate violation notices, late fee reminders, and owner communications from templates.' },
              { title: 'Meeting Summaries', desc: 'Turn board meeting notes into formatted minutes and action items automatically.' },
              { title: 'Work Order Assistance', desc: 'Help managers draft work orders, vendor instructions, and status update messages.' },
            ].map(item => (
              <div key={item.title} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-gray-900 text-sm">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── White Glove Setup ───────────────────────── */}
      <section className="bg-[#1E3A5F] py-16 lg:py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            White Glove Setup Included
          </h2>
          <p className="mt-4 text-lg text-gray-300">
            Every new management company gets hands-on onboarding. We handle the heavy lifting so your team can focus on serving associations from day one.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {['Data Migration', 'Association Setup', 'Owner & Vendor Import', 'Document Organization', 'Team Training', 'Launch Support', 'Workflow Configuration', 'AI Key Setup'].map(item => (
              <div key={item} className="rounded-lg bg-white/10 border border-white/10 px-4 py-3 text-sm font-medium text-white">
                <Check className="inline h-4 w-4 mr-2 text-emerald-400" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────── */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <details key={i} className="group rounded-xl border border-gray-200 bg-white shadow-sm">
                <summary className="flex cursor-pointer items-center justify-between px-6 py-4 text-sm font-semibold text-gray-900 hover:text-[#1E3A5F] transition">
                  {faq.q}
                  <span className="ml-4 flex-shrink-0 text-gray-400 group-open:hidden">+</span>
                  <span className="ml-4 flex-shrink-0 text-gray-400 hidden group-open:inline">−</span>
                </summary>
                <div className="px-6 pb-4 text-sm text-gray-600 leading-relaxed">{faq.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ──────────────────────────────── */}
      <section className="border-t border-gray-100 bg-gray-50 py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            See how Portier369 runs your entire portfolio.
          </h2>
          <p className="mt-3 text-gray-600">
            White glove setup included. No long-term contract required.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link href="/demo" className="inline-flex items-center gap-2 rounded-lg bg-[#1E3A5F] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#162D4A] transition">
              Schedule Demo <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/pricing" className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition">
              View pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
