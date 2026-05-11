// Editorial split-pane shell for /login, /signup, /accept-invitation,
// /forgot-password, and /reset-password.
//
// Tenant-aware: when reached via a tenant subdomain or custom domain
// (e.g. beacon.portier369.com), the right-side concierge panel and the
// header logo switch to the tenant's company name + uploaded logo.
// Pure portier369.com / preview / localhost stays branded as Portier.

import Link from 'next/link';
import { ManageOpsLogo } from '@/components/brand/manageops-logo';
import { currentTenant } from '@/lib/tenant/server';

export const dynamic = 'force-dynamic';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const tenant = await currentTenant();

  // Display strings — tenant brand or Portier default
  const companyName = tenant?.company_name ?? 'Portier';
  const conciergeHeadline = tenant
    ? <>Welcome back to<br /><span className="italic text-champagne-300">{tenant.company_name}.</span></>
    : <>A concierge<br /><span className="italic text-champagne-300">for your portfolio.</span></>;
  const conciergeBody = tenant
    ? `Sign in to your ${tenant.company_name} workspace to settle ledgers, dispatch maintenance, and keep boards quietly informed.`
    : 'Sign in to your workspace to settle ledgers, dispatch maintenance, and keep boards quietly informed. Your team will be glad you did.';
  const quoteAttrib = tenant
    ? `${tenant.company_name} · powered by Portier`
    : 'Margaret Devlin · Beacon Hill Management';

  return (
    <div className="flex min-h-screen bg-cream-50 text-ink-800">
      {/* Form side */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between px-8 py-6">
          <Link href="/" className="inline-flex items-center gap-3">
            {tenant?.logo_url ? (
              <img
                src={tenant.logo_url}
                alt={`${tenant.company_name} logo`}
                className="h-8 w-auto max-w-[140px] object-contain"
              />
            ) : null}
            {tenant ? (
              <span className="font-display text-base font-medium tracking-editorial text-ink-900">
                {tenant.company_name}
              </span>
            ) : (
              <ManageOpsLogo size="sm" />
            )}
          </Link>
          <Link
            href="/"
            className="text-sm text-ink-600 underline decoration-ink-200 underline-offset-4 hover:text-champagne-700 hover:decoration-champagne-400 transition-colors"
          >
            ← Back to home
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className="w-full max-w-xl">{children}</div>
        </main>

        <footer className="border-t border-ink-100 px-8 py-5 text-xs text-ink-500">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>© {new Date().getFullYear()} {companyName} · powered by Portier</span>
            <span>
              <Link href="/legal/privacy" className="hover:text-champagne-700 transition-colors">Privacy</Link>
              <span className="mx-2 text-ink-300">·</span>
              <Link href="/legal/terms" className="hover:text-champagne-700 transition-colors">Terms</Link>
            </span>
          </div>
        </footer>
      </div>

      {/* Concierge panel — only on wide screens */}
      <aside
        className="relative hidden w-[42%] max-w-[640px] flex-shrink-0 overflow-hidden bg-ink-gradient text-cream-100 lg:block print:hidden"
        aria-hidden="true"
      >
        {/* Champagne hairline running down the inside edge */}
        <span className="absolute left-0 top-0 h-full w-px bg-champagne-500/40" />

        <div className="flex h-full flex-col justify-between px-12 py-14">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-champagne-200">
              {tenant ? tenant.company_name : 'Portier'}
            </div>
            <h2 className="mt-6 font-display text-4xl tracking-editorial text-cream-50">
              {conciergeHeadline}
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-cream-300">
              {conciergeBody}
            </p>
          </div>

          <div className="space-y-7">
            <figure>
              <blockquote className="font-display text-lg italic leading-relaxed text-cream-100">
                “Onboarding three associations took an afternoon. The dashboards
                read like our annual report — our board chair noticed first.”
              </blockquote>
              <figcaption className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-champagne-200">
                {quoteAttrib}
              </figcaption>
            </figure>

            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md bg-white/10">
              <div className="bg-ink-900/50 px-3 py-3">
                <div className="font-display text-xl text-cream-50 number-plate">1,200+</div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cream-400">units</div>
              </div>
              <div className="bg-ink-900/50 px-3 py-3">
                <div className="font-display text-xl text-cream-50 number-plate">$3M+</div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cream-400">processed</div>
              </div>
              <div className="bg-ink-900/50 px-3 py-3">
                <div className="font-display text-xl text-cream-50 number-plate">99.98%</div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cream-400">uptime</div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
