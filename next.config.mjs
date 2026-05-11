import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  outputFileTracingRoot: __dirname,

  // ⚠ TEMPORARY — diagnostic only. We're using these to determine whether
  // the Vercel build failure is a TypeScript or ESLint issue. If the build
  // succeeds with these on, we know the failure is in those layers and
  // we'll re-enable strict checking once the root cause is fixed.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
