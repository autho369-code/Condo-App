import { parseAppfolioReport, splitGroupHeading } from './appfolio';

// AppFolio's "Work Order" report (Row Groups: Property) read into work orders
// grouped by property, with dates normalized and AppFolio's status and
// priority mapped onto Portier369's work_order_status / work_order_priority
// enums. Client-safe (no server imports): the import page previews in the
// browser and the server action re-validates every value.

/** public.work_order_status (supabase/migrations baseline). */
export const WORK_ORDER_STATUSES = ['new', 'assigned', 'scheduled', 'in_progress', 'done', 'completed', 'billed', 'closed', 'cancelled'] as const;
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];
/** public.work_order_priority. */
export const WORK_ORDER_PRIORITIES = ['low', 'normal', 'high', 'emergency'] as const;
export type WorkOrderPriority = (typeof WORK_ORDER_PRIORITIES)[number];

/** Columns that identify the export as AppFolio's Work Order report. */
export const WORK_ORDER_HEADERS = ['Work Order Number', 'Status'] as const;

export type AppfolioWorkOrder = {
  /** Spreadsheet line number. */
  row: string;
  /** AppFolio's work order number, e.g. "1234-1". */
  number: string;
  unit: string | null;
  vendor: string | null;
  status: WorkOrderStatus;
  /** The status as AppFolio wrote it. */
  appfolio_status: string;
  priority: WorkOrderPriority;
  appfolio_priority: string;
  /** Internal / Resident / Unit Turn. */
  type: string | null;
  issue: string | null;
  job_description: string | null;
  instructions: string | null;
  primary_resident: string | null;
  /** YYYY-MM-DD. */
  created_on: string | null;
  scheduled_date: string | null;
  /** HH:MM:00 (24h), from Scheduled Start when it has a time. */
  scheduled_time: string | null;
  scheduled_end: string | null;
  work_done_on: string | null;
  completed_on: string | null;
  estimate_requested_on: string | null;
  estimated_on: string | null;
  estimate_amount: number | null;
  estimate_approval_status: string | null;
  estimate_approved_on: string | null;
  amount: number | null;
  invoice: string | null;
  unit_turn_id: string | null;
  recurring: string | null;
  home_warranty_expiration: string | null;
};

export type AppfolioWorkOrderGroup = {
  name: string;
  address: string | null;
  workOrders: AppfolioWorkOrder[];
  /** Rows skipped or values mapped to a default, worded for the person importing. */
  warnings: string[];
};

const STATUS_MAP: Record<string, WorkOrderStatus> = {
  new: 'new',
  'estimate requested': 'new',
  estimated: 'new',
  assigned: 'assigned',
  'assigned by appfolio': 'assigned',
  scheduled: 'scheduled',
  waiting: 'in_progress',
  'in progress': 'in_progress',
  'work done': 'done',
  'ready to bill': 'done',
  completed: 'completed',
  'completed no need to bill': 'completed',
  'completed - no need to bill': 'completed',
  billed: 'billed',
  closed: 'closed',
  canceled: 'cancelled',
  cancelled: 'cancelled',
};

const PRIORITY_MAP: Record<string, WorkOrderPriority> = {
  low: 'low',
  normal: 'normal',
  medium: 'normal',
  high: 'high',
  urgent: 'high',
  emergency: 'emergency',
};

const key = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * A status as shown and stored here: the old system's own name is dropped
 * ("Assigned by AppFolio" -> "Assigned"), so it never appears in the product.
 */
export const neutralStatus = (status: string) =>
  status.replace(/\s*\bby\s+appfolio\b/gi, '').replace(/\bappfolio\b/gi, 'previous system').trim();

/**
 * AppFolio status -> Portier status. "Estimate Requested" / "Estimated" mean a
 * vendor was asked for a price, so they count as assigned when the work order
 * names a vendor. Unknown or blank -> "new" with `known: false`.
 */
export function mapAppfolioStatus(status: string, hasVendor = false): { status: WorkOrderStatus; known: boolean } {
  const k = key(status);
  const mapped = STATUS_MAP[k];
  if (!mapped) return { status: 'new', known: false };
  if ((k === 'estimate requested' || k === 'estimated') && hasVendor) return { status: 'assigned', known: true };
  return { status: mapped, known: true };
}

/** AppFolio priority -> Portier priority. Blank -> normal (known); unknown -> normal with `known: false`. */
export function mapAppfolioPriority(priority: string): { priority: WorkOrderPriority; known: boolean } {
  const k = key(priority);
  if (!k) return { priority: 'normal', known: true };
  const mapped = PRIORITY_MAP[k];
  return mapped ? { priority: mapped, known: true } : { priority: 'normal', known: false };
}

const pad = (n: number) => String(n).padStart(2, '0');

function validDate(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * "10/05/2026", "10/5/26 2:31 PM", "10/05/2026 at 14:31" or "2026-10-05[T14:31]"
 * -> { date: "2026-10-05", time: "14:31:00" | null }. Anything else -> null.
 */
export function parseAppfolioDateTime(v: string | undefined): { date: string; time: string | null } | null {
  const s = (v ?? '').trim();
  if (!s) return null;
  let y: number, m: number, d: number;
  let rest: string;
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})\b(.*)$/);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
  if (us) {
    m = Number(us[1]); d = Number(us[2]); y = Number(us[3]);
    // Two-digit years: 70-99 are 1900s, 00-69 are 2000s (same pivot as the vendor import).
    if (us[3].length === 2) y += y >= 70 ? 1900 : 2000;
    rest = us[4];
  } else if (iso) {
    y = Number(iso[1]); m = Number(iso[2]); d = Number(iso[3]);
    rest = iso[4];
  } else {
    return null;
  }
  const date = validDate(y, m, d);
  if (!date) return null;
  const t = rest.trim().replace(/^(T|at\s+|,\s*)/i, '').match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?\s*([AaPp]\.?[Mm]\.?)?/);
  if (!t) return { date, time: null };
  let h = Number(t[1]);
  const min = Number(t[2]);
  const ampm = t[3]?.replace(/\./g, '').toLowerCase();
  if (ampm) {
    if (h < 1 || h > 12) return { date, time: null };
    if (ampm === 'pm' && h !== 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
  }
  if (h > 23 || min > 59) return { date, time: null };
  return { date, time: `${pad(h)}:${pad(min)}:00` };
}

export const parseAppfolioDate = (v: string | undefined): string | null => parseAppfolioDateTime(v)?.date ?? null;

/** "$1,234.50" -> 1234.5, "(12.00)" -> -12. Blank or unreadable -> null. */
export function parseAppfolioAmount(v: string | undefined): number | null {
  let s = (v ?? '').trim();
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[()$,\s-]/g, '');
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round((negative ? -n : n) * 100) / 100;
}

const text = (v: string | undefined): string | null => {
  const s = (v ?? '').trim();
  return s ? s : null;
};

/** Read AppFolio's Work Order report into work orders grouped by property. */
export function parseAppfolioWorkOrders(input: string): { groups?: AppfolioWorkOrderGroup[]; error?: string } {
  const { report, error } = parseAppfolioReport(input);
  if (!report) return { error };
  const missing = WORK_ORDER_HEADERS.filter((h) => !report.headers.includes(h));
  if (missing.length) {
    return { error: `This doesn't look like a Work Order report (missing ${missing.join(', ')}).` };
  }

  const out = new Map<string, AppfolioWorkOrderGroup>();
  for (const g of report.groups) {
    for (const r of g.rows) {
      // Grouped export -> the "-> ..." heading; flat export -> the Property column.
      const column = (r['Property Name'] || r['Property'] || '').trim();
      const heading = g.heading || column;
      const { name, address } = g.heading
        ? { name: g.name, address: g.address }
        : splitGroupHeading(column);
      const groupKey = heading || '(no property)';
      if (!out.has(groupKey)) {
        out.set(groupKey, { name: name || groupKey, address: address ?? text(r['Property Address']), workOrders: [], warnings: [] });
      }
      const group = out.get(groupKey)!;

      const number = (r['Work Order Number'] ?? '').trim();
      if (!number) {
        group.warnings.push(`Line ${r.row}: no work order number; skipped.`);
        continue;
      }
      const vendor = text(r['Vendor']);
      const appfolioStatus = (r['Status'] ?? '').trim();
      const appfolioPriority = (r['Priority'] ?? '').trim();
      const status = mapAppfolioStatus(appfolioStatus, vendor !== null);
      const priority = mapAppfolioPriority(appfolioPriority);
      if (!status.known) {
        group.warnings.push(`Line ${r.row} (WO ${number}): status "${neutralStatus(appfolioStatus) || 'blank'}" has no match here; it will be imported as New.`);
      }
      if (!priority.known) {
        group.warnings.push(`Line ${r.row} (WO ${number}): priority "${appfolioPriority}" has no match here; it will be imported as Normal.`);
      }
      const scheduled = parseAppfolioDateTime(r['Scheduled Start']);
      group.workOrders.push({
        row: r.row,
        number,
        unit: text(r['Unit']),
        vendor,
        status: status.status,
        appfolio_status: neutralStatus(appfolioStatus),
        priority: priority.priority,
        appfolio_priority: appfolioPriority,
        type: text(r['Work Order Type']),
        issue: text(r['Work Order Issue']),
        job_description: text(r['Job Description']),
        instructions: text(r['Instructions']),
        primary_resident: text(r['Primary Resident']),
        created_on: parseAppfolioDate(r['Created At']),
        scheduled_date: scheduled?.date ?? null,
        scheduled_time: scheduled?.time ?? null,
        scheduled_end: parseAppfolioDate(r['Scheduled End']),
        work_done_on: parseAppfolioDate(r['Work Done On']),
        completed_on: parseAppfolioDate(r['Completed On']),
        estimate_requested_on: parseAppfolioDate(r['Estimate Req On']),
        estimated_on: parseAppfolioDate(r['Estimated On']),
        estimate_amount: parseAppfolioAmount(r['Estimate Amount']),
        estimate_approval_status: text(r['Estimate Approval Status']),
        estimate_approved_on: parseAppfolioDate(r['Estimate Approved On']),
        amount: parseAppfolioAmount(r['Amount']),
        invoice: text(r['Invoice']),
        unit_turn_id: text(r['Unit Turn ID']),
        recurring: text(r['Recurring']),
        home_warranty_expiration: parseAppfolioDate(r['Home Warranty Expiration']),
      });
    }
  }
  const groups = [...out.values()].filter((g) => g.workOrders.length || g.warnings.length);
  if (!groups.some((g) => g.workOrders.length)) return { error: 'The file has no work orders.' };
  return { groups };
}
