import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { COMPETITORS, getCompetitorBySlug } from '@/lib/seo/competitors'

export const dynamicParams = false

export function generateStaticParams() {
  return COMPETITORS.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const c = getCompetitorBySlug(slug)
  if (!c) return {}
  return {
    title: `${c.name} Alternative for HOA & Condo Management (2026)`,
    description: `Comparing Portier369 vs ${c.name} for community association management: features, pricing model, portals, violations, and migration — an honest side-by-side for HOA and condo managers.`,
    alternates: { canonical: `/compare/${c.slug}` },
  }
}

export default async function ComparePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = getCompetitorBySlug(slug)
  if (!c) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        mainEntity: c.faq.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Compare', item: 'https://portier369.com/compare' },
          { '@type': 'ListItem', position: 2, name: `${c.name} Alternative`, item: `https://portier369.com/compare/${c.slug}` },
        ],
      },
    ],
  }

  return (
    <div className="bg-white font-sans antialiased">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-[880px] px-6 lg:px-8">
          <nav className="text-sm text-gray-400">
            <Link href="/compare" className="hover:text-gray-600">Compare</Link> /{' '}
            <span className="text-gray-600">{c.name} Alternative</span>
          </nav>

          <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-[-0.03em] text-gray-950 sm:text-[42px]">
            Looking for a {c.name} alternative for HOA & condo management?
          </h1>
          <p className="mt-5 text-lg leading-8 text-gray-600">{c.answer}</p>
          <p className="mt-4 text-[15px] leading-7 text-gray-500">{c.whatItIs}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/demo"
              className="inline-flex items-center rounded-xl bg-[#1E3A5F] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[#162D4A]"
            >
              Request a Proposal
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center rounded-xl border border-gray-300 px-6 py-3 text-[15px] font-semibold text-gray-700 transition hover:border-gray-400"
            >
              See Pricing
            </Link>
          </div>

          <h2 className="mt-14 text-2xl font-semibold tracking-[-0.02em] text-gray-950">
            Why association managers switch from {c.name}
          </h2>
          <div className="mt-6 space-y-6">
            {c.whySwitch.map((w) => (
              <div key={w.title}>
                <h3 className="text-[17px] font-semibold text-gray-900">{w.title}</h3>
                <p className="mt-1.5 text-[15px] leading-7 text-gray-600">{w.body}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-14 text-2xl font-semibold tracking-[-0.02em] text-gray-950">
            Portier369 vs {c.name} at a glance
          </h2>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full min-w-[560px] border-collapse text-left text-[15px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 font-semibold text-gray-500"> </th>
                  <th className="px-4 py-3 font-semibold text-[#1E3A5F]">Portier369</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">{c.name}</th>
                </tr>
              </thead>
              <tbody>
                {c.table.map((row) => (
                  <tr key={row.dimension} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-gray-900">{row.dimension}</td>
                    <td className="px-4 py-3 text-gray-700">{row.portier}</td>
                    <td className="px-4 py-3 text-gray-600">{row.competitor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-5 text-gray-400">
            Competitor characteristics summarized from publicly available information as of July 2026; plans and
            features change — verify current details with the vendor.
          </p>

          <h2 className="mt-14 text-2xl font-semibold tracking-[-0.02em] text-gray-950">
            When {c.name} is the better fit
          </h2>
          <p className="mt-3 text-[15px] leading-7 text-gray-600">
            An honest comparison cuts both ways. {c.name} is likely the better choice if:
          </p>
          <ul className="mt-4 space-y-3">
            {c.whenTheyWin.map((p) => (
              <li key={p} className="flex gap-3 text-[15px] leading-7 text-gray-600">
                <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[15px] leading-7 text-gray-600">
            Portier369 deliberately does not do rentals — no leasing, no screening, no rent roll. If your portfolio
            is 100% community associations, that focus is exactly the point.
          </p>

          <div className="mt-14 rounded-2xl border border-[#1E3A5F]/15 bg-[#1E3A5F]/[0.03] p-6">
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-gray-950">
              Switching from {c.name}? Migration is included.
            </h2>
            <p className="mt-2 text-[15px] leading-7 text-gray-600">
              Associations, units, owners, vendors, open balances, and documents are imported for you — keep your
              history, skip the rekeying, and see the platform on your own portfolio before you commit.
            </p>
            <Link
              href="/demo"
              className="mt-5 inline-flex items-center rounded-xl bg-[#1E3A5F] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[#162D4A]"
            >
              Request a Free Proposal
            </Link>
          </div>

          <h2 className="mt-14 text-2xl font-semibold tracking-[-0.02em] text-gray-950">Frequently asked questions</h2>
          <div className="mt-4 space-y-4">
            {c.faq.map((item) => (
              <div key={item.question} className="rounded-xl border border-gray-200 p-5">
                <h3 className="text-[17px] font-semibold text-gray-900">{item.question}</h3>
                <p className="mt-2 text-[15px] leading-7 text-gray-600">{item.answer}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-wrap gap-2">
            {COMPETITORS.filter((x) => x.slug !== c.slug).map((x) => (
              <Link
                key={x.slug}
                href={`/compare/${x.slug}`}
                className="rounded-full border border-gray-200 px-4 py-1.5 text-sm text-gray-600 transition hover:border-[#1E3A5F]/40 hover:text-[#1E3A5F]"
              >
                {x.name} alternative
              </Link>
            ))}
            <Link
              href="/features"
              className="rounded-full border border-gray-200 px-4 py-1.5 text-sm text-gray-600 transition hover:border-[#1E3A5F]/40 hover:text-[#1E3A5F]"
            >
              All features
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
