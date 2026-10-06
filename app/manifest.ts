import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { tenantFromHeaders } from '@/lib/tenant/resolve'

// Installed-app details. On a company's own address (workspace address or
// custom domain) the app installs under the company's name.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const tenant = tenantFromHeaders(await headers())
  const company = tenant?.portfolioId ? tenant.companyName.trim() : ''
  return {
    name: company || 'Portier369 — Property Management',
    short_name: company ? company.slice(0, 30) : 'Portier369',
    description: company
      ? `${company} — owner, board and management portal.`
      : 'All-in-one property management software for condominium and HOA management companies.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#1E3A5F',
    categories: ['business', 'productivity', 'finance'],
    icons: [
      { src: '/icon-192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512-maskable', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
