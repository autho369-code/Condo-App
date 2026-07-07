import type { Metadata } from 'next'
import Link from 'next/link'
import { LOCAL_CITIES } from '@/lib/seo/local-cities'

export const metadata: Metadata = {
  title: 'HOA & Condo Management Software Across the USA',
  description:
    'Portier369 serves community association managers nationwide — explore how the platform fits the statutes and market realities of major U.S. metros.',
  alternates: { canonical: '/local' },
}

export default function LocalHubPage() {
  return (
    <div className="bg-white font-sans antialiased">
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#1E3A5F]">Locations</p>
            <h1 className="mt-2 text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-gray-950 sm:text-[44px]">
              Community association software, wherever your portfolio is
            </h1>
            <p className="mt-4 text-lg leading-7 text-gray-500">
              Portier369 is a nationwide platform. Every state regulates associations differently — these guides cover
              how the platform maps to the statutes and market realities of major metros, with links to each
              state&apos;s HOA and condo law summary.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LOCAL_CITIES.map((c) => (
              <Link
                key={c.slug}
                href={`/local/${c.slug}`}
                className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-[#1E3A5F]/40 hover:shadow"
              >
                <div className="text-lg font-semibold text-gray-900 group-hover:text-[#1E3A5F]">
                  {c.city}, {c.abbr}
                </div>
                <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-gray-500">{c.blurb}</p>
              </Link>
            ))}
          </div>

          <div className="mt-14 rounded-2xl border border-gray-200 bg-gray-50 p-8">
            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-gray-950">Not seeing your market?</h2>
            <p className="mt-2 max-w-2xl text-[15px] leading-7 text-gray-600">
              Portier369 works in all 50 states. Check the{' '}
              <Link href="/hoa-laws" className="font-semibold text-[#1E3A5F] hover:underline">
                HOA laws by state
              </Link>{' '}
              library, or request a proposal for your portfolio anywhere in the USA.
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
