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

export type IconBrand = { glyph: string; background: string; foreground: string }

export const PLATFORM_ICON: IconBrand = { glyph: 'P', background: PLATFORM_BACKGROUND, foreground: '#ffffff' }

// The renderer's bundled font (next/og's Noto Sans latin subset) covers A–Z,
// 0–9 and the Latin-1 capitals (À–Ö, Ø–Þ); anything else would make it fetch
// a font at request time. Checked against the font file in app-icon.test.ts.
export const DRAWABLE_GLYPH = /^[A-Z0-9\u00C0-\u00D6\u00D8-\u00DE]$/

// Text the same bundled font can draw in full: printable ASCII, Latin-1 and
// typographic dashes/quotes (checked against the font file in the test).
export const DRAWABLE_TEXT = /^[\u0020-\u007E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D]+$/

const DARK_GLYPH = '#111827'

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** White or dark text, whichever contrasts more with the colour (WCAG contrast ratio). */
export function glyphColorFor(hex: string): string {
  const bg = luminance(hex)
  const onWhite = 1.05 / (bg + 0.05)
  const onDark = (bg + 0.05) / (luminance(DARK_GLYPH) + 0.05)
  return onDark > onWhite ? DARK_GLYPH : '#ffffff'
}

/**
 * The company's icon: its first letter or digit on its brand colour (hex
 * only; anything else keeps the platform colour). A name starting with a
 * character the icon font can't draw keeps the platform icon.
 */
export function companyIconBrand(companyName: string | null | undefined, brandColor: string | null | undefined): IconBrand {
  const glyph = String(companyName ?? '').match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase()
  if (!glyph || !DRAWABLE_GLYPH.test(glyph)) return PLATFORM_ICON
  const color = String(brandColor ?? '').trim()
  return /^#[0-9a-f]{6}$/i.test(color)
    ? { glyph, background: color, foreground: glyphColorFor(color) }
    : { glyph, background: PLATFORM_BACKGROUND, foreground: '#ffffff' }
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
          color: brand.foreground,
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
