// Content Security Policy.
//
// App pages (everything signed-in people use) get an ENFORCED policy: a
// script runs only if it carries this request's nonce or comes from our own
// origin, Stripe or Plaid. An injected <script> or inline handler is blocked,
// which is what turns a stored-HTML bug into a non-event. Next.js reads the
// nonce from the request's Content-Security-Policy header and puts it on its
// own scripts; every app page is rendered per request, so each gets one.
//
// Marketing pages are prerendered once and cannot carry a per-request nonce:
// they keep the previous, looser policy as report-only.

const STRIPE = 'https://js.stripe.com https://*.js.stripe.com';
const PLAID = 'https://cdn.plaid.com';

const shared = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://connect.stripe.com https://checkout.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `frame-src ${STRIPE} https://hooks.stripe.com https://checkout.stripe.com https://*.supabase.co ${PLAID}`,
  "worker-src 'self' blob:",
];

const CONNECT_SRC = "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.plaid.com https://*.vercel-insights.com";

/**
 * In development only: a local Supabase (`supabase start`, loopback http) so
 * browser uploads and auth calls work against it. Production never adds it.
 */
function localSupabaseOrigin(): string | null {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    const loopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    return url.protocol === 'http:' && loopback ? url.origin : null;
  } catch {
    return null;
  }
}

function connectSrc(dev: boolean): string {
  const local = dev ? localSupabaseOrigin() : null;
  return local ? `${CONNECT_SRC} ${local} ${local.replace(/^http:/, 'ws:')}` : CONNECT_SRC;
}

export const CSP_REPORT_PATH = '/api/csp-report';

/** sha256 of PRINT_ON_LOAD_SCRIPT (lib/print-script.ts); csp.test.ts checks it. */
export const PRINT_SCRIPT_HASH = "'sha256-JvP7+dR0/uG+XdJLQ3VY1tsCgjRYmPOpus5OtsH4uU8='";

/**
 * Enforced policy for app pages. `dev` adds 'unsafe-eval' (React refresh),
 * Vercel Analytics' debug script host (production loads it from our origin)
 * and a local loopback Supabase, if that's what the app is configured with.
 */
export function appContentSecurityPolicy(nonce: string, dev = false): string {
  return [
    ...shared,
    connectSrc(dev),
    `script-src 'self' 'nonce-${nonce}' ${PRINT_SCRIPT_HASH} ${STRIPE} ${PLAID}${dev ? " 'unsafe-eval' https://va.vercel-scripts.com" : ''}`,
    'upgrade-insecure-requests',
    `report-uri ${CSP_REPORT_PATH}`,
  ].join('; ');
}

/** Report-only policy for prerendered marketing pages (unchanged in spirit). */
export const marketingContentSecurityPolicy = [
  ...shared,
  CONNECT_SRC,
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${STRIPE} ${PLAID}`,
].join('; ');

export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
