export const MAX_ONLINE_PAYMENT_CENTS = 5_000_000;

export const AUTOPAY_MODES = [
  'current_balance',
  'fixed',
  'recurring_only',
  'special_only',
  'minimum',
] as const;

export type AutopayMode = (typeof AUTOPAY_MODES)[number];

export interface StripeReadyAssociation {
  stripe_account_id?: string | null;
  stripe_charges_enabled?: boolean | null;
  stripe_payouts_enabled?: boolean | null;
  stripe_deauthorized_at?: string | null;
}

export interface AutopayConfiguration {
  mode: AutopayMode;
  dayOfMonth: number;
  maxCents: number;
  fixedCents: number | null;
  minimumCents: number | null;
  includeLateFees: boolean;
}

export type AutopayConfigurationResult =
  | { ok: true; value: AutopayConfiguration }
  | { ok: false; error: string };

export function isStripeAccountId(value: unknown): value is string {
  return typeof value === 'string' && /^acct_[A-Za-z0-9]+$/.test(value);
}

/** Parse a user-entered USD amount without accepting exponent notation or fractions of a cent. */
export function parseUsdCents(value: unknown, maxCents = MAX_ONLINE_PAYMENT_CENTS): number | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/^\$/, '');
  if (!/^(?:(?:\d{1,3}(?:,\d{3})+)|\d+)(?:\.\d{1,2})?$/.test(normalized)) return null;

  const [whole, fraction = ''] = normalized.replace(/,/g, '').split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents < 100 || cents > maxCents) return null;
  return cents;
}

export function associationCanAcceptStripePayments(association: StripeReadyAssociation | null | undefined): boolean {
  return !!association
    && isStripeAccountId(association.stripe_account_id)
    && association.stripe_charges_enabled === true
    && association.stripe_payouts_enabled === true
    && !association.stripe_deauthorized_at;
}

export function parseAutopayConfiguration(input: {
  mode: unknown;
  dayOfMonth: unknown;
  maxAmount: unknown;
  fixedAmount: unknown;
  minimumAmount: unknown;
  includeLateFees: boolean;
}): AutopayConfigurationResult {
  if (typeof input.mode !== 'string' || !AUTOPAY_MODES.includes(input.mode as AutopayMode)) {
    return { ok: false, error: 'Choose a valid AutoPay mode.' };
  }
  const mode = input.mode as AutopayMode;
  const dayOfMonth = Number(input.dayOfMonth);
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) {
    return { ok: false, error: 'Choose a run day from 1 through 28.' };
  }

  const maxCents = parseUsdCents(input.maxAmount);
  if (maxCents === null) {
    return { ok: false, error: 'Set a maximum withdrawal from $1.00 through $50,000.00.' };
  }

  const fixedCents = mode === 'fixed' ? parseUsdCents(input.fixedAmount) : null;
  if (mode === 'fixed' && fixedCents === null) {
    return { ok: false, error: 'Enter a valid fixed monthly amount.' };
  }
  if (fixedCents !== null && fixedCents > maxCents) {
    return { ok: false, error: 'The fixed monthly amount cannot exceed the withdrawal cap.' };
  }

  const minimumCents = mode === 'minimum' ? parseUsdCents(input.minimumAmount) : null;
  if (mode === 'minimum' && minimumCents === null) {
    return { ok: false, error: 'Enter a valid minimum payment amount.' };
  }
  if (minimumCents !== null && minimumCents > maxCents) {
    return { ok: false, error: 'The minimum payment cannot exceed the withdrawal cap.' };
  }

  return {
    ok: true,
    value: {
      mode,
      dayOfMonth,
      maxCents,
      fixedCents,
      minimumCents,
      includeLateFees: input.includeLateFees,
    },
  };
}

export function nextMonthlyRunDate(dayOfMonth: number, reference = new Date()): string {
  const day = Math.min(28, Math.max(1, Math.trunc(dayOfMonth) || 1));
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, day))
    .toISOString()
    .slice(0, 10);
}

