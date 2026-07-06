import { ImageResponse } from 'next/og'

// Renders the Portier369 app icon at any size. Used by the PWA manifest
// icon routes (/icon-192, /icon-512, /icon-512-maskable) and available to
// native asset generation (see mobile/README.md).
//
// `maskable` pads the mark into the 80% safe zone required by Android
// adaptive icons so nothing is clipped by circular masks.
export function renderAppIcon(size: number, maskable = false) {
  const glyphScale = maskable ? 0.42 : 0.58
  const radius = maskable ? 0 : Math.round(size * 0.22)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #24466f 0%, #1E3A5F 55%, #162D4A 100%)',
          borderRadius: radius,
          color: '#ffffff',
          fontSize: Math.round(size * glyphScale),
          fontWeight: 700,
          fontFamily: 'sans-serif',
        }}
      >
        P
      </div>
    ),
    { width: size, height: size }
  )
}
