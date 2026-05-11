// =============================================================================
// Server-component tenant helper
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

/**
 * Returns the tenant for the current request, or null if:
 *   - the host doesn't resolve to a tenant (apex / preview / localhost)
 *   - SUPABASE_SERVICE_ROLE_KEY isn't configured (gracefully degrades)
 *   - the lookup throws for any reason (logged, returns null)
 */
export async function currentTenant(): Promise<CurrentTenant> {
  // Bail early if the service role isn't wired up. This lets the redesign
  // ship to environments where the env var hasn't been set yet without
  // crashing every server render that touches the layout.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

  let slug: string | null;
  try {
    const h = await headers();
    slug = tenantSlugFromHeaders(h);
  } catch {
    return null;
  }
  if (!slug) return null;

  try {
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
  } catch (err) {
    console.warn('[currentTenant]', err);
    return null;
  }
}

/** Compose a single-line address string, dropping empty parts cleanly. */
export function formatTenantAddress(t: NonNullable<CurrentTenant>): string {
  const cityState = [t.address_city, t.address_state].filter(Boolean).join(', ');
  return [t.address_street, [cityState, t.address_zip].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(' · ');
}
