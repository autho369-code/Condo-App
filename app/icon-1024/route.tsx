import { renderAppIcon } from '@/lib/brand/app-icon'

// Source-of-truth 1024px app icon — used by store listings and by
// `npx capacitor-assets generate` in mobile/ (see mobile/README.md).
export const dynamic = 'force-static'

export function GET() {
  return renderAppIcon(1024)
}
