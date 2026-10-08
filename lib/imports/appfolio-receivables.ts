import Papa from 'papaparse';
import { parseAppfolioReport, splitGroupHeading } from './appfolio';

// AppFolio's "Aged Receivable Detail" export -> open receivable items per
// association and unit, used as opening balances. Client-safe (no server
// imports): the import page parses the file in the browser to preview it, and
// the server action re-validates every item it is sent.
//
// A company-wide export is grouped by "Property, Unit & Payer Name":
//
//   Payer Name,Charge Date,Posting Date,GL Account Number,GL Account Name,Total Amount,Amount Receivable,0-30,31-60,61-90,91+
//   "-> Pine Tree Court Condominium Association - 5460 W Higgins Ave Chicago, IL 60630 - Unit 2A - Smith, Jane",...
//   "Smith, Jane",09/01/2026,09/01/2026,4101,Regular Assessment,"1,250.00","1,250.00",0.00,"1,250.00",0.00,0.00
//   ,,,,,"1,250.00","1,250.00",...          <- per-heading subtotal (blank first cell)
//   Total,,,,,...                           <- grand total for the whole file
//
// Older exports grouped by "Unit & Payer Name" only ("-> 101 - Jane Smith")
// cover one association; a flat export (no row group) carries the unit in a
// "Unit Name" or "Unit & Payer Name" column and the property in "Property
// Name" / "Property".

/** Columns every Aged Receivable Detail export has. */
export const AGED_RECEIVABLE_HEADERS = ['Charge Date', 'Amount Receivable'] as const;

export type ReceivableAging = { d0_30: number; d31_60: number; d61_90: number; d91_plus: number };

export type AppfolioReceivableItem = {
  /** Spreadsheet line number in the export. */
  row: string;
  unit_number: string;
  payer: string;
  /** YYYY-MM-DD, or null when the export has no readable charge date. */
  charge_date: string | null;
  gl_number: string;
  gl_name: string;
  /** What is still owed on this charge; negative for a credit or prepayment. */
  amount: number;
  aging: ReceivableAging;
};

export type AppfolioReceivableUnit = {
  unit_number: string;
  payers: string[];
  items: AppfolioReceivableItem[];
  total: number;
  aging: ReceivableAging;
};

export type ReceivableTotals = { amount: number; charges: number; credits: number; aging: ReceivableAging; itemCount: number };

/** One AppFolio association (property) in the export, with its open items by unit. */
export type AppfolioReceivableAssociation = {
  /** The property heading's name part; '' when the export names no property (one association). */
  name: string;
  address: string | null;
  units: AppfolioReceivableUnit[];
  /** Open items, in file order (what the import action takes). */
  items: AppfolioReceivableItem[];
  totals: ReceivableTotals;
};

export type AppfolioReceivablesParse = {
  associations?: AppfolioReceivableAssociation[];
  /** Totals over the whole file. */
  totals?: ReceivableTotals;
  /** The Amount Receivable on the file's own "Total" line, when it has one (to tie out against). */
  fileTotal?: number | null;
  /** Rows that could not be read (no unit, unreadable amount); they are left out of `items`. */
  problems?: string[];
  error?: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const zeroAging = (): ReceivableAging => ({ d0_30: 0, d31_60: 0, d61_90: 0, d91_plus: 0 });

/** "1,250.00", "$1,250.00", "-50.00" or "(50.00)" -> number; blank -> 0; unreadable -> null. */
export function parseAppfolioAmount(v: string | undefined): number | null {
  let s = (v ?? '').trim().replace(/[$,\s]/g, '');
  if (!s) return 0;
  let sign = 1;
  const paren = s.match(/^\((.*)\)$/);
  if (paren) { sign = -1; s = paren[1]; }
  if (!/^-?\d*\.?\d+$/.test(s)) return null;
  const n = Number(s) * sign;
  return Number.isFinite(n) ? round2(n) : null;
}

/** "10/31/2026" (AppFolio's format), "10/31/26" or "2026-10-31" -> "2026-10-31"; anything else -> null. */
export function parseAppfolioDate(v: string | undefined): string | null {
  const s = (v ?? '').trim();
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (match) {
    m = Number(match[1]); d = Number(match[2]); y = Number(match[3]);
    if (match[3].length === 2) y += 2000;
  } else if ((match = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) {
    y = Number(match[1]); m = Number(match[2]); d = Number(match[3]);
  } else {
    return null;
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * The unit part of a "Unit & Payer Name" value such as "101 - Jane Smith".
 * Prefers splitting off the row's own payer name; otherwise splits at the
 * first " - " unless what follows is a street address (a property heading
 * like "Pine Tree Court - 5460 W Higgins Ave" is not a unit).
 */
export function unitFromUnitAndPayer(value: string, payer: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const p = payer.trim();
  if (p) {
    const suffix = ` - ${p}`.toLowerCase();
    if (v.toLowerCase().endsWith(suffix) && v.length > suffix.length) return v.slice(0, v.length - suffix.length).trim();
  }
  const m = v.match(/^(.+?)\s+-\s+(.+)$/);
  if (m && !/^\d/.test(m[2])) return m[1].trim();
  return null;
}

/** Tidy a property name from a heading: stray quotes and doubled spaces AppFolio leaves in. */
function cleanName(v: string): string {
  return v.replace(/^["\s]+|["\s]+$/g, '').replace(/\s+/g, ' ');
}

/**
 * Read a group heading. The company-wide shape is
 * "Association - Address - Unit <unit> - <payer>"; the older one is
 * "<unit> - <payer>". The payer is taken off using the row's own payer name
 * when it matches (payer names may contain " - ").
 */
export function parseReceivableHeading(
  heading: string,
  payer: string,
): { name: string; address: string | null; unit: string } | null {
  const h = heading.trim();
  if (!h) return null;
  const p = payer.trim();
  let rest: string | null = null;
  if (p && h.toLowerCase().endsWith(` - ${p}`.toLowerCase())) rest = h.slice(0, h.length - p.length - 3).trimEnd();
  const withUnit = (rest ?? h).match(/^(.*)\s+-\s+Unit\s+(.+)$/i);
  const fromRest = rest !== null && withUnit ? withUnit : null;
  const m = fromRest ?? h.match(/^(.*)\s+-\s+Unit\s+(.+?)\s+-\s+.+$/i);
  if (m) {
    const { name, address } = splitGroupHeading(m[1]);
    const unit = m[2].trim();
    return unit ? { name: cleanName(name), address: address ? address.replace(/\s+/g, ' ') : null, unit } : null;
  }
  const unit = unitFromUnitAndPayer(h, p);
  return unit ? { name: '', address: null, unit } : null;
}

function sumTotals(items: AppfolioReceivableItem[]): ReceivableTotals {
  const aging = zeroAging();
  let charges = 0;
  let credits = 0;
  for (const it of items) {
    for (const k of Object.keys(aging) as Array<keyof ReceivableAging>) aging[k] = round2(aging[k] + it.aging[k]);
    if (it.amount > 0) charges = round2(charges + it.amount);
    else credits = round2(credits + it.amount);
  }
  return { amount: round2(charges + credits), charges, credits, aging, itemCount: items.length };
}

/** Amount Receivable on the file's "Total" line (the grand total), or null when it has none. */
function readFileTotal(text: string): number | null {
  const lines = Papa.parse<string[]>(text.replace(/^﻿/, ''), { delimiter: ',', skipEmptyLines: true }).data;
  const headerIndex = lines.findIndex((cells) => cells.some((c) => c.trim() !== ''));
  if (headerIndex < 0) return null;
  const col = lines[headerIndex].findIndex((h) => h.trim() === 'Amount Receivable');
  if (col < 0) return null;
  for (let i = lines.length - 1; i > headerIndex; i--) {
    if (/^total$/i.test((lines[i][0] ?? '').trim())) return parseAppfolioAmount(lines[i][col]);
  }
  return null;
}

/** Read AppFolio's Aged Receivable Detail export into open items grouped by association, then unit. */
export function parseAppfolioAgedReceivables(text: string): AppfolioReceivablesParse {
  const { report, error } = parseAppfolioReport(text);
  if (!report) return { error };
  const has = (h: string) => report.headers.includes(h);
  const missing = AGED_RECEIVABLE_HEADERS.filter((h) => !has(h));
  if (missing.length) {
    return { error: `This doesn't look like AppFolio's Aged Receivable Detail export (missing ${missing.join(', ')}).` };
  }
  const hasUnitColumn = has('Unit Name') || has('Unit & Payer Name');
  const hasUnitHeadings = report.groups.some((g) => g.heading);
  if (!hasUnitColumn && !hasUnitHeadings) {
    return { error: 'The export has no units. In AppFolio group the report by "Unit & Payer Name" or add the "Unit Name" column, then export again.' };
  }

  type Bucket = { name: string; address: string | null; items: AppfolioReceivableItem[] };
  const byAssociation = new Map<string, Bucket>();
  const problems: string[] = [];
  let itemCount = 0;
  for (const g of report.groups) {
    for (const r of g.rows) {
      const payer = (r['Payer Name'] ?? '').trim();
      const chargeRaw = r['Charge Date'] ?? '';
      const amountRaw = r['Amount Receivable'] ?? '';
      // Per-group "Total ..." lines some exports add: no charge date, label starts with Total.
      const first = Object.entries(r).find(([k]) => k !== 'row')?.[1] ?? '';
      if (!chargeRaw && /^total\b/i.test(first)) continue;

      let unit = (r['Unit Name'] || '').trim() || unitFromUnitAndPayer(r['Unit & Payer Name'] ?? '', payer) || '';
      let assoc: { name: string; address: string | null } = { name: '', address: null };
      const property = (r['Property Name'] || r['Property'] || '').trim();
      if (property) {
        const s = splitGroupHeading(property);
        assoc = { name: cleanName(s.name), address: s.address };
      }
      if (g.heading) {
        const h = parseReceivableHeading(g.heading, payer);
        if (h) {
          if (!unit) unit = h.unit;
          if (h.name) assoc = { name: h.name, address: h.address };
        }
      }
      if (!unit) { problems.push(`Line ${r.row}: no unit for ${payer || 'this row'}.`); continue; }
      const amount = parseAppfolioAmount(amountRaw);
      if (amount === null) { problems.push(`Line ${r.row} (${unit}): unreadable Amount Receivable "${amountRaw}".`); continue; }
      if (amount === 0) continue; // fully paid: nothing open
      const bucket = (h: string) => parseAppfolioAmount(r[h]) ?? 0;
      const key = assoc.name.toLowerCase();
      let b = byAssociation.get(key);
      if (!b) { b = { ...assoc, items: [] }; byAssociation.set(key, b); }
      b.items.push({
        row: r.row,
        unit_number: unit.slice(0, 40),
        payer,
        charge_date: parseAppfolioDate(chargeRaw) ?? parseAppfolioDate(r['Posting Date']),
        gl_number: (r['GL Account Number'] ?? '').trim(),
        gl_name: (r['GL Account Name'] || r['GL Account'] || '').trim(),
        amount,
        aging: { d0_30: bucket('0-30'), d31_60: bucket('31-60'), d61_90: bucket('61-90'), d91_plus: bucket('91+') },
      });
      itemCount++;
    }
  }
  if (!itemCount) {
    return { error: problems.length ? `No open items could be read. ${problems.slice(0, 3).join(' ')}` : 'The export has no open receivables.', problems };
  }

  const associations: AppfolioReceivableAssociation[] = [];
  for (const b of byAssociation.values()) {
    const byUnit = new Map<string, AppfolioReceivableUnit>();
    for (const it of b.items) {
      const key = it.unit_number.toLowerCase();
      let u = byUnit.get(key);
      if (!u) { u = { unit_number: it.unit_number, payers: [], items: [], total: 0, aging: zeroAging() }; byUnit.set(key, u); }
      u.items.push(it);
      if (it.payer && !u.payers.includes(it.payer)) u.payers.push(it.payer);
      u.total = round2(u.total + it.amount);
      for (const k of Object.keys(u.aging) as Array<keyof ReceivableAging>) u.aging[k] = round2(u.aging[k] + it.aging[k]);
    }
    associations.push({ name: b.name, address: b.address, units: [...byUnit.values()], items: b.items, totals: sumTotals(b.items) });
  }
  return {
    associations,
    totals: sumTotals(associations.flatMap((a) => a.items)),
    fileTotal: readFileTotal(text),
    problems: problems.length ? problems : undefined,
  };
}
