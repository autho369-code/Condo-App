import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'Get in touch with Portier369 — sales, support, and partnership inquiries for our HOA and condo management platform. Headquartered in Chicago, serving all 50 states.',
  alternates: { canonical: '/contact' },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ContactPage',
  name: 'Contact Portier369',
  url: 'https://portier369.com/contact',
  mainEntity: {
    '@id': 'https://portier369.com/#organization',
  },
}

export default function ContactPage() {
  return (
    <div className="bg-white font-sans antialiased">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-[880px] px-6 lg:px-8">
          <h1 className="text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-gray-950 sm:text-[44px]">
            Contact Portier369
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-7 text-gray-500">
            Headquartered in Chicago, Illinois — serving community association management companies and self-managed
            associations in all 50 states.
          </p>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Sales & proposals</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                See the platform on your own portfolio&apos;s numbers — associations, doors, and current software.
              </p>
              <Link
                href="/demo"
                className="mt-4 inline-flex items-center rounded-xl bg-[#1E3A5F] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#162D4A]"
              >
                Request a Proposal
              </Link>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Everything else</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Support, partnerships, press, or security questions — email us and a human replies.
              </p>
              <a
                href="mailto:hello@portier369.com"
                className="mt-4 inline-flex items-center rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-gray-400"
              >
                hello@portier369.com
              </a>
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm leading-6 text-gray-600">
            <span className="font-semibold text-gray-900">Portier369</span> · Chicago, Illinois, USA ·{' '}
            <a href="mailto:hello@portier369.com" className="text-[#1E3A5F] hover:underline">
              hello@portier369.com
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
