import { renderAppIcon } from '@/lib/brand/app-icon'
import { requestIconBrand } from '@/lib/brand/request-icon'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// iOS applies its own corner mask, so the tile fills the full square.
export default async function AppleIcon() {
  return renderAppIcon(size.width, false, await requestIconBrand(), false)
}
