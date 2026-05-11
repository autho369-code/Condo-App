import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { updateSession } from '@/lib/supabase/middleware';
import type { Database } from '@/lib/types/database';

const APEX_DOMAIN = process.env.NEXT_PUBLIC_PORTIER_APEX_DOMAIN ?? 'portier369.com';
const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'admin', 'platform', 'auth', 'mail', 'smtp']);

const GUARD_EXEMPT_PREFIXES = [
  '/login', '/signup', '/request-access', '/forgot-password', '/reset-password',
  '/accept-invitation', '/api/', '/_next/',
];

export async function middleware(request: NextRequest) {
  // 1) Run Supabase auth refresh / public-path gate (existing behaviour)
  const response = await updateSession(request);

  // 2) Resolve tenant for this host using anon-role lookup against the
  //    public RPC. No service-role import, no transitive Node-only deps —
  //    keeps the middleware bundle tiny and Edge-compatible.
  const host = request.headers.get('host');
  const tenant = await resolveTenant(request, host);

  if (tenant) {
    response.headers.set('x-portier-tenant-slug', tenant.slug);
    response.headers.set('x-portier-tenant-id', tenant.portfolio_id);
    response.headers.set('x-portier-tenant-name', tenant.company_name);
  }

  return response;
}

async function resolveTenant(request: NextRequest, host: string | null) {
  if (!host) return null;
  const h = host.toLowerCase().split(':')[0];
  if (h === APEX_DOMAIN || h === `www.${APEX_DOMAIN}`) return null;
  if (h === 'localhost' || h.startsWith('localhost:')) return null;
  if (h.endsWith('.vercel.app')) return null;

  // Quick subdomain shape check; full resolution happens in the RPC
  if (h.endsWith(`.${APEX_DOMAIN}`)) {
    const sub = h.slice(0, h.lastIndexOf(`.${APEX_DOMAIN}`));
    if (!sub || sub.includes('.') || RESERVED_SUBDOMAINS.has(sub)) return null;
  }

  // Use the SSR client with anon key — same role the marketing pages use
  try {
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
    const { data, error } = await (supa as any).rpc('resolve_portfolio_for_host', { p_host: host });
    if (error || !data) return null;
    const row = (data as any[])[0];
    if (!row) return null;
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
