import 'server-only';
import { headers } from 'next/headers';
import { sameHostTenantUrl } from '@/lib/tenant/host';
import { tenantFromHeaders } from '@/lib/tenant/resolve';

/**
 * A URL on the address this request came in on, when that address belongs to
 * `company` (its custom domain or workspace subdomain), else on the company's
 * workspace address. For links back from payment pages, so the user returns
 * to where they are signed in.
 */
export async function sameHostCompanyUrl(
  company: { id?: string | null; slug?: string | null } | null | undefined,
  path: string,
) {
  const tenant = tenantFromHeaders(await headers());
  const target = tenant && company?.id && tenant.portfolioId === company.id
    ? tenant
    : { slug: company?.slug ?? null };
  return sameHostTenantUrl(target, path);
}
