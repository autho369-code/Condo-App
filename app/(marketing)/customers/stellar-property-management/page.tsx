import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Case Study: Stellar Property Management — 42 Associations on Portier369',
  description:
    'How a Chicago management company running 42 associations and 2,450 doors replaced AppFolio (and Buildium before it) with Portier369 — accounting, violations, board and vendor portals, and AI automation at a flat per-door price.',
  alternates: { canonical: '/customers/stellar-property-management' },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Article',
      headline: 'How Stellar Property Management runs 42 associations and 2,450 doors on Portier369',
      author: { '@id': 'https://portier369.com/#organization' },
      publisher: { '@id': 'https://portier369.com/#organization' },
      datePublished: '2026-07-06',
      about: {
        '@type': 'Organization',
        name: 'Stellar Property Management',
        url: 'https://stellarpropertygroup.com',
        address: { '@type': 'PostalAddress', addressLocality: 'Chicago', addressRegion: 'IL', addressCountry: 'US' },
      },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Customers', item: 'https://portier369.com/customers/stellar-property-management' },
        { '@type': 'ListItem', position: 2, name: 'Stellar Property Management', item: 'https://portier369.com/customers/stellar-property-management' },
      ],
    },
  ],
}

const stats = [
  { value: '42', label: 'associations managed' },
  { value: '2,450', label: 'doors under management' },
  { value: '2007', label: 'managing Chicago communities since' },
  { value: '2', label: 'platforms replaced (Buildium, then AppFolio)' },
]

const reasons = [
  {
    title: 'Association accounting that holds up',
    body: 'True double-entry fund accounting, AR aging, budgets versus actuals, and bank reconciliation — the financial backbone a 42-association portfolio needs, without add-on fees for core reports.',
  },
  {
    title: 'Communication in one place',
    body: 'Owner and board notices, email, and threaded request messaging replaced scattered inboxes — every conversation attached to the unit and association it belongs to.',
  },
  {
    title: 'The full violation lifecycle',
    body: 'Photo capture, notice generation, hearing scheduling, and fine assessment run as one documented workflow — critical for Illinois due-process requirements.',
  },
  {
    title: 'Board and vendor portals included',
    body: 'All 42 boards get live financial visibility in their own scoped portal; vendors get work orders, compliance tracking, and payment history in theirs. No per-portal charges.',
  },
  {
    title: 'AI automation and document management',
    body: 'AI-drafted letters and notices, role-scoped AI assistants, and centralized document storage cut the repetitive administration out of day-to-day management.',
  },
  {
    title: 'Flat per-door pricing',
    body: 'Every feature, every portal, every report — included. After watching add-on fees stack up on the previous platform, predictable pricing was a requirement, not a preference.',
  },
]

export default function StellarCaseStudyPage() {
  return (
    <div className="bg-white font-sans antialiased">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-[880px] px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#1E3A5F]">Customer Story</p>
          <h1 className="mt-2 text-4xl font-semibold leading-[1.1] tracking-[-0.03em] text-gray-950 sm:text-[42px]">
            How Stellar Property Management runs 42 associations and 2,450 doors on Portier369
          </h1>
          <p className="mt-5 text-lg leading-8 text-gray-600">
            <a href="https://stellarpropertygroup.com" target="_blank" rel="noopener" className="font-semibold text-[#1E3A5F] hover:underline">
              Stellar Property Management
            </a>{' '}
            has managed Chicago condominium, HOA, and townhome associations since 2007. After outgrowing Buildium and
            then watching AppFolio&apos;s add-on fees climb, Stellar moved its entire portfolio to Portier369.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-center">
                <div className="text-3xl font-semibold tracking-[-0.02em] text-[#1E3A5F]">{s.value}</div>
                <div className="mt-1 text-xs leading-5 text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>

          <h2 className="mt-14 text-2xl font-semibold tracking-[-0.02em] text-gray-950">
            The problem: two platforms, same story
          </h2>
          <p className="mt-3 text-[15px] leading-7 text-gray-600">
            Stellar started on Buildium, then moved to AppFolio as the portfolio grew. Both are rentals-first
            platforms with association features attached — and on AppFolio, the economics kept shifting: capabilities
            that a management company depends on arrived as add-ons, and the add-on fees grew unreasonable for an
            association-only portfolio that never used the leasing, screening, or marketing tools it was paying to
            subsidize.
          </p>

          <blockquote className="mt-8 rounded-2xl border-l-4 border-[#1E3A5F] bg-[#1E3A5F]/[0.03] p-6">
            <p className="text-[17px] leading-8 text-gray-800">
              &ldquo;We&apos;d been through Buildium and AppFolio. When AppFolio&apos;s add-on fees became
              unreasonable, we went looking — and found Portier369: excellent accounting, communication, violations,
              board access, vendor access, AI automation, and document management, at an unbeatable price with a UI
              our whole team actually finds easy to use.&rdquo;
            </p>
            <footer className="mt-4 text-sm font-semibold text-gray-500">
              Mirsad — Owner, Stellar Property Management, Chicago
            </footer>
          </blockquote>

          <h2 className="mt-14 text-2xl font-semibold tracking-[-0.02em] text-gray-950">
            Why Stellar chose Portier369
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {reasons.map((r) => (
              <div key={r.title} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="text-[16px] font-semibold text-gray-900">{r.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-gray-600">{r.body}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-14 text-2xl font-semibold tracking-[-0.02em] text-gray-950">
            The switch, without the pain
          </h2>
          <p className="mt-3 text-[15px] leading-7 text-gray-600">
            All 42 associations — units, owners, vendors, open balances, and documents — were migrated with
            Portier369&apos;s included guided migration. No rekeying, no lost history, no services invoice on the way
            out the door.
          </p>

          <div className="mt-12 rounded-2xl border border-[#1E3A5F]/15 bg-[#1E3A5F]/[0.03] p-6">
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-gray-950">
              Managing associations on AppFolio or Buildium?
            </h2>
            <p className="mt-2 text-[15px] leading-7 text-gray-600">
              See the honest side-by-side comparisons, or request a proposal with your own association and door count.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/demo"
                className="inline-flex items-center rounded-xl bg-[#1E3A5F] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[#162D4A]"
              >
                Request a Free Proposal
              </Link>
              <Link
                href="/compare/appfolio-alternative"
                className="inline-flex items-center rounded-xl border border-gray-300 px-6 py-3 text-[15px] font-semibold text-gray-700 transition hover:border-gray-400"
              >
                vs AppFolio
              </Link>
              <Link
                href="/compare/buildium-alternative"
                className="inline-flex items-center rounded-xl border border-gray-300 px-6 py-3 text-[15px] font-semibold text-gray-700 transition hover:border-gray-400"
              >
                vs Buildium
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
