import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/lib/types/database';

const APEX_DOMAIN = 'portier369.com';
const PUBLIC_PATHS = ['/', '/pricing', '/features', '/login', '/signup', '/accept-invitation', '/api/auth/callback'];

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || APEX_DOMAIN;
  const clean = hostname.split(':')[0].toLowerCase();
  const isSubdomain = clean !== APEX_DOMAIN && clean !== 'localhost' && !clean.startsWith('127.') && !clean.startsWith('192.');

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(items) {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Resolve tenant branding on subdomains
  if (isSubdomain) {
    const slug = clean.endsWith(`.${APEX_DOMAIN}`)
      ? clean.replace(`.${APEX_DOMAIN}`, '')
      : null;

    if (slug) {
      const { data: portfolio } = await (supabase as any)
        .from('portfolios')
        .select('id, company_name, logo_url, brand_color, support_email, support_phone, public_website')
        .eq('slug', slug)
        .maybeSingle();

      if (portfolio) {
        response.headers.set('x-portfolio-id', portfolio.id);
        response.headers.set('x-portfolio-name', portfolio.company_name ?? 'Portier');
        if (portfolio.logo_url) response.headers.set('x-portfolio-logo', portfolio.logo_url);
        response.headers.set('x-portfolio-color', portfolio.brand_color ?? '#10B981');
        if (portfolio.support_email) response.headers.set('x-portfolio-support-email', portfolio.support_email);
        if (portfolio.support_phone) response.headers.set('x-portfolio-support-phone', portfolio.support_phone);
        if (portfolio.public_website) response.headers.set('x-portfolio-website', portfolio.public_website);

        // Cache the tenant headers for 60 seconds
        response.headers.set('x-tenant-cache', 'hit');
      }
    }
  }

  // Auth session refresh
  const { data: { user } } = await supabase.auth.getUser();
  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
