import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PortierLogo } from '@/components/brand/manageops-logo';
import { Button } from '@/components/ui/button';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-cream-50 text-ink-800">
      <header className="sticky top-0 z-40 border-b border-ink-100/70 bg-cream-50/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/">
            <PortierLogo size="sm" />
          </Link>
          <nav className="hidden items-center gap-9 text-sm md:flex">
            <Link href="/#features" className="text-ink-700 hover:text-champagne-700 transition-colors">Platform</Link>
            <Link href="/#pricing" className="text-ink-700 hover:text-champagne-700 transition-colors">Pricing</Link>
            <Link href="/#faq" className="text-ink-700 hover:text-champagne-700 transition-colors">Questions</Link>
            <Link href="/#contact" className="text-ink-700 hover:text-champagne-700 transition-colors">Contact</Link>
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/dashboard">
                <Button size="sm" variant="primary">Open workspace</Button>
              </Link>
            ) : (
              <>
                {/* Existing-customer sign-in is given a real button so it
                    reads as a peer to the primary CTA, not a dim afterthought. */}
                <Link href="/login">
                  <Button size="sm" variant="outline">Sign in</Button>
                </Link>
                <Link href="/request-access">
                  <Button size="sm" variant="primary">Request access</Button>
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
                A premium operating platform for community managers. Accounting,
                maintenance, and resident services — composed into a single,
                quietly-luxurious workspace.
              </p>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-cream-400">Platform</div>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li><Link href="/#features" className="hover:text-champagne-200 transition-colors">Features</Link></li>
                <li><Link href="/#pricing" className="hover:text-champagne-200 transition-colors">Pricing</Link></li>
                <li><Link href="/login" className="hover:text-champagne-200 transition-colors">Sign in</Link></li>
                <li><Link href="/request-access" className="hover:text-champagne-200 transition-colors">Request access</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-cream-400">Company</div>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li><a href="mailto:hello@portier369.com" className="hover:text-champagne-200 transition-colors">Contact</a></li>
                <li><Link href="/legal/privacy" className="hover:text-champagne-200 transition-colors">Privacy</Link></li>
                <li><Link href="/legal/terms" className="hover:text-champagne-200 transition-colors">Terms</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-cream-400">
            <span>© {new Date().getFullYear()} Portier, Property operations, refined.</span>
            <span className="font-display italic text-cream-300">Refined operations, modernized.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
