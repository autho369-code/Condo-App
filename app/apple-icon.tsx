import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// iOS applies its own corner mask, so the tile fills the full square.
export default function AppleIcon() {
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
          color: '#ffffff',
          fontSize: 104,
          fontWeight: 700,
          fontFamily: 'sans-serif',
        }}
      >
        P
      </div>
    ),
    size
  )
}
