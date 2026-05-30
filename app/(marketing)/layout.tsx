import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-brand-600 text-center font-bold leading-8 text-white">C</div>
            <span className="text-lg font-semibold">condo-app</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm md:flex">
            <Link href="/#features" className="text-gray-700 hover:text-gray-900">Features</Link>
            <Link href="/#pricing" className="text-gray-700 hover:text-gray-900">Pricing</Link>
            <Link href="/#faq" className="text-gray-700 hover:text-gray-900">FAQ</Link>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Link href="/dashboard"
                className="inline-flex h-9 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
                Go to app →
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm text-gray-700 hover:text-gray-900">Sign in</Link>
                <Link href="/signup"
                  className="inline-flex h-9 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
                  Start free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-gray-600">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-brand-600 text-center text-xs font-bold leading-6 text-white">C</div>
              <span className="font-semibold text-gray-800">condo-app</span>
              <span>· HOA &amp; condo management, reimagined</span>
            </div>
            <div className="flex gap-6">
              <Link href="/pricing">Pricing</Link>
              <Link href="/login">Sign in</Link>
              <Link href="/contact">Contact</Link>
            </div>
          </div>
          <div className="mt-6 text-xs text-gray-400">© {new Date().getFullYear()} · Built for the next generation of community managers.</div>
        </div>
      </footer>
    </div>
  );
}
