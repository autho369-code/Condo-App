import Papa from 'papaparse';

// AppFolio report exports (CSV) are grouped reports, not flat tables:
//
//   Unit Name,Market Rent,...            <- header
//                                        <- blank
//   "-> Pine Tree Court ... - 5460 W Higgins Ave Chicago, IL 60630",...  <- group heading
//   101,,,,...                           <- detail rows
//   ,0.00,0.00,0,...                     <- group subtotal (first cell blank)
//                                        <- blank
//   Total,0.00,...                       <- grand total
//
// This reads that shape into groups of detail rows keyed by the export's own
// headers. Client-safe (no server imports): the import page parses the file
// in the browser to preview it, and the server action re-checks every row.

export type AppfolioGroup = {
  /** Group heading without the "-> " marker, e.g. "Pine Tree Court ... - 5460 W Higgins Ave ..." */
  heading: string;
  /** The name part of the heading (before " - " when an address follows). */
  name: string;
  /** The address part of the heading, if any. */
  address: string | null;
  /** Detail rows, keyed by the export's header names. `row` is the spreadsheet line number. */
  rows: Array<Record<string, string> & { row: string }>;
};

export type AppfolioReport = { headers: string[]; groups: AppfolioGroup[] };

const GROUP_MARKER = /^\s*->\s*/;

/** Split "Name - Street City, ST 12345" at the last " - " followed by a digit (the street number). */
export function splitGroupHeading(heading: string): { name: string; address: string | null } {
  const match = heading.match(/^(.*?)\s+-\s+(\d.*)$/);
  if (!match) return { name: heading.trim(), address: null };
  return { name: match[1].trim(), address: match[2].trim() };
}

export function parseAppfolioReport(text: string): { report?: AppfolioReport; error?: string } {
  // AppFolio exports are always comma-separated; auto-detection fails on narrow files.
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ''), { delimiter: ',', skipEmptyLines: false });
  if (parsed.errors.length) {
    const e = parsed.errors[0];
    return { error: `Could not read the CSV (line ${(e.row ?? 0) + 1}): ${e.message}` };
  }
  const lines = parsed.data;
  const headerIndex = lines.findIndex((cells) => cells.some((c) => c.trim() !== ''));
  if (headerIndex < 0) return { error: 'The file is empty.' };
  const headers = lines[headerIndex].map((h) => h.trim());

  const groups: AppfolioGroup[] = [];
  let current: AppfolioGroup | null = null;
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const cells = lines[i];
    const first = (cells[0] ?? '').trim();
    if (cells.every((c) => c.trim() === '')) continue;
    if (GROUP_MARKER.test(first)) {
      const heading = first.replace(GROUP_MARKER, '').trim();
      current = { heading, ...splitGroupHeading(heading), rows: [] };
      groups.push(current);
      continue;
    }
    // Subtotal rows have a blank first cell; the grand total starts with "Total".
    if (first === '' || /^total$/i.test(first)) continue;
    if (!current) {
      // A report with no group headings (one property): collect into an unnamed group.
      current = { heading: '', name: '', address: null, rows: [] };
      groups.push(current);
    }
    const record: Record<string, string> & { row: string } = { row: String(i + 1) };
    headers.forEach((h, idx) => { record[h] = (cells[idx] ?? '').trim(); });
    current.rows.push(record);
  }
  if (!groups.some((g) => g.rows.length)) return { error: 'The file has no rows.' };
  return { report: { headers, groups } };
}

/** Header names of AppFolio's "Unit Directory" report. */
export const UNIT_DIRECTORY_HEADERS = ['Unit Name', 'Sqft', 'Bedrooms', 'Bathrooms'] as const;

export type AppfolioUnit = {
  row: string;
  unit_number: string;
  sqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  /** The unit's own street address, when the export includes AppFolio's optional unit address columns. */
  address: string | null;
  /** Ownership percentage (0-100), when the export includes it. */
  ownership_pct: number | null;
};

// Names AppFolio setups use for a unit's ownership share (Customize panel).
const OWNERSHIP_HEADERS = [
  'Percentage Ownership', 'Ownership Percentage', 'Percent Ownership', 'Ownership %', 'Ownership Pct',
  'Unit Percentage', 'Percentage Of Ownership', 'Ownership Interest', 'Percentage Interest', 'Percent Interest',
];

/** The export's ownership-percentage column, if it has one (case-insensitive). */
export function ownershipHeader(headers: readonly string[]): string | null {
  const wanted = new Set(OWNERSHIP_HEADERS.map((h) => h.toLowerCase()));
  return headers.find((h) => wanted.has(h.trim().toLowerCase())) ?? null;
}

/** "12.5", "12.5%" or "0.125" (a fraction, when below 1 and written with a decimal point) -> 12.5. */
export function parseOwnershipPct(v: string | undefined): number | null {
  const s = (v ?? '').replace(/[%\s,]/g, '');
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  const pct = n < 1 && s.includes('.') && !(v ?? '').includes('%') ? n * 100 : n;
  return pct <= 100 ? Math.round(pct * 10000) / 10000 : null;
}

// Optional unit-address columns from AppFolio's Customize panel.
function unitAddress(r: Record<string, string>): string | null {
  const parts = [
    [r['Unit Street Address 1'], r['Unit Street Address 2']].filter(Boolean).join(' '),
    [r['Unit City'], [r['Unit State'], r['Unit Zip']].filter(Boolean).join(' ')].filter(Boolean).join(', '),
  ].filter(Boolean);
  const joined = parts.join(', ').trim();
  return joined || (r['Unit Address']?.trim() || null);
}

const numberOrNull = (v: string | undefined): number | null => {
  const s = (v ?? '').replace(/[$,]/g, '').trim();
  if (!s) return null;
  const n = Number(s);
  // AppFolio writes 0 for "not set" in these columns.
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Read AppFolio's Unit Directory export into units grouped by association. */
export function parseAppfolioUnitDirectory(text: string): {
  groups?: Array<{ name: string; address: string | null; units: AppfolioUnit[] }>;
  /** Whether the export has an ownership-percentage column. */
  hasOwnership?: boolean;
  error?: string;
} {
  const { report, error } = parseAppfolioReport(text);
  if (!report) return { error };
  const missing = UNIT_DIRECTORY_HEADERS.filter((h) => !report.headers.includes(h));
  if (missing.length) {
    return { error: `This doesn't look like AppFolio's Unit Directory export (missing ${missing.join(', ')}).` };
  }
  const pctHeader = ownershipHeader(report.headers);
  const toUnit = (r: Record<string, string> & { row: string }): AppfolioUnit => ({
    row: r.row,
    unit_number: r['Unit Name'],
    sqft: numberOrNull(r['Sqft']),
    bedrooms: numberOrNull(r['Bedrooms']),
    bathrooms: numberOrNull(r['Bathrooms']),
    address: unitAddress(r),
    ownership_pct: pctHeader ? parseOwnershipPct(r[pctHeader]) : null,
  });

  // Grouped export (Row Groups: Property) -> groups come from the "-> ..." headings.
  // Flat export (no row group) -> group by the "Property Name" / "Property" column.
  const out = new Map<string, { name: string; address: string | null; units: AppfolioUnit[] }>();
  for (const g of report.groups) {
    for (const r of g.rows) {
      if (!r['Unit Name']) continue;
      const column = (r['Property Name'] || r['Property'] || '').trim();
      const heading = g.heading || column;
      const { name, address } = g.heading ? { name: g.name, address: g.address } : splitGroupHeading(column);
      const key = heading || '(no property)';
      if (!out.has(key)) out.set(key, { name: name || key, address, units: [] });
      out.get(key)!.units.push(toUnit(r));
    }
  }
  return { groups: [...out.values()], hasOwnership: pctHeader !== null };
}
