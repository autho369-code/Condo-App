// Monthly platform usage, built from usage_metrics (one row per company per
// month, refreshed nightly by aggregate_usage_metrics). Months are calendar
// months in UTC, as the aggregation job counts them.

export const USAGE_FIELDS = [
  { key: 'unit_count', label: 'Doors', kind: 'level' },
  { key: 'association_count', label: 'Associations', kind: 'level' },
  { key: 'staff_count', label: 'Staff users', kind: 'level' },
  { key: 'owner_count', label: 'Owner accounts', kind: 'level' },
  { key: 'work_orders_created', label: 'Work orders', kind: 'activity' },
  { key: 'service_requests_created', label: 'Service requests', kind: 'activity' },
  { key: 'bills_posted', label: 'Bills', kind: 'activity' },
  { key: 'payments_received', label: 'Payments', kind: 'activity' },
  { key: 'emails_sent', label: 'Emails', kind: 'activity' },
  { key: 'sms_sent', label: 'Texts', kind: 'activity' },
  { key: 'api_calls', label: 'API calls', kind: 'activity' },
] as const;

/**
 * First month whose staff count includes company admins (before it, staff
 * meant managers only). Staff changes across this month aren't comparable.
 */
export const STAFF_DEFINITION_MONTH = '2026-10';

/** Whether a staff-count change from `previous` to `current` mixes the two definitions. */
export function staffDefinitionChanged(current: string, previous: string): boolean {
  return previous < STAFF_DEFINITION_MONTH && current >= STAFF_DEFINITION_MONTH;
}

export type UsageField = (typeof USAGE_FIELDS)[number]['key'];

export type UsageRow = {
  portfolio_id: string;
  period_year: number;
  period_month: number;
} & Partial<Record<UsageField, number | null>>;

export type MonthTotals = { month: string; companies: number } & Record<UsageField, number>;

/** YYYY-MM for a usage row. */
export function monthKey(row: { period_year: number; period_month: number }): string {
  return `${row.period_year}-${String(row.period_month).padStart(2, '0')}`;
}

/** The month before a YYYY-MM month. */
export function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

function emptyTotals(month: string): MonthTotals {
  const totals = { month, companies: 0 } as MonthTotals;
  for (const f of USAGE_FIELDS) totals[f.key] = 0;
  return totals;
}

/** Platform totals per month, newest month first. */
export function totalsByMonth(rows: UsageRow[]): MonthTotals[] {
  const byMonth = new Map<string, MonthTotals>();
  for (const row of rows) {
    const month = monthKey(row);
    const totals = byMonth.get(month) ?? emptyTotals(month);
    totals.companies += 1;
    for (const f of USAGE_FIELDS) totals[f.key] += Number(row[f.key] ?? 0) || 0;
    byMonth.set(month, totals);
  }
  return [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month));
}

/** Change from `previous` to `current` as a whole percent; null when there is no base to compare. */
export function percentChange(current: number, previous: number | null | undefined): number | null {
  if (previous == null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** "+12% vs Sep" style text, or a plain note when there is nothing to compare. */
export function changeLabel(current: number, previous: number | null | undefined, previousLabel: string): string {
  if (previous == null) return 'No earlier month';
  const pct = percentChange(current, previous);
  if (pct === null) return current === 0 ? `None in ${previousLabel} either` : `Up from 0 in ${previousLabel}`;
  if (pct === 0) return `Same as ${previousLabel}`;
  return `${pct > 0 ? '+' : ''}${pct}% vs ${previousLabel}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Oct 2026" for 2026-10. */
export function monthLabel(month: string, withYear = true): string {
  const [y, m] = month.split('-').map(Number);
  const name = MONTHS[(m || 1) - 1] ?? month;
  return withYear ? `${name} ${y}` : name;
}
