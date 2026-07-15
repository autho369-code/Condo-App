import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LOCAL_CITIES, getCityBySlug } from '@/lib/seo/local-cities'
import { getStateBySlug } from '@/lib/seo/hoa-states'

export const dynamicParams = false

export function generateStaticParams() {
  return LOCAL_CITIES.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const c = getCityBySlug(slug)
  if (!c) return {}
  return {
    title: `HOA & Condo Management Software in ${c.city}, ${c.abbr}`,
    description: `Portier369 for ${c.city} community associations: accounting, violations, work orders, and board, owner, and vendor portals — built for ${c.state} compliance requirements.`,
    alternates: { canonical: `/local/${c.slug}` },
  }
}

const keyFeatures = [
  { title: 'Manager Dashboard', desc: 'Work orders, violations, maintenance, vendors — everything a property manager needs in one command center.' },
  { title: 'Board Portal', desc: 'Financial visibility, violation oversight, budget tracking, and documents — scoped to the association only.' },
  { title: 'Owner Self-Service', desc: 'Pay assessments, submit requests, view documents, upload insurance — everything owners need.' },
  { title: 'Maintenance Calendar', desc: 'Annual, seasonal, and vendor maintenance tracked across every association. Automated reminders before every deadline.' },
  { title: 'Violation Workflow', desc: 'Photo capture → notice generation → hearing scheduling → fine assessment — the entire lifecycle automated.' },
  { title: 'Association Accounting', desc: 'True double-entry ledger, AR aging, budgets vs. actuals, bank reconciliation, and a full report library.' },
]

export default async function CityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = getCityBySlug(slug)
  if (!c) notFound()
  const stateLaw = getStateBySlug(c.stateSlug)

  const faqItems = [
    {
      question: `What should ${c.city} associations look for in HOA management software?`,
      answer: `${c.city} communities need software that keeps official records, owner notices, violation due process, reserves, and association accounting organized under ${c.state} law. Portier369 covers all of it in one platform, with separate portals for managers, boards, owners, and vendors.`,
    },
    {
      question: `How much does HOA software cost for a ${c.city} community?`,
      answer: 'Portier369 uses transparent per-door pricing starting at $157/month — every plan includes the complete core platform with no hidden software modules, and standard onboarding is included. Request a free proposal to see exact pricing for your portfolio.',
    },
    {
      question: 'Can we migrate our existing data to Portier369?',
      answer: 'Yes. Portier369 includes guided data migration — units, owners, vendors, open balances, and documents — so your team is not rekeying records or losing history when switching systems.',
    },
  ]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        mainEntity: faqItems.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Locations', item: 'https://portier369.com/local' },
          { '@type': 'ListItem', position: 2, name: `${c.city}, ${c.abbr}`, item: `https://portier369.com/local/${c.slug}` },
        ],
      },
    ],
  }

  return (
    <div className="bg-white font-sans antialiased">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <nav className="text-sm text-gray-400">
              <Link href="/local" className="hover:text-gray-600">Locations</Link> /{' '}
              <span className="text-gray-600">{c.city}, {c.abbr}</span>
            </nav>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-gray-950 sm:text-[44px]">
              HOA & Condo Management Software in {c.city}, {c.abbr}
            </h1>
            <p className="mt-5 text-lg leading-8 text-gray-500">{c.blurb}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A5F] px-7 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-black/30 transition hover:bg-[#162D4A]"
              >
                Request a Free Proposal
              </Link>
              {stateLaw && (
                <Link
                  href={`/hoa-laws/${c.stateSlug}`}
                  className="inline-flex items-center rounded-xl border border-gray-300 px-7 py-3.5 text-[15px] font-semibold text-gray-700 transition hover:border-gray-400"
                >
                  {c.state} HOA Law Guide
                </Link>
              )}
            </div>
          </div>

          <div className="mt-16">
            <h2 className="mb-8 text-center text-3xl font-semibold tracking-[-0.02em]">
              Everything {c.city} communities need in one platform
            </h2>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {keyFeatures.map((feature) => (
                <div key={feature.title} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {stateLaw && (
            <div className="mx-auto mt-16 max-w-3xl rounded-2xl border border-gray-200 bg-gray-50 p-8">
              <h2 className="text-2xl font-semibold tracking-[-0.02em] text-gray-950">
                {c.state} compliance, handled operationally
              </h2>
              <p className="mt-3 text-[15px] leading-7 text-gray-600">
                Associations in {c.city} are governed by the {stateLaw.condoAct.split('(')[0].trim()}
                {stateLaw.hoaAct ? ` and the ${stateLaw.hoaAct.split('(')[0].trim()}` : ''}. Portier369 keeps the
                records, notices, budgets, reserves, and violation due process those statutes expect — organized and
                audit-ready.
              </p>
              <Link
                href={`/hoa-laws/${c.stateSlug}`}
                className="mt-4 inline-block text-[15px] font-semibold text-[#1E3A5F] hover:underline"
              >
                Read the {c.state} HOA & condo law guide →
              </Link>
            </div>
          )}

          <div className="mx-auto mt-16 max-w-2xl">
            <h2 className="mb-8 text-center text-3xl font-semibold tracking-[-0.02em]">Frequently asked questions</h2>
            <div className="space-y-4">
              {faqItems.map((item) => (
                <div key={item.question} className="rounded-lg border border-gray-200 p-4">
                  <h3 className="text-lg font-semibold">{item.question}</h3>
                  <p className="mt-2 text-gray-600">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
