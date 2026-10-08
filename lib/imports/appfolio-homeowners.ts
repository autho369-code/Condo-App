// AppFolio's "Homeowner Directory" export (Reports → Homeowner Directory →
// Export as CSV). A flat report, one row per homeowner record:
//
//   Property,Unit,Homeowner,Electronic Delivery Consent,Status,Renter Occupied Unit,
//   Homeowner Type,Phone Numbers,Emails,Lockbox ID,Ownership Percentage,Dues,Tags
//
// "Property" is "Association Name - Street City, ST 12345"; rows are grouped
// by it here. "Homeowner" is AppFolio's "Last, First" with everything people
// typed into those two fields: joint owners ("Abbey, Leon & Ariel",
// "& Jaime Peralta, Florence Miller", "Akiko Maeda, Naoto &"), parking notes
// ("Adilov - PKG#149, Vusal"), suffixes ("Fisher, Jr., Robert") and company
// or trust names. homeownerName() turns that into a display name and keeps
// the raw value. "Ownership Percentage" is a percent (0.9 = 0.9%, the column
// totals 100 per association), not a fraction.
//
// Client-safe (no server imports): the import page parses in the browser to
// preview, and the server action re-checks every value.
import { parseAppfolioReport, splitGroupHeading } from './appfolio';
import { splitEmails } from './appfolio-vendors';

/** Columns the import needs (Property names the association in the flat export). */
export const HOMEOWNER_DIRECTORY_HEADERS = ['Unit', 'Homeowner', 'Status'] as const;

export type HomeownerName = {
  /** The Homeowner cell as exported. */
  raw: string;
  /** Readable name: "Leon & Ariel Abbey", "Florence Miller & Jaime Peralta", "Adriatic Realty LLC". */
  display: string;
  first_name: string | null;
  last_name: string | null;
  /** A company, trust or other organisation (kept as written, apart from parking notes). */
  is_company: boolean;
  /** Notes taken out of the name, e.g. "PKG#149", "Beneficiary". */
  notes: string[];
};

export type AppfolioHomeowner = {
  /** Spreadsheet line number. */
  row: string;
  unit_number: string;
  name: HomeownerName;
  status: string;
  electronic_consent: boolean;
  renter_occupied: boolean;
  /** The Phone Numbers cell ("Home: (773) 555-0100, Mobile: …"); split by parseLabeledPhones on import. */
  phones: string;
  emails: string[];
  /** Percent, 0-100 (null when blank or 0). */
  ownership_pct: number | null;
  /** Monthly dues (null when blank). */
  dues: number | null;
};

export type AppfolioHomeownerGroup = {
  name: string;
  address: string | null;
  /** Current homeowners (the ones imported). */
  homeowners: AppfolioHomeowner[];
  /** Rows not imported (status other than Current, or no unit/name), with the reason. */
  skipped: Array<{ row: string; unit_number: string; name: string; reason: string }>;
};

// Parking / storage notes typed into the name: " - PKG#23", " - P#99 & P#128",
// " - Parking # 12", "Pkg#41/19/39", ", PKG# 7", " - P-10", " P#34".
const SPACE_TAG = String.raw`(?:PKG|Parking|P)\s*[#-]?\s*#?\s*`;
const SPACE_ID = String.raw`(?:\d+[A-Za-z]?|East|West|North|South)\b`;
const PARKING = new RegExp(
  String.raw`(?:\s*[-,]\s*|\s+)(${SPACE_TAG}${SPACE_ID}(?:\s*(?:&|\/)\s*(?:${SPACE_TAG})?${SPACE_ID})*)`,
  'gi',
);
const BENEFICIARY = /\s*-\s*Beneficiary\b/gi;
const SUFFIX = /^(?:jr|sr|ii|iii|iv|v)\.?$/i;
const COMPANY = new RegExp(
  String.raw`\b(?:LLC|L\.L\.C|Inc|Incorporated|Corp|Corporation|Company|Co|Trust|Trustees?|Bank|Realty|Properties|Property|` +
    String.raw`Holdings?|Management|Investments?|Developments?|Association|HOA|Services|Systems|Estate|Group|Partners|LP|LLP|Ltd|Radio)\b`,
  'i',
);

const squash = (s: string) =>
  s.replace(/[​-‏‪-‮﻿]/g, '').replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim();
/** Strip joining marks left at the edges: "& Jaime Peralta" -> "Jaime Peralta", "Naoto &" -> "Naoto". */
const trimJoins = (s: string) => s.replace(/^[\s&/,]+|[\s&/,]+$/g, '').trim();
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s\-'&/(])([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());

export function homeownerName(rawCell: string | null | undefined): HomeownerName {
  const raw = (rawCell ?? '').trim();
  const notes: string[] = [];
  let s = squash(raw);
  s = s.replace(PARKING, (_m, tag: string) => { notes.push(tag.replace(/\s+/g, ' ').trim()); return ''; });
  s = s.replace(BENEFICIARY, () => { notes.push('Beneficiary'); return ''; });
  s = squash(s);

  if (COMPANY.test(s)) {
    const display = trimJoins(s);
    return { raw, display, first_name: null, last_name: null, is_company: true, notes };
  }

  const parts = s.split(/\s*,\s*/);
  if (parts.length === 1) {
    let display = trimJoins(s);
    if (!/[a-z]/.test(display)) display = titleCase(display);
    const { first, last } = splitPerson(display);
    return { raw, display, first_name: first || null, last_name: last || null, is_company: false, notes };
  }

  // "Last, First": the last name is the first part, plus a suffix that follows it ("Fisher, Jr., Robert").
  let lastCount = 1;
  while (lastCount < parts.length - 1 && SUFFIX.test(parts[lastCount])) lastCount++;
  const lastRaw = parts.slice(0, lastCount).join(', ');
  const firstRaw = parts.slice(lastCount).join(', ');
  // A "&" at the join means two people across the two fields ("& Jaime Peralta, Florence Miller").
  const joint = /^\s*[&/]/.test(lastRaw) || /[&/]\s*$/.test(firstRaw);
  let display = trimJoins(squash(`${firstRaw} ${lastRaw}`).replace(/(?:\s*&\s*){2,}/g, ' & '));
  let first = trimJoins(firstRaw);
  let last = trimJoins(lastRaw);
  if (!/[a-z]/.test(display)) {
    display = titleCase(display);
    first = titleCase(first);
    last = titleCase(last);
  }
  if (joint || !first || !last) {
    // Name the record after its first person ("Florence Miller & Jaime Peralta" -> Florence / Miller);
    // when that is a first name only ("Naoto & Akiko Maeda"), the last name is the display's last word.
    const person = first.split(' ').length >= 2 && !/[&/]/.test(first) ? first : display;
    ({ first, last } = splitPerson(person));
  }
  return { raw, display, first_name: first || null, last_name: last || null, is_company: false, notes };
}

/** "Mary Ann Smith" -> Mary Ann / Smith; "Jose Romero Jr" -> Jose / Romero Jr; one word -> last name only. */
function splitPerson(name: string): { first: string; last: string } {
  const words = name.split(' ').filter(Boolean);
  let cut = words.length - 1;
  if (cut > 1 && SUFFIX.test(words[cut].replace(/,$/, ''))) cut--;
  return { first: trimJoins(words.slice(0, Math.max(cut, 0)).join(' ')), last: trimJoins(words.slice(Math.max(cut, 0)).join(' ')) };
}

/** "2.851200000000" -> 2.8512 (a percent). Blank, 0, negative or over 100 -> null. */
export function parseHomeownerPct(v: string | null | undefined): number | null {
  const s = (v ?? '').replace(/[%\s,]/g, '');
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0 || n > 100) return null;
  return Math.round(n * 10000) / 10000;
}

/** "$1,296.25" -> 1296.25; blank or unreadable -> null; negatives -> null. */
export function parseDues(v: string | null | undefined): number | null {
  const s = (v ?? '').replace(/[$,\s]/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

const yes = (v: string | undefined) => /^(yes|y|true)$/i.test((v ?? '').trim());

/** Read AppFolio's Homeowner Directory export into homeowners grouped by association. */
export function parseAppfolioHomeownerDirectory(text: string): { groups?: AppfolioHomeownerGroup[]; error?: string } {
  const { report, error } = parseAppfolioReport(text);
  if (!report) return { error };
  const missing = HOMEOWNER_DIRECTORY_HEADERS.filter((h) => !report.headers.includes(h));
  if (missing.length) {
    return { error: `This doesn't look like AppFolio's Homeowner Directory export (missing ${missing.join(', ')}).` };
  }

  const out = new Map<string, AppfolioHomeownerGroup>();
  for (const g of report.groups) {
    for (const r of g.rows) {
      // Flat export: the Property column names the association. Grouped export: the "-> …" heading does.
      const column = (r['Property'] || '').trim();
      const heading = g.heading || column;
      const { name, address } = g.heading ? { name: g.name, address: g.address } : splitGroupHeading(column);
      const key = heading || '(no property)';
      if (!out.has(key)) out.set(key, { name: name || key, address, homeowners: [], skipped: [] });
      const group = out.get(key)!;

      const unit = (r['Unit'] || '').trim();
      const owner = homeownerName(r['Homeowner']);
      const status = (r['Status'] || '').trim();
      if (!unit || !owner.display) {
        group.skipped.push({ row: r.row, unit_number: unit, name: owner.display, reason: !unit ? 'no unit' : 'no homeowner name' });
        continue;
      }
      if (status.toLowerCase() !== 'current') {
        group.skipped.push({ row: r.row, unit_number: unit, name: owner.display, reason: `status ${status || 'blank'}` });
        continue;
      }
      group.homeowners.push({
        row: r.row,
        unit_number: unit,
        name: owner,
        status,
        electronic_consent: yes(r['Electronic Delivery Consent']),
        renter_occupied: yes(r['Renter Occupied Unit']),
        phones: (r['Phone Numbers'] || '').replace(/[​-‏‪-‮﻿]/g, '').trim(),
        emails: splitEmails(r['Emails']),
        ownership_pct: parseHomeownerPct(r['Ownership Percentage']),
        dues: parseDues(r['Dues']),
      });
    }
  }
  const groups = [...out.values()];
  if (!groups.some((g) => g.homeowners.length || g.skipped.length)) return { error: 'The file has no homeowners.' };
  return { groups };
}

/**
 * The unit's ownership % for a group: the first non-blank value among its rows
 * (co-owners on separate rows repeat the unit's share), summed once per unit.
 */
export function ownershipTotal(homeowners: AppfolioHomeowner[]): { total: number; units: number } {
  const perUnit = new Map<string, number>();
  for (const h of homeowners) {
    const key = h.unit_number.toLowerCase();
    if (h.ownership_pct !== null && !perUnit.has(key)) perUnit.set(key, h.ownership_pct);
  }
  const total = [...perUnit.values()].reduce((s, n) => s + n, 0);
  return { total: Math.round(total * 10000) / 10000, units: perUnit.size };
}
