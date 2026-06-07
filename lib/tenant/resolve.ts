/**
 * Tenant resolution — maps subdomain or custom domain to a portfolio.
 *
 * Resolution order:
 *   1. Custom domain match  (CNAME → portfolios.custom_domain)
 *   2. Subdomain match      (slug.portier369.com → portfolios.slug)
 *   3. Default / apex       (portier369.com → standard auth flow)
 */
import { createClient } from '@/lib/supabase/server';

export type TenantBranding = {
  portfolioId: string;
  companyName: string;
  logoUrl: string | null;
  brandColor: string;
  supportEmail: string | null;
  supportPhone: string | null;
  publicWebsite: string | null;
};

const APEX_DOMAIN = process.env.NEXT_PUBLIC_APEX_DOMAIN || 'portier369.com';

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

  // 1. Try custom domain
  const { data: byDomain } = await (supabase as any)
    .from('portfolios')
    .select('id, company_name, logo_url, brand_color, support_email, support_phone, public_website')
    .eq('custom_domain', clean)
    .maybeSingle();

  if (byDomain) return mapBranding(byDomain);

  // 2. Try subdomain
  const slug = clean.replace(`.${APEX_DOMAIN}`, '');
  if (slug === clean) return null; // not a subdomain of ours

  const { data: bySlug } = await (supabase as any)
    .from('portfolios')
    .select('id, company_name, logo_url, brand_color, support_email, support_phone, public_website')
    .eq('slug', slug)
    .maybeSingle();

  if (bySlug) return mapBranding(bySlug);

  return null;
}

function mapBranding(row: any): TenantBranding {
  return {
    portfolioId: row.id,
    companyName: row.company_name ?? 'Portier',
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
    companyName: headers.get('x-portfolio-name') ?? 'Portier',
    logoUrl: headers.get('x-portfolio-logo') || null,
    brandColor: headers.get('x-portfolio-color') ?? '#10B981',
    supportEmail: headers.get('x-portfolio-support-email') || null,
    supportPhone: headers.get('x-portfolio-support-phone') || null,
    publicWebsite: headers.get('x-portfolio-website') || null,
  };
}
