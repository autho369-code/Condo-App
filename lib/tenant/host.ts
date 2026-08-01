import { siteUrl } from '@/lib/url/site-url';

const DEFAULT_APEX_DOMAIN = 'portier369.com';
const PORTFOLIO_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])$/;

export type TenantHost =
  | { kind: 'platform'; hostname: string; slug: null }
  | { kind: 'www'; hostname: string; slug: null }
  | { kind: 'subdomain'; hostname: string; slug: string }
  | { kind: 'custom-domain'; hostname: string; slug: null };

export type TenantAccessDecision =
  | { allowed: true }
  | { allowed: false; reason: 'platform_operator_on_tenant' | 'portfolio_mismatch' };

export function apexDomain() {
  return normalizeHostname(process.env.NEXT_PUBLIC_APEX_DOMAIN || DEFAULT_APEX_DOMAIN);
}

export function normalizeHostname(value: string | null | undefined) {
  const raw = (value ?? '').trim().toLowerCase();
  if (!raw) return '';
  if (raw.startsWith('[')) {
    const end = raw.indexOf(']');
    return end >= 0 ? raw.slice(1, end) : raw;
  }
  return raw.split(':')[0].replace(/\.$/, '');
}

function isLocalHostname(hostname: string) {
  return hostname === 'localhost'
    || hostname === '::1'
    || hostname.startsWith('127.')
    || hostname.startsWith('10.')
    || hostname.startsWith('192.168.');
}

function isVercelHostname(hostname: string) {
  return hostname === 'vercel.app' || hostname.endsWith('.vercel.app');
}

export function isPortfolioSlug(value: string | null | undefined): value is string {
  return typeof value === 'string' && PORTFOLIO_SLUG.test(value);
}

/** Classify a request host without consulting the database. */
export function classifyTenantHost(hostHeader: string | null | undefined, apex = apexDomain()): TenantHost {
  const hostname = normalizeHostname(hostHeader);
  const normalizedApex = normalizeHostname(apex) || DEFAULT_APEX_DOMAIN;

  if (!hostname || hostname === normalizedApex || isLocalHostname(hostname) || isVercelHostname(hostname)) {
    return { kind: 'platform', hostname, slug: null };
  }
  if (hostname === `www.${normalizedApex}`) return { kind: 'www', hostname, slug: null };

  if (hostname.endsWith('.localhost')) {
    const slug = hostname.slice(0, -'.localhost'.length);
    if (isPortfolioSlug(slug)) return { kind: 'subdomain', hostname, slug };
  }

  const suffix = `.${normalizedApex}`;
  if (hostname.endsWith(suffix)) {
    const slug = hostname.slice(0, -suffix.length);
    if (isPortfolioSlug(slug)) return { kind: 'subdomain', hostname, slug };
  }

  return { kind: 'custom-domain', hostname, slug: null };
}

function normalizePath(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * Build a company's canonical workspace URL in production. Preview/local
 * deployments deliberately stay on their current origin because wildcard
 * tenant DNS and auth redirect allow-lists do not exist for each preview.
 */
export function tenantWorkspaceUrl(
  slug: string | null | undefined,
  path = '/',
  platformOrigin = siteUrl(),
  apex = apexDomain(),
) {
  const fallback = new URL(platformOrigin);
  const normalizedApex = normalizeHostname(apex) || DEFAULT_APEX_DOMAIN;
  const canUseSubdomain = isPortfolioSlug(slug)
    && [normalizedApex, `www.${normalizedApex}`].includes(normalizeHostname(fallback.hostname));
  const origin = canUseSubdomain ? `https://${slug}.${normalizedApex}` : fallback.origin;
  return new URL(normalizePath(path), origin).toString();
}

/** Return to the platform login without sending local tenant testing to production. */
export function platformLoginUrl(
  hostHeader: string | null | undefined,
  path = '/login',
  apex = apexDomain(),
) {
  const hostname = normalizeHostname(hostHeader);
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    const raw = (hostHeader ?? '').trim();
    const port = /^.+:(\d+)$/.exec(raw)?.[1];
    return new URL(normalizePath(path), `http://localhost${port ? `:${port}` : ''}`).toString();
  }
  return new URL(normalizePath(path), `https://${normalizeHostname(apex) || DEFAULT_APEX_DOMAIN}`).toString();
}

/**
 * Preserve a verified Portier tenant/local host. Custom domains fall back to
 * the canonical slug host because arbitrary customer domains cannot be safely
 * covered by Supabase Auth's redirect allow-list.
 */
export function resolvedTenantUrl(
  tenant: { hostname?: string | null; slug?: string | null } | null | undefined,
  path: string,
  platformOrigin = siteUrl(),
  apex = apexDomain(),
) {
  const hostname = normalizeHostname(tenant?.hostname);
  const host = classifyTenantHost(hostname, apex);
  if (host.kind === 'subdomain') {
    const protocol = isLocalHostname(hostname) || hostname.endsWith('.localhost') ? 'http' : 'https';
    return new URL(normalizePath(path), `${protocol}://${hostname}`).toString();
  }
  return tenantWorkspaceUrl(tenant?.slug, path, platformOrigin, apex);
}

export function tenantAccessDecision(
  tenantPortfolioId: string | null | undefined,
  me: { is_platform_operator: boolean; portfolio?: { id?: string | null } | null } | null | undefined,
): TenantAccessDecision {
  if (!tenantPortfolioId) return { allowed: true };
  if (!me) return { allowed: false, reason: 'portfolio_mismatch' };
  if (me.is_platform_operator) return { allowed: false, reason: 'platform_operator_on_tenant' };
  if (!me.portfolio?.id || me.portfolio.id !== tenantPortfolioId) {
    return { allowed: false, reason: 'portfolio_mismatch' };
  }
  return { allowed: true };
}
