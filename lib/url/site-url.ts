const DEFAULT_SITE_URL = 'https://portier369.com';

function normalizeUrl(value: string | undefined) {
  const candidate = value?.trim();
  if (!candidate) return null;
  const withProtocol = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Keep preview authentication flows on staging instead of crossing into production. */
export function siteUrl() {
  const previewUrl = process.env.VERCEL_ENV === 'preview'
    ? normalizeUrl(process.env.VERCEL_URL ?? process.env.NEXT_PUBLIC_VERCEL_URL)
    : null;

  return previewUrl
    ?? normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL)
    ?? normalizeUrl(process.env.NEXT_PUBLIC_PORTAL_URL)
    ?? normalizeUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL)
    ?? DEFAULT_SITE_URL;
}
