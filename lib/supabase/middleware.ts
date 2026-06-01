// Refreshes the Supabase session cookie on each request, and redirects
// unauthenticated users to /login (except from auth pages themselves).
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/types/database';

const PUBLIC_PATHS = ['/', '/pricing', '/features', '/contact', '/faq', '/login', '/signup', '/accept-invitation', '/api/auth/callback'];

export function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => {
    if (path === '/') return pathname === '/';
    return pathname === path || pathname.startsWith(`${path}/`);
  });
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  // Required: touches the session so it's refreshed before returning
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect unauthenticated users away from protected pages
  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from marketing/auth pages
  if (user && isPublicPath(request.nextUrl.pathname)) {
    const marketingPaths = ['/', '/login', '/signup', '/pricing', '/features', '/contact', '/faq'];
    if (marketingPaths.some((p) => request.nextUrl.pathname === p || request.nextUrl.pathname.startsWith(`${p}/`))) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return response;
}
