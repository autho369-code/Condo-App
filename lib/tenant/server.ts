// =============================================================================
// Server-component tenant helper
// =============================================================================
// Wraps `tenantSlugFromHeaders()` with a Supabase fetch so any server
// component can do:
//
//     import { currentTenant } from '@/lib/tenant/server';
//     const tenant = await currentTenant();
//     if (tenant) { /* show tenant.company_name + tenant.logo_url etc. */ }
//
// `null` is returned for the apex marketing site, preview deploys, and
// localhost — pages decide how to render generically in that case.
// =============================================================================

import { headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';
import { tenantSlugFromHeaders } from '@/lib/tenant/resolve';

export type CurrentTenant = {
  portfolio_id: string;
  slug: string;
  company_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  // Contact / brand identity (shown on portal footer, statements, etc.)
  brand_email: string | null;
  billing_email_from: string | null;
  phone_number: string | null;
  website: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
} | null;

const COLUMNS =
  'id, slug, company_name, logo_url, favicon_url, brand_email, billing_email_from, phone_number, website, address_street, address_city, address_state, address_zip';

/** Fetch the tenant scoped to this request, including brand assets + contact. */
export async function currentTenant(): Promise<CurrentTenant> {
  const h = await headers();
  const slug = tenantSlugFromHeaders(h);
  if (!slug) return null;

  const supa = createServiceClient();
  const { data, error } = await (supa as any)
    .from('portfolios')
    .select(COLUMNS)
    .eq('slug', slug)
    .is('archived_at', null)
    .maybeSingle();

  if (error || !data) return null;
  return {
    portfolio_id:       data.id,
    slug:               data.slug,
    company_name:       data.company_name,
    logo_url:           data.logo_url ?? null,
    favicon_url:        data.favicon_url ?? null,
    brand_email:        data.brand_email ?? null,
    billing_email_from: data.billing_email_from ?? null,
    phone_number:       data.phone_number ?? null,
    website:            data.website ?? null,
    address_street:     data.address_street ?? null,
    address_city:       data.address_city ?? null,
    address_state:      data.address_state ?? null,
    address_zip:        data.address_zip ?? null,
  };
}

/** Compose a single-line address string, dropping empty parts cleanly. */
export function formatTenantAddress(t: NonNullable<CurrentTenant>): string {
  const cityState = [t.address_city, t.address_state].filter(Boolean).join(', ');
  return [t.address_street, [cityState, t.address_zip].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(' · ');
}
