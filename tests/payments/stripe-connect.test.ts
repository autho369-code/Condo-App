import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCheckoutSession,
  createOffSessionPaymentIntent,
  createSetupCheckoutSession,
  expectedStripeLivemode,
  isIndeterminateStripeError,
  isStripeConfigured,
} from '@/lib/payments/stripe';

function stripeResponse(payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('Stripe Connect direct-charge requests', () => {
  beforeEach(() => {
    vi.stubEnv('STRIPE_SECRET_KEY', ['sk', 'test', 'fixture'].join('_'));
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', ['whsec', 'fixture'].join('_'));
    vi.stubEnv('STRIPE_LIVEMODE', 'false');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('creates owner checkout on the association account with a stable key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(stripeResponse({ id: 'cs_test_1', url: 'https://checkout.stripe.test/1' }));
    vi.stubGlobal('fetch', fetchMock);

    await createCheckoutSession({
      intentId: 'f7f79522-827b-4ea1-a06d-4eb199956196',
      amountCents: 12_345,
      description: 'Association assessment',
      successUrl: 'https://example.test/success',
      cancelUrl: 'https://example.test/cancel',
      metadata: { association_id: '4c22cac7-f006-4a4e-bf43-85a571116c27' },
      stripeAccount: 'acct_Association123',
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Stripe-Account']).toBe('acct_Association123');
    expect(headers['Idempotency-Key']).toBe('checkout-f7f79522-827b-4ea1-a06d-4eb199956196');
    expect(String(init.body)).not.toContain('transfer_data');
    expect(String(init.body)).not.toContain('destination');
  });

  it('fails configuration closed when the explicit mode and secret key disagree', () => {
    expect(expectedStripeLivemode()).toBe(false);
    expect(isStripeConfigured()).toBe(true);
    vi.stubEnv('STRIPE_LIVEMODE', 'true');
    expect(expectedStripeLivemode()).toBeNull();
    expect(isStripeConfigured()).toBe(false);
  });

  it('uses the persisted setup/run key on association-scoped AutoPay requests', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(stripeResponse({ id: 'cs_setup_1', url: 'https://checkout.stripe.test/setup' }))
      .mockResolvedValueOnce(stripeResponse({ id: 'pi_AutoPay123', status: 'processing' }));
    vi.stubGlobal('fetch', fetchMock);

    await createSetupCheckoutSession({
      successUrl: 'https://example.test/success',
      cancelUrl: 'https://example.test/cancel',
      metadata: { purpose: 'autopay_setup', setup_attempt_id: 'attempt-id' },
      stripeAccount: 'acct_Association123',
      idempotencyKey: 'autopay-setup-attempt-id',
    });
    await createOffSessionPaymentIntent({
      amountCents: 25_000,
      customer: 'cus_Association123',
      paymentMethod: 'pm_Association123',
      description: 'Monthly AutoPay',
      metadata: { autopay_run_id: 'run-id' },
      stripeAccount: 'acct_Association123',
      idempotencyKey: 'autopay-run-run-id',
    });

    const setupHeaders = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    const runHeaders = fetchMock.mock.calls[1][1]?.headers as Record<string, string>;
    expect(setupHeaders['Stripe-Account']).toBe('acct_Association123');
    expect(setupHeaders['Idempotency-Key']).toBe('autopay-setup-attempt-id');
    expect(runHeaders['Stripe-Account']).toBe('acct_Association123');
    expect(runHeaders['Idempotency-Key']).toBe('autopay-run-run-id');
  });

  it('classifies an exhausted idempotent transport failure as indeterminate', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('connection reset'));
    vi.stubGlobal('fetch', fetchMock);

    const pending = createOffSessionPaymentIntent({
      amountCents: 25_000,
      customer: 'cus_Association123',
      paymentMethod: 'pm_Association123',
      description: 'Monthly AutoPay',
      metadata: { autopay_run_id: 'run-id' },
      stripeAccount: 'acct_Association123',
      idempotencyKey: 'autopay-run-run-id',
    }).catch((caught) => caught);
    await vi.runAllTimersAsync();

    const error = await pending;
    expect(isIndeterminateStripeError(error)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});
