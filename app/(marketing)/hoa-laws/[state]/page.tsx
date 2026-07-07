import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { STATE_LAWS, getStateBySlug } from '@/lib/seo/hoa-states'

export const dynamicParams = false

export function generateStaticParams() {
  return STATE_LAWS.map((s) => ({ state: s.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }): Promise<Metadata> {
  const { state } = await params
  const s = getStateBySlug(state)
  if (!s) return {}
  return {
    title: `${s.name} HOA & Condo Association Laws (2026 Guide)`,
    description: `${s.name} community association law explained: ${s.condoAct.split('(')[0].trim()}, board compliance duties, reserve rules, and resale disclosure requirements — in plain English.`,
    alternates: { canonical: `/hoa-laws/${s.slug}` },
  }
}

export default async function StateLawPage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  const s = getStateBySlug(state)
  if (!s) notFound()

  const faqItems = [
    {
      question: `What law governs condo associations in ${s.name}?`,
      answer: `Condominiums in ${s.name} are governed by the ${s.condoAct}.${s.hoaAct ? ` Homeowners associations and planned communities fall under the ${s.hoaAct}.` : ' Homeowners associations are generally governed by their recorded declarations, bylaws, and state nonprofit-corporation law.'}`,
    },
    {
      question: `Are resale disclosures required in ${s.name}?`,
      answer: s.resale,
    },
    {
      question: `What software helps ${s.name} associations stay compliant?`,
      answer: `Association management software like Portier369 supports the operational side of ${s.name} compliance: maintaining official records, distributing meeting notices, tracking reserves and budgets, running violation due process with notices and hearings, and assembling resale document packages.`,
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
          { '@type': 'ListItem', position: 1, name: 'HOA Laws by State', item: 'https://portier369.com/hoa-laws' },
          { '@type': 'ListItem', position: 2, name: s.name, item: `https://portier369.com/hoa-laws/${s.slug}` },
        ],
      },
    ],
  }

  const idx = STATE_LAWS.findIndex((x) => x.slug === s.slug)
  const related = [
    ...STATE_LAWS.slice(Math.max(0, idx - 2), idx),
    ...STATE_LAWS.slice(idx + 1, idx + 3),
  ].slice(0, 4)

  return (
    <div className="bg-white font-sans antialiased">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-[880px] px-6 lg:px-8">
          <nav className="text-sm text-gray-400">
            <Link href="/hoa-laws" className="hover:text-gray-600">
              HOA Laws by State
            </Link>{' '}
            / <span className="text-gray-600">{s.name}</span>
          </nav>

          <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-[-0.03em] text-gray-950 sm:text-[42px]">
            {s.name} HOA & Condo Association Laws
          </h1>
          <p className="mt-5 text-lg leading-8 text-gray-600">{s.overview}</p>

          <div className="mt-10 rounded-2xl border border-gray-200 bg-gray-50 p-6">
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-gray-950">
              Which statutes apply in {s.name}?
            </h2>
            <dl className="mt-4 space-y-3 text-[15px] leading-7">
              <div>
                <dt className="font-semibold text-gray-900">Condominiums</dt>
                <dd className="text-gray-600">{s.condoAct}</dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-900">HOAs / planned communities</dt>
                <dd className="text-gray-600">
                  {s.hoaAct ??
                    'No dedicated HOA statute — recorded declarations, bylaws, and state nonprofit-corporation law govern.'}
                </dd>
              </div>
            </dl>
          </div>

          <h2 className="mt-12 text-2xl font-semibold tracking-[-0.02em] text-gray-950">
            Key compliance rules for {s.name} boards and managers
          </h2>
          <ul className="mt-4 space-y-3">
            {s.keyPoints.map((p) => (
              <li key={p} className="flex gap-3 text-[15px] leading-7 text-gray-600">
                <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1E3A5F]" />
                {p}
              </li>
            ))}
          </ul>

          <h2 className="mt-12 text-2xl font-semibold tracking-[-0.02em] text-gray-950">
            Resale and disclosure requirements
          </h2>
          <p className="mt-3 text-[15px] leading-7 text-gray-600">{s.resale}</p>

          <div className="mt-12 rounded-2xl border border-[#1E3A5F]/15 bg-[#1E3A5F]/[0.03] p-6">
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-gray-950">
              Running associations in {s.name}?
            </h2>
            <p className="mt-2 text-[15px] leading-7 text-gray-600">
              Portier369 handles the operational side of {s.name} compliance — official records, owner and board
              notices, reserve and budget tracking, violation due process, and document packages — in one platform
              built for community association managers.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/demo"
                className="inline-flex items-center rounded-xl bg-[#1E3A5F] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[#162D4A]"
              >
                Request a Proposal
              </Link>
              <Link
                href="/features/accounting"
                className="inline-flex items-center rounded-xl border border-gray-300 px-6 py-3 text-[15px] font-semibold text-gray-700 transition hover:border-gray-400"
              >
                See Association Accounting
              </Link>
            </div>
          </div>

          <h2 className="mt-12 text-2xl font-semibold tracking-[-0.02em] text-gray-950">Frequently asked questions</h2>
          <div className="mt-4 space-y-4">
            {faqItems.map((item) => (
              <div key={item.question} className="rounded-xl border border-gray-200 p-5">
                <h3 className="text-[17px] font-semibold text-gray-900">{item.question}</h3>
                <p className="mt-2 text-[15px] leading-7 text-gray-600">{item.answer}</p>
              </div>
            ))}
          </div>

          {related.length > 0 && (
            <>
              <h2 className="mt-12 text-xl font-semibold tracking-[-0.02em] text-gray-950">Nearby state guides</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/hoa-laws/${r.slug}`}
                    className="rounded-full border border-gray-200 px-4 py-1.5 text-sm text-gray-600 transition hover:border-[#1E3A5F]/40 hover:text-[#1E3A5F]"
                  >
                    {r.name}
                  </Link>
                ))}
              </div>
            </>
          )}

          <p className="mt-12 text-xs leading-5 text-gray-400">
            This guide is an educational summary, not legal advice. Statutes are amended regularly — confirm current
            law with an attorney licensed in {s.name} before acting.
          </p>
        </div>
      </section>
    </div>
  )
}
