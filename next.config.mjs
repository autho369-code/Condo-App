import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Owners upload insurance policy PDFs/photos via server actions.
      bodySizeLimit: '12mb',
    },
  },
  outputFileTracingRoot: __dirname,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // Content-Security-Policy is set per request in middleware.ts
          // (a nonce for app pages; lib/server/csp.ts).
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Legacy platform area, consolidated into /platform-operator (2026-06-11).
      // Keeps old bookmarks and deep links working.
      { source: '/platform', destination: '/platform-operator', permanent: true },
      { source: '/platform/:path*', destination: '/platform-operator', permanent: true },
      // Previous-system importer moved off a competitor-named URL (2026-10-09).
      { source: '/owners/import/appfolio', destination: '/owners/import/previous-system', permanent: true },
    ];
  },
  async rewrites() {
    return [
      { source: '/report-card', destination: '/report-card.html' },
    ];
  },
};
export default nextConfig;
