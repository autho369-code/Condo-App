import { describe, expect, it } from 'vitest';
import {
  assertStripeId,
  assertConnectedAccountScope,
  assertStripeMoney,
  payoutChargeIds,
  sumStripeNetCents,
  usdDollarsToCents,
} from '@/lib/payments/stripe-invariants';

describe('association-owned Stripe invariants', () => {
  it('accepts only the expected Stripe object namespace', () => {
    expect(assertStripeId('acct_assocA123', 'acct', 'account')).toBe('acct_assocA123');
    expect(() => assertStripeId('pi_assocA123', 'acct', 'account')).toThrow('Invalid account');
    expect(() => assertStripeId('acct_bad-value', 'acct', 'account')).toThrow('Invalid account');
  });

  it('rejects every cross-association account combination', () => {
    expect(() => assertConnectedAccountScope('acct_assocA', 'acct_assocA', 'acct_assocA')).not.toThrow();
    expect(() => assertConnectedAccountScope('acct_assocA', 'acct_assocB', 'acct_assocA')).toThrow('different association');
    expect(() => assertConnectedAccountScope('acct_assocA', 'acct_assocA', 'acct_assocB')).toThrow('different association');
  });

  it('matches exact USD cents and rejects wrong amount or currency', () => {
    expect(() => assertStripeMoney({ amount_received: 12345, currency: 'usd' }, '123.45', 'amount_received')).not.toThrow();
    expect(() => assertStripeMoney({ amount_received: 12344, currency: 'usd' }, '123.45', 'amount_received')).toThrow();
    expect(() => assertStripeMoney({ amount_received: 12345, currency: 'cad' }, '123.45', 'amount_received')).toThrow();
    expect(usdDollarsToCents(10.01)).toBe(1001);
  });

  it('derives payout membership only from valid charge sources', () => {
    const rows = [
      { id: 'txn_1', net: 9700, source: 'ch_assocA1' },
      { id: 'txn_2', net: -200, source: 'fee_1' },
      { id: 'txn_3', net: 500, source: 'ch_assocA1' },
      { id: 'txn_4', net: 0, source: 'ch_assocA2' },
    ];
    expect(sumStripeNetCents(rows)).toBe(10_000);
    expect(payoutChargeIds(rows)).toEqual(['ch_assocA1', 'ch_assocA2']);
  });

  it('fails closed when Stripe returns malformed payout amounts', () => {
    expect(() => sumStripeNetCents([{ net: '9.5' }])).toThrow('invalid net amount');
  });
});
