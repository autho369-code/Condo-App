import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/database'

const APEX_DOMAIN = 'portier369.com'
const MARKETING_PATHS = ['/pricing', '/features', '/company', '/report-card']
const PUBLIC_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password', '/accept-invitation', '/api/auth/callback', '/report-violation', '/invite', '/demo', '/legal', '/api/maintenance/send-reminders', '/report-card']

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || APEX_DOMAIN
  const clean = hostname.split(':')[0].toLowerCase()
  const isSubdomain = clean !== APEX_DOMAIN && clean !== 'localhost' && !clean.startsWith('127.') && !clean.startsWith('192.')
  const pathname = request.nextUrl.pathname

  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(items) {
          items.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          items.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  // Resolve tenant branding on subdomains
  if (isSubdomain) {
    const slug = clean.endsWith(`.${APEX_DOMAIN}`)
      ? clean.replace(`.${APEX_DOMAIN}`, '')
      : null

    if (slug) {
      const { data: brandingRows } = await (supabase as any)
        .rpc('tenant_branding', { p_slug: slug })
      const portfolio = brandingRows?.[0]

      if (portfolio) {
        response.headers.set('x-portfolio-id', portfolio.id)
        response.headers.set('x-portfolio-name', portfolio.company_name ?? 'Portier')
        if (portfolio.logo_url) response.headers.set('x-portfolio-logo', portfolio.logo_url)
        response.headers.set('x-portfolio-color', portfolio.brand_color ?? '#10B981')
        if (portfolio.support_email) response.headers.set('x-portfolio-support-email', portfolio.support_email)
        if (portfolio.support_phone) response.headers.set('x-portfolio-support-phone', portfolio.support_phone)
        if (portfolio.public_website) response.headers.set('x-portfolio-website', portfolio.public_website)
        response.headers.set('x-tenant-cache', 'hit')
      }

      // On subdomains, redirect marketing paths and root to login
      // The tenant's branded login page should ALWAYS be shown, never the main marketing site
      const isMarketingPath = pathname === '/' || MARKETING_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
      if (isMarketingPath && !PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
      }
    }
  }

  // Auth session refresh
  const { data: { user } } = await supabase.auth.getUser()
  const isPublic = [...PUBLIC_PATHS, ...MARKETING_PATHS].some((p) =>
    request.nextUrl.pathname === p || request.nextUrl.pathname.startsWith(p + '/')
  )
  const isRoot = request.nextUrl.pathname === '/'

  if (!user && !isPublic && !isRoot) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html)$).*)'],
}
