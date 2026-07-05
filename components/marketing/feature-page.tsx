import Link from 'next/link'

export type FeatureSection = {
  eyebrow: string
  title: string
  body: string
  bullets: string[]
}

export type FeaturePageProps = {
  eyebrow: string
  headline: string
  intro: string
  sections: FeatureSection[]
  ctaHeadline: string
}

/**
 * Shared layout for the marketing feature deep-dive pages
 * (/features/accounting, /features/maintenance, ...). Matches the
 * homepage design language: light content sections + dark CTA band.
 */
export function FeaturePage({ eyebrow, headline, intro, sections, ctaHeadline }: FeaturePageProps) {
  return (
    <div className="bg-white font-sans antialiased">
      {/* Hero */}
      <section className="border-b border-gray-100 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-[1180px] px-6 lg:px-8">
          <Link href="/features" className="text-[13px] font-medium text-gray-400 transition hover:text-gray-600">
            ← All features
          </Link>
          <span className="mt-6 block text-[13px] font-semibold uppercase tracking-[0.14em] text-[#1E3A5F]">{eyebrow}</span>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.06] tracking-[-0.03em] text-gray-950 sm:text-[52px]">
            {headline}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-500">{intro}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/demo" className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A5F] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[#152940]">
              Request Proposal
            </Link>
            <Link href="/pricing" className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-200 px-6 py-3 text-[15px] font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50">
              View pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Sections */}
      {sections.map((section, i) => (
        <section key={section.title} className="py-14 sm:py-16" style={{ backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F5F4F1' }}>
          <div className="mx-auto max-w-[1180px] px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-20">
              <div>
                <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#0D9488]">{section.eyebrow}</span>
                <h2 className="mt-3 text-3xl font-semibold leading-[1.1] tracking-[-0.02em] text-gray-950 sm:text-4xl">
                  {section.title}
                </h2>
                <p className="mt-4 text-base leading-relaxed text-gray-500 sm:text-lg">{section.body}</p>
              </div>
              <div className="space-y-3">
                {section.bullets.map((b) => (
                  <div key={b} className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                    <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    <span className="text-[15px] leading-relaxed text-gray-700">{b}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* CTA */}
      <section className="relative overflow-hidden bg-[#060709] py-20 sm:py-24">
        <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 h-[480px] w-[760px] -translate-x-1/2 rounded-full opacity-[0.14]" style={{ background: 'radial-gradient(circle, #6d8dff 0%, transparent 70%)' }} />
        <div className="relative mx-auto max-w-[1180px] px-6 text-center lg:px-8">
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold leading-[1.08] tracking-[-0.03em] text-white sm:text-4xl">
            {ctaHeadline}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-zinc-400">
            White-glove setup included. No long-term contract required.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/demo" className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-[15px] font-semibold text-gray-950 shadow-lg shadow-black/30 transition hover:bg-zinc-100">
              Request Proposal
            </Link>
            <Link href="/features" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-7 py-3.5 text-[15px] font-semibold text-white transition hover:bg-white/[0.08]">
              Explore more features
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
