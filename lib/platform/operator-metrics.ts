// Shared definitions for the platform-operator dashboards, so the root
// dashboard, Billing, Revenue and Overview agree on what "MRR" and "this
// month" mean.
import { addMonthsToMonth, DEFAULT_TIME_ZONE, todayInZone, zonedWallTimeToUtc } from '@/lib/time/zoned';

/** Subscriptions that are billed (trials and paused/cancelled ones are not revenue). */
export const BILLABLE_SUBSCRIPTION_STATUSES = ['active', 'past_due'] as const;

export function isBillableSubscription(status: string | null | undefined): boolean {
  return (BILLABLE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status ?? '');
}

/** Monthly recurring revenue in cents across billable subscriptions. */
export function monthlyRecurringCents(
  subscriptions: Array<{ status?: string | null; price_monthly_cents?: number | null }>,
): number {
  return subscriptions.reduce(
    (sum, s) => (isBillableSubscription(s.status) ? sum + (Number(s.price_monthly_cents) || 0) : sum),
    0,
  );
}

export type MonthWindow = {
  /** YYYY-MM */
  month: string;
  /** First calendar day, YYYY-MM-DD */
  startDate: string;
  /** Last calendar day, YYYY-MM-DD */
  endDate: string;
  /** Local midnight on the first day, as a UTC ISO instant */
  startIso: string;
  /** Local midnight on the first day of the NEXT month (exclusive bound) */
  endIso: string;
};

function lastDayOfMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const day = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, '0')}`;
}

/**
 * The calendar month `offset` months from the current month in `timeZone`.
 * Server code runs in UTC, so `new Date(y, m, 1)` put month boundaries at
 * UTC midnight (hours off for US companies) — this uses the display zone.
 */
export function monthWindowInZone(timeZone: string, now: Date = new Date(), offset = 0): MonthWindow {
  const month = addMonthsToMonth(todayInZone(timeZone, now).slice(0, 7), offset);
  const next = addMonthsToMonth(month, 1);
  const startIso = zonedWallTimeToUtc(`${month}-01`, '00:00', timeZone)?.toISOString() ?? `${month}-01T00:00:00.000Z`;
  const endIso = zonedWallTimeToUtc(`${next}-01`, '00:00', timeZone)?.toISOString() ?? `${next}-01T00:00:00.000Z`;
  return { month, startDate: `${month}-01`, endDate: lastDayOfMonth(month), startIso, endIso };
}

/** Parse a positive whole number from a form field; null when blank or invalid. */
export function parsePositiveInt(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Parse a non-negative dollar amount into cents; null when blank or invalid. */
export function parseDollarsToCents(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(Number(s) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

/**
 * Past-due platform invoices: still `open` with a billing period that ended
 * before today (Central). Nothing ever sets status 'overdue', so counting that
 * status always showed zero — every operator page uses this one definition.
 */
export const PAST_DUE_INVOICE_STATUS = 'open' as const;

/** Today's date (YYYY-MM-DD) in the platform's billing zone (Central). */
export function platformToday(now: Date = new Date()): string {
  return todayInZone(DEFAULT_TIME_ZONE, now);
}

export function isPastDueInvoice(
  invoice: { status?: string | null; period_end?: string | null },
  today: string = platformToday(),
): boolean {
  return invoice.status === PAST_DUE_INVOICE_STATUS && !!invoice.period_end && invoice.period_end < today;
}

/** Narrow an `invoices` query to past-due rows (see isPastDueInvoice). */
export function pastDueInvoicesFilter(query: any, today: string = platformToday()): any {
  return query.eq('status', PAST_DUE_INVOICE_STATUS).lt('period_end', today);
}
