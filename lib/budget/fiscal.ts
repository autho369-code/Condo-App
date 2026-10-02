import { csvCell } from '@/lib/csv/cell';

// Fiscal-year helpers shared by the budget worksheet and budget-vs-actual
// views. Mirrors association_fiscal_window() in the database: fiscal year N
// is the one that ENDS in calendar year N, and budget_lines.monthly_amounts[i]
// is the i-th month of that fiscal year.

const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function normalizeStartMonth(start: number | null | undefined) {
  const n = Number(start);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : 1;
}

/** Month labels in fiscal order, e.g. start 7 → Jul … Jun. */
export function fiscalMonthLabels(startMonth: number | null | undefined) {
  const s = normalizeStartMonth(startMonth);
  return Array.from({ length: 12 }, (_, i) => SHORT[(s - 1 + i) % 12]);
}

/** First and last day (YYYY-MM-DD) of fiscal year `fy`. */
export function fiscalWindow(fy: number, startMonth: number | null | undefined) {
  const s = normalizeStartMonth(startMonth);
  const startYear = s === 1 ? fy : fy - 1;
  const start = new Date(Date.UTC(startYear, s - 1, 1));
  const end = new Date(Date.UTC(startYear + 1, s - 1, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

/** The fiscal year that contains `date`. */
export function fiscalYearFor(date: Date, startMonth: number | null | undefined) {
  const s = normalizeStartMonth(startMonth);
  const y = date.getFullYear();
  return s === 1 || date.getMonth() + 1 < s ? y : y + 1;
}

/** How many months of fiscal year `fy` have started by `today` (0–12). */
export function fiscalMonthsElapsed(fy: number, startMonth: number | null | undefined, today = new Date()) {
  const { start } = fiscalWindow(fy, startMonth);
  const [sy, sm] = start.split('-').map(Number);
  const diff = (today.getFullYear() * 12 + today.getMonth() + 1) - (sy * 12 + sm) + 1;
  return Math.max(0, Math.min(12, diff));
}

// ── Worksheet math (pure, unit-tested) ──────────────────────────────────────

const cents = (n: number) => Math.round(n * 100);

/** Split an annual amount into 12 months that add up exactly; the last month takes the rounding. */
export function spreadEvenly(annual: number): number[] {
  const total = cents(Math.max(0, annual || 0));
  const base = Math.floor(total / 12);
  const out = Array(12).fill(base / 100);
  out[11] = (total - base * 11) / 100;
  return out;
}

/** Scale every month by `pct` percent (e.g. 3 → +3%), rounded to cents, never negative. */
export function adjustByPercent(amounts: number[], pct: number): number[] {
  const f = 1 + (Number(pct) || 0) / 100;
  return amounts.map((a) => Math.max(0, cents((a || 0) * f) / 100));
}

export const sum = (a: number[]) => cents(a.reduce((s, x) => s + (Number(x) || 0), 0)) / 100;

export type WorksheetRow = { glAccountId: string; number: number | null; name: string; amounts: number[]; notes: string };

export function worksheetToCsv(rows: WorksheetRow[], labels: string[]) {
  const head = ['Account number', 'Account', ...labels, 'Annual', 'Notes'];
  const lines = rows.map((r) => [r.number ?? '', r.name, ...r.amounts.map((a) => a.toFixed(2)), sum(r.amounts).toFixed(2), r.notes].map(csvCell).join(','));
  return [head.map(csvCell).join(','), ...lines].join('\n');
}

function parseCsvLine(line: string) {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

/**
 * Read a worksheet CSV (the export format) and return amounts keyed by
 * account number. Rows whose account number is unknown are reported, not
 * silently dropped.
 */
export function parseWorksheetCsv(text: string, knownNumbers: Set<number>) {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '');
  const byNumber = new Map<number, { amounts: number[]; notes: string }>();
  const unknown: string[] = [];
  const invalid: string[] = [];
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const num = Number(String(cells[0]).trim());
    if (!Number.isInteger(num) || !knownNumbers.has(num)) { unknown.push(String(cells[0] || cells[1] || '').trim()); continue; }
    const amounts = cells.slice(2, 14).map((c) => Number(String(c).replace(/[$,\s]/g, '') || 0));
    if (amounts.length !== 12 || amounts.some((a) => !Number.isFinite(a) || a < 0)) { invalid.push(String(num)); continue; }
    byNumber.set(num, { amounts: amounts.map((a) => cents(a) / 100), notes: (cells[15] ?? '').trim() });
  }
  return { byNumber, unknown, invalid };
}
