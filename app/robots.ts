import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Keep the authenticated app + transactional routes out of the index
        disallow: ['/dashboard', '/board', '/portal', '/vendor', '/company-admin', '/platform-operator', '/platform', '/api/', '/login', '/invite', '/accept-invitation'],
      },
    ],
    sitemap: 'https://portier369.com/sitemap.xml',
  }
}
