import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Features — Portier369 | HOA & Condo Management Software',
  description:
    'Explore Portier369 features: association accounting, maintenance and work orders, communications, and dedicated portals for boards, owners, and vendors.',
}

const CATEGORIES = [
  {
    href: '/features/accounting',
    color: '#1E3A5F',
    title: 'Association Accounting',
    desc: 'True double-entry general ledger, AR aging, bill approval workflows, budgets vs. actuals, bank reconciliation with automatic bank feeds, and a 119-report library with a custom report builder.',
    points: ['Double-entry GL', 'AR aging & delinquencies', 'Bank feeds & reconciliation', 'Report builder'],
  },
  {
    href: '/features/maintenance',
    color: '#0D9488',
    title: 'Maintenance & Operations',
    desc: 'Work orders, recurring preventive maintenance, inspections, purchase orders, inventory, violations with the full notice-to-hearing lifecycle, and architectural review workflows.',
    points: ['Work orders & scheduling', 'Preventive maintenance calendar', 'Violations lifecycle', 'Architectural reviews'],
  },
  {
    href: '/features/communications',
    color: '#7C3AED',
    title: 'Communications',
    desc: 'A centralized communication hub: owner email campaigns, SMS notifications, AI-drafted letters and notices, document templates with merge variables, and threaded request messaging.',
    points: ['Email & SMS center', 'AI-drafted notices', 'Document templates', 'Threaded messaging'],
  },
  {
    href: '/features/portals',
    color: '#059669',
    title: 'Portals for Every Role',
    desc: 'Six purpose-built workspaces — platform operator, company admin, manager, board, owner, and vendor — each scoped to exactly the data that role should see.',
    points: ['Board governance portal', 'Owner self-service', 'Vendor work-order portal', 'Role-scoped security'],
  },
]

export default function FeaturesHubPage() {
  return (
    <div className="bg-white font-sans antialiased">
      <section className="border-b border-gray-100 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-[1180px] px-6 lg:px-8">
          <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#1E3A5F]">Features</span>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.06] tracking-[-0.03em] text-gray-950 sm:text-[52px]">
            Everything a management company runs on, in one platform.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-500">
            Portier369 covers the full operating surface of a condominium and HOA management company —
            accounting, maintenance, communications, and portals for every stakeholder. No modules to
            bolt on, no per-feature upcharges.
          </p>
        </div>
      </section>

      <section className="py-14 sm:py-16" style={{ backgroundColor: '#F5F4F1' }}>
        <div className="mx-auto max-w-[1180px] px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                className="group rounded-2xl border border-gray-200 bg-white p-7 shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]"
              >
                <div className="mb-4 h-2 w-10 rounded-full" style={{ backgroundColor: cat.color }} />
                <h2 className="text-xl font-semibold text-gray-900 group-hover:text-[#1E3A5F]">{cat.title}</h2>
                <p className="mt-3 text-[15px] leading-relaxed text-gray-500">{cat.desc}</p>
                <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2">
                  {cat.points.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-[13px] font-medium text-gray-600">
                      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: cat.color }} />
                      {p}
                    </li>
                  ))}
                </ul>
                <span className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-[#1E3A5F]">
                  Explore {cat.title.toLowerCase()} <span className="transition group-hover:translate-x-0.5">→</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#060709] py-20 sm:py-24">
        <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 h-[480px] w-[760px] -translate-x-1/2 rounded-full opacity-[0.14]" style={{ background: 'radial-gradient(circle, #6d8dff 0%, transparent 70%)' }} />
        <div className="relative mx-auto max-w-[1180px] px-6 text-center lg:px-8">
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold leading-[1.08] tracking-[-0.03em] text-white sm:text-4xl">
            See the whole platform in a live walkthrough.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-zinc-400">
            White-glove setup included. No long-term contract required.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/demo" className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-[15px] font-semibold text-gray-950 shadow-lg shadow-black/30 transition hover:bg-zinc-100">
              Request Proposal
            </Link>
            <Link href="/pricing" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-7 py-3.5 text-[15px] font-semibold text-white transition hover:bg-white/[0.08]">
              View pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
