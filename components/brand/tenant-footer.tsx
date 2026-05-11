// Editorial footer for resident-facing pages. Renders the tenant's brand
// block (logo or wordmark, address, phone, email, website) with a discreet
// "powered by Portier" microline.
//
// Pass the resolved CurrentTenant; falls back gracefully when null
// (apex / preview hosts) — in that case shows generic Portier credits.
import Link from 'next/link';
import type { CurrentTenant } from '@/lib/tenant/server';
import { formatTenantAddress } from '@/lib/tenant/server';
import { ManageOpsLogo } from '@/components/brand/manageops-logo';

export function TenantFooter({ tenant }: { tenant: CurrentTenant }) {
  const year = new Date().getFullYear();

  // No tenant context (apex / preview) — fall back to a Portier-branded line
  if (!tenant) {
    return (
      <footer className="mt-16 border-t border-ink-100 px-8 py-6 text-xs text-ink-500">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <ManageOpsLogo size="sm" />
          <span>© {year} Portier · Property operations, refined.</span>
        </div>
      </footer>
    );
  }

  const address = formatTenantAddress(tenant);

  return (
    <footer className="mt-16 border-t border-ink-100">
      <div className="mx-auto max-w-5xl px-8 py-10">
        {/* Top row: brand mark + company name */}
        <div className="flex flex-wrap items-center gap-4">
          {tenant.logo_url ? (
            <img
              src={tenant.logo_url}
              alt={`${tenant.company_name} logo`}
              className="h-9 w-auto max-w-[160px] object-contain"
            />
          ) : null}
          <div className="font-display text-lg tracking-editorial text-ink-900">
            {tenant.company_name}
          </div>
        </div>

        {/* Brand details — three columns on wide screens */}
        <dl className="mt-6 grid gap-x-8 gap-y-4 text-sm md:grid-cols-3">
          {address && (
            <div>
              <dt className="eyebrow">Office</dt>
              <dd className="mt-1.5 text-ink-700 leading-relaxed whitespace-pre-line">
                {address.replace(/ · /g, '\n')}
              </dd>
            </div>
          )}

          <div>
            <dt className="eyebrow">Reach us</dt>
            <dd className="mt-1.5 space-y-1 text-ink-700">
              {tenant.phone_number && (
                <div>
                  <a
                    href={`tel:${tenant.phone_number.replace(/[^\d+]/g, '')}`}
                    className="hover:text-champagne-700 transition-colors"
                  >
                    {tenant.phone_number}
                  </a>
                </div>
              )}
              {tenant.brand_email && (
                <div>
                  <a
                    href={`mailto:${tenant.brand_email}`}
                    className="underline decoration-champagne-300 underline-offset-4 hover:decoration-champagne-500 hover:text-champagne-700 transition-colors"
                  >
                    {tenant.brand_email}
                  </a>
                </div>
              )}
            </dd>
          </div>

          {tenant.website && (
            <div>
              <dt className="eyebrow">Online</dt>
              <dd className="mt-1.5 text-ink-700">
                <a
                  href={tenant.website}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-champagne-300 underline-offset-4 hover:decoration-champagne-500 hover:text-champagne-700 transition-colors"
                >
                  {tenant.website.replace(/^https?:\/\//, '')}
                </a>
              </dd>
            </div>
          )}
        </dl>

        {/* Microline */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4 text-[11px] uppercase tracking-[0.16em] text-ink-500">
          <span>© {year} {tenant.company_name}</span>
          <span className="inline-flex items-center gap-2">
            <span className="text-ink-400">Workspace by</span>
            <Link href="https://portier369.com" className="font-medium text-ink-700 hover:text-champagne-700 transition-colors">
              Portier
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
