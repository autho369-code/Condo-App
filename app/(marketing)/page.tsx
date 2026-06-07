import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="bg-white">
      {/* ──────────────────────────────────────────────
          HERO — Problem → Value Prop
          ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-white pt-20 pb-12 lg:pt-32 lg:pb-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(30,58,95,0.06),transparent)]" />
        <div className="relative mx-auto max-w-5xl px-6 text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/80 px-4 py-1.5 text-sm text-gray-600 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
            Purpose-built for professional property managers
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-7xl">
            The operating system
            <br />
            <span className="text-[#1E3A5F]">for community management</span>
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-gray-500 sm:text-xl">
            Most platforms force you to choose between power and simplicity. Portier369 gives you both —
            every tool your team needs across associations, boards, owners, and vendors, in a single interface
            that actually makes sense.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-lg bg-[#1E3A5F] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#1E3A5F]/20 hover:bg-[#162D4A] transition"
            >
              Request a demo
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-8 py-3.5 text-base font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────
          THE PROBLEM
          ────────────────────────────────────────────── */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-20 items-center">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">The challenge</span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Managing communities shouldn&apos;t require five different systems.
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-gray-500">
                Property managers juggle accounting software, maintenance tracking, violation logs,
                board communications, and vendor management — often across separate tools that
                don&apos;t talk to each other. Information gets lost. Response times suffer. Boards get frustrated.
              </p>
              <div className="mt-8 space-y-4">
                {[
                  'Disconnected systems create data silos across associations',
                  'Board members lack visibility into violations and finances',
                  'Owners have no self-service portal for payments or requests',
                  'Vendor compliance tracking is manual and error-prone',
                  'Onboarding new management companies takes months',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <div className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-full bg-red-100 flex items-center justify-center">
                      <span className="text-red-500 text-xs font-bold">&times;</span>
                    </div>
                    <span className="text-gray-600">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
                <div className="space-y-3">
                  {['Accounting Software', 'Maintenance Tracker', 'Violation Log', 'Board Portal', 'Vendor Spreadsheet', 'Owner Database'].map((label) => (
                    <div key={label} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                      <span className="text-sm text-gray-500">{label}</span>
                      <span className="text-xs text-red-400">Disconnected</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-lg bg-[#1E3A5F]/5 border border-[#1E3A5F]/10 p-4 text-center">
                  <span className="text-sm font-medium text-[#1E3A5F]">Portier369 unifies all of this into one platform</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────
          THE PLATFORM — Dashboard Showcase
          ────────────────────────────────────────────── */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">The platform</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Five portals. One platform. Complete visibility.
            </h2>
            <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
              Every stakeholder gets exactly the tools they need — from the CEO to the homeowner.
            </p>
          </div>

          {/* Dashboard Preview Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {[
              { name: 'Platform Operator', desc: 'CEO-level visibility across all management companies. Revenue, door usage, company health, provisioning.', color: '#1E3A5F', stats: '14 companies · $24.8K MRR · 3,200 doors' },
              { name: 'Company Admin', desc: 'Portfolio-wide control. Associations, managers, billing, platform requests.', color: '#0F766E', stats: '12 associations · 8 managers · $8.2K revenue' },
              { name: 'Manager', desc: 'Day-to-day operations. Work orders, violations, maintenance, vendors.', color: '#2563EB', stats: '3 associations · 142 units · 18 open WO' },
              { name: 'Board Member', desc: 'Governance oversight. Violations, financials, budget, architectural reviews.', color: '#7C3AED', stats: '1 association · 4 open violations · $12K reserves' },
              { name: 'Owner', desc: 'Self-service. Payments, work orders, documents, insurance, calendar.', color: '#059669', stats: 'Unit 204 · $450 due Jun 1 · 0 open violations' },
            ].map((portal, i) => (
              <div key={portal.name} className={`lg:col-span-${i === 0 ? '2' : '1'}`} style={i === 0 ? { gridColumn: 'span 2' } : {}}>
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition overflow-hidden group">
                  {/* Dashboard mockup */}
                  <div className="p-4 border-b border-gray-100" style={{ backgroundColor: portal.color + '08' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-red-300" />
                        <div className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                      </div>
                      <span className="text-[10px] font-medium text-gray-400 ml-2 uppercase tracking-wider">{portal.name}</span>
                    </div>
                    {/* Mini dashboard cards */}
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      {portal.stats.split(' · ').map((stat) => (
                        <div key={stat} className="rounded-md px-2 py-2 text-center" style={{ backgroundColor: portal.color + '10' }}>
                          <div className="text-[10px] font-semibold" style={{ color: portal.color }}>{stat.split(' ')[0]}</div>
                          <div className="text-[9px] text-gray-400 mt-0.5 truncate">{stat.split(' ').slice(1).join(' ')}</div>
                        </div>
                      ))}
                    </div>
                    {/* Mini table */}
                    <div className="space-y-1">
                      {[1, 2, 3].map((r) => (
                        <div key={r} className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded" style={{ backgroundColor: portal.color + '15' }} />
                          <div className="h-1.5 w-8 rounded" style={{ backgroundColor: portal.color + '25' }} />
                          <div className="h-1.5 w-6 rounded" style={{ backgroundColor: portal.color + '10' }} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="px-4 py-3">
                    <h3 className="text-sm font-semibold text-gray-900">{portal.name}</h3>
                    <p className="mt-1 text-xs text-gray-500 leading-relaxed">{portal.desc}</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: portal.color }} />
                      <span className="text-[10px] text-gray-400">Live dashboard</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────
          DIFFERENTIATION
          ────────────────────────────────────────────── */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Why Portier369</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Built differently. Priced differently.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {[
              { title: 'Door-based pricing', body: 'Pay based on active units, not user seats. Unlimited owners, board members, and vendors on every plan. Your costs scale with your portfolio — not your headcount.', stat: 'Unlimited users on every plan' },
              { title: 'White glove onboarding', body: 'Data migration, association setup, owner and vendor imports, document organization, team training — handled by our team. Most companies go live in under a week.', stat: 'Go live in under a week' },
              { title: 'Everything included', body: 'Work orders, violations, maintenance, compliance, communications, documents, board management, and AI automation — no paid modules, no surprise charges.', stat: 'Zero paid modules' },
              { title: 'Bring your own AI', body: 'Connect your OpenAI, Claude, or Gemini API key. Auto-generate notices, draft responses, summarize meetings, and detect violations — all running on your own credentials.', stat: 'Your AI, your data' },
              { title: 'Association health scoring', body: 'Every association gets a real-time health score based on open work orders, violations, delinquency, manager response time, and vendor compliance.', stat: 'Real-time health monitoring' },
              { title: 'Built by property managers', body: 'Every feature was designed with input from active property managers. We understand assessment cycles, board politics, maintenance seasons, and the 4pm Friday emergency.', stat: 'Industry-informed design' },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition">
                <div className="text-xs font-semibold text-[#1E3A5F] uppercase tracking-wider mb-2">{item.stat}</div>
                <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-3 text-sm text-gray-500 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────
          CAPABILITIES
          ────────────────────────────────────────────── */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:gap-24">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Operations</span>
              <h3 className="mt-2 text-2xl font-bold text-gray-900">Everything your team needs to run the day-to-day.</h3>
              <div className="mt-8 space-y-6">
                {[
                  { title: 'Work Orders & Maintenance', desc: 'Service request to vendor payment — one continuous workflow. Preventive maintenance calendars with automated reminders.' },
                  { title: 'Violations & Compliance', desc: 'Issue, track, and resolve violations. Board hearings, fines, notices, and owner communication — all in one place.' },
                  { title: 'Vendor Management', desc: 'Track insurance, licenses, and compliance for every vendor. Automated expiration alerts and 1099-ready records.' },
                  { title: 'Architectural Reviews', desc: 'Submit, review, approve, or deny modification requests. Attach plans, photos, and board decisions.' },
                ].map((f) => (
                  <div key={f.title}>
                    <h4 className="font-semibold text-gray-900">{f.title}</h4>
                    <p className="mt-1 text-sm text-gray-500">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Governance & Finance</span>
              <h3 className="mt-2 text-2xl font-bold text-gray-900">Everything your board and owners expect.</h3>
              <div className="mt-8 space-y-6">
                {[
                  { title: 'Board Portal', desc: 'Association-scoped dashboard with financials, violations, budget vs actual, and delinquency tracking.' },
                  { title: 'Owner Portal', desc: 'Self-service payments, work order requests, violation viewing, document access, and insurance upload.' },
                  { title: 'Financial Management', desc: 'Assessments, payments, late fees, bank reconciliation, GL accounts, and reporting.' },
                  { title: 'Communications', desc: 'Email and SMS to owners, board announcements, vendor messages — with delivery tracking.' },
                ].map((f) => (
                  <div key={f.title}>
                    <h4 className="font-semibold text-gray-900">{f.title}</h4>
                    <p className="mt-1 text-sm text-gray-500">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────
          TRUST
          ────────────────────────────────────────────── */}
      <section className="py-16 lg:py-24 bg-[#1E3A5F]">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Built for the people who manage communities.
          </h2>
          <p className="mt-4 text-lg text-gray-300 max-w-2xl mx-auto">
            Every feature in Portier369 came from conversations with property managers.
            We understand the weight of managing other people&apos;s homes and investments.
          </p>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              { label: 'Row-Level Security', desc: 'Supabase RLS enforced on every query. No portfolio can ever access another portfolio\'s data.' },
              { label: 'Data Ownership', desc: 'Export your data anytime. Your records are yours — no vendor lock-in.' },
              { label: 'Enterprise Infrastructure', desc: 'Hosted on AWS via Vercel. 99.9% uptime. Automatic backups and point-in-time recovery.' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-white/10 border border-white/10 p-6 text-left">
                <h3 className="font-semibold text-white">{item.label}</h3>
                <p className="mt-2 text-sm text-gray-300 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────
          PRICING SUMMARY
          ────────────────────────────────────────────── */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Pricing</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Simple. Door-based. Everything included.
          </h2>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
            Four plans based on active units. No per-seat fees. No paid modules. No long-term contracts.
          </p>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: 'Foundation', price: '$157', doors: 'Up to 250 units', best: 'Small companies' },
              { name: 'Growth', price: '$282+', doors: '251 – 1,000 units', best: 'Growing portfolios', featured: true },
              { name: 'Portfolio', price: '$1,800', doors: 'Up to 4,000 units', best: 'Established firms' },
              { name: 'Enterprise', price: '$3,600', doors: 'Up to 10,000 units', best: 'Large operations' },
            ].map((plan) => (
              <div key={plan.name} className={`relative rounded-2xl border bg-white p-6 text-left shadow-sm ${plan.featured ? 'border-[#1E3A5F] ring-1 ring-[#1E3A5F]' : 'border-gray-200'}`}>
                {plan.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#1E3A5F] px-3 py-0.5 text-[10px] font-semibold text-white">Most Popular</div>
                )}
                <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-sm text-gray-500">/month</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">{plan.doors}</p>
                <p className="mt-2 text-xs text-gray-400">{plan.best}</p>
              </div>
            ))}
          </div>
          <Link href="/pricing" className="mt-8 inline-flex items-center gap-1 text-sm font-medium text-[#1E3A5F] hover:text-[#162D4A]">
            See full pricing details &rarr;
          </Link>
        </div>
      </section>

      {/* ──────────────────────────────────────────────
          DEMO CTA
          ────────────────────────────────────────────── */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            See Portier369 in action.
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            Walk through a live dashboard with your portfolio data. We&apos;ll show you how your team,
            board, owners, and vendors would use the platform every day.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-lg bg-[#1E3A5F] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#1E3A5F]/20 hover:bg-[#162D4A] transition"
            >
              Request a demo
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-8 py-3.5 text-base font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              View pricing
            </Link>
          </div>
          <p className="mt-6 text-sm text-gray-400">
            White glove setup included. No long-term contract required.
          </p>
        </div>
      </section>
    </div>
  )
}
