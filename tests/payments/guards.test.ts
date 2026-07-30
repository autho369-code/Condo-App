import { describe, expect, it } from 'vitest';
import {
  associationCanAcceptStripePayments,
  isStripeAccountId,
  nextMonthlyRunDate,
  parseAutopayConfiguration,
  parseUsdCents,
} from '@/lib/payments/guards';

describe('association-owned payment guards', () => {
  it('parses USD as exact cents and rejects ambiguous or unsafe amounts', () => {
    expect(parseUsdCents('1')).toBe(100);
    expect(parseUsdCents('$1,234.50')).toBe(123_450);
    expect(parseUsdCents('50000.00')).toBe(5_000_000);
    expect(parseUsdCents('0.99')).toBeNull();
    expect(parseUsdCents('1.001')).toBeNull();
    expect(parseUsdCents('1e3')).toBeNull();
    expect(parseUsdCents('50000.01')).toBeNull();
    expect(parseUsdCents('12,34.00')).toBeNull();
  });

  it('requires the association account, charges, payouts, and authorization state', () => {
    const ready = {
      stripe_account_id: 'acct_Association123',
      stripe_charges_enabled: true,
      stripe_payouts_enabled: true,
      stripe_deauthorized_at: null,
    };
    expect(isStripeAccountId(ready.stripe_account_id)).toBe(true);
    expect(associationCanAcceptStripePayments(ready)).toBe(true);
    expect(associationCanAcceptStripePayments({ ...ready, stripe_payouts_enabled: false })).toBe(false);
    expect(associationCanAcceptStripePayments({ ...ready, stripe_deauthorized_at: '2026-07-26T00:00:00Z' })).toBe(false);
    expect(associationCanAcceptStripePayments({ ...ready, stripe_account_id: 'acct_other-account' })).toBe(false);
  });

  it('validates mode-specific AutoPay amounts against the owner cap', () => {
    const fixed = parseAutopayConfiguration({
      mode: 'fixed',
      dayOfMonth: '28',
      maxAmount: '500.00',
      fixedAmount: '350.25',
      minimumAmount: '',
      includeLateFees: true,
    });
    expect(fixed).toEqual({
      ok: true,
      value: {
        mode: 'fixed',
        dayOfMonth: 28,
        maxCents: 50_000,
        fixedCents: 35_025,
        minimumCents: null,
        includeLateFees: true,
      },
    });

    expect(parseAutopayConfiguration({
      mode: 'fixed',
      dayOfMonth: '29',
      maxAmount: '100.00',
      fixedAmount: '150.00',
      minimumAmount: '',
      includeLateFees: false,
    }).ok).toBe(false);
    expect(parseAutopayConfiguration({
      mode: 'minimum',
      dayOfMonth: '1',
      maxAmount: '100.00',
      fixedAmount: '',
      minimumAmount: '150.00',
      includeLateFees: false,
    }).ok).toBe(false);
  });

  it('computes the next monthly run in UTC across year boundaries', () => {
    expect(nextMonthlyRunDate(31, new Date('2026-12-15T23:59:00Z'))).toBe('2027-01-28');
    expect(nextMonthlyRunDate(1, new Date('2026-01-31T23:59:00-08:00'))).toBe('2026-03-01');
  });
});
