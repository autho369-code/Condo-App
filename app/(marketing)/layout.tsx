import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PortierLogo } from '@/components/brand/manageops-logo';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  let user: any = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Render the marketing site even if auth lookup fails
  }

  return (
    <div className="min-h-screen bg-cream-50 text-ink-800">
      <header className="sticky top-0 z-40 border-b border-ink-100/70 bg-cream-50/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/">
            <PortierLogo size="sm" />
          </Link>
          <nav className="hidden items-center gap-7 text-sm md:flex">
            <Link href="/#features" className="text-ink-700 hover:text-champagne-700 transition-colors">Platform</Link>
            <Link href="/#pricing" className="text-ink-700 hover:text-champagne-700 transition-colors">Pricing</Link>
            <Link href="/services" className="text-ink-700 hover:text-champagne-700 transition-colors">Services</Link>
            <Link href="/why-switch" className="text-ink-700 hover:text-champagne-700 transition-colors">Why switch</Link>
            <Link href="/#faq" className="text-ink-700 hover:text-champagne-700 transition-colors">Questions</Link>
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/dashboard">
                <Button size="sm" variant="primary">Open workspace</Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button size="sm" variant="outline">Sign in</Button>
                </Link>
                <Link href="/request-access">
                  <Button size="sm" variant="primary">Plan migration</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-ink-100 bg-ink-gradient text-cream-200">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="grid gap-10 md:grid-cols-4">
            <div className="md:col-span-2">
              <PortierLogo size="md" tone="light" />
              <p className="mt-5 max-w-md text-sm leading-relaxed text-cream-300/90">
                Modern property management operations with concierge onboarding.
                Replace AppFolio and Buildium without painful migrations,
                broken workflows, or weeks of setup.
              </p>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-cream-400">Platform</div>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li><Link href="/#features" className="hover:text-champagne-200 transition-colors">Features</Link></li>
                <li><Link href="/#pricing" className="hover:text-champagne-200 transition-colors">Pricing</Link></li>
                <li><Link href="/services" className="hover:text-champagne-200 transition-colors">Services</Link></li>
                <li><Link href="/why-switch" className="hover:text-champagne-200 transition-colors">Why switch</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-cream-400">Get started</div>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li><Link href="/request-access" className="hover:text-champagne-200 transition-colors">Plan your migration</Link></li>
                <li><Link href="/request-access?intent=quote" className="hover:text-champagne-200 transition-colors">Migration quote</Link></li>
                <li><Link href="/login" className="hover:text-champagne-200 transition-colors">Sign in</Link></li>
                <li><a href="mailto:hello@portier369.com" className="hover:text-champagne-200 transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-cream-400">
            <span>© {new Date().getFullYear()} Portier · Property operations, refined.</span>
            <span className="font-display italic text-cream-300">14-day migration guarantee</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
