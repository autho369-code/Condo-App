import Link from 'next/link'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://portier369.com/#organization',
      name: 'Portier369',
      url: 'https://portier369.com',
      logo: 'https://portier369.com/opengraph-image',
      description:
        'The operating system for condominium and HOA management — serving community association management companies across all 50 US states.',
      email: 'hello@portier369.com',
      telephone: '+1-872-269-8818',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '5107 N Western Ave, Suite 1S',
        addressLocality: 'Chicago',
        addressRegion: 'IL',
        postalCode: '60625',
        addressCountry: 'US',
      },
      areaServed: 'US',
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'sales',
        telephone: '+1-872-269-8818',
        email: 'hello@portier369.com',
        url: 'https://portier369.com/contact',
      },
    },
    {
      '@type': 'SoftwareApplication',
      name: 'Portier369',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'Property Management Software',
      operatingSystem: 'Web, iOS, Android',
      description:
        'All-in-one property management software for condominium and HOA management companies — work orders, violations, maintenance, accounting, board and owner portals, and vendor management.',
      offers: {
        '@type': 'Offer',
        price: '157',
        priceCurrency: 'USD',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: '157',
          priceCurrency: 'USD',
          billingDuration: 'P1M',
        },
      },
      publisher: { '@id': 'https://portier369.com/#organization' },
    },
  ],
}

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="border-b border-gray-100 bg-white sticky top-0 z-50">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1E3A5F] text-sm font-bold text-white">P</div>
            <span className="text-lg font-semibold text-gray-900">Portier369</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm md:flex">
            <Link href="/features" className="text-gray-600 hover:text-gray-900 transition">Features</Link>
            <Link href="/ai-receptionist" className="text-gray-600 hover:text-gray-900 transition">AI Receptionist</Link>
            <Link href="/professional-services" className="hidden text-gray-600 hover:text-gray-900 transition lg:block">Professional Services</Link>
            <Link href="/pricing" className="text-gray-600 hover:text-gray-900 transition">Pricing</Link>
            <Link href="/company" className="text-gray-600 hover:text-gray-900 transition">Company</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">Sign in</Link>
            <Link href="/demo" className="inline-flex h-9 items-center rounded-lg bg-[#1E3A5F] px-4 text-sm font-medium text-white hover:bg-[#162D4A] transition">
              Request Proposal
            </Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-[1280px] px-6 py-12">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1E3A5F] text-sm font-bold text-white">P</div>
                <span className="text-lg font-semibold tracking-[-0.01em] text-gray-900">Portier369</span>
              </div>
              <p className="text-[15px] leading-6 text-gray-500 max-w-xs">The operating system for condominium and HOA management.</p>
              <div className="mt-4 space-y-1 text-sm text-gray-500">
                <p>5107 N Western Ave, Suite 1S, Chicago, IL 60625</p>
                <p>
                  <a href="tel:+18722698818" className="hover:text-gray-900">(872) 269-8818</a>
                  {' · '}
                  <a href="mailto:hello@portier369.com" className="hover:text-gray-900">hello@portier369.com</a>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-12 gap-y-8">
              <div>
                <div className="text-xs font-semibold uppercase text-gray-400 mb-3">Product</div>
                <div className="space-y-2 text-sm">
                  <Link href="/features" className="block text-gray-600 hover:text-gray-900">Features</Link>
                  <Link href="/ai-receptionist" className="block text-gray-600 hover:text-gray-900">AI Receptionist</Link>
                  <Link href="/professional-services" className="block text-gray-600 hover:text-gray-900">Professional Services</Link>
                  <Link href="/onboarding" className="block text-gray-600 hover:text-gray-900">Onboarding</Link>
                  <Link href="/pricing" className="block text-gray-600 hover:text-gray-900">Pricing</Link>
                  <Link href="/demo" className="block text-gray-600 hover:text-gray-900">Proposal</Link>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-gray-400 mb-3">Resources</div>
                <div className="space-y-2 text-sm">
                  <Link href="/hoa-laws" className="block text-gray-600 hover:text-gray-900">HOA Laws by State</Link>
                  <Link href="/local" className="block text-gray-600 hover:text-gray-900">Locations</Link>
                  <Link href="/compare/appfolio-alternative" className="block text-gray-600 hover:text-gray-900">AppFolio Alternative</Link>
                  <Link href="/compare/buildium-alternative" className="block text-gray-600 hover:text-gray-900">Buildium Alternative</Link>
                  <Link href="/legal/security" className="block text-gray-600 hover:text-gray-900">Security</Link>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-gray-400 mb-3">Company</div>
                <div className="space-y-2 text-sm">
                  <Link href="/company" className="block text-gray-600 hover:text-gray-900">About</Link>
                  <Link href="/customers/stellar-property-management" className="block text-gray-600 hover:text-gray-900">Customer Story</Link>
                  <Link href="/contact" className="block text-gray-600 hover:text-gray-900">Contact</Link>
                  <Link href="/login" className="block text-gray-600 hover:text-gray-900">Sign in</Link>
                  <Link href="/login?mode=company_admin" className="block text-gray-600 hover:text-gray-900">Company admin</Link>
                  <Link href="/login?mode=admin" className="block text-gray-600 hover:text-gray-900">Operator</Link>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-gray-400 mb-3">Legal</div>
                <div className="space-y-2 text-sm">
                  <Link href="/legal/privacy" className="block text-gray-600 hover:text-gray-900">Privacy</Link>
                  <Link href="/legal/terms" className="block text-gray-600 hover:text-gray-900">Terms</Link>
                  <Link href="/legal/security" className="block text-gray-600 hover:text-gray-900">Security</Link>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-gray-200 text-xs text-gray-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <span>&copy; {new Date().getFullYear()} Portier369. All rights reserved.</span>
            <div className="flex items-center gap-4">
              <Link href="/legal/privacy" className="hover:text-gray-600">Privacy</Link>
              <Link href="/legal/terms" className="hover:text-gray-600">Terms</Link>
              <Link href="/legal/security" className="hover:text-gray-600">Security</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
