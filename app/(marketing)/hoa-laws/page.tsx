import type { Metadata } from 'next'
import Link from 'next/link'
import { STATE_LAWS } from '@/lib/seo/hoa-states'

export const metadata: Metadata = {
  title: 'HOA & Condo Association Laws by State (2026 Guide)',
  description:
    'Plain-English summaries of HOA and condominium association laws in all 50 states and D.C. — statutes, reserve requirements, resale certificates, and board compliance rules.',
  alternates: { canonical: '/hoa-laws' },
}

export default function HoaLawsHubPage() {
  return (
    <div className="bg-white font-sans antialiased">
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#1E3A5F]">Resources</p>
            <h1 className="mt-2 text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-gray-950 sm:text-[44px]">
              HOA & Condo Association Laws by State
            </h1>
            <p className="mt-4 text-lg leading-7 text-gray-500">
              Every state regulates community associations differently — from California&apos;s Davis-Stirling Act to
              Florida&apos;s post-Surfside structural inspection mandates. These guides summarize the statute, board
              compliance duties, reserve rules, and resale disclosure requirements for each state, in plain English.
            </p>
            <p className="mt-3 text-sm text-gray-400">
              Educational summaries, not legal advice. Statutes change — always confirm current law with an attorney
              licensed in your state.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {STATE_LAWS.map((s) => (
              <Link
                key={s.slug}
                href={`/hoa-laws/${s.slug}`}
                className="group rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm transition hover:border-[#1E3A5F]/40 hover:shadow"
              >
                <div className="text-[15px] font-semibold text-gray-900 group-hover:text-[#1E3A5F]">{s.name}</div>
                <div className="mt-0.5 truncate text-xs text-gray-400">{s.condoAct.split('(')[0].trim()}</div>
              </Link>
            ))}
          </div>

          <div className="mt-16 rounded-2xl border border-gray-200 bg-gray-50 p-8">
            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-gray-950">
              One platform, every state&apos;s paperwork
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-gray-600">
              Portier369 keeps association records, meeting notices, reserve tracking, violation due process, and
              resale document packages organized — the operational side of staying compliant, wherever your
              communities are.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/demo"
                className="inline-flex items-center rounded-xl bg-[#1E3A5F] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[#162D4A]"
              >
                Request a Proposal
              </Link>
              <Link
                href="/features"
                className="inline-flex items-center rounded-xl border border-gray-300 px-6 py-3 text-[15px] font-semibold text-gray-700 transition hover:border-gray-400"
              >
                Explore Features
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
