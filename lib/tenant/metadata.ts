// White-label page metadata: the browser tab, installed-app name and link
// previews of a company's pages carry the company's name, not the platform's
// (the "Powered by Portier369" line in the page body stays). Used by the
// layouts of every company-facing section; the marketing site and the
// platform-operator area keep the root metadata.
import { cache } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { tenantFromHeaders } from '@/lib/tenant/resolve';

/** Metadata for pages shown under a company's name. */
export function brandedMetadata(companyName: string): Metadata {
  const name = companyName.trim();
  return {
    title: { template: `%s · ${name}`, default: name },
    applicationName: name,
    appleWebApp: { capable: true, title: name, statusBarStyle: 'default' },
    openGraph: { siteName: name, title: name },
    twitter: { title: name },
  };
}

// The signed-in user's company name, read without getMe()'s side effects
// (sign-out, redirects): metadata must never change the session. One lookup
// per request however many layouts ask.
const signedInCompanyName = cache(async (): Promise<string | null> => {
  try {
    const supabase = await createClient();
    const { data } = await (supabase as any).rpc('me');
    const name = data?.portfolio?.company_name ?? data?.portfolio?.name;
    return typeof name === 'string' && name.trim() ? name.trim() : null;
  } catch {
    return null;
  }
});

/**
 * The company whose pages these are: the workspace address or custom domain
 * the request came in on, else the signed-in user's company. Null on the
 * platform's own address for someone without a company (keeps the defaults).
 */
export async function workspaceCompanyName(): Promise<string | null> {
  const tenant = tenantFromHeaders(await headers());
  if (tenant?.companyName && tenant.portfolioId) return tenant.companyName;
  return signedInCompanyName();
}

/** generateMetadata for a company-facing layout. */
export async function workspaceMetadata(): Promise<Metadata> {
  const name = await workspaceCompanyName();
  return name ? brandedMetadata(name) : {};
}

/**
 * generateMetadata for sign-in pages: branded only on a company's own
 * address (the platform login stays Portier369), and kept out of search
 * results there.
 */
export async function signInMetadata(): Promise<Metadata> {
  const tenant = tenantFromHeaders(await headers());
  if (!tenant?.portfolioId) return {};
  return { ...brandedMetadata(tenant.companyName), robots: { index: false, follow: false } };
}

/**
 * generateMetadata for signed-in steps of sign-in (two-factor): the person
 * already belongs to a company, so the signed-in fallback applies on the
 * platform address too. Kept out of search results.
 */
export async function signedInStepMetadata(): Promise<Metadata> {
  const name = await workspaceCompanyName();
  return name ? { ...brandedMetadata(name), robots: { index: false, follow: false } } : {};
}
