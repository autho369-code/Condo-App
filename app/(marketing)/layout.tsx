import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-[#060B18]">
      <header className="sticky top-0 z-50 border-b border-slate-800/50 bg-[#060B18]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center">
            <span className="text-xl font-semibold tracking-tight text-white">
              Portier
            </span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <Link href="/#features" className="text-sm font-medium text-slate-400 transition-colors hover:text-white">Features</Link>
            <Link href="/pricing" className="text-sm font-medium text-slate-400 transition-colors hover:text-white">Pricing</Link>
            <Link href="/#faq" className="text-sm font-medium text-slate-400 transition-colors hover:text-white">FAQ</Link>
            <Link href="/contact" className="text-sm font-medium text-slate-400 transition-colors hover:text-white">Contact</Link>
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/dashboard" className="inline-flex h-10 items-center rounded-lg bg-emerald-500 px-5 text-sm font-semibold text-black transition-all hover:bg-emerald-400">
                Dashboard &rarr;
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium text-slate-400 transition-colors hover:text-white">
                  Sign in
                </Link>
                <Link href="/signup" className="inline-flex h-10 items-center rounded-lg bg-emerald-500 px-5 text-sm font-semibold text-black transition-all hover:bg-emerald-400">
                  Start free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-slate-800">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-wrap items-center justify-between gap-6 text-sm">
            <div>
              <span className="text-lg font-semibold text-white">Portier</span>
              <p className="mt-1 text-slate-500">The operating system for condominium &amp; HOA management.</p>
            </div>
            <div className="flex gap-8">
              <Link href="/pricing" className="text-slate-500 transition-colors hover:text-white">Pricing</Link>
              <Link href="/login" className="text-slate-500 transition-colors hover:text-white">Sign in</Link>
              <Link href="/contact" className="text-slate-500 transition-colors hover:text-white">Contact</Link>
            </div>
          </div>
          <div className="mt-8 text-xs text-slate-700">
            &copy; {new Date().getFullYear()} Portier.
          </div>
        </div>
      </footer>
    </div>
  );
}
