import { ImageResponse } from 'next/og'
import { headers } from 'next/headers'
import { DRAWABLE_TEXT, companyIconBrand } from '@/lib/brand/app-icon'
import { tenantFromHeaders } from '@/lib/tenant/resolve'

export const runtime = 'edge'
// Neutral: the same alt text serves the platform card and every company's card.
export const alt = 'HOA & condo management portal'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const BACKGROUND = 'linear-gradient(135deg, #060709 0%, #101826 55%, #1E3A5F 100%)'

// Link-preview card. On a company's own address it carries the company's
// name and initial (white label); the platform address keeps the Portier369
// card. A name the bundled font can't draw in full is left off rather than
// fetching a font at request time.
export default async function OpengraphImage() {
  const tenant = tenantFromHeaders(await headers())
  if (tenant?.portfolioId) {
    const name = tenant.companyName.trim().slice(0, 60)
    const icon = companyIconBrand(name, tenant.brandColor)
    const host = (tenant.hostname ?? '').toLowerCase()
    return card({
      glyph: icon.glyph,
      tile: icon.background,
      tileText: icon.foreground,
      name: DRAWABLE_TEXT.test(name) ? name : null,
      headline: 'Owner, board and vendor portal',
      body: 'Account balances, payments, requests, documents and announcements in one place.',
      footer: /^[a-z0-9.-]+$/.test(host) ? host : null,
    })
  }
  return card({
    glyph: 'P',
    tile: '#1E3A5F',
    tileText: '#ffffff',
    name: 'Portier369',
    headline: 'The operating system for HOA & condo management',
    body: 'Accounting, violations, work orders, and portals for boards, owners, and vendors — one platform.',
    footer: 'portier369.com',
  })
}

function card(c: {
  glyph: string; tile: string; tileText: string; name: string | null
  headline: string; body: string; footer: string | null
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: BACKGROUND,
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
              background: c.tile,
              border: '1px solid rgba(255,255,255,0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: c.tileText,
              fontSize: 40,
              fontWeight: 700,
            }}
          >
            {c.glyph}
          </div>
          {c.name && <div style={{ color: '#fff', fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>{c.name}</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ color: '#fff', fontSize: 64, fontWeight: 700, letterSpacing: -2, lineHeight: 1.1, maxWidth: 980 }}>
            {c.headline}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 30, lineHeight: 1.35, maxWidth: 900 }}>
            {c.body}
          </div>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 26 }}>{c.footer ?? ''}</div>
      </div>
    ),
    // Company cards change with the company's name or colour: a day, not the
    // year-long immutable default.
    { ...size, headers: { 'Cache-Control': 'public, max-age=86400' } }
  )
}
