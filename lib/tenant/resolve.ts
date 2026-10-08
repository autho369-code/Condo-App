/**
 * Tenant resolution — maps subdomain or custom domain to a portfolio.
 *
 * Resolution order:
 *   1. Custom domain match  (CNAME → portfolios.custom_domain)
 *   2. Subdomain match      (slug.portier369.com → portfolios.slug)
 *   3. Default / apex       (portier369.com → standard auth flow)
 */
import { createClient } from '@/lib/supabase/server';
import { hasVisibleText } from '@/lib/company-admin/settings';

export type TenantBranding = {
  portfolioId: string;
  slug: string | null;
  hostname: string | null;
  companyName: string;
  logoUrl: string | null;
  brandColor: string;
  supportEmail: string | null;
  supportPhone: string | null;
  publicWebsite: string | null;
};

const APEX_DOMAIN = process.env.NEXT_PUBLIC_APEX_DOMAIN || 'portier369.com';

/**
 * Shown on a company's own pages only if its name is somehow unavailable
 * (company_name is NOT NULL, so this means a missing or garbled header).
 * White label: never fall back to the platform's name on a client's pages.
 */
export { NEUTRAL_COMPANY_NAME } from '@/lib/tenant/neutral-name';
import { NEUTRAL_COMPANY_NAME } from '@/lib/tenant/neutral-name';

/**
 * Resolve a tenant from the request hostname.
 * Returns null for apex domain (no tenant-specific branding — use default Portier branding).
 */
export async function resolveTenant(hostname: string): Promise<TenantBranding | null> {
  // Always treat apex domain as the platform-level view
  const clean = hostname.split(':')[0].toLowerCase();
  if (clean === APEX_DOMAIN || clean === 'localhost' || clean.startsWith('127.') || clean.startsWith('192.')) {
    return null;
  }

  const supabase = await createClient();

  // Branding via a SECURITY DEFINER function that returns ONLY branding columns,
  // so anon never needs SELECT on the full portfolios row (which holds secrets
  // like ai_api_key). Matches custom_domain (preferred) or subdomain slug.
  const slug = clean.endsWith(`.${APEX_DOMAIN}`) ? clean.replace(`.${APEX_DOMAIN}`, '') : null;
  const { data: rows } = await (supabase as any)
    .rpc('tenant_branding', { p_host: clean, p_slug: slug });
  const row = rows?.[0];
  if (row) return mapBranding(row, clean);
  return null;
}

function mapBranding(row: any, hostname: string): TenantBranding {
  return {
    portfolioId: row.id,
    slug: row.slug ?? null,
    hostname,
    companyName: hasVisibleText(row.company_name) ? row.company_name.trim() : NEUTRAL_COMPANY_NAME,
    logoUrl: row.logo_url ?? null,
    brandColor: row.brand_color ?? '#10B981',
    supportEmail: row.support_email ?? null,
    supportPhone: row.support_phone ?? null,
    publicWebsite: row.public_website ?? null,
  };
}

/**
 * Read tenant branding from request headers (set by middleware).
 * Use in server components that don't have access to the request hostname.
 */
export function tenantFromHeaders(headers: Headers): TenantBranding | null {
  const id = headers.get('x-portfolio-id');
  if (!id) return null;
  return {
    portfolioId: id,
    slug: headers.get('x-portfolio-slug') || null,
    hostname: headers.get('x-tenant-host') || null,
    companyName: readHeader(headers, 'x-portfolio-name')?.trim() || NEUTRAL_COMPANY_NAME,
    logoUrl: readHeader(headers, 'x-portfolio-logo'),
    brandColor: headers.get('x-portfolio-color') ?? '#10B981',
    supportEmail: readHeader(headers, 'x-portfolio-support-email'),
    supportPhone: readHeader(headers, 'x-portfolio-support-phone'),
    publicWebsite: readHeader(headers, 'x-portfolio-website'),
  };
}

function readHeader(headers: Headers, name: string) {
  const value = headers.get(name);
  if (!value) return null;
  try { return decodeURIComponent(value); }
  catch { return null; }
}
