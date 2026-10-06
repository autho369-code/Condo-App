import { ImageResponse } from 'next/og'

// Renders the app icon at any size. Used by the tab icon (app/icon.tsx), the
// Apple home-screen icon (app/apple-icon.tsx), the PWA manifest icon routes
// (/icon-192, /icon-512, /icon-512-maskable) and native asset generation
// (/icon-1024, see mobile/README.md).
//
// On a company's own address the icon is the company's initial on its brand
// colour (white label); everywhere else it is the platform's "P".
//
// `maskable` pads the mark into the 80% safe zone required by Android
// adaptive icons so nothing is clipped by circular masks.

const PLATFORM_BACKGROUND = 'linear-gradient(145deg, #24466f 0%, #1E3A5F 55%, #162D4A 100%)'

export type IconBrand = { glyph: string; background: string }

export const PLATFORM_ICON: IconBrand = { glyph: 'P', background: PLATFORM_BACKGROUND }

/** The company's icon: its first letter or digit on its brand colour (hex only; anything else keeps the platform colour). */
export function companyIconBrand(companyName: string | null | undefined, brandColor: string | null | undefined): IconBrand {
  const glyph = String(companyName ?? '').match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase()
  if (!glyph) return PLATFORM_ICON
  const color = String(brandColor ?? '').trim()
  return { glyph, background: /^#[0-9a-f]{6}$/i.test(color) ? color : PLATFORM_BACKGROUND }
}

export function renderAppIcon(size: number, maskable = false, brand: IconBrand = PLATFORM_ICON, rounded = !maskable) {
  const glyphScale = maskable ? 0.42 : 0.58
  const radius = rounded ? Math.round(size * 0.22) : 0

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: brand.background,
          borderRadius: radius,
          color: '#ffffff',
          fontSize: Math.round(size * glyphScale),
          fontWeight: 700,
          fontFamily: 'sans-serif',
        }}
      >
        {brand.glyph}
      </div>
    ),
    {
      width: size,
      height: size,
      // A company can change its name or colour: cache for a day, not the
      // year-long immutable default.
      headers: { 'Cache-Control': 'public, max-age=86400' },
    }
  )
}
