import type { MetadataRoute } from 'next'
import { STATE_LAWS } from '@/lib/seo/hoa-states'
import { LOCAL_CITIES } from '@/lib/seo/local-cities'
import { COMPETITORS } from '@/lib/seo/competitors'

const BASE = 'https://portier369.com'

// Bump these when the corresponding content meaningfully changes — a truthful
// lastModified is what makes crawlers trust the sitemap.
const CORE_UPDATED = new Date('2026-07-06')
const LEGAL_UPDATED = new Date('2026-06-14')
const CONTENT_UPDATED = new Date('2026-07-06')

export default function sitemap(): MetadataRoute.Sitemap {
  const core = [
    { path: '', priority: 1.0, changeFrequency: 'weekly' as const },
    { path: '/pricing', priority: 0.9, changeFrequency: 'weekly' as const },
    { path: '/features', priority: 0.9, changeFrequency: 'monthly' as const },
    { path: '/features/accounting', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/features/maintenance', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/features/communications', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/features/portals', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/company', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/customers/stellar-property-management', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/contact', priority: 0.6, changeFrequency: 'yearly' as const },
    { path: '/demo', priority: 0.8, changeFrequency: 'monthly' as const },
  ].map((r) => ({
    url: `${BASE}${r.path}`,
    lastModified: CORE_UPDATED,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }))

  const legal = ['/legal/privacy', '/legal/terms', '/legal/security'].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: LEGAL_UPDATED,
    changeFrequency: 'yearly' as const,
    priority: 0.3,
  }))

  const hoaLaws = [
    {
      url: `${BASE}/hoa-laws`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    ...STATE_LAWS.map((s) => ({
      url: `${BASE}/hoa-laws/${s.slug}`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ]

  const compare = [
    {
      url: `${BASE}/compare`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    ...COMPETITORS.map((c) => ({
      url: `${BASE}/compare/${c.slug}`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ]

  const local = [
    {
      url: `${BASE}/local`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    },
    ...LOCAL_CITIES.map((c) => ({
      url: `${BASE}/local/${c.slug}`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ]

  return [...core, ...legal, ...compare, ...hoaLaws, ...local]
}
