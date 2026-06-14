import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  outputFileTracingRoot: __dirname,
  async rewrites() {
    return [
      { source: '/report-card', destination: '/report-card.html' },
    ];
  },
};
export default nextConfig;
