import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/database'
import { getSupabaseBrowserKey, getSupabaseUrl } from '@/lib/supabase/env'
import { PUBLIC_PATHS } from '@/lib/server/public-paths'
import { isStaleAuthSession, isSupabaseAuthCookie } from '@/lib/server/auth-session'
import { apexDomain, classifyTenantHost, tenantAccessDecision } from '@/lib/tenant/host'
import { requiresMfa } from '@/lib/auth/mfa-policy'

const APEX_DOMAIN = apexDomain()
const MARKETING_PATHS = ['/pricing', '/features', '/company', '/report-card', '/local', '/hoa-laws', '/contact', '/compare', '/customers', '/onboarding', '/ai-receptionist', '/professional-services']
const PUBLIC_ASSETS = ['/robots.txt', '/sitemap.xml', '/manifest.webmanifest', '/llms.txt', '/11d6c6528609b3874d201bf3145e294c.txt']
const PUBLIC_ASSET_PREFIXES = ['/icon', '/apple-icon', '/opengraph-image', '/manuals/']
const INTERNAL_TENANT_HEADERS = [
  'x-portier-client-address',
  'x-portier-request-path',
  'x-tenant-state',
  'x-tenant-host',
  'x-portfolio-id',
  'x-portfolio-slug',
  'x-portfolio-name',
  'x-portfolio-logo',
  'x-portfolio-color',
  'x-portfolio-support-email',
  'x-portfolio-support-phone',
  'x-portfolio-website',
]

function pathMatches(pathname: string, paths: readonly string[]) {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

function setEncodedHeader(headers: Headers, name: string, value: unknown) {
  if (typeof value === 'string' && value) headers.set(name, encodeURIComponent(value))
}

function expireAuthCookies(target: NextResponse, cookieNames: string[]) {
  cookieNames.forEach((name) => {
    target.cookies.set(name, '', { httpOnly: true, maxAge: 0, path: '/', sameSite: 'lax' })
  })
  return target
}

export async function middleware(request: NextRequest) {
  const host = classifyTenantHost(request.headers.get('host'), APEX_DOMAIN)
  const pathname = request.nextUrl.pathname
  const isPublicAsset = PUBLIC_ASSETS.includes(pathname) || PUBLIC_ASSET_PREFIXES.some((path) => pathname.startsWith(path))
  const isPublic = isPublicAsset || pathMatches(pathname, [...PUBLIC_PATHS, ...MARKETING_PATHS])
  const isMarketingPath = pathname === '/' || pathMatches(pathname, MARKETING_PATHS)

  if (host.kind === 'www') {
    const url = request.nextUrl.clone()
    url.hostname = APEX_DOMAIN
    return NextResponse.redirect(url, 308)
  }

  // Strip caller-supplied internal headers before adding trusted values from
  // the branding RPC. Server layouts may rely on these as a tenant boundary.
  const requestHeaders = new Headers(request.headers)
  INTERNAL_TENANT_HEADERS.forEach((name) => requestHeaders.delete(name))
  const edgeClientAddress = request.headers.get('x-vercel-forwarded-for') || 'unknown'
  requestHeaders.set('x-portier-client-address', edgeClientAddress.split(',')[0].trim().slice(0, 128) || 'unknown')
  requestHeaders.set('x-portier-request-path', encodeURIComponent(`${pathname}${request.nextUrl.search}`))

  let response = NextResponse.next({ request: { headers: requestHeaders } })
  const supabase = createServerClient<Database>(
    getSupabaseUrl(),
    getSupabaseBrowserKey(),
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(items) {
          items.forEach(({ name, value }) => request.cookies.set(name, value))
          const refreshedCookie = request.cookies.getAll()
            .map(({ name, value }) => `${name}=${value}`)
            .join('; ')
          if (refreshedCookie) requestHeaders.set('cookie', refreshedCookie)
          else requestHeaders.delete('cookie')
          response = NextResponse.next({ request: { headers: requestHeaders } })
          items.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  let tenantPortfolio: any = null
  if (host.kind === 'subdomain' || host.kind === 'custom-domain') {
    const { data: brandingRows } = await (supabase as any).rpc('tenant_branding', {
      p_host: host.hostname,
      p_slug: host.slug,
    })
    tenantPortfolio = brandingRows?.[0] ?? null

    if (!tenantPortfolio) {
      // Unknown hosts never reach application, report, or API surfaces. Keep a
      // single branded-safe error page reachable without creating a loop.
      if (pathname === '/login' && request.nextUrl.searchParams.get('error') === 'workspace_not_found') {
        requestHeaders.set('x-tenant-state', 'not-found')
        return NextResponse.next({ request: { headers: requestHeaders } })
      }
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.search = ''
      url.searchParams.set('error', 'workspace_not_found')
      return NextResponse.redirect(url)
    }

    requestHeaders.set('x-tenant-state', 'resolved')
    requestHeaders.set('x-tenant-host', host.hostname)
    requestHeaders.set('x-portfolio-id', tenantPortfolio.id)
    if (tenantPortfolio.slug) requestHeaders.set('x-portfolio-slug', tenantPortfolio.slug)
    setEncodedHeader(requestHeaders, 'x-portfolio-name', tenantPortfolio.company_name ?? 'Portier369')
    setEncodedHeader(requestHeaders, 'x-portfolio-logo', tenantPortfolio.logo_url)
    requestHeaders.set('x-portfolio-color', tenantPortfolio.brand_color ?? '#10B981')
    setEncodedHeader(requestHeaders, 'x-portfolio-support-email', tenantPortfolio.support_email)
    setEncodedHeader(requestHeaders, 'x-portfolio-support-phone', tenantPortfolio.support_phone)
    setEncodedHeader(requestHeaders, 'x-portfolio-website', tenantPortfolio.public_website)
    response = NextResponse.next({ request: { headers: requestHeaders } })

    if ((isMarketingPath || pathname === '/signup') && !isPublicAsset) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  // Refresh the Auth session. Protected server layouts and route handlers
  // still enforce roles and tenant identity; middleware is defense-in-depth.
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  let expiredAuthCookies: string[] = []

  // A browser can retain a rotated or revoked refresh token indefinitely. Clear
  // it on the first request so a normal session expiry does not become a stream
  // of middleware errors and the user gets a clean sign-in path.
  if (!user && isStaleAuthSession(authError)) {
    expiredAuthCookies = request.cookies.getAll()
      .map(({ name }) => name)
      .filter(isSupabaseAuthCookie)

    expiredAuthCookies.forEach((name) => request.cookies.delete(name))
    const remainingCookie = request.cookies.getAll()
      .map(({ name, value }) => `${name}=${value}`)
      .join('; ')
    if (remainingCookie) requestHeaders.set('cookie', remainingCookie)
    else requestHeaders.delete('cookie')

    response = expireAuthCookies(
      NextResponse.next({ request: { headers: requestHeaders } }),
      expiredAuthCookies,
    )
  }

  if (!user && !isPublic && pathname !== '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
    if (expiredAuthCookies.length > 0) url.searchParams.set('error', 'session_expired')
    return expireAuthCookies(NextResponse.redirect(url), expiredAuthCookies)
  }

  let requestIdentity: any = null
  let requestIdentityError: any = null
  if (user && !isPublic) {
    const { data, error } = await (supabase as any).rpc('me')
    requestIdentity = data
    requestIdentityError = error
  }

  if (user && tenantPortfolio && !isPublic) {
    const decision = requestIdentityError
      ? { allowed: false as const, reason: 'portfolio_mismatch' as const }
      : tenantAccessDecision(tenantPortfolio.id, requestIdentity)

    if (!decision.allowed) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'workspace_access_denied' }, { status: 403 })
      }
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.search = ''
      url.searchParams.set(
        'error',
        decision.reason === 'platform_operator_on_tenant'
          ? 'platform_workspace_only'
          : 'workspace_access_denied',
      )
      return NextResponse.redirect(url)
    }
  }

  // Enforce portfolio and operator MFA before any page, route handler, or
  // server action runs. Server guards repeat the check as defense-in-depth.
  if (
    user
    && !isPublic
    && !(request.method === 'GET' && pathname === '/mfa')
    && !requestIdentityError
    && requestIdentity
    && requiresMfa(requestIdentity)
  ) {
    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (assuranceError || assurance?.currentLevel !== 'aal2') {
      const next = pathname.startsWith('/api/') ? '/dashboard' : `${pathname}${request.nextUrl.search}`
      const mfaUrl = request.nextUrl.clone()
      mfaUrl.pathname = '/mfa'
      mfaUrl.search = ''
      mfaUrl.searchParams.set('next', next)
      if (assuranceError) mfaUrl.searchParams.set('error', 'verification_unavailable')

      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          {
            error: assuranceError ? 'mfa_verification_unavailable' : 'mfa_required',
            verification_url: `${mfaUrl.pathname}${mfaUrl.search}`,
          },
          { status: assuranceError ? 503 : 403, headers: { 'Cache-Control': 'no-store' } },
        )
      }
      return NextResponse.redirect(mfaUrl)
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html)$).*)'],
}
