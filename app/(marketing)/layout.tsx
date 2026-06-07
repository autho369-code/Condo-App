import Link from 'next/link'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 bg-white sticky top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1E3A5F] text-sm font-bold text-white">P</div>
            <span className="text-lg font-semibold text-gray-900">Portier369</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm md:flex">
            <Link href="/pricing" className="text-gray-600 hover:text-gray-900 transition">Pricing</Link>
            <Link href="/demo" className="text-gray-600 hover:text-gray-900 transition">Demo</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">Sign in</Link>
            <Link href="/demo" className="inline-flex h-9 items-center rounded-lg bg-[#1E3A5F] px-4 text-sm font-medium text-white hover:bg-[#162D4A] transition">
              Request demo
            </Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded bg-[#1E3A5F] text-xs font-bold text-white">P</div>
                <span className="font-semibold text-gray-800">Portier369</span>
              </div>
              <p className="text-sm text-gray-500 max-w-xs">The operating system for condominium and HOA management.</p>
            </div>
            <div className="flex gap-12">
              <div>
                <div className="text-xs font-semibold uppercase text-gray-400 mb-3">Product</div>
                <div className="space-y-2 text-sm">
                  <Link href="/pricing" className="block text-gray-600 hover:text-gray-900">Pricing</Link>
                  <Link href="/demo" className="block text-gray-600 hover:text-gray-900">Demo</Link>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-gray-400 mb-3">Company</div>
                <div className="space-y-2 text-sm">
                  <a href="mailto:hello@portier369.com" className="block text-gray-600 hover:text-gray-900">Contact</a>
                  <Link href="/login" className="block text-gray-600 hover:text-gray-900">Sign in</Link>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-gray-200 text-xs text-gray-400 flex items-center justify-between">
            <span>&copy; {new Date().getFullYear()} Portier369</span>
            <span className="text-gray-500">Powered by <span className="font-semibold">Portier369</span></span>
          </div>
        </div>
      </footer>
    </div>
  )
}
