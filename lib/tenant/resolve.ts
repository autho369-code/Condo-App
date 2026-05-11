// =============================================================================
// Tenant resolution
// =============================================================================
// Single source of truth for "which management company is this URL serving?".
//
// Resolution order:
//   1. Custom vanity domain        managebeacon.com           → portfolios.custom_domain
//   2. Subdomain on the apex       beacon.portier369.com      → portfolios.slug
//   3. Apex / preview / localhost  portier369.com, *.vercel.app, localhost → null
//
// Returning `null` is a valid result — it means "this is the marketing apex
// or a developer preview, not a tenant URL." Pages are then expected to make
// their own decisions (marketing site, generic login, etc.).
// =============================================================================

import { createServiceClient } from '@/lib/supabase/server';

export const APEX_DOMAIN = process.env.NEXT_PUBLIC_PORTIER_APEX_DOMAIN ?? 'portier369.com';

/** Hosts that should never be treated as a tenant subdomain. */
const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'admin', 'platform', 'auth', 'mail', 'smtp']);

/** Hosts we consider "apex" (no tenant — show marketing or generic auth). */
function isApexHost(host: string): boolean {
  if (!host) return true;
  const h = host.toLowerCase();
  if (h === APEX_DOMAIN || h === `www.${APEX_DOMAIN}`) return true;
  if (h === 'localhost' || h.startsWith('localhost:')) return true;
  if (h.endsWith('.vercel.app')) return true;     // Vercel preview deploys
  if (h.endsWith('.localhost')) return false;      // *.localhost still resolves a tenant for local dev
  return false;
}

/** Pull the leading subdomain, e.g. "beacon" from "beacon.portier369.com". */
function leadingSubdomain(host: string): string | null {
  const h = host.toLowerCase().split(':')[0];
  // Vanity domain shape (no apex match) → no subdomain extraction
  if (!h.endsWith(`.${APEX_DOMAIN}`) && !h.endsWith('.localhost')) return null;
  const left = h.slice(0, h.lastIndexOf(`.${h.endsWith('.localhost') ? 'localhost' : APEX_DOMAIN}`));
  if (!left) return null;
  // Anything with dots (e.g. "internal.beacon") is multi-level and out of scope today
  if (left.includes('.')) return null;
  if (RESERVED_SUBDOMAINS.has(left)) return null;
  return left;
}

export type ResolvedTenant = {
  portfolio_id: string;
  slug: string;
  company_name: string;
} | null;

/**
 * Server-side resolver. Uses the service role so it can read portfolios
 * before the user is authenticated (the login page needs to know whose
 * brand to show).
 *
 * Cached per-host for the lifetime of a single request via a WeakMap on
 * `globalThis` — Next.js may invoke this from middleware AND from a server
 * component on the same render, and we don't want to double up.
 */
export async function resolveTenantFromHost(host: string | null | undefined): Promise<ResolvedTenant> {
  if (!host) return null;
  if (isApexHost(host)) return null;

  const sub = leadingSubdomain(host);
  const supa = createServiceClient();

  const { data, error } = await (supa as any).rpc('resolve_portfolio_for_host', { p_host: host });
  if (error) {
    console.warn('[resolveTenantFromHost]', error.message);
    return null;
  }
  const row = (data ?? [])[0];
  if (!row) return null;
  return {
    portfolio_id: row.id,
    slug: row.slug,
    company_name: row.company_name,
  };
}

/** Build the URL for a given tenant — useful in the platform console. */
export function tenantUrl(slug: string, path = '/dashboard') {
  const apex = APEX_DOMAIN;
  return `https://${slug}.${apex}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Reads the tenant slug a server component received from middleware. */
export function tenantSlugFromHeaders(headers: Headers): string | null {
  return headers.get('x-portier-tenant-slug');
}
