import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Portier369 — Property management software for HOAs and condos'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #1E3A5F 0%, #152940 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: '#ffffff', color: '#1E3A5F', fontSize: 34, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>P</div>
          <div style={{ color: '#cbd5e1', fontSize: 30, fontWeight: 600 }}>Portier369</div>
        </div>
        <div style={{ color: '#ffffff', fontSize: 64, fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em', maxWidth: 900 }}>
          Run your entire property management company from one platform.
        </div>
        <div style={{ color: '#94a3b8', fontSize: 30, marginTop: 32 }}>
          Built from 29 years in the field — not a conference room.
        </div>
      </div>
    ),
    { ...size },
  )
}
