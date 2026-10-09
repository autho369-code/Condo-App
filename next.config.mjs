import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://connect.stripe.com https://checkout.stripe.com",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://*.supabase.co",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.vercel-insights.com",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join('; ');

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
          { key: 'Content-Security-Policy-Report-Only', value: contentSecurityPolicy },
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
