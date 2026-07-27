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
import { assertStripeId } from './stripe-invariants';

const STRIPE_API = 'https://api.stripe.com/v1';
const STRIPE_TIMEOUT_MS = 12_000;
const STRIPE_MAX_ATTEMPTS = 3;

export class StripeRequestError extends Error {
  readonly retryable: boolean;
  readonly indeterminate: boolean;

  constructor(message: string, options: { retryable: boolean; indeterminate: boolean; cause?: unknown }) {
    super(message, { cause: options.cause });
    this.name = 'StripeRequestError';
    this.retryable = options.retryable;
    this.indeterminate = options.indeterminate;
  }
}

export function isIndeterminateStripeError(error: unknown): boolean {
  return error instanceof StripeRequestError && error.indeterminate;
}

function requireAmountCents(value: number): number {
  if (!Number.isSafeInteger(value) || value < 50 || value > 99_999_999) {
    throw new Error('Stripe amount must be an integer between 50 and 99,999,999 cents');
  }
  return value;
}

export function isStripeConfigured(): boolean {
  return /^sk_(?:live|test)_[A-Za-z0-9]{16,}$/.test(process.env.STRIPE_SECRET_KEY ?? '')
    && /^whsec_[A-Za-z0-9]{16,}$/.test(process.env.STRIPE_WEBHOOK_SECRET ?? '')
    && expectedStripeLivemode() !== null;
}

/** Explicitly pin test/live behavior; never let a test event mutate live data. */
export function expectedStripeLivemode(): boolean | null {
  const configured = process.env.STRIPE_LIVEMODE?.trim().toLowerCase();
  const key = process.env.STRIPE_SECRET_KEY ?? '';
  const keyMode = key.startsWith('sk_live_')
    ? true
    : key.startsWith('sk_test_')
      ? false
      : null;
  if (configured !== 'true' && configured !== 'false') return keyMode;
  const configuredMode = configured === 'true';
  return keyMode === configuredMode ? configuredMode : null;
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
  options?: { method?: 'POST' | 'GET'; stripeAccount?: string; idempotencyKey?: string },
): Promise<T> {
  if (expectedStripeLivemode() === null) {
    throw new Error('Stripe is not configured with a valid test or live secret key');
  }
  const headers: Record<string, string> = { ...authHeaders() };
  // Connect: act on the association's own connected account (direct charges —
  // funds settle straight to the association's bank, never the platform's).
  if (options?.stripeAccount) {
    headers['Stripe-Account'] = assertStripeId(options.stripeAccount, 'acct', 'connected Stripe account id');
  }
  if (options?.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
  const method = options?.method ?? (body ? 'POST' : 'GET');
  const canRetry = method === 'GET' || !!options?.idempotencyKey;

  for (let attempt = 1; attempt <= STRIPE_MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), STRIPE_TIMEOUT_MS);
    try {
      const res = await fetch(`${STRIPE_API}${path}`, {
        method,
        headers,
        body: body ? formEncode(body).join('&') : undefined,
        signal: controller.signal,
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) return json as T;

      const retryable = res.status === 409 || res.status === 429 || res.status >= 500;
      if (!canRetry || !retryable || attempt === STRIPE_MAX_ATTEMPTS) {
        throw new StripeRequestError(
          json?.error?.message || `Stripe ${path} failed (${res.status})`,
          {
            retryable,
            // A retryable response or transport failure after an idempotent
            // POST may follow acceptance; the same key must be retried later.
            indeterminate: canRetry && retryable,
          },
        );
      }
    } catch (error) {
      const known = error instanceof StripeRequestError;
      if (!canRetry || (known && !error.retryable)) throw error;
      if (attempt === STRIPE_MAX_ATTEMPTS) {
        if (known) throw error;
        throw new StripeRequestError('Stripe did not return a definitive response.', {
          retryable: true,
          indeterminate: true,
          cause: error,
        });
      }
    } finally {
      clearTimeout(timeout);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 250));
  }
  throw new Error(`Stripe ${path} failed after retries`);
}

// ── Connect: per-association Stripe accounts ────────────────────────────────

/** Create a Standard connected account for an association (its OWN Stripe account). */
export async function createConnectedAccount(params: {
  associationId: string;
  portfolioId: string;
  associationName: string;
  email?: string | null;
}) {
  return stripeRequest<{ id: string }>('/accounts', {
    type: 'standard',
    business_profile: { name: params.associationName },
    email: params.email ?? undefined,
    metadata: {
      association_id: params.associationId,
      portfolio_id: params.portfolioId,
      association_name: params.associationName,
    },
  }, { idempotencyKey: `association-connect-${params.associationId}` });
}

/** One-time onboarding link that walks the association through Stripe setup. */
export async function createAccountLink(accountId: string, refreshUrl: string, returnUrl: string) {
  assertStripeId(accountId, 'acct', 'connected Stripe account id');
  return stripeRequest<{ url: string }>('/account_links', {
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });
}

/** Current status of a connected account (charges_enabled, details_submitted). */
export async function getConnectedAccount(accountId: string) {
  assertStripeId(accountId, 'acct', 'connected Stripe account id');
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
  stripeAccount: string;
}) {
  requireAmountCents(params.amountCents);
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
  }, { stripeAccount: params.stripeAccount, idempotencyKey: `checkout-${params.intentId}` });
}

export async function retrievePaymentIntent(paymentIntentId: string, stripeAccount: string) {
  assertStripeId(paymentIntentId, 'pi', 'Stripe PaymentIntent id');
  return stripeRequest<any>(
    `/payment_intents/${paymentIntentId}?expand[0]=latest_charge&expand[1]=latest_charge.balance_transaction`,
    undefined,
    { stripeAccount },
  );
}

/** Exact balance-transaction membership for one connected-account payout. */
export async function listPayoutBalanceTransactions(payoutId: string, stripeAccount: string) {
  assertStripeId(payoutId, 'po', 'Stripe payout id');
  const rows: any[] = [];
  let startingAfter: string | null = null;
  for (let page = 0; page < 10; page++) {
    const query = new URLSearchParams({ payout: payoutId, limit: '100' });
    if (startingAfter) query.set('starting_after', startingAfter);
    const result = await stripeRequest<{ data: any[]; has_more: boolean }>(
      `/balance_transactions?${query.toString()}`,
      undefined,
      { stripeAccount },
    );
    rows.push(...(result.data ?? []));
    if (!result.has_more || !result.data?.length) return rows;
    startingAfter = result.data[result.data.length - 1].id;
  }
  throw new Error('Stripe payout contains more than 1,000 balance transactions; manual reconciliation required');
}

// ── AutoPay: saved payment methods + off-session charging ───────────────────

/** Checkout in setup mode: saves a card/bank for future off-session AutoPay runs. */
export async function createSetupCheckoutSession(params: {
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
  stripeAccount: string;
  idempotencyKey: string;
}) {
  return stripeRequest<{ id: string; url: string }>('/checkout/sessions', {
    mode: 'setup',
    payment_method_types: ['card', 'us_bank_account'],
    customer_creation: 'always',
    customer_email: params.customerEmail ?? undefined,
    metadata: params.metadata,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  }, { stripeAccount: params.stripeAccount, idempotencyKey: params.idempotencyKey });
}

export async function getSetupIntent(setupIntentId: string, stripeAccount: string) {
  assertStripeId(setupIntentId, 'seti', 'Stripe SetupIntent id');
  return stripeRequest<{
    id: string;
    status: string;
    usage: string;
    payment_method: string | null;
    customer: string | null;
  }>(
    `/setup_intents/${setupIntentId}`, undefined, { stripeAccount });
}

export async function getPaymentMethod(paymentMethodId: string, stripeAccount: string) {
  assertStripeId(paymentMethodId, 'pm', 'Stripe PaymentMethod id');
  return stripeRequest<any>(`/payment_methods/${paymentMethodId}`, undefined, { stripeAccount });
}

/** Charge a saved method without the owner present (AutoPay run). */
export async function createOffSessionPaymentIntent(params: {
  amountCents: number;
  customer: string;
  paymentMethod: string;
  description: string;
  metadata: Record<string, string>;
  stripeAccount: string;
  idempotencyKey: string;
}) {
  requireAmountCents(params.amountCents);
  assertStripeId(params.customer, 'cus', 'Stripe Customer id');
  assertStripeId(params.paymentMethod, 'pm', 'Stripe PaymentMethod id');
  return stripeRequest<{ id: string; status: string; latest_charge?: any }>('/payment_intents', {
    amount: params.amountCents,
    currency: 'usd',
    customer: params.customer,
    payment_method: params.paymentMethod,
    payment_method_types: ['card', 'us_bank_account'],
    confirm: true,
    off_session: true,
    description: params.description,
    metadata: params.metadata,
  }, { stripeAccount: params.stripeAccount, idempotencyKey: params.idempotencyKey });
}

/**
 * Verify a Stripe webhook signature (Stripe-Signature header: t=...,v1=...).
 * Manual HMAC-SHA256 of `${t}.${rawBody}` with the endpoint secret.
 */
export function verifyStripeSignature(rawBody: string, signatureHeader: string | null, toleranceSeconds = 300): boolean {
  if (!signatureHeader || !process.env.STRIPE_WEBHOOK_SECRET) return false;
  const pairs = signatureHeader.split(',').map((kv) => {
    const idx = kv.indexOf('=');
    return [kv.slice(0, idx).trim(), kv.slice(idx + 1).trim()] as const;
  });
  const timestamp = pairs.find(([key]) => key === 't')?.[1];
  const signatures = pairs.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!timestamp || signatures.length === 0) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;

  const expected = createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');
  return signatures.some((signature) => {
    try {
      return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
    } catch {
      return false;
    }
  });
}
