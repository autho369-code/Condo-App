const EXACT_PUBLIC_PATHS = new Set([
  '/',
  '/pricing',
  '/features',
  '/login',
  '/signup',
  '/request-access',
  '/accept-invitation',
  '/forgot-password',
  '/reset-password',
  '/api/auth/callback',
]);

const PUBLIC_PREFIXES = [
  '/api/auth/callback/',
  '/accept-invitation/',
  '/forgot-password/',
  '/login/',
  '/reset-password/',
];

export function isPublicPath(pathname: string) {
  return EXACT_PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
