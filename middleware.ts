import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/database'
import { getSupabaseBrowserKey, getSupabaseUrl } from '@/lib/supabase/env'
import { PUBLIC_PATHS } from '@/lib/server/public-paths'
import { isStaleAuthSession, isSupabaseAuthCookie } from '@/lib/server/auth-session'
import { apexDomain, classifyTenantHost, forwardedTenantHostname, tenantAccessDecision } from '@/lib/tenant/host'
import { requiresMfa } from '@/lib/auth/mfa-policy'
import { blocksOperatorWrite } from '@/lib/auth/operator-writes'
import { fetchWithTimeout, isUnavailableError, withDeadline } from '@/lib/server/deadline'

const APEX_DOMAIN = apexDomain()
const MARKETING_PATHS = ['/pricing', '/features', '/company', '/report-card', '/local', '/hoa-laws', '/contact', '/compare', '/customers', '/onboarding', '/ai-receptionist', '/professional-services', '/demo', '/legal']
// The platform's own site files and marketing APIs: never served on a
// company's address (white label; a company's portal is not the platform).
const PLATFORM_ONLY_PATHS = ['/sitemap.xml', '/llms.txt', '/11d6c6528609b3874d201bf3145e294c.txt', '/api/demo-request', '/api/piper', '/report-card.html']
const PUBLIC_ASSETS = ['/robots.txt', '/sitemap.xml', '/manifest.webmanifest', '/llms.txt', '/11d6c6528609b3874d201bf3145e294c.txt', '/report-card.html']
const PUBLIC_ASSET_PREFIXES = ['/icon', '/apple-icon', '/opengraph-image', '/manuals/']
const INTERNAL_TENANT_HEADERS = [
  'x-portier-client-address',
  'x-portier-request-method',
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

// Vercel stops middleware after 25 s. Each database call gets 6 s and the
// sign-in check 9 s in all (Auth retries a token refresh for up to 30 s), so
// even three slow calls end in time with a "try again" answer.
const CALL_TIMEOUT_MS = 6_000
const AUTH_DEADLINE_MS = 9_000

// `from` carries any session cookies Auth refreshed during this request, so a
// "try again" answer never loses a newly issued refresh token.
function serviceUnavailable(pathname: string, from?: NextResponse) {
  const headers = { 'Cache-Control': 'no-store', 'Retry-After': '30' }
  const answer = pathname.startsWith('/api/')
    ? NextResponse.json({ error: 'service_unavailable' }, { status: 503, headers })
    : new NextResponse('This page could not load because the database did not answer. Try again in a moment.', { status: 503, headers })
  from?.cookies.getAll().forEach((cookie) => answer.cookies.set(cookie))
  return answer
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
  // Trusted request method for server code: a server action can arrive as a
  // plain multipart POST without the Next-Action header (lib/auth/me.ts).
  requestHeaders.set('x-portier-request-method', request.method.toUpperCase())

  let response = NextResponse.next({ request: { headers: requestHeaders } })
  const supabase = createServerClient<Database>(
    getSupabaseUrl(),
    getSupabaseBrowserKey(),
    {
      global: { fetch: fetchWithTimeout(CALL_TIMEOUT_MS) },
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
    let branding: { data: any; error: unknown }
    try {
      branding = await withDeadline<any>((supabase as any).rpc('tenant_branding', {
        p_host: host.hostname,
        p_slug: host.slug,
      }), CALL_TIMEOUT_MS, 'tenant_branding')
    } catch (error) {
      branding = { data: null, error }
    }
    // An error is not "no such company": don't send the visitor to the
    // workspace-not-found page because the database was slow.
    if (branding.error) return serviceUnavailable(pathname)
    const brandingRows = branding.data
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

    // A company's retired address (after a rename) keeps old links working by
    // forwarding to its current address, same path and query. Temporary and
    // uncached: a company may take its old address back, and a cached
    // permanent redirect would then loop.
    const forwardTo = forwardedTenantHostname(host, tenantPortfolio.slug)
    if (forwardTo) {
      const url = request.nextUrl.clone()
      url.hostname = forwardTo
      const forward = NextResponse.redirect(url, 307)
      forward.headers.set('Cache-Control', 'no-store')
      return forward
    }

    requestHeaders.set('x-tenant-state', 'resolved')
    requestHeaders.set('x-tenant-host', host.hostname)
    requestHeaders.set('x-portfolio-id', tenantPortfolio.id)
    if (tenantPortfolio.slug) requestHeaders.set('x-portfolio-slug', tenantPortfolio.slug)
    setEncodedHeader(requestHeaders, 'x-portfolio-name', tenantPortfolio.company_name)
    setEncodedHeader(requestHeaders, 'x-portfolio-logo', tenantPortfolio.logo_url)
    // Sent raw: anything other than #RRGGBB could break header parsing.
    const brandColor = tenantPortfolio.brand_color
    requestHeaders.set('x-portfolio-color', typeof brandColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(brandColor) ? brandColor : '#10B981')
    setEncodedHeader(requestHeaders, 'x-portfolio-support-email', tenantPortfolio.support_email)
    setEncodedHeader(requestHeaders, 'x-portfolio-support-phone', tenantPortfolio.support_phone)
    setEncodedHeader(requestHeaders, 'x-portfolio-website', tenantPortfolio.public_website)
    response = NextResponse.next({ request: { headers: requestHeaders } })

    // A company's address is its portal: keep it out of search engines and
    // don't serve the platform's sitemap, llms.txt or marketing APIs there.
    if (pathname === '/robots.txt') {
      return new NextResponse('User-agent: *\nDisallow: /\n', { headers: { 'content-type': 'text/plain; charset=utf-8' } })
    }
    if (PLATFORM_ONLY_PATHS.includes(pathname)) {
      return new NextResponse('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } })
    }

    if ((isMarketingPath || pathname === '/signup') && !isPublicAsset) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  // Refresh the Auth session. Protected server layouts and route handlers
  // still enforce roles and tenant identity; middleware is defense-in-depth.
  let authResult: { data: { user: any }; error: any }
  try {
    authResult = await withDeadline(supabase.auth.getUser(), AUTH_DEADLINE_MS, 'auth.getUser')
  } catch (error) {
    authResult = { data: { user: null }, error }
  }
  const { data: { user }, error: authError } = authResult

  // Auth did not answer: the visitor may well be signed in, so don't send them
  // to the sign-in page (and never clear their cookies) - ask them to retry.
  if (!user && !isPublic && pathname !== '/' && isUnavailableError(authError)) {
    return serviceUnavailable(pathname, response)
  }
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
    try {
      const { data, error } = await withDeadline<any>((supabase as any).rpc('me'), CALL_TIMEOUT_MS, 'me')
      requestIdentity = data
      requestIdentityError = error
    } catch (error) {
      requestIdentityError = error
    }
  }

  // Without the caller's identity the workspace, operator-write and MFA checks
  // below cannot run: refuse every request with "try again" (fails closed; a
  // tenant host used to say "access denied", the platform host let reads past
  // the MFA check). Pages repeat these checks through getMe().
  if (user && !isPublic && requestIdentityError) return serviceUnavailable(pathname, response)

  if (user && tenantPortfolio && !isPublic) {
    const decision = tenantAccessDecision(tenantPortfolio.id, requestIdentity)

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

  // Only operator admins change data. Server actions and route handlers often
  // switch to the service-role client, where the database cannot tell who
  // started the write, so refuse non-GET requests from support/readonly
  // operators here (see lib/auth/operator-writes.ts for the exceptions).
  // (A failed identity lookup was refused above.)
  if (user && !isPublic && !requestIdentityError && blocksOperatorWrite(requestIdentity, request.method, pathname)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'operator_read_only' }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
    }
    return new NextResponse('Only Portier platform admins can make changes.', { status: 403, headers: { 'Cache-Control': 'no-store' } })
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
  // .html goes through: public/report-card.html is the platform's and must not
  // open on a company's address.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
