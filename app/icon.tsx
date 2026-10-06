import { renderAppIcon } from '@/lib/brand/app-icon'
import { requestIconBrand } from '@/lib/brand/request-icon'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

// Browser-tab icon: the company's initial on its own address.
export default async function Icon() {
  return renderAppIcon(size.width, false, await requestIconBrand())
}
