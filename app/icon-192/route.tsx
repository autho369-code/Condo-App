import { renderAppIcon } from '@/lib/brand/app-icon'
import { requestIconBrand } from '@/lib/brand/request-icon'

// Installed-app icon: the company's on its own address (per request).
export async function GET() {
  return renderAppIcon(192, false, await requestIconBrand())
}
