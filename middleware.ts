import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { resolveTenantFromHost, APEX_DOMAIN } from '@/lib/tenant/resolve';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/lib/types/database';

const GUARD_EXEMPT_PREFIXES = [
  '/login',
  '/signup',
  '/request-access',
  '/forgot-password',
  '/reset-password',
  '/accept-invitation',
  '/api/',
  '/_next/',
];

export async function middleware(request: NextRequest) {
  // 1) Resolve the tenant for this host (returns null if service key absent)
  const host = request.headers.get('host');
  const tenant = await resolveTenantFromHost(host);

  // 2) Run Supabase auth refresh / public-path gate
  const response = await updateSession(request);

  // 3) Forward tenant headers to server components
  if (tenant) {
    response.headers.set('x-portier-tenant-slug', tenant.slug);
    response.headers.set('x-portier-tenant-id', tenant.portfolio_id);
    response.headers.set('x-portier-tenant-name', tenant.company_name);
  }

  // 4) Cross-tenant URL guard — only when fully configured
  if (
    tenant &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    shouldEnforceTenantGuard(request)
  ) {
    try {
      const userPortfolioId = await getUserPortfolioId(request);
      if (userPortfolioId && userPortfolioId !== tenant.portfolio_id) {
        const correctSlug = await getPortfolioSlug(userPortfolioId);
        if (correctSlug) {
          const url = new URL(request.url);
          url.host = `${correctSlug}.${APEX_DOMAIN}`;
          url.searchParams.set('redirected_from', tenant.slug);
          return NextResponse.redirect(url);
        }
      }
    } catch (err) {
      console.warn('[tenant-guard]', err);
      // Fall through — the user just sees an empty workspace, but no crash.
    }
  }

  return response;
}

function shouldEnforceTenantGuard(req: NextRequest): boolean {
  const path = req.nextUrl.pathname;
  return !GUARD_EXEMPT_PREFIXES.some((p) => path.startsWith(p));
}

async function getUserPortfolioId(request: NextRequest): Promise<string | null> {
  const supa = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    },
  );
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return null;
  const { data: profile } = await (supa as any)
    .from('profiles')
    .select('portfolio_id')
    .eq('id', user.id)
    .maybeSingle();
  return profile?.portfolio_id ?? null;
}

async function getPortfolioSlug(portfolioId: string): Promise<string | null> {
  const supa = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } },
  );
  const { data } = await (supa as any)
    .from('portfolios')
    .select('slug')
    .eq('id', portfolioId)
    .maybeSingle();
  return data?.slug ?? null;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
