import { promises as fs } from 'fs';
import * as path from 'path';

const URL = 'https://portier369.com';

export async function GET() {
  const filePath = path.join(process.cwd(), 'cities.csv');
  const fileContents = await fs.readFile(filePath, 'utf8');
  const cities = fileContents.split('\n').slice(1).map(line => {
    const [city] = line.split(',');
    return city ? city.toLowerCase().replace(/ /g, '-') : null;
  }).filter(Boolean);

  const staticPages = [
    '/',
    '/features',
    '/pricing',
    '/company',
    '/demo',
    '/login',
    '/report-card'
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${staticPages.map(page => `
    <url>
      <loc>${URL}${page}</loc>
      <lastmod>${new Date().toISOString()}</lastmod>
      <changefreq>monthly</changefreq>
      <priority>1.0</priority>
    </url>
  `).join('')}
  ${cities.map(city => `
    <url>
      <loc>${URL}/local/${city}</loc>
      <lastmod>${new Date().toISOString()}</lastmod>
      <changefreq>yearly</changefreq>
      <priority>0.8</priority>
    </url>
  `).join('')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}
