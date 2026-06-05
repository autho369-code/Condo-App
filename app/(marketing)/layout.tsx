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
            <Link href="/#features" className="text-sm font-semibold text-white transition-colors hover:text-emerald-400">Features</Link>
            <Link href="/#pricing" className="text-sm font-semibold text-white transition-colors hover:text-emerald-400">Pricing</Link>
            <Link href="/#faq" className="text-sm font-semibold text-white transition-colors hover:text-emerald-400">FAQ</Link>
            <Link href="/#contact" className="text-sm font-semibold text-white transition-colors hover:text-emerald-400">Contact</Link>
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/dashboard" className="inline-flex h-10 items-center rounded-lg bg-emerald-500 px-5 text-sm font-semibold text-black transition-all hover:bg-emerald-400">
                Dashboard &rarr;
              </Link>
            ) : (
              <Link href="/login" className="inline-flex h-10 items-center rounded-lg bg-emerald-500 px-5 text-sm font-semibold text-black transition-all hover:bg-emerald-400">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-slate-800 bg-[#060B18]">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div>
              <span className="text-lg font-semibold text-white">Portier</span>
              <p className="mt-1.5 text-sm text-slate-400">The operating system for condominium &amp; HOA management.</p>
              <a href="mailto:hello@portier369.com" className="mt-2 inline-block text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
                hello@portier369.com
              </a>
            </div>
            <nav className="flex flex-wrap gap-6 text-sm">
              <Link href="/#pricing" className="text-slate-400 transition-colors hover:text-white">Pricing</Link>
              <Link href="/#contact" className="text-slate-400 transition-colors hover:text-white">Contact</Link>
              <Link href="/login" className="text-slate-400 transition-colors hover:text-white">Sign In</Link>
            </nav>
          </div>
          <div className="mt-8 border-t border-slate-800 pt-6 text-xs text-slate-600">
            &copy; 2026 Portier. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
