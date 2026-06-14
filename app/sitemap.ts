import type { MetadataRoute } from 'next'

const BASE = 'https://portier369.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const routes = [
    { path: '', priority: 1.0, changeFrequency: 'weekly' as const },
    { path: '/pricing', priority: 0.9, changeFrequency: 'weekly' as const },
    { path: '/company', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/demo', priority: 0.8, changeFrequency: 'monthly' as const },
  ]
  return routes.map((r) => ({
    url: `${BASE}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }))
}
