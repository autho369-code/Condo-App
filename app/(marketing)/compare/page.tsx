import type { Metadata } from 'next'
import Link from 'next/link'
import { COMPETITORS } from '@/lib/seo/competitors'

export const metadata: Metadata = {
  title: 'Compare HOA & Condo Management Software',
  description:
    'Honest side-by-side comparisons of Portier369 vs AppFolio, Buildium, and other community association management platforms — features, pricing models, and migration.',
  alternates: { canonical: '/compare' },
}

export default function CompareHubPage() {
  return (
    <div className="bg-white font-sans antialiased">
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-[880px] px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#1E3A5F]">Compare</p>
          <h1 className="mt-2 text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-gray-950 sm:text-[44px]">
            How Portier369 compares
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-7 text-gray-500">
            Side-by-side comparisons for community association managers evaluating software. Honest on both sides —
            including when the other platform is the better fit.
          </p>

          <div className="mt-12 space-y-4">
            {COMPETITORS.map((c) => (
              <Link
                key={c.slug}
                href={`/compare/${c.slug}`}
                className="group block rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-[#1E3A5F]/40 hover:shadow"
              >
                <div className="text-xl font-semibold text-gray-900 group-hover:text-[#1E3A5F]">
                  Portier369 vs {c.name}
                </div>
                <p className="mt-2 line-clamp-2 text-[15px] leading-7 text-gray-500">{c.whatItIs}</p>
                <span className="mt-3 inline-block text-sm font-semibold text-[#1E3A5F]">
                  Read the comparison →
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-14 rounded-2xl border border-gray-200 bg-gray-50 p-8">
            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-gray-950">
              The fastest comparison: see it on your portfolio
            </h2>
            <p className="mt-2 max-w-2xl text-[15px] leading-7 text-gray-600">
              Feature tables only go so far. Request a proposal and see Portier369 running with your association
              count, door count, and current software in mind — free, no obligation.
            </p>
            <Link
              href="/demo"
              className="mt-5 inline-flex items-center rounded-xl bg-[#1E3A5F] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[#162D4A]"
            >
              Request a Proposal
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
