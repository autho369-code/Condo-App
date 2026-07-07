import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Portier369 — HOA & Condo Management Software'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #060709 0%, #101826 55%, #1E3A5F 100%)',
          padding: '72px 80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: '#1E3A5F',
              border: '1px solid rgba(255,255,255,0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 40,
              fontWeight: 700,
            }}
          >
            P
          </div>
          <div style={{ color: '#fff', fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>Portier369</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ color: '#fff', fontSize: 64, fontWeight: 700, letterSpacing: -2, lineHeight: 1.1, maxWidth: 980 }}>
            The operating system for HOA & condo management
          </div>
          <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 30, lineHeight: 1.35, maxWidth: 900 }}>
            Accounting, violations, work orders, and portals for boards, owners, and vendors — one platform.
          </div>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 26 }}>portier369.com</div>
      </div>
    ),
    { ...size }
  )
}
