// White-label page metadata: the browser tab, installed-app name and link
// previews of a company's pages carry the company's name, not the platform's
// (the "Powered by Portier369" line in the page body stays). Used by the
// layouts of every company-facing section; the marketing site and the
// platform-operator area keep the root metadata.
import { cache } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { tenantFromHeaders, type TenantBranding } from '@/lib/tenant/resolve';
import { classifyTenantHost, normalizeHostname, resolvedTenantUrl } from '@/lib/tenant/host';

const PREVIEW_ALT = 'HOA & condo management portal';

/**
 * Metadata for pages shown under a company's name. `previewImage` is the
 * absolute URL of the company's link-preview card (its own address): these
 * openGraph/twitter objects replace the root ones, whose image resolves to the
 * platform address and would show the platform's card.
 */
export function brandedMetadata(companyName: string, previewImage?: string | null): Metadata {
  const name = companyName.trim();
  const images = previewImage ? [{ url: previewImage, width: 1200, height: 630, alt: PREVIEW_ALT }] : undefined;
  return {
    title: { template: `%s · ${name}`, default: name },
    // The root layout's platform author, creator, sales description and SEO
    // keywords would otherwise carry through to the company's pages and
    // link previews.
    description: null,
    keywords: null,
    authors: null,
    creator: null,
    applicationName: name,
    appleWebApp: { capable: true, title: name, statusBarStyle: 'default' },
    openGraph: { siteName: name, title: name, ...(images ? { images } : {}) },
    twitter: { title: name, ...(images ? { card: 'summary_large_image' as const, images: [previewImage!] } : {}) },
  };
}

/**
 * The company's link-preview card on its own address: the custom domain the
 * page was served on (resolvedTenantUrl sends custom domains to the workspace
 * subdomain, which is right for sign-in callbacks but not for a public card),
 * else its workspace address.
 */
export function tenantPreviewImage(tenant: Pick<TenantBranding, 'hostname' | 'slug'>): string {
  const hostname = normalizeHostname(tenant.hostname);
  if (hostname && classifyTenantHost(hostname).kind === 'custom-domain') {
    return new URL('/opengraph-image', `https://${hostname}`).toString();
  }
  return resolvedTenantUrl(tenant, '/opengraph-image');
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
  return (await workspaceBrand())?.name ?? null;
}

/**
 * The company and, on its own address, its preview card. The signed-in
 * fallback on the platform address has no company card to point at.
 */
async function workspaceBrand(): Promise<{ name: string; previewImage: string | null } | null> {
  const tenant = tenantFromHeaders(await headers());
  if (tenant?.companyName && tenant.portfolioId) return { name: tenant.companyName, previewImage: tenantPreviewImage(tenant) };
  const name = await signedInCompanyName();
  return name ? { name, previewImage: null } : null;
}

/** generateMetadata for a company-facing layout. */
export async function workspaceMetadata(): Promise<Metadata> {
  const brand = await workspaceBrand();
  return brand ? brandedMetadata(brand.name, brand.previewImage) : {};
}

/**
 * generateMetadata for sign-in pages: branded only on a company's own
 * address (the platform login stays Portier369), and kept out of search
 * results there.
 */
export async function signInMetadata(): Promise<Metadata> {
  const tenant = tenantFromHeaders(await headers());
  if (!tenant?.portfolioId) return {};
  return { ...brandedMetadata(tenant.companyName, tenantPreviewImage(tenant)), robots: { index: false, follow: false } };
}

/**
 * generateMetadata for signed-in steps of sign-in (two-factor): the person
 * already belongs to a company, so the signed-in fallback applies on the
 * platform address too. Kept out of search results.
 */
export async function signedInStepMetadata(): Promise<Metadata> {
  const brand = await workspaceBrand();
  return brand ? { ...brandedMetadata(brand.name, brand.previewImage), robots: { index: false, follow: false } } : {};
}
