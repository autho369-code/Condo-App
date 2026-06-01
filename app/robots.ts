import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://portier369.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard/',
          '/portal/',
          '/vendor-portal/',
          '/board-portal/',
          '/login',
          '/signup',
          '/accept-invite',
          '/accounting/',
          '/associations/',
          '/units/',
          '/owners/',
          '/vendors/',
          '/violations/',
          '/work-orders/',
          '/maintenance/',
          '/reports/',
          '/platform/',
          '/settings/',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
