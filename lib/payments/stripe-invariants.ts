/** Pure, testable invariants shared by Stripe request and webhook code. */

export type StripeIdPrefix = 'acct' | 'ch' | 'cs' | 'cus' | 'evt' | 'pi' | 'pm' | 'po' | 'seti';

export function isStripeId(value: unknown, prefix: StripeIdPrefix): value is string {
  return typeof value === 'string'
    && new RegExp(`^${prefix}_[A-Za-z0-9_]+$`).test(value);
}

export function assertStripeId(value: unknown, prefix: StripeIdPrefix, label: string): string {
  if (!isStripeId(value, prefix)) throw new Error(`Invalid ${label}`);
  return value;
}

export function assertConnectedAccountScope(
  eventAccount: unknown,
  associationAccount: unknown,
  persistedObjectAccount?: unknown,
): void {
  const account = assertStripeId(eventAccount, 'acct', 'connected Stripe account id');
  if (associationAccount !== account
      || (persistedObjectAccount != null && persistedObjectAccount !== account)) {
    throw new Error('Stripe object is bound to a different association account');
  }
}

export function usdDollarsToCents(value: unknown): number {
  const dollars = typeof value === 'string' ? Number(value) : value;
  if (typeof dollars !== 'number' || !Number.isFinite(dollars) || dollars < 0) {
    throw new Error('Invalid USD amount');
  }
  const cents = Math.round((dollars + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(cents)) throw new Error('USD amount is outside the supported range');
  return cents;
}

export function assertStripeMoney(
  object: Record<string, unknown>,
  expectedDollars: unknown,
  amountField: string,
): void {
  const actualCents = Number(object[amountField]);
  if (!Number.isSafeInteger(actualCents)
      || actualCents !== usdDollarsToCents(expectedDollars)
      || String(object.currency ?? '').toLowerCase() !== 'usd') {
    throw new Error('Stripe event amount or currency does not match the payment intent');
  }
}

export function sumStripeNetCents(transactions: Array<Record<string, unknown>>): number {
  return transactions.reduce((sum, transaction) => {
    const net = Number(transaction.net);
    if (!Number.isSafeInteger(net)) throw new Error('Stripe payout contains an invalid net amount');
    const next = sum + net;
    if (!Number.isSafeInteger(next)) throw new Error('Stripe payout net amount is outside the supported range');
    return next;
  }, 0);
}

export function payoutChargeIds(transactions: Array<Record<string, unknown>>): string[] {
  return Array.from(new Set(
    transactions
      .map((transaction) => transaction.source)
      .filter((source): source is string => isStripeId(source, 'ch')),
  ));
}
