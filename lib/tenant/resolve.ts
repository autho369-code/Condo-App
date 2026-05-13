// =============================================================================
// Tenant resolution
// =============================================================================
// Resolves an incoming HTTP host to a portfolio for branding purposes.
// Returns `null` for the apex marketing site, preview deploys, and localhost,
// or when the service role key isn't configured (graceful degradation).
// =============================================================================

import { createServiceClient } from '@/lib/supabase/server';

export const APEX_DOMAIN = process.env.NEXT_PUBLIC_PORTIER_APEX_DOMAIN ?? 'portier369.com';

const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'admin', 'platform', 'auth', 'mail', 'smtp']);

function isApexHost(host: string): boolean {
  if (!host) return true;
  const h = host.toLowerCase();
  if (h === APEX_DOMAIN || h === `www.${APEX_DOMAIN}`) return true;
  if (h === 'localhost' || h.startsWith('localhost:')) return true;
  if (h.endsWith('.vercel.app')) return true;
  return false;
}

function leadingSubdomain(host: string): string | null {
  const h = host.toLowerCase().split(':')[0];
  if (!h.endsWith(`.${APEX_DOMAIN}`) && !h.endsWith('.localhost')) return null;
  const suffix = h.endsWith('.localhost') ? '.localhost' : `.${APEX_DOMAIN}`;
  const left = h.slice(0, h.lastIndexOf(suffix));
  if (!left) return null;
  if (left.includes('.')) return null;
  if (RESERVED_SUBDOMAINS.has(left)) return null;
  return left;
}

export type ResolvedTenant = {
  portfolio_id: string;
  slug: string;
  company_name: string;
} | null;

export async function resolveTenantFromHost(host: string | null | undefined): Promise<ResolvedTenant> {
  if (!host) return null;
  if (isApexHost(host)) return null;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

  try {
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
  } catch (err) {
    console.warn('[resolveTenantFromHost]', err);
    return null;
  }
}

export function tenantUrl(slug: string, path = '/dashboard') {
  const apex = APEX_DOMAIN;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `https://${apex}/t/${encodeURIComponent(slug)}${normalizedPath}`;
}

export function tenantSlugFromHeaders(headers: Headers): string | null {
  return headers.get('x-portier-tenant-slug');
}

// Re-exported for convenience; existing code uses `leadingSubdomain` only here
export { leadingSubdomain };
