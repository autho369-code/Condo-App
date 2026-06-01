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
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 md:grid-cols-4">
            {/* Brand */}
            <div>
              <span className="text-lg font-semibold text-white">Portier</span>
              <p className="mt-2 text-sm text-slate-400">The operating system for condominium &amp; HOA management.</p>
              <div className="mt-4 space-y-1 text-xs text-slate-400">
                <p>Chicago, Illinois</p>
                <p>Headquarters</p>
              </div>
              <a href="mailto:hello@portier369.com" className="mt-3 inline-block text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
                hello@portier369.com
              </a>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">Legal</h4>
              <nav className="flex flex-col gap-2.5">
                <Link href="/legal/privacy" className="text-sm text-slate-400 transition-colors hover:text-white">Privacy Policy</Link>
                <Link href="/legal/terms" className="text-sm text-slate-400 transition-colors hover:text-white">Terms of Service</Link>
                <Link href="/legal/cookies" className="text-sm text-slate-400 transition-colors hover:text-white">Cookie Policy</Link>
                <Link href="/legal/acceptable-use" className="text-sm text-slate-400 transition-colors hover:text-white">Acceptable Use Policy</Link>
                <Link href="/legal/dpa" className="text-sm text-slate-400 transition-colors hover:text-white">Data Processing Agreement</Link>
              </nav>
            </div>

            {/* Security & Trust */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">Security &amp; Trust</h4>
              <nav className="flex flex-col gap-2.5">
                <Link href="/trust" className="text-sm text-slate-400 transition-colors hover:text-white">Trust Center</Link>
                <Link href="/trust/security" className="text-sm text-slate-400 transition-colors hover:text-white">Security</Link>
                <Link href="/trust/security-whitepaper" className="text-sm text-slate-400 transition-colors hover:text-white">Security Whitepaper</Link>
                <Link href="/trust/incident-response" className="text-sm text-slate-400 transition-colors hover:text-white">Incident Response Policy</Link>
                <Link href="/trust/disaster-recovery" className="text-sm text-slate-400 transition-colors hover:text-white">Disaster Recovery Policy</Link>
                <Link href="/trust/vulnerability-disclosure" className="text-sm text-slate-400 transition-colors hover:text-white">Vulnerability Disclosure Program</Link>
                <Link href="/trust/ai-usage" className="text-sm text-slate-400 transition-colors hover:text-white">AI Usage Policy</Link>
                <Link href="/trust/responsible-ai" className="text-sm text-slate-400 transition-colors hover:text-white">Responsible AI Statement</Link>
              </nav>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">Company</h4>
              <nav className="flex flex-col gap-2.5">
                <Link href="/#pricing" className="text-sm text-slate-400 transition-colors hover:text-white">Pricing</Link>
                <Link href="/login" className="text-sm text-slate-400 transition-colors hover:text-white">Sign in</Link>
                <Link href="/legal/accessibility" className="text-sm text-slate-400 transition-colors hover:text-white">Accessibility</Link>
                <Link href="/status" className="text-sm text-slate-400 transition-colors hover:text-white">System Status</Link>
                <Link href="/#contact" className="text-sm text-slate-400 transition-colors hover:text-white">Contact Support</Link>
              </nav>
            </div>
          </div>

          <div className="mt-12 border-t border-slate-800 pt-8 text-xs text-slate-700">
            &copy; 2026 Portier. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
