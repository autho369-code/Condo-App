import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="bg-white font-sans antialiased">
      {/* ═══════════════════════════════════════════════
          HERO
          ═══════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-white pt-20 pb-16 sm:pt-32 sm:pb-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(30,58,95,0.05),transparent)]" />
        <div className="relative mx-auto max-w-[1280px] px-6 lg:px-8">
          <div className="max-w-4xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-gray-500 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Software built from 29 years in the field — not from a conference room.
            </span>
            <h1 className="mt-8 text-5xl font-bold leading-[1.05] tracking-[-0.03em] text-gray-900 sm:text-6xl lg:text-7xl">
              Run your entire property management company
              <br />
              <span className="text-[#1E3A5F]">from one platform.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-500 sm:text-xl">
              Every workflow inside Portier369 comes from actual condominium and HOA operations, including violations, maintenance, board approvals, owner communications, budgeting, and vendor management.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link href="/demo" className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A5F] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-[#1E3A5F]/20 hover:bg-[#152940] transition">
                Schedule a demo
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Link>
              <Link href="/pricing" className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-8 py-4 text-base font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition">
                View pricing
              </Link>
            </div>
          </div>

          {/* Product Preview */}
          <div className="mt-16 lg:mt-20">
            <div className="relative rounded-2xl border border-gray-200 bg-white shadow-[0_25px_70px_-20px_rgba(30,58,95,0.15),0_15px_35px_-15px_rgba(0,0,0,0.08)] overflow-hidden">
              <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3 bg-gray-50/50">
                <div className="h-3 w-3 rounded-full bg-red-300" />
                <div className="h-3 w-3 rounded-full bg-amber-300" />
                <div className="h-3 w-3 rounded-full bg-emerald-300" />
                <span className="ml-3 text-xs font-medium uppercase tracking-wider text-gray-400">Platform Command Center</span>
              </div>
              <div className="grid grid-cols-5 divide-x divide-gray-100">
                {[
                  { name: 'Platform Operator', stats: ['2 companies', '$299 MRR', '575 doors'], color: '#1E3A5F' },
                  { name: 'Company Admin', stats: ['5 associations', '3 managers', 'Portfolio view'], color: '#0D9488' },
                  { name: 'Manager', stats: ['3 associations', '18 open WO', 'Day-to-day ops'], color: '#2563EB' },
                  { name: 'Board Member', stats: ['Financials', 'Violations', 'Documents'], color: '#7C3AED' },
                  { name: 'Owner Portal', stats: ['Payments', 'Requests', 'Calendar'], color: '#059669' },
                ].map(p => (
                  <div key={p.name} className="p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{p.name}</span>
                    </div>
                    {p.stats.map(s => (
                      <div key={s} className="rounded-lg px-3 py-2.5 text-sm font-medium" style={{ backgroundColor: p.color + '08', color: p.color }}>
                        {s}
                      </div>
                    ))}
                    <div className="space-y-1.5 pt-1">
                      <div className="h-1 rounded w-full" style={{ backgroundColor: p.color + '10' }} />
                      <div className="h-1 rounded w-3/4" style={{ backgroundColor: p.color + '0D' }} />
                      <div className="h-1 rounded w-1/2" style={{ backgroundColor: p.color + '08' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          PRODUCT SHOWCASE — Screenshots
          ═══════════════════════════════════════════════ */}
      <section className="py-16 sm:py-20" style={{ backgroundColor: '#F5F4F1' }}>
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold uppercase tracking-[0.15em] text-gray-400">The product</span>
            <h2 className="mt-4 text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-5xl">
              Every workflow. Every stakeholder. One platform.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {[
              { title: 'Manager Dashboard', desc: 'Work orders, violations, maintenance, vendors — everything a property manager needs in one command center.', color: '#2563EB' },
              { title: 'Board Portal', desc: 'Financial visibility, violation oversight, budget tracking, and documents — scoped to the association only.', color: '#7C3AED' },
              { title: 'Owner Self-Service', desc: 'Pay assessments, submit requests, view documents, upload insurance — everything owners need, nothing they don\'t.', color: '#059669' },
              { title: 'Maintenance Calendar', desc: 'Annual, seasonal, and vendor maintenance tracked across every association. Automated reminders before every deadline.', color: '#0D9488' },
              { title: 'Violation Workflow', desc: 'Photo capture → notice generation → hearing scheduling → fine assessment — the entire lifecycle automated.', color: '#D97706' },
              { title: 'Platform Command Center', desc: 'CEO-level visibility. Revenue, door usage, company health, provisioning — every management company in one view.', color: '#1E3A5F' },
            ].map(item => (
              <div key={item.title} className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] transition group">
                <div className="p-4 border-b border-gray-100" style={{ backgroundColor: item.color + '06' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-red-300" />
                      <div className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 ml-2">{item.title}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="rounded-lg px-2 py-2.5" style={{ backgroundColor: item.color + '10' }}>
                          <div className="h-1.5 rounded w-2/3 mb-1.5" style={{ backgroundColor: item.color + '30' }} />
                          <div className="h-1 rounded w-1/2" style={{ backgroundColor: item.color + '15' }} />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="h-1.5 rounded flex-1" style={{ backgroundColor: item.color + '10' }} />
                          <div className="h-1.5 rounded w-12" style={{ backgroundColor: item.color + '18' }} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-2 text-sm text-gray-500 leading-relaxed">{item.desc}</p>
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
              <span className="text-sm font-semibold uppercase tracking-[0.15em] text-gray-400">The problem</span>
              <h2 className="mt-4 text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-5xl">
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
            <span className="text-sm font-semibold uppercase tracking-[0.15em] text-gray-400">What sets us apart</span>
            <h2 className="mt-4 text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-5xl">
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
      <section className="py-16 sm:py-20 bg-[#1E3A5F]">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-white sm:text-5xl">
              White glove setup, included.
            </h2>
            <p className="mt-4 text-lg text-gray-300 max-w-2xl mx-auto">
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
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 border border-white/10 text-2xl font-bold text-white">{item.step}</div>
                </div>
                <h3 className="text-base font-semibold text-white">{item.title}</h3>
                <p className="mt-1 text-sm text-gray-300">{item.desc}</p>
                {i < 5 && <div className="hidden lg:block absolute top-6 -right-2 w-8 h-px bg-white/20" />}
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
          <div className="text-center mb-12">
            <span className="text-sm font-semibold uppercase tracking-[0.15em] text-gray-400">Pricing</span>
            <h2 className="mt-4 text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-5xl">
              Simple door-based pricing. Everything included.
            </h2>
            <p className="mt-4 text-lg text-gray-500">No per-seat fees. No paid modules. No long-term contracts.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: 'Foundation', price: '$157', doors: 'Up to 250 units', desc: 'Small management companies and self-managed associations.', modules: 'Owner Portal, Board Portal, Manager Dashboard, Work Orders, Violations, Document Management, Email Support' },
              { name: 'Growth', price: '$282+', doors: '251 – 1,000 units', desc: 'Growing management companies scaling their portfolio.', modules: 'Everything in Foundation + Vendor Portal, Maintenance Calendar, Compliance Tracking, SMS Notifications, Priority Support', featured: true },
              { name: 'Portfolio', price: '$1,800', doors: 'Up to 4,000 units', desc: 'Established management firms with multiple associations.', modules: 'Everything in Growth + Company Admin Dashboard, AI Automation, Advanced Reporting, API Access, Dedicated Account Manager' },
              { name: 'Enterprise', price: '$3,600', doors: 'Up to 10,000 units', desc: 'Large multi-office operations needing scale.', modules: 'Everything in Portfolio + Multi-Office, Custom Integrations, SLA Guarantee, Volume Pricing' },
            ].map(plan => (
              <div key={plan.name} className={`relative rounded-2xl border bg-white p-6 shadow-sm ${plan.featured ? 'border-[#1E3A5F] ring-2 ring-[#1E3A5F] shadow-[0_12px_40px_rgba(30,58,95,0.12)] scale-[1.03]' : 'border-gray-200 shadow-[0_4px_20px_rgba(0,0,0,0.04)]'}`}>
                {plan.featured && <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#1E3A5F] px-4 py-1 text-xs font-semibold text-white">Most popular</div>}
                <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-base text-gray-400">/month</span>
                </div>
                <p className="mt-2 text-sm text-gray-500">{plan.doors}</p>
                <p className="mt-3 text-sm text-gray-500 leading-relaxed">{plan.desc}</p>
                <Link href="/demo" className={`mt-5 flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition w-full ${plan.featured ? 'bg-[#1E3A5F] text-white hover:bg-[#152940]' : 'border-2 border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'}`}>
                  Schedule demo
                </Link>
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 leading-relaxed">{plan.modules}</p>
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
            <span className="text-sm font-semibold uppercase tracking-[0.15em] text-gray-400">Premium services</span>
            <h2 className="mt-4 text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-5xl">
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
          TRUST
          ═══════════════════════════════════════════════ */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-5xl">
              Built by property managers, not just developers.
            </h2>
            <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
              Every feature came from real condominium, HOA, and townhome management workflows. We understand board expectations, vendor follow-up, compliance deadlines, and the 4pm Friday emergency.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
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
      <section className="py-16 sm:py-20" style={{ backgroundColor: '#F5F4F1' }}>
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-5xl">
            Run your entire portfolio from one platform.
          </h2>
          <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">
            White glove setup included. No long-term contract required.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/demo" className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A5F] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-[#1E3A5F]/20 hover:bg-[#152940] transition">
              Schedule a demo
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
            <Link href="/pricing" className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-8 py-4 text-base font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition">
              View pricing
            </Link>
          </div>
          <p className="mt-8 text-sm text-gray-400">Software built from 29 years in the field — not from a conference room.</p>
        </div>
      </section>
    </div>
  )
}
