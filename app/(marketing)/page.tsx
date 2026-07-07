import Link from 'next/link'
import type { Metadata } from 'next'
import { Screenshot } from '@/components/marketing/screenshot'

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

// Static — hero uses illustrative demo data, no DB calls

export default async function HomePage() {
  // Illustrative figures for the product demo in the hero — they showcase the
  // platform's scale-handling, not Portier369's own customer count. Kept round
  // and realistic; no revenue is shown publicly.
  const companyCount = 12
  const assocCount = 147
  const doorCount = 4280
  return (
    <div className="bg-white font-sans antialiased">
      {/* ═══════════════════════════════════════════════
          HERO — dark brand panel
          ═══════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-[#060709] pt-20 pb-20 sm:pt-28 sm:pb-28">
        {/* Ambient glows */}
        <div aria-hidden className="pointer-events-none absolute -top-48 left-1/2 h-[640px] w-[900px] -translate-x-1/2 rounded-full opacity-[0.16]" style={{ background: 'radial-gradient(circle, #6d8dff 0%, transparent 70%)' }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-64 -right-32 h-[520px] w-[520px] rounded-full opacity-[0.08]" style={{ background: 'radial-gradient(circle, #c9a86a 0%, transparent 70%)' }} />
        {/* Hairline grid texture */}
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '88px 88px' }} />

        <div className="relative mx-auto max-w-[1180px] px-6 lg:px-8 text-center">
          <div className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-[12px] font-medium tracking-[0.02em] text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Built from 29 years in community management
          </div>
          <h1 className="mx-auto max-w-4xl text-[40px] font-semibold leading-[1.04] tracking-[-0.03em] text-white sm:text-6xl lg:text-[68px]">
            Run your entire property
            <br className="hidden sm:block" /> management company,{' '}
            <span className="bg-gradient-to-r from-[#a9bcff] to-[#6d8dff] bg-clip-text text-transparent">from one platform.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-[17px] leading-8 text-zinc-400 sm:text-lg">
            Accounting, maintenance, violations, board approvals, owner communications, and vendor management — every
            workflow drawn from how property managers actually work, not how software teams imagine they do.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="/demo" className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-[15px] font-semibold text-gray-950 shadow-lg shadow-black/30 transition hover:bg-zinc-100">
              Request Proposal
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
            <Link href="/pricing" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-7 py-3.5 text-[15px] font-semibold text-white transition hover:bg-white/[0.08]">
              View pricing
            </Link>
          </div>

          {/* Product Preview — floats on the dark for depth */}
          <div className="mt-16 lg:mt-20">
            <Screenshot
              file="hero.png"
              alt="Portier369 platform — manager dashboard"
              width={2400}
              height={1500}
              priority
              framed
              fallback={
              <div className="relative rounded-2xl border border-gray-200 bg-white shadow-[0_25px_70px_-20px_rgba(30,58,95,0.15),0_15px_35px_-15px_rgba(0,0,0,0.08)] overflow-hidden">
              <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3 bg-gray-50/50">
                <div className="h-3 w-3 rounded-full bg-red-300" />
                <div className="h-3 w-3 rounded-full bg-amber-300" />
                <div className="h-3 w-3 rounded-full bg-emerald-300" />
                <span className="ml-3 text-xs font-medium uppercase tracking-wider text-gray-400">Platform Command Center</span>
              </div>
              <div className="grid grid-cols-5 divide-x divide-gray-100">
                {[
                  { name: 'Platform Operator', stats: [`${companyCount} companies`, `${assocCount} associations`, `${doorCount.toLocaleString()} doors`], color: '#1E3A5F' },
                  { name: 'Company Admin', stats: [`${assocCount} associations`, 'Portfolio view', 'Billing control'], color: '#0D9488' },
                  { name: 'Manager', stats: ['Work orders', 'Violations', 'Maintenance'], color: '#2563EB' },
                  { name: 'Board Member', stats: ['Financials', 'Violations', 'Documents'], color: '#7C3AED' },
                  { name: 'Owner Portal', stats: ['Payments', 'Requests', 'Calendar'], color: '#059669' },
                ].map(p => (
                  <div key={p.name} className="p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{p.name}</span>
                    </div>
                    {p.stats.map(s => (
                      <div key={s} className="rounded-lg px-3 py-2.5 text-sm font-medium" style={{ backgroundColor: p.color + '0E', color: p.color }}>
                        {s}
                      </div>
                    ))}
                    <div className="space-y-1.5 pt-1">
                      <div className="h-1.5 rounded-full w-full" style={{ backgroundColor: p.color + '20' }} />
                      <div className="h-1.5 rounded-full w-4/5" style={{ backgroundColor: p.color + '16' }} />
                      <div className="h-1.5 rounded-full w-3/5" style={{ backgroundColor: p.color + '10' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
              }
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          PRODUCT SHOWCASE — Screenshots
          ═══════════════════════════════════════════════ */}
      <section className="py-16 sm:py-20" style={{ backgroundColor: '#F5F4F1' }}>
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#1E3A5F]">The product</span>
            <h2 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-gray-950 sm:text-[44px]">
              Every workflow. Every stakeholder. One platform.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {[
              { shot: 'manager.png', title: 'Manager Dashboard', desc: 'Work orders, violations, maintenance, vendors — everything a property manager needs in one command center.', color: '#2563EB', metrics: [['Open work orders', '14'], ['Active violations', '7'], ['Due this week', '23']], rows: [['#2546 · Water pressure', 'Assigned'], ['#2547 · Roof leak', 'Scheduled'], ['#2548 · Lobby light', 'New']] },
              { shot: 'board.png', title: 'Board Portal', desc: 'Financial visibility, violation oversight, budget tracking, and documents — scoped to the association only.', color: '#7C3AED', metrics: [['Operating cash', '$84.2k'], ['Reserve fund', '$210k'], ['Delinquency', '3.1%']], rows: [['Q2 Income statement', 'Ready'], ['Budget vs actual', 'On track'], ['June minutes', 'Approved']] },
              { shot: 'owner.png', title: 'Owner Self-Service', desc: 'Pay assessments, submit requests, view documents, upload insurance — everything owners need.', color: '#059669', metrics: [['Balance due', '$0'], ['Next dues', 'Jul 1'], ['Requests', '2']], rows: [['Autopay', 'Active'], ['HO6 insurance', 'Current'], ['Pool key request', 'In review']] },
              { shot: 'maintenance.png', title: 'Maintenance Calendar', desc: 'Annual, seasonal, and vendor maintenance tracked across every association. Automated reminders before every deadline.', color: '#0D9488', metrics: [['This month', '12'], ['Overdue', '0'], ['Vendors', '8']], rows: [['HVAC seasonal service', 'Jun 18'], ['Gutter cleaning', 'Jun 24'], ['Fire inspection', 'Jul 02']] },
              { shot: 'violations.png', title: 'Violation Workflow', desc: 'Photo capture → notice generation → hearing scheduling → fine assessment — the entire lifecycle automated.', color: '#D97706', metrics: [['Open cases', '7'], ['Hearings', '2'], ['Cured', '31']], rows: [['Unit 4B · Parking', 'Notice sent'], ['Unit 2A · Trash', 'Hearing set'], ['Unit 7C · Pet', 'Cured']] },
              { shot: 'platform.png', title: 'Platform Command Center', desc: 'CEO-level visibility. Doors under management, company health, provisioning — every management company in one view.', color: '#1E3A5F', metrics: [['Companies', '12'], ['Associations', '147'], ['Doors', '4,280']], rows: [['Stellar Property Mgmt', 'Healthy'], ['Manage369', 'Healthy'], ['ABC Management', 'Trial']] },
            ].map(item => (
              <div key={item.title} className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] transition group">
                <Screenshot
                  file={item.shot}
                  alt={`Portier369 — ${item.title}`}
                  width={1200}
                  height={750}
                  className="block w-full border-b border-gray-100"
                  fallback={
                <div className="p-4 border-b border-gray-100" style={{ backgroundColor: item.color + '05' }}>
                  <div className="flex items-center gap-2 mb-3.5">
                    <div className="flex gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-red-300" />
                      <div className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 ml-2">{item.title}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {item.metrics.map(([label, value]) => (
                      <div key={label} className="rounded-lg bg-white border border-gray-100 px-2.5 py-2">
                        <div className="text-[13px] font-bold tabular-nums leading-none" style={{ color: item.color }}>{value}</div>
                        <div className="mt-1 text-[8px] font-medium uppercase tracking-wide text-gray-400 leading-tight">{label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    {item.rows.map(([label, status]) => (
                      <div key={label} className="flex items-center justify-between rounded-md bg-white border border-gray-100 px-2.5 py-1.5">
                        <span className="text-[10px] font-medium text-gray-600 truncate">{label}</span>
                        <span className="text-[8px] font-semibold uppercase tracking-wide rounded-full px-1.5 py-0.5 flex-shrink-0" style={{ backgroundColor: item.color + '12', color: item.color }}>{status}</span>
                      </div>
                    ))}
                  </div>
                </div>
                  }
                />
                <div className="p-5">
                  <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-2 text-[15px] text-gray-600 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          PROBLEM → SOLUTION
          ═══════════════════════════════════════════════ */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:gap-24 items-center">
            <div>
              <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#1E3A5F]">The problem</span>
              <h2 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-gray-950 sm:text-[44px]">
                Property management shouldn&apos;t require six systems.
              </h2>
              <div className="mt-8 space-y-4">
                {['Missed maintenance deadlines become expensive emergency repairs.', 'Boards demand financial visibility but get forwarded spreadsheets.', 'Vendor compliance slips through cracks until audit season.', 'Owners have no self-service — everything goes through the manager.', 'No single view of portfolio health across all associations.'].map(item => (
                  <div key={item} className="flex items-start gap-3">
                    <div className="mt-1 h-4 w-4 flex-shrink-0 rounded-full border-2 border-red-200 flex items-center justify-center"><div className="h-1 w-1 rounded-full bg-red-400" /></div>
                    <span className="text-base text-gray-600 leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_10px_40px_rgba(0,0,0,0.05)]">
              <div className="space-y-3">
                {['Accounting software', 'Maintenance tracker', 'Violation log', 'Board portal', 'Vendor spreadsheet', 'Owner database'].map(tool => (
                  <div key={tool} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-5 py-4">
                    <span className="text-base text-gray-500">{tool}</span>
                    <span className="text-xs font-medium text-gray-300">Disconnected</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-xl bg-[#1E3A5F]/5 border border-[#1E3A5F]/10 px-5 py-4 text-center">
                <span className="text-base font-semibold text-[#1E3A5F]">Portier369 unifies everything into one platform</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          DIFFERENTIATORS
          ═══════════════════════════════════════════════ */}
      <section className="py-16 sm:py-20" style={{ backgroundColor: '#F5F4F1' }}>
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#1E3A5F]">What sets us apart</span>
            <h2 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-gray-950 sm:text-[44px]">
              Designed for how property managers actually work.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: 'Association Health Scores', body: 'Every community gets a real-time health score — open work orders, overdue violations, delinquency, and manager response times weighted into one number. Spot problems before boards start calling.', stat: 'Proactive, not reactive' },
              { label: 'Annual Maintenance Calendar', body: 'HVAC seasonal service, gutter cleaning, pool opening, fire inspections, elevator certifications. Automated reminders across every association. Nothing falls through the cracks.', stat: 'Never miss a deadline' },
              { label: 'Automated Violation Workflow', body: 'Photo capture → notice generation → hearing scheduling → fine assessment. The entire violation lifecycle is automated. Managers spend less time on paperwork.', stat: 'Close violations faster' },
              { label: 'Compliance Tracking', body: 'Monitor insurance, licenses, certifications, and contracts for every vendor. Automated expiration alerts. 1099-ready records and complete audit trails.', stat: 'Audit-ready always' },
              { label: 'Board Governance', body: 'Financial visibility, documents, minutes, calendars, violations, and reports — without operational control over the management company. Association-scoped access only.', stat: 'Visibility without risk' },
              { label: 'Bring Your Own AI', body: 'Connect your own OpenAI, Claude, or Gemini key. Auto-draft violation notices, summarize board meetings, generate owner responses — running on your credentials.', stat: 'Your AI, your rules' },
            ].map(item => (
              <div key={item.label} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] transition">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#0D9488] mb-2">{item.stat}</div>
                <h3 className="text-xl font-semibold text-gray-900">{item.label}</h3>
                <p className="mt-3 text-base text-gray-500 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          WHITE GLOVE TIMELINE
          ═══════════════════════════════════════════════ */}
      <section className="relative overflow-hidden py-20 sm:py-24 bg-[#060709]">
        <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[760px] -translate-x-1/2 rounded-full opacity-[0.12]" style={{ background: 'radial-gradient(circle, #6d8dff 0%, transparent 70%)' }} />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '88px 88px' }} />
        <div className="relative mx-auto max-w-[1180px] px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#8fa6ff]">Onboarding</span>
            <h2 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-white sm:text-[44px]">
              White-glove setup, included.
            </h2>
            <p className="mt-4 text-lg leading-8 text-zinc-400 max-w-2xl mx-auto">
              Every management company gets hands-on onboarding. Most go live in under a week.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { step: '1', title: 'Data Import', desc: 'Migrate from any legacy system' },
              { step: '2', title: 'Account Setup', desc: 'Configure your company profile' },
              { step: '3', title: 'Association Config', desc: 'Set up every community' },
              { step: '4', title: 'Training', desc: 'Your team learns the platform' },
              { step: '5', title: 'Go Live', desc: 'Launch with support standing by' },
              { step: '6', title: 'Ongoing Support', desc: 'Dedicated help when you need it' },
            ].map((item, i) => (
              <div key={item.step} className="relative text-center">
                <div className="flex items-center justify-center mb-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06] border border-white/10 text-xl font-semibold text-white">{item.step}</div>
                </div>
                <h3 className="text-[15px] font-semibold text-white">{item.title}</h3>
                <p className="mt-1 text-[13px] leading-5 text-zinc-400">{item.desc}</p>
                {i < 5 && <div className="hidden lg:block absolute top-6 -right-2 w-8 h-px bg-white/15" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          PRICING
          ═══════════════════════════════════════════════ */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
          {/* Everything Included banner */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-6 py-2.5 text-base font-semibold text-emerald-700 shadow-sm">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              Everything Included. No Hidden Modules. No Implementation Fees. No Long-Term Contracts.
            </div>
          </div>

          <div className="text-center mb-12">
            <h2 className="text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-gray-950 sm:text-[44px]">
              Simple door-based pricing.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: 'Foundation', price: '$157', doors: 'Up to 200 Units', desc: 'For self-managed associations and smaller management companies.', cta: 'Request Proposal', href: '/demo', features: ['Owner Portal', 'Board Portal', 'Manager Dashboard', 'Work Orders', 'Violations', 'Document Management', 'Assessment Tracking', 'Email Communications', 'White Glove Setup'] },
              { name: 'Growth', price: '$382', doors: 'Up to 600 Units', desc: 'For growing management companies that need stronger operational control.', cta: 'Request Proposal', href: '/demo', featured: true, features: ['Everything in Foundation', 'Vendor Portal', 'Maintenance Calendar', 'Compliance Tracking', 'Vendor Coordination', 'Association Health Scores', 'SMS Notifications', 'Portfolio Visibility', 'Priority Support'] },
              { name: 'Portfolio', price: '$642', doors: 'Up to 1,000 Units', desc: 'For established management companies managing multiple associations.', cta: 'Request Proposal', href: '/demo', features: ['Everything in Growth', 'Company Admin Dashboard', 'Architectural Reviews', 'Board Management Tools', 'AI Automation', 'Advanced Reporting', 'API Access', 'Multi-Manager Oversight', 'Dedicated Success Manager'] },
              { name: 'Enterprise', price: 'Custom', doors: '1,000+ Units', desc: 'For large management companies and multi-office operations.', cta: 'Request Proposal', href: '/demo', features: ['Everything in Portfolio', 'Multi-Office Support', 'Custom Integrations', 'Custom AI Workflows', 'Enterprise Security Controls', 'Dedicated Support Team', 'SLA Guarantee', 'Custom Onboarding', 'Volume Pricing'] },
            ].map(plan => (
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
                    {plan.features.map((f: string) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-gray-500 leading-relaxed">
                        <svg className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/pricing" className="inline-flex items-center gap-1 text-base font-medium text-[#1E3A5F] hover:text-[#152940] transition">
              See full pricing details <span>&rarr;</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          PREMIUM SERVICES
          ═══════════════════════════════════════════════ */}
      <section className="py-16 sm:py-20" style={{ backgroundColor: '#F5F4F1' }}>
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#1E3A5F]">Premium services</span>
            <h2 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-gray-950 sm:text-[44px]">
              Hands-on services when you need them.
            </h2>
            <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">Expert services for management companies that want white-glove support, custom development, or operational outsourcing.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: 'Data migration', desc: 'Full portfolio migration from any legacy system — units, owners, vendors, documents, financial history.' },
              { title: 'AI document assistant', desc: 'Custom AI workflows trained on your documents. Auto-classify, extract, summarize, and organize.' },
              { title: 'Custom website development', desc: 'Branded association websites, owner portals, and board communication hubs.' },
              { title: 'White-label mobile app', desc: 'Your management company brand on iOS and Android — owners and boards access from their phone.' },
              { title: 'Accounting outsourcing', desc: 'Turn over your books. Assessments, payables, reconciliation, financial reporting.' },
              { title: 'Full-service onboarding', desc: 'We set up every association, import every record, train every team member.' },
              { title: 'Bulk document digitization', desc: 'Decades of paper records scanned, OCR\'d, organized, and uploaded into your document center.' },
              { title: 'Dedicated account manager', desc: 'A named contact who knows your portfolio, handles escalations, and manages your account.' },
            ].map(svc => (
              <div key={svc.title} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition">
                <h3 className="text-lg font-semibold text-gray-900">{svc.title}</h3>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">{svc.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <a href="mailto:hello@portier369.com" className="inline-flex items-center gap-2 rounded-xl border-2 border-[#1E3A5F]/20 bg-[#1E3A5F]/5 px-8 py-4 text-base font-semibold text-[#1E3A5F] hover:bg-[#1E3A5F]/10 transition">
              Contact hello@portier369.com for service pricing
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          ABOUT — 29 Years Experience
          ═══════════════════════════════════════════════ */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
          <div className="max-w-3xl">
            <span className="text-sm font-semibold uppercase tracking-[0.15em] text-[#1E3A5F]">Built on 29 Years of Property Management Experience</span>
            <h2 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-gray-950 sm:text-[44px]">
              Portier369 wasn&apos;t designed in a software conference room.
            </h2>
            <p className="mt-6 text-lg text-gray-500 leading-relaxed">
              It was built from nearly three decades of real-world condominium and HOA management experience by a CAM, CMCA, and AMS professional who has managed thousands of units, worked with hundreds of board members, coordinated major capital projects, resolved violations, handled emergencies, and navigated the daily realities of community management.
            </p>
            <p className="mt-4 text-lg text-gray-500 leading-relaxed">
              Every workflow inside Portier369 reflects how property managers actually work. Not how software developers think they work.
            </p>
            <p className="mt-4 text-lg text-gray-500 leading-relaxed">
              From violations and maintenance tracking to board approvals, owner communication, vendor coordination, and preventive maintenance, every feature was designed to eliminate administrative friction and give managers more time to focus on serving their communities.
            </p>
            <p className="mt-4 text-lg text-gray-500 leading-relaxed">
              Portier369 combines operational experience with modern automation so management companies can run more associations, respond faster, and deliver a better experience to boards and owners.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              { title: 'Row-level security', desc: 'Supabase RLS enforced on every database query. No portfolio can access another portfolio\'s data. Period.' },
              { title: 'Your data, portable', desc: 'Export anything, anytime. No vendor lock-in. Your records belong to you — always.' },
              { title: 'Enterprise infrastructure', desc: 'AWS via Vercel. Automatic backups. Point-in-time recovery. Built to run your business.' },
            ].map(item => (
              <div key={item.title} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-3 text-base text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          FINAL CTA
          ═══════════════════════════════════════════════ */}
      <section className="relative overflow-hidden py-24 sm:py-28 bg-[#060709]">
        <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-[0.14]" style={{ background: 'radial-gradient(circle, #6d8dff 0%, transparent 70%)' }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-48 -right-24 h-[440px] w-[440px] rounded-full opacity-[0.07]" style={{ background: 'radial-gradient(circle, #c9a86a 0%, transparent 70%)' }} />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '88px 88px' }} />
        <div className="relative mx-auto max-w-[1180px] px-6 lg:px-8 text-center">
          <h2 className="mx-auto max-w-2xl text-4xl font-semibold leading-[1.06] tracking-[-0.03em] text-white sm:text-5xl">
            Run your entire portfolio from one platform.
          </h2>
          <p className="mt-5 text-lg leading-8 text-zinc-400 max-w-xl mx-auto">
            White-glove setup included. No long-term contract required.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="/demo" className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-[15px] font-semibold text-gray-950 shadow-lg shadow-black/30 transition hover:bg-zinc-100">
              Request Proposal
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
            <Link href="/pricing" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-7 py-3.5 text-[15px] font-semibold text-white transition hover:bg-white/[0.08]">
              View pricing
            </Link>
          </div>
          <p className="mt-8 text-[13px] text-zinc-500">Software built from 29 years in the field — not from a conference room.</p>
        </div>
      </section>
    </div>
  )
}
