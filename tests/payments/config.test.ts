import { describe, expect, it } from 'vitest';

import { isStripePaymentsConfigured } from '@/lib/payments/config';

describe('payment configuration', () => {
  it('treats missing or placeholder Stripe secrets as disabled', () => {
    expect(isStripePaymentsConfigured(undefined)).toBe(false);
    expect(isStripePaymentsConfigured('')).toBe(false);
    expect(isStripePaymentsConfigured('sk_test_...')).toBe(false);
  });

  it('treats real-looking Stripe secret keys as enabled', () => {
    expect(isStripePaymentsConfigured('sk_test_1234567890')).toBe(true);
    expect(isStripePaymentsConfigured('sk_live_1234567890')).toBe(true);
  });
});
