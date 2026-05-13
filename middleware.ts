import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/lib/types/database';

const APEX_DOMAIN = process.env.NEXT_PUBLIC_PORTIER_APEX_DOMAIN ?? 'portier369.com';
const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'admin', 'platform', 'auth', 'mail', 'smtp']);

const PUBLIC_PATHS = [
  '/', '/pricing', '/features',
  '/login', '/signup', '/request-access', '/accept-invitation',
  '/forgot-password', '/reset-password',
  '/api/auth/callback',
];

const LEAN_CORE_DISABLED_APP_PREFIXES = [
  '/activity',
  '/automation-center',
  '/bulk-statement-settings',
  '/compliance',
  '/diagnostics',
  '/fixed-assets',
  '/forms',
  '/inbox',
  '/inspections',
  '/inventory',
  '/letters',
  '/lockbox',
  '/metrics',
  '/owners/ach',
  '/owners/forms',
  '/owners/management-agreements',
  '/owners/packets',
  '/projects',
  '/purchase-orders',
  '/recurring-work-orders',
  '/surveys',
  '/unit-turns',
  '/vendors/ach',
  '/vendors/compliance',
  '/vendors/forms',
  '/vendors/w9',
];

function tenantAliasForPath(pathname: string) {
  const match = pathname.match(/^\/t\/([a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?)(\/.*)?$/);
  if (!match) return null;

  const slug = match[1];
  const targetPath = match[2] || '/login';
  if (targetPath !== '/login' && !targetPath.startsWith('/login/')) return null;
  return { slug, targetPath };
}

/**
 * Top-level middleware. Wrapped in try/catch so a failure in any branch
 * just renders the page without tenant context — never returns 500.
 *
 * Two responsibilities:
 *   1. Refresh the Supabase session cookie + auth gate (preserved from
 *      the original middleware behaviour).
 *   2. Resolve the tenant for this host and forward x-portier-tenant-*
 *      headers so server components can render tenant branding.
 */
export async function middleware(request: NextRequest) {
  const tenantAlias = tenantAliasForPath(request.nextUrl.pathname);
  if (tenantAlias) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-portier-tenant-slug', tenantAlias.slug);

    const url = request.nextUrl.clone();
    url.pathname = tenantAlias.targetPath;
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  // -- Stage 1: auth refresh + public-path gate ------------------------------
  let response: NextResponse;
  try {
    response = await updateSessionSafe(request);
  } catch (err) {
    console.warn('[middleware] updateSession failed', err);
    response = NextResponse.next({ request });
  }

  if (!response.headers.has('location') && isLeanCoreDisabledPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // -- Stage 2: tenant resolution (best-effort) ------------------------------
  try {
    const host = request.headers.get('host');
    const tenant = await resolveTenant(request, host);
    if (tenant) {
      response.headers.set('x-portier-tenant-slug', tenant.slug);
      response.headers.set('x-portier-tenant-id', tenant.portfolio_id);
      response.headers.set('x-portier-tenant-name', tenant.company_name);
    }
  } catch (err) {
    console.warn('[middleware] tenant resolution failed', err);
  }

  return response;
}

function isLeanCoreDisabledPath(pathname: string) {
  return LEAN_CORE_DISABLED_APP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

// =============================================================================
// Stage 1 — Supabase session refresh + auth gate
// =============================================================================
async function updateSessionSafe(request: NextRequest): Promise<NextResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    // Nothing we can do — let the page render so static assets still work
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(items: Array<{ name: string; value: string; options?: any }>) {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Refresh the user session — wrapped so a Supabase outage doesn't 500
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    console.warn('[middleware] auth.getUser failed', err);
  }

  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return response;
}

// =============================================================================
// Stage 2 — Tenant resolution
// =============================================================================
async function resolveTenant(request: NextRequest, host: string | null) {
  if (!host) return null;
  const h = host.toLowerCase().split(':')[0];

  // Apex / preview / localhost — nothing to resolve
  if (h === APEX_DOMAIN || h === `www.${APEX_DOMAIN}`) return null;
  if (h === 'localhost' || h.startsWith('localhost:')) return null;
  if (h.endsWith('.vercel.app')) return null;

  // Subdomain shape check
  if (h.endsWith(`.${APEX_DOMAIN}`)) {
    const sub = h.slice(0, h.lastIndexOf(`.${APEX_DOMAIN}`));
    if (!sub || sub.includes('.') || RESERVED_SUBDOMAINS.has(sub)) return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  try {
    const supa = createServerClient<Database>(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll() {},
        },
      },
    );
    const { data, error } = await (supa as any).rpc('resolve_portfolio_for_host', { p_host: host });
    if (error || !data) return null;
    const row = Array.isArray(data) ? data[0] : (data as any);
    if (!row || !row.id) return null;
    return {
      portfolio_id: row.id as string,
      slug:         row.slug as string,
      company_name: row.company_name as string,
    };
  } catch {
    return null;
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
