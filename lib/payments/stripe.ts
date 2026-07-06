/**
 * Stripe integration — server-only, env-gated.
 *
 * Uses the raw Stripe REST API (form-encoded) so no SDK dependency is needed.
 * Everything here is dormant until STRIPE_SECRET_KEY and
 * STRIPE_WEBHOOK_SECRET are set in the environment; the owner portal only
 * shows "Pay online" when isStripeConfigured() is true.
 *
 * Truth hierarchy (per the payment architecture): Portier ledger -> Stripe ->
 * bank. Stripe events feed the ledger; they never override it.
 */
import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';

const STRIPE_API = 'https://api.stripe.com/v1';

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
}

/** Flatten a nested object into Stripe's form-encoded bracket syntax. */
function formEncode(obj: Record<string, unknown>, prefix = ''): string[] {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        if (typeof v === 'object' && v !== null) parts.push(...formEncode(v as Record<string, unknown>, `${name}[${i}]`));
        else parts.push(`${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(String(v))}`);
      });
    } else if (typeof value === 'object') {
      parts.push(...formEncode(value as Record<string, unknown>, name));
    } else {
      parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts;
}

async function stripeRequest<T = any>(
  path: string,
  body?: Record<string, unknown>,
  options?: { method?: 'POST' | 'GET'; stripeAccount?: string | null },
): Promise<T> {
  const headers: Record<string, string> = { ...authHeaders() };
  // Connect: act on the association's own connected account (direct charges —
  // funds settle straight to the association's bank, never the platform's).
  if (options?.stripeAccount) headers['Stripe-Account'] = options.stripeAccount;
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: options?.method ?? (body ? 'POST' : 'GET'),
    headers,
    body: body ? formEncode(body).join('&') : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || `Stripe ${path} failed (${res.status})`);
  }
  return json as T;
}

// ── Connect: per-association Stripe accounts ────────────────────────────────

/** Create a Standard connected account for an association (its OWN Stripe account). */
export async function createConnectedAccount(params: { associationName: string; email?: string | null }) {
  return stripeRequest<{ id: string }>('/accounts', {
    type: 'standard',
    business_profile: { name: params.associationName },
    email: params.email ?? undefined,
    metadata: { association_name: params.associationName },
  });
}

/** One-time onboarding link that walks the association through Stripe setup. */
export async function createAccountLink(accountId: string, refreshUrl: string, returnUrl: string) {
  return stripeRequest<{ url: string }>('/account_links', {
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });
}

/** Current status of a connected account (charges_enabled, details_submitted). */
export async function getConnectedAccount(accountId: string) {
  return stripeRequest<{ id: string; charges_enabled: boolean; details_submitted: boolean; payouts_enabled: boolean }>(`/accounts/${accountId}`);
}

/**
 * Create a Stripe Checkout Session for an assessment payment.
 * ACH (us_bank_account) + card; Apple/Google Pay ride on `card`
 * automatically in Checkout.
 */
export async function createCheckoutSession(params: {
  intentId: string;
  amountCents: number;
  description: string;
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
  /** The association's connected account — required for per-association settlement. */
  stripeAccount?: string | null;
}) {
  return stripeRequest<{ id: string; url: string; payment_intent?: string }>('/checkout/sessions', {
    mode: 'payment',
    payment_method_types: ['card', 'us_bank_account'],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: params.amountCents,
          product_data: { name: params.description },
        },
      },
    ],
    customer_email: params.customerEmail ?? undefined,
    client_reference_id: params.intentId,
    metadata: params.metadata,
    payment_intent_data: { metadata: params.metadata },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  }, { stripeAccount: params.stripeAccount ?? null });
}

export async function retrievePaymentIntent(paymentIntentId: string, stripeAccount?: string | null) {
  return stripeRequest<any>(`/payment_intents/${paymentIntentId}?expand[0]=latest_charge`, undefined, { stripeAccount: stripeAccount ?? null });
}

/**
 * Verify a Stripe webhook signature (Stripe-Signature header: t=...,v1=...).
 * Manual HMAC-SHA256 of `${t}.${rawBody}` with the endpoint secret.
 */
export function verifyStripeSignature(rawBody: string, signatureHeader: string | null, toleranceSeconds = 300): boolean {
  if (!signatureHeader || !process.env.STRIPE_WEBHOOK_SECRET) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((kv) => {
      const idx = kv.indexOf('=');
      return [kv.slice(0, idx).trim(), kv.slice(idx + 1).trim()];
    }),
  ) as Record<string, string>;
  const timestamp = parts['t'];
  const signature = parts['v1'];
  if (!timestamp || !signature) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;

  const expected = createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}
