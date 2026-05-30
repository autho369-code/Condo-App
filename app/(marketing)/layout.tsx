import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur-[12px]">
        <div className="mx-auto flex max-w-[1080px] items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center">
            <span className="text-[22px] font-light tracking-[-0.02em] text-navy-600">
              Portier
            </span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <Link href="/#features" className="text-[14px] font-normal text-navy-600 transition-colors hover:text-brand-500">Features</Link>
            <Link href="/pricing" className="text-[14px] font-normal text-navy-600 transition-colors hover:text-brand-500">Pricing</Link>
            <Link href="/#faq" className="text-[14px] font-normal text-navy-600 transition-colors hover:text-brand-500">FAQ</Link>
            <Link href="/contact" className="text-[14px] font-normal text-navy-600 transition-colors hover:text-brand-500">Contact</Link>
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/dashboard" className="btn-primary">
                Dashboard &rarr;
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-[14px] font-normal text-navy-600 transition-colors hover:text-brand-500">
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
      <footer className="border-t border-border">
        <div className="mx-auto max-w-[1080px] px-6 py-10">
          <div className="flex flex-wrap items-center justify-between gap-6 text-[14px]">
            <div>
              <span className="text-[18px] font-light text-navy-600">Portier</span>
              <p className="mt-1 text-slate-400">HOA &amp; condo management, reimagined.</p>
            </div>
            <div className="flex gap-6">
              <Link href="/pricing" className="text-slate-400 transition-colors hover:text-navy-600">Pricing</Link>
              <Link href="/login" className="text-slate-400 transition-colors hover:text-navy-600">Sign in</Link>
              <Link href="/contact" className="text-slate-400 transition-colors hover:text-navy-600">Contact</Link>
            </div>
          </div>
          <div className="mt-6 text-[12px] text-slate-400">
            &copy; {new Date().getFullYear()} Portier.
          </div>
        </div>
      </footer>
    </div>
  );
}
