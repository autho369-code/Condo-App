import Link from 'next/link'

const nav = { brand: '#1E3A5F', green: '#0D9488', amber: '#D97706', red: '#DC2626', warmGray: '#F5F4F1', gray50: '#F9FAFB', gray100: '#F3F4F6', gray200: '#E5E7EB', gray400: '#9CA3AF', gray500: '#6B7280', gray600: '#4B5563', gray900: '#111827', white: '#FFFFFF' }

export default function HomePage() {
  return (
    <div className="bg-white font-sans antialiased">
      {/* ═══════════════════════════════════════════════
          HERO
          ═══════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-white pt-24 pb-8 sm:pt-36 sm:pb-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(30,58,95,0.04),transparent)]" />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <div className="mb-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-[13px] font-medium text-gray-500 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Built by property managers, for property managers
            </span>
          </div>
          <h1 className="text-[42px] font-bold leading-[1.05] tracking-[-0.04em] text-gray-900 sm:text-[56px] lg:text-[64px]">
            Run your entire management company
            <br />
            <span className="text-[#1E3A5F]">from one platform.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-relaxed text-gray-500 sm:text-lg">
            Portier369 helps professional property managers run associations, boards, owners, vendors, maintenance, compliance, violations, and communications — from one calm, organized system.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/demo" className="inline-flex items-center gap-2 rounded-lg bg-[#1E3A5F] px-6 py-3 text-[15px] font-semibold text-white shadow-lg shadow-[#1E3A5F]/15 hover:bg-[#152940] transition">
              Schedule a demo
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
            <Link href="/pricing" className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-6 py-3 text-[15px] font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition">
              View pricing
            </Link>
          </div>
        </div>

        {/* Product preview strip */}
        <div className="mx-auto mt-16 max-w-5xl px-6 sm:mt-24">
          <div className="relative rounded-2xl border border-gray-200 bg-white shadow-[0_20px_60px_-15px_rgba(30,58,95,0.12),0_10px_30px_-10px_rgba(0,0,0,0.06)] overflow-hidden">
            <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-2.5 bg-gray-50/50">
              <div className="h-2.5 w-2.5 rounded-full bg-red-300" />
              <div className="h-2.5 w-2.5 rounded-full bg-amber-300" />
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
              <span className="ml-3 text-[11px] font-medium uppercase tracking-wider text-gray-400">Association Command Center</span>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-5 gap-3">
                {[
                  { label: 'Platform Operator', color: '#1E3A5F', items: ['14 companies', '$24.8K MRR'] },
                  { label: 'Company Admin', color: '#0D9488', items: ['12 associations', '$8.2K revenue'] },
                  { label: 'Manager', color: '#2563EB', items: ['3 associations', '18 open WO'] },
                  { label: 'Board', color: '#7C3AED', items: ['4 violations', '$12K reserves'] },
                  { label: 'Owner', color: '#059669', items: ['Unit 204', '$450 due'] },
                ].map(p => (
                  <div key={p.label} className="rounded-xl border border-gray-100 bg-white p-3 hover:shadow-md transition cursor-default">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">{p.label}</div>
                    <div className="space-y-1.5">
                      {p.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between rounded-md px-2 py-1.5" style={{ backgroundColor: p.color + '08' }}>
                          <span className="text-[11px] font-medium" style={{ color: p.color }}>{item.split(' ')[0]}</span>
                          <span className="text-[10px] text-gray-400">{item.split(' ').slice(1).join(' ')}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 space-y-1">
                      {[1, 2].map(r => <div key={r} className="h-1 rounded" style={{ backgroundColor: p.color + '12', width: `${60 + r * 20}%` }} />)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          PROBLEM
          ═══════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28" style={{ backgroundColor: '#F5F4F1' }}>
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 items-center">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-400">The problem</span>
              <h2 className="mt-4 text-[32px] font-bold leading-[1.15] tracking-[-0.02em] text-gray-900 sm:text-[40px]">
                Property management shouldn&apos;t require six systems and a full inbox.
              </h2>
              <div className="mt-8 space-y-3">
                {[
                  'Missed maintenance deadlines cascade into expensive repairs',
                  'Boards demand financial visibility but get spreadsheets',
                  'Owners have no self-service portal for payments or requests',
                  'Vendor compliance slips through the cracks until audit season',
                  'No single view of portfolio health across associations',
                ].map(item => (
                  <div key={item} className="flex items-start gap-3">
                    <div className="mt-1 h-4 w-4 flex-shrink-0 rounded-full border-2 border-red-200 flex items-center justify-center">
                      <div className="h-1 w-1 rounded-full bg-red-400" />
                    </div>
                    <span className="text-[15px] text-gray-600 leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                <div className="space-y-2.5">
                  {['Accounting software', 'Maintenance tracker', 'Violation log', 'Board portal', 'Vendor spreadsheet', 'Owner database'].map(tool => (
                    <div key={tool} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                      <span className="text-sm text-gray-500">{tool}</span>
                      <span className="text-[11px] font-medium text-gray-300">Disconnected</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg bg-[#1E3A5F]/5 border border-[#1E3A5F]/10 px-4 py-3 text-center">
                  <span className="text-sm font-semibold text-[#1E3A5F]">Portier369 unifies everything into one platform</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          SOLUTION — How it works
          ═══════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-400">How it works</span>
            <h2 className="mt-4 text-[32px] font-bold leading-[1.15] tracking-[-0.02em] text-gray-900 sm:text-[40px]">
              Every stakeholder gets exactly the right tools.
            </h2>
            <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
              Five portals. One platform. From the CEO to the homeowner — everyone sees what they need, nothing they don&apos;t.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { name: 'Platform Operator', desc: 'Full platform visibility. Revenue, door usage, company provisioning, system health.', color: '#1E3A5F' },
              { name: 'Company Admin', desc: 'Portfolio-wide control. Managers, associations, billing, platform requests.', color: '#0D9488' },
              { name: 'Manager', desc: 'Day-to-day operations. Work orders, violations, maintenance, vendors.', color: '#2563EB' },
              { name: 'Board Member', desc: 'Governance oversight. Financials, violations, budget, documents.', color: '#7C3AED' },
              { name: 'Owner', desc: 'Self-service. Payments, requests, documents, insurance, calendar.', color: '#059669' },
            ].map(portal => (
              <div key={portal.name} className="rounded-xl border border-gray-200 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition group">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: portal.color }} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{portal.name}</span>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="h-1.5 rounded w-full" style={{ backgroundColor: portal.color + '12' }} />
                  <div className="h-1.5 rounded w-3/4" style={{ backgroundColor: portal.color + '10' }} />
                  <div className="h-1.5 rounded w-1/2" style={{ backgroundColor: portal.color + '08' }} />
                </div>
                <p className="text-[13px] text-gray-500 leading-relaxed">{portal.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          DIFFERENTIATION
          ═══════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28" style={{ backgroundColor: '#F5F4F1' }}>
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-400">What sets us apart</span>
            <h2 className="mt-4 text-[32px] font-bold leading-[1.15] tracking-[-0.02em] text-gray-900 sm:text-[40px]">
              Designed for how property managers actually work.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: 'Association Health Scores', body: 'Every community gets a real-time health score. Open work orders, overdue violations, delinquency, and manager response times — weighted into a single number that tells you where to focus. Spot problems before boards start calling.', stat: 'Proactive, not reactive' },
              { label: 'Annual Maintenance Calendar', body: 'Plan and track every recurring maintenance task — HVAC seasonal service, gutter cleaning, pool opening, fire inspections, elevator certifications. Automated reminders ensure nothing gets missed across any association.', stat: 'Never miss a deadline' },
              { label: 'Automated Violation Workflow', body: 'From photo capture to notice generation to hearing scheduling — the entire violation lifecycle is automated. Managers spend less time on paperwork and more time resolving issues. Owners receive consistent, timely communication at every step.', stat: 'Close violations faster' },
              { label: 'Compliance Tracking', body: 'Monitor insurance, licenses, certifications, and contract expirations for every vendor. Automated alerts before deadlines. 1099-ready records and complete audit trails built in.', stat: 'Audit-ready always' },
              { label: 'Board Governance', body: 'Give boards financial visibility, documents, minutes, calendars, violations, and reports — without giving them operational control over the management company. Association-scoped access only.', stat: 'Visibility without risk' },
              { label: 'Bring Your Own AI', body: 'Connect your own OpenAI, Claude, or Gemini key. Auto-draft violation notices, summarize board meetings, generate owner responses — automation that runs on your credentials, your data.', stat: 'Your AI, your rules' },
            ].map(item => (
              <div key={item.label} className="rounded-xl border border-gray-200 bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#0D9488] mb-2">{item.stat}</div>
                <h3 className="text-lg font-semibold text-gray-900">{item.label}</h3>
                <p className="mt-2 text-[14px] text-gray-500 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          WHITE GLOVE
          ═══════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 bg-[#1E3A5F]">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-[32px] font-bold leading-[1.15] tracking-[-0.02em] text-white sm:text-[40px]">
            White glove setup, included.
          </h2>
          <p className="mt-4 text-lg text-gray-300 max-w-2xl mx-auto">
            Every management company gets hands-on onboarding. We handle data migration, association setup, owner and vendor imports, document organization, team training, and launch support.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {['Data migration', 'Association setup', 'Owner import', 'Vendor import', 'Document organization', 'Team training', 'Launch support', 'AI key setup'].map(item => (
              <div key={item} className="rounded-lg bg-white/8 border border-white/10 px-4 py-3 text-sm font-medium text-white/90">
                {item}
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-gray-400">Most companies go live in under a week.</p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          PRICING
          ═══════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-400">Pricing</span>
            <h2 className="mt-4 text-[32px] font-bold leading-[1.15] tracking-[-0.02em] text-gray-900 sm:text-[40px]">
              Simple door-based pricing. Everything included.
            </h2>
            <p className="mt-4 text-lg text-gray-500">No per-seat fees. No paid modules. No long-term contracts.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: 'Foundation', price: '$157', doors: 'Up to 250 units', best: 'Small companies & self-managed' },
              { name: 'Growth', price: '$282+', doors: '251 – 1,000 units', best: 'Growing management companies', featured: true },
              { name: 'Portfolio', price: '$1,800', doors: 'Up to 4,000 units', best: 'Established management firms' },
              { name: 'Enterprise', price: '$3,600', doors: 'Up to 10,000 units', best: 'Large multi-office operations' },
            ].map(plan => (
              <div key={plan.name} className={`relative rounded-2xl border bg-white p-6 shadow-sm ${plan.featured ? 'border-[#1E3A5F] ring-1 ring-[#1E3A5F] shadow-[0_8px_30px_rgba(30,58,95,0.1)]' : 'border-gray-200 shadow-[0_2px_12px_rgba(0,0,0,0.03)]'}`}>
                {plan.featured && <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#1E3A5F] px-3 py-0.5 text-[10px] font-semibold text-white">Most popular</div>}
                <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-0.5">
                  <span className="text-[32px] font-bold text-gray-900">{plan.price}</span>
                  <span className="text-sm text-gray-400">/month</span>
                </div>
                <p className="mt-1 text-[13px] text-gray-500">{plan.doors}</p>
                <p className="mt-2 text-[12px] text-gray-400">{plan.best}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/pricing" className="inline-flex items-center gap-1 text-[15px] font-medium text-[#1E3A5F] hover:text-[#152940] transition">
              See full pricing details <span>&rarr;</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          TRUST
          ═══════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28" style={{ backgroundColor: '#F5F4F1' }}>
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-[32px] font-bold leading-[1.15] tracking-[-0.02em] text-gray-900 sm:text-[40px]">
            Built by property managers, not just software developers.
          </h2>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
            Every feature in Portier369 was designed from real condominium, HOA, and townhome management workflows.
            We understand board expectations, vendor follow-up, compliance deadlines, and the 4pm Friday emergency.
          </p>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3 text-left">
            {[
              { title: 'Row-level security', desc: 'Supabase RLS enforced on every database query. No portfolio can access another portfolio\'s data. Period.' },
              { title: 'Your data, portable', desc: 'Export anything, anytime. No vendor lock-in. Your records belong to you — always.' },
              { title: 'Enterprise infrastructure', desc: 'AWS via Vercel. Automatic backups. Point-in-time recovery. Built to run your business.' },
            ].map(item => (
              <div key={item.title} className="rounded-xl border border-gray-200 bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                <h3 className="font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-[14px] text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          FAQ
          ═══════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-center text-[32px] font-bold leading-[1.15] tracking-[-0.02em] text-gray-900 sm:text-[40px] mb-14">
            Frequently asked questions
          </h2>
          <div className="space-y-3">
            {[
              { q: 'Is Portier369 only for condominiums?', a: 'No. Portier369 is built for condominiums, HOAs, townhomes, and any community association structure. The platform adapts to how your communities are organized.' },
              { q: 'Is pricing based on doors or users?', a: 'Pricing is based on active doors and units under management. Owners, board members, and vendors are unlimited on every plan.' },
              { q: 'Are board members able to see financials?', a: 'Yes. The Board Portal provides financial visibility — budget vs actual, delinquency, bank balances — scoped to their association only. Board members cannot change financial data or access other associations.' },
              { q: 'Can owners pay assessments online?', a: 'Yes. The Owner Portal includes online payments, auto-pay setup, ledger access, and downloadable statements.' },
              { q: 'Does Portier369 include maintenance and compliance tracking?', a: 'Yes. Preventive maintenance planning, work order management, and vendor compliance tracking — including insurance, license, and certification expiration monitoring — are included in every plan.' },
              { q: 'Can we use our own AI API key?', a: 'Yes. Management companies connect their own OpenAI, Claude, or Gemini API key. AI assists with drafting notices, summarizing meetings, and preparing responses — all running on your credentials.' },
              { q: 'Do you offer a free trial?', a: 'We do not offer self-service free trials. Instead, we provide guided demos and white-glove onboarding to ensure every management company is properly set up from day one.' },
            ].map(faq => (
              <details key={faq.q} className="group rounded-xl border border-gray-200 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                <summary className="flex cursor-pointer items-center justify-between px-6 py-4 text-[15px] font-semibold text-gray-900 hover:text-[#1E3A5F] transition">
                  {faq.q}
                  <svg className="h-4 w-4 flex-shrink-0 text-gray-300 group-open:rotate-45 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </summary>
                <div className="px-6 pb-5 text-[15px] text-gray-500 leading-relaxed">{faq.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          FINAL CTA
          ═══════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28" style={{ backgroundColor: '#F5F4F1' }}>
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-[32px] font-bold leading-[1.15] tracking-[-0.02em] text-gray-900 sm:text-[40px]">
            Ready to see Portier369 run your portfolio?
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            Walk through a live dashboard with your data. White glove setup included.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/demo" className="inline-flex items-center gap-2 rounded-lg bg-[#1E3A5F] px-6 py-3 text-[15px] font-semibold text-white shadow-lg shadow-[#1E3A5F]/15 hover:bg-[#152940] transition">
              Schedule a demo
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
            <Link href="/pricing" className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-6 py-3 text-[15px] font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition">
              View pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
