import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-cream-100">
      <header className="sticky top-0 z-50 border-b border-cream-200/80 bg-cream-100/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-serif text-2xl font-light tracking-tightest text-ink-900">
              Portier
            </span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm md:flex">
            <Link href="/#features" className="font-medium text-ink-500 transition-colors hover:text-ink-800">Features</Link>
            <Link href="/#pricing" className="font-medium text-ink-500 transition-colors hover:text-ink-800">Pricing</Link>
            <Link href="/#faq" className="font-medium text-ink-500 transition-colors hover:text-ink-800">FAQ</Link>
            <Link href="/contact" className="font-medium text-ink-500 transition-colors hover:text-ink-800">Contact</Link>
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/dashboard" className="btn-primary">
                Dashboard &rarr;
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium text-ink-500 transition-colors hover:text-ink-800">
                  Sign in
                </Link>
                <Link href="/signup" className="btn-primary">
                  Start free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-cream-200">
        <div className="mx-auto max-w-6xl px-6 py-12 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <span className="font-serif text-xl font-light text-ink-800">Portier</span>
              <p className="mt-1 text-ink-400">HOA &amp; condo management, reimagined.</p>
            </div>
            <div className="flex gap-8">
              <Link href="/pricing" className="text-ink-400 transition-colors hover:text-ink-700">Pricing</Link>
              <Link href="/login" className="text-ink-400 transition-colors hover:text-ink-700">Sign in</Link>
              <Link href="/contact" className="text-ink-400 transition-colors hover:text-ink-700">Contact</Link>
            </div>
          </div>
          <div className="mt-8 text-xs text-ink-300">
            &copy; {new Date().getFullYear()} Portier. Built for the next generation of community managers.
          </div>
        </div>
      </footer>
    </div>
  );
}
