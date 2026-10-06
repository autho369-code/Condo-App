import { headers } from 'next/headers'
import { tenantFromHeaders } from '@/lib/tenant/resolve'
import { PLATFORM_ICON, companyIconBrand, type IconBrand } from '@/lib/brand/app-icon'

/** The icon for this request: the company's on its own address, else the platform's. */
export async function requestIconBrand(): Promise<IconBrand> {
  const tenant = tenantFromHeaders(await headers())
  return tenant?.portfolioId ? companyIconBrand(tenant.companyName, tenant.brandColor) : PLATFORM_ICON
}
