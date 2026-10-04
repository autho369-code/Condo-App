// Pure helpers for the vendor portal (app/vendor/*). No I/O, so they are
// unit-tested in portal.test.ts.

/** Statuses a vendor may set on their own work order (mirrors work_orders_vendor_update_guard). */
export const VENDOR_SETTABLE_STATUSES = ['scheduled', 'in_progress', 'done'] as const;
export type VendorSettableStatus = (typeof VENDOR_SETTABLE_STATUSES)[number];

/**
 * Current statuses the DB guard lets a vendor move away from. A job the vendor
 * marked done is final for them: only staff can reopen it (reopening would
 * also restore the vendor's access to the property's site notes).
 */
const VENDOR_CHANGEABLE_FROM = new Set(['new', 'assigned', 'scheduled', 'in_progress']);

/** Work-order statuses the submit_vendor_invoice RPC accepts. */
export const VENDOR_INVOICEABLE_STATUSES = ['done', 'completed', 'billed', 'closed'] as const;

export function isVendorSettableStatus(value: unknown): value is VendorSettableStatus {
  return typeof value === 'string' && (VENDOR_SETTABLE_STATUSES as readonly string[]).includes(value);
}

/** Whether a vendor may move a job from `current` to `next` (same rule as the DB guard). */
export function canVendorChangeStatus(current: string | null | undefined, next: string): boolean {
  return VENDOR_CHANGEABLE_FROM.has(String(current ?? '')) && isVendorSettableStatus(next);
}

export function isVendorInvoiceable(status: string | null | undefined): boolean {
  return (VENDOR_INVOICEABLE_STATUSES as readonly string[]).includes(String(status ?? ''));
}

/** Add whole days to a YYYY-MM-DD calendar date. */
export function addDaysToDate(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export type ComplianceState = 'missing' | 'expired' | 'expiring' | 'current';

/**
 * Compare a YYYY-MM-DD expiration date with today's local calendar date.
 * A document expiring today is still valid today; within `soonDays` is "expiring".
 */
export function complianceState(expires: string | null | undefined, today: string, soonDays = 30): ComplianceState {
  const day = typeof expires === 'string' ? expires.slice(0, 10) : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return 'missing';
  if (day < today) return 'expired';
  if (day <= addDaysToDate(today, soonDays)) return 'expiring';
  return 'current';
}
