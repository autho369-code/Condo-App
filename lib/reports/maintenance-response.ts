// Maintenance response times: how fast service requests get a first reply
// and get resolved, and how fast work orders get completed. Pure functions
// over rows the caller already scoped (RLS for the live page, portfolio
// filter for exports), so the page and the export compute the same numbers.

export type ResponseRequest = {
  association_id: string | null;
  priority: string | null;
  status: string | null;
  created_at: string;
  first_response_due_at: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
};

export type ResponseWorkOrder = {
  association_id: string | null;
  priority: string | null;
  status: string | null;
  created_at: string;
  completed_date: string | null;
};

export type ResponseMetrics = {
  requests: number;
  withTarget: number;
  onTime: number;
  late: number;
  overdueNow: number;
  /** Share of requests with a target that were answered by it (null: none had a target). */
  onTimeRate: number | null;
  medianHoursToRespond: number | null;
  resolved: number;
  medianDaysToResolve: number | null;
  workOrders: number;
  completed: number;
  medianDaysToComplete: number | null;
};

const HOUR = 3_600_000;
const DAY = 86_400_000;
const OPEN_REQUEST = new Set(['open', 'waiting']);
const DONE_WORK_ORDER = new Set(['done', 'completed', 'billed', 'closed']);
export const PRIORITIES = ['emergency', 'high', 'normal', 'low'] as const;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const ms = (iso: string | null) => (iso ? Date.parse(iso) : NaN);

/** Days from a timestamp to a calendar date (completed_date has no time). */
function daysToDate(createdAt: string, completedDate: string): number {
  return Math.max(0, Math.round((Date.parse(`${completedDate}T00:00:00Z`) - Date.parse(`${createdAt.slice(0, 10)}T00:00:00Z`)) / DAY));
}

export function responseMetrics(requests: ResponseRequest[], workOrders: ResponseWorkOrder[], now = new Date()): ResponseMetrics {
  const nowMs = now.getTime();
  let withTarget = 0, onTime = 0, late = 0, overdueNow = 0, resolved = 0;
  const respondHours: number[] = [];
  const resolveDays: number[] = [];

  for (const r of requests) {
    const created = ms(r.created_at);
    const due = ms(r.first_response_due_at);
    const ack = ms(r.acknowledged_at);
    if (!Number.isNaN(due)) {
      withTarget++;
      if (!Number.isNaN(ack)) {
        if (ack <= due) onTime++; else late++;
      } else if (due < nowMs && OPEN_REQUEST.has(String(r.status))) {
        overdueNow++;
      }
    }
    if (!Number.isNaN(ack) && !Number.isNaN(created)) respondHours.push(Math.max(0, (ack - created) / HOUR));
    const res = ms(r.resolved_at);
    if (!Number.isNaN(res) && !Number.isNaN(created)) {
      resolved++;
      resolveDays.push(Math.max(0, (res - created) / DAY));
    }
  }

  const completeDays: number[] = [];
  let completed = 0;
  for (const w of workOrders) {
    if (w.completed_date) {
      completed++;
      completeDays.push(daysToDate(w.created_at, w.completed_date));
    } else if (DONE_WORK_ORDER.has(String(w.status))) {
      completed++;
    }
  }

  return {
    requests: requests.length,
    withTarget,
    onTime,
    late,
    overdueNow,
    onTimeRate: withTarget > 0 ? onTime / withTarget : null,
    medianHoursToRespond: median(respondHours),
    resolved,
    medianDaysToResolve: median(resolveDays),
    workOrders: workOrders.length,
    completed,
    medianDaysToComplete: median(completeDays),
  };
}

export type OpenAging = { bucket: string; count: number }[];

/** Open work orders by age today, whatever period they were created in. */
export function openWorkOrderAging(workOrders: ResponseWorkOrder[], now = new Date()): OpenAging {
  const buckets = [
    { bucket: '0–7 days', max: 7, count: 0 },
    { bucket: '8–30 days', max: 30, count: 0 },
    { bucket: '31–60 days', max: 60, count: 0 },
    { bucket: 'Over 60 days', max: Infinity, count: 0 },
  ];
  for (const w of workOrders) {
    if (w.completed_date || DONE_WORK_ORDER.has(String(w.status)) || w.status === 'cancelled') continue;
    const age = Math.max(0, Math.floor((now.getTime() - Date.parse(w.created_at)) / DAY));
    buckets.find((b) => age <= b.max)!.count++;
  }
  return buckets.map(({ bucket, count }) => ({ bucket, count }));
}

export function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row); else map.set(k, [row]);
  }
  return map;
}

export const hoursLabel = (h: number | null) => (h == null ? '—' : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} days`);
export const daysLabel = (d: number | null) => (d == null ? '—' : `${d.toFixed(1)} days`);
export const rateLabel = (r: number | null) => (r == null ? '—' : `${Math.round(r * 100)}%`);

/** Export rows: one per association plus a total row. */
export function responseExportRows(
  requests: ResponseRequest[],
  workOrders: ResponseWorkOrder[],
  associationNames: Map<string, string>,
  now = new Date(),
): Record<string, unknown>[] {
  const reqBy = groupBy(requests, (r) => r.association_id ?? '');
  const woBy = groupBy(workOrders, (w) => w.association_id ?? '');
  const ids = [...new Set([...reqBy.keys(), ...woBy.keys()])]
    .sort((a, b) => (associationNames.get(a) ?? '').localeCompare(associationNames.get(b) ?? ''));
  const row = (name: string, m: ResponseMetrics) => ({
    association: name,
    requests: m.requests,
    answered_on_time: m.onTime,
    answered_late: m.late,
    overdue_unanswered: m.overdueNow,
    on_time_rate: m.onTimeRate == null ? null : Math.round(m.onTimeRate * 100) / 100,
    median_hours_to_respond: m.medianHoursToRespond == null ? null : Math.round(m.medianHoursToRespond * 10) / 10,
    resolved: m.resolved,
    median_days_to_resolve: m.medianDaysToResolve == null ? null : Math.round(m.medianDaysToResolve * 10) / 10,
    work_orders: m.workOrders,
    work_orders_completed: m.completed,
    median_days_to_complete: m.medianDaysToComplete == null ? null : Math.round(m.medianDaysToComplete * 10) / 10,
  });
  const rows = ids.map((id) => row(associationNames.get(id) ?? (id ? 'Association' : 'No association'), responseMetrics(reqBy.get(id) ?? [], woBy.get(id) ?? [], now)));
  if (rows.length > 0) rows.push(row('All associations', responseMetrics(requests, workOrders, now)));
  return rows;
}
