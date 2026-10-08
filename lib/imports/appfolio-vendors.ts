import Papa from 'papaparse';
import { parseAppfolioReport } from '@/lib/imports/appfolio';
import { parseLabeledPhones } from '@/lib/contacts/labeled-phones';

// AppFolio "Vendor Directory" report export (CSV) -> vendor records ready for
// importAppfolioVendors. Client-safe (no server imports): the import page
// parses the file in the browser to preview it; the server action re-checks
// every field.
//
// The export is flat (no row groups). Its first column is "Company Name",
// which is blank on most rows — and parseAppfolioReport treats a blank first
// cell as a subtotal row. So before handing the file over we put a lead
// column in front holding the vendor's Name (or Company Name), keeping
// AppFolio's own "-> group" and "Total" markers as they are.

export type AppfolioVendorPhone = { number: string; type: string | null };

export type AppfolioVendor = {
  /** Spreadsheet line in the export. */
  row: string;
  /** Display name: the company name, or the Name column put back in reading order. */
  name: string;
  /** The Name cell exactly as AppFolio has it (e.g. "Abcede, Michael"). */
  appfolio_name: string;
  company_name: string | null;
  /** The person named on a company vendor (Name, when Company Name is also filled). */
  contact_name: string | null;
  phones: AppfolioVendorPhone[];
  emails: string[];
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  /** GL account number from "6371 - Painting & Decorating". */
  gl_account_number: string | null;
  gl_account_label: string | null;
  /** check | echeck | ach | online, or null when blank/unknown. */
  payment_type: 'check' | 'echeck' | 'ach' | 'online' | null;
  /** AppFolio's payment type when it is not a supported one. */
  payment_type_raw: string | null;
  send_1099: boolean;
  workers_comp_expiration: string | null;
  general_liability_expiration: string | null;
  epa_certification_expiration: string | null;
  auto_insurance_expiration: string | null;
  state_license_expiration: string | null;
  contract_expiration: string | null;
  tags: string | null;
  portal_activated: boolean;
  last_payment_date: string | null;
};

const REQUIRED = ['Name', 'Phone Numbers', 'Email'] as const;
const LEAD = '__portier_lead__';

const norm = (h: string) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

/** Find a column by any of its names, ignoring case, spaces and punctuation. */
function headerFinder(headers: readonly string[]) {
  const byKey = new Map<string, string>();
  for (const h of headers) if (!byKey.has(norm(h))) byKey.set(norm(h), h);
  return (...names: string[]): string | null => {
    for (const n of names) {
      const hit = byKey.get(norm(n));
      if (hit) return hit;
    }
    return null;
  };
}

/** "07/15/2026", "7/5/26" or "2026-07-15" -> "2026-07-15"; anything else -> null. */
export function parseAppfolioDate(v: string | null | undefined): string | null {
  const s = (v ?? '').trim();
  if (!s) return null;
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (match) {
    m = Number(match[1]); d = Number(match[2]); y = Number(match[3]);
    if (match[3].length === 2) y += y >= 70 ? 1900 : 2000;
  } else if ((match = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) {
    y = Number(match[1]); m = Number(match[2]); d = Number(match[3]);
  } else {
    return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Name parts that only ever trail a name ("Smith, John, Jr.", "Acme Roofing, Inc."):
// a comma before one of these is not AppFolio's "Last, First" split.
const NAME_SUFFIX = /^(inc|llc|l\.l\.c|llp|ltd|co|corp|corporation|company|plc|pc|p\.c|lp|l\.p|jr|sr|ii|iii|iv|esq|cpa)\.?$/i;

/**
 * AppFolio's Name column is "Last, First", and it builds it for companies too
 * by cutting the name before its last word(s): "Abcede, Michael" ->
 * "Michael Abcede", "& Associates, Elliott" -> "Elliott & Associates",
 * "Plumbing, Inc., Great American" -> "Great American Plumbing, Inc.",
 * "& Katherine M Nilles, Rene B Pastor" -> "Rene B Pastor & Katherine M Nilles",
 * "Wood Dale, City of" -> "City of Wood Dale". So the part after the last
 * comma goes in front. A name ending in a suffix ("Acme Roofing, Inc.") or
 * without a comma is kept as it is.
 */
export function vendorDisplayName(name: string): string {
  const s = name
    .replace(/\s+/g, ' ')
    .replace(/\s*,[\s,]*/g, ', ') // "Inc,, X" and "Bruchmann , David" -> one ", "
    .replace(/^[\s,]+|[\s,]+$/g, '');
  const cut = s.lastIndexOf(', ');
  if (cut < 0) return s;
  const before = s.slice(0, cut).trim();
  const after = s.slice(cut + 2).trim();
  if (!before || !after || NAME_SUFFIX.test(after)) return s;
  return `${after} ${before}`;
}

const EMAIL = /^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/;

export function splitEmails(v: string | null | undefined): string[] {
  const out: string[] = [];
  for (const part of (v ?? '').split(/[,;\s]+/)) {
    const e = part.trim().toLowerCase();
    if (e && EMAIL.test(e) && !out.includes(e)) out.push(e);
  }
  return out;
}

/** "6371 - Painting & Decorating" -> { number: "6371", label: "Painting & Decorating" }. */
export function parseGlAccount(v: string | null | undefined): { number: string | null; label: string | null } {
  const s = (v ?? '').trim();
  if (!s) return { number: null, label: null };
  const m = s.match(/^([0-9][0-9.\-]*)\s*(?:-\s*(.*))?$/);
  if (!m) return { number: null, label: s };
  return { number: m[1].replace(/[.-]$/, ''), label: m[2]?.trim() || null };
}

const PAYMENT_TYPES: Record<string, AppfolioVendor['payment_type']> = {
  check: 'check', echeck: 'echeck', ach: 'ach', online: 'online', directdeposit: 'ach',
};

export function parsePaymentType(v: string | null | undefined): AppfolioVendor['payment_type'] {
  const key = (v ?? '').toLowerCase().replace(/[^a-z]/g, '');
  return key ? PAYMENT_TYPES[key] ?? null : null;
}

const yes = (v: string | null | undefined) => /^(y|yes|true|1)$/i.test((v ?? '').trim());

// Words that end a street name, and markers that start a unit after it.
const STREET_SUFFIX = new Set([
  'st', 'street', 'ave', 'av', 'avenue', 'rd', 'road', 'dr', 'drive', 'blvd', 'boulevard', 'ln', 'lane',
  'ct', 'court', 'pl', 'place', 'pkwy', 'parkway', 'hwy', 'highway', 'way', 'ter', 'terrace', 'cir', 'circle',
  'trl', 'trail', 'sq', 'square', 'plz', 'plaza', 'pike', 'expy', 'expressway', 'row', 'aly', 'alley',
]);
// Unit markers followed by the unit's name ("Unit 202", "Ste G2", "- 3F", "# 308", "Box 660317").
const UNIT_PREFIX = new Set(['unit', 'suite', 'ste', 'apt', 'apartment', '#', '-', 'rm', 'room', 'bldg', 'building', 'box', 'no', 'dept']);
// Unit markers that follow their value ("1st Fl") or stand alone ("BSMT").
const UNIT_POSTFIX = new Set(['fl', 'floor', 'bsmt', 'basement', 'gb', 'gdn', 'storefront', 'rear', 'ph', 'penthouse']);
// "St" that starts a city ("St. Paul, MN", "St. Louis, MO") rather than ending a street.
const SAINT_CITY = new Set(['paul', 'louis', 'charles', 'joseph', 'cloud', 'petersburg', 'augustine', 'george', 'clair']);
// A one-letter compass point after the street ("Superior Avenue E Cleveland") belongs to the street.
const COMPASS = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']);
const MAX_CITY_WORDS = 4;
const bare = (t: string) => t.toLowerCase().replace(/[.,]+$/, '');

/**
 * Street / city / state / zip from one address line. AppFolio writes
 * "1430 Lee Street Des Plaines, IL 60018" or "2555 W Leland Ave - Unit 202
 * Chicago, IL 60632" — no comma between street and city — so state and zip
 * come off the end and the city is the words after the street's last
 * landmark: a street suffix (St, Ave, Rd…), a unit ("Unit 202", "- 3F",
 * "#306", "STE 810", "1st Fl") or a number past the house number ("P.O. Box
 * 29120"). When there is no such landmark ("4200 N. Troy Chicago") the city
 * is left blank and the whole line stays in street rather than guessing.
 */
export function splitAddress(v: string | null | undefined): Pick<AppfolioVendor, 'address_street' | 'address_city' | 'address_state' | 'address_zip'> {
  const s = (v ?? '').trim().replace(/\s+/g, ' ');
  const blank = { address_street: null, address_city: null, address_state: null, address_zip: null };
  if (!s) return blank;
  // ", IL 60018", ", IL 60018-1234", ", IL" or ", 60076" at the end.
  const tail = s.match(/^(.*?),\s*(?:([A-Za-z]{2})\.?)?\s*(\d{5}(?:-\d{4}|\d{1,4})?)?$/);
  if (!tail || (!tail[2] && !tail[3]) || !tail[1].trim()) return { ...blank, address_street: s };
  const state = tail[2] ? tail[2].toUpperCase() : null;
  const zip = tail[3] ?? null;
  const tokens = tail[1].trim().split(' ');
  // "Wood Dale IL, IL 60191": the state written twice.
  if (state && tokens.length > 1 && bare(tokens[tokens.length - 1]) === state.toLowerCase()) tokens.pop();

  // Walk back from the end over words that can be part of a city name.
  let i = tokens.length - 1;
  while (i >= 0) {
    const t = tokens[i];
    const b = bare(t);
    const saintCity = (b === 'st' || b === 'ste') && i + 1 < tokens.length && SAINT_CITY.has(bare(tokens[i + 1]));
    if (!saintCity && (/\d/.test(t) || t.startsWith('#') || t.endsWith(',') || STREET_SUFFIX.has(b) || UNIT_PREFIX.has(b) || UNIT_POSTFIX.has(b))) break;
    i--;
  }
  let cityStart = i + 1;
  const anchor = i >= 0 ? tokens[i] : '';
  // "- G Chicago", "Unit E Norridge": the word right after a unit marker is the unit.
  if (i >= 0 && UNIT_PREFIX.has(bare(anchor))) cityStart++;
  if (i >= 0 && tokens.length - cityStart > 1 && COMPASS.has(bare(tokens[cityStart]))) cityStart++;
  // Only the house number in front ("4200 N. Troy Chicago") is no landmark.
  const confident = i > 0 || (i === 0 && (anchor.endsWith(',') || !/\d/.test(anchor)));
  const city = tokens.slice(cityStart).join(' ').replace(/,$/, '');
  if (!confident || !city || cityStart - 1 < 0 || tokens.length - cityStart > MAX_CITY_WORDS) {
    return { address_street: tail[1].trim().replace(/,$/, ''), address_city: null, address_state: state, address_zip: zip };
  }
  const street = tokens.slice(0, cityStart).join(' ').replace(/,$/, '').trim();
  return { address_street: street || null, address_city: city, address_state: state, address_zip: zip };
}

/** Put a lead column in front so rows with a blank Company Name are not read as subtotals. */
function withLeadColumn(text: string): { csv?: string; error?: string } {
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ''), { delimiter: ',', skipEmptyLines: false });
  if (parsed.errors.length) {
    const e = parsed.errors[0];
    return { error: `Could not read the CSV (line ${(e.row ?? 0) + 1}): ${e.message}` };
  }
  const lines = parsed.data;
  const headerIndex = lines.findIndex((cells) => cells.some((c) => c.trim() !== ''));
  if (headerIndex < 0) return { error: 'The file is empty.' };
  const find = headerFinder(lines[headerIndex]);
  const missing = REQUIRED.filter((h) => !find(h));
  if (missing.length) {
    return { error: `This doesn't look like AppFolio's Vendor Directory export (missing ${missing.join(', ')}).` };
  }
  const nameIdx = lines[headerIndex].indexOf(find('Name') ?? '');
  const companyIdx = lines[headerIndex].indexOf(find('Company Name', 'Company') ?? '');
  const out = lines.map((cells, i) => {
    if (i < headerIndex) return cells;
    if (i === headerIndex) return [LEAD, ...cells];
    const first = (cells[0] ?? '').trim();
    if (cells.every((c) => c.trim() === '')) return cells;
    if (/^->/.test(first) || /^total$/i.test(first)) return [first, ...cells];
    const lead = (nameIdx >= 0 ? cells[nameIdx] ?? '' : '').trim() || (companyIdx >= 0 ? cells[companyIdx] ?? '' : '').trim();
    return [lead, ...cells];
  });
  return { csv: Papa.unparse(out, { newline: '\n' }) };
}

/** Read AppFolio's Vendor Directory export into vendor records. */
export function parseAppfolioVendorDirectory(text: string): { vendors?: AppfolioVendor[]; error?: string } {
  const lead = withLeadColumn(text);
  if (!lead.csv) return { error: lead.error };
  const { report, error } = parseAppfolioReport(lead.csv);
  if (!report) return { error };
  const headers = report.headers.filter((h) => h !== LEAD);
  const find = headerFinder(headers);
  const col = {
    company: find('Company Name', 'Company'),
    name: find('Name')!,
    address: find('Address'),
    street1: find('Street Address 1', 'Address 1', 'Street Address'),
    street2: find('Street Address 2', 'Address 2'),
    city: find('City'),
    state: find('State'),
    zip: find('Zip', 'Zip Code', 'Postal Code'),
    phones: find('Phone Numbers')!,
    email: find('Email')!,
    gl: find('Default GL Account'),
    payment: find('Payment Type'),
    send1099: find('Send 1099?', 'Send 1099'),
    workers: find("Worker's Comp. Expiration", "Workers' Comp Expiration", 'Workers Comp Expiration'),
    liability: find('Liability Insurance Expiration', 'General Liability Expiration'),
    epa: find('EPA Certification Expiration'),
    auto: find('Auto Insurance Expiration'),
    license: find('State License Expiration'),
    contract: find('Contract Expiration'),
    tags: find('Tags'),
    portal: find('Vendor Portal Activated'),
    lastPaid: find('Last Payment Date'),
  };
  const get = (r: Record<string, string>, h: string | null) => (h ? (r[h] ?? '').trim() : '');
  const orNull = (s: string) => (s ? s : null);

  const vendors: AppfolioVendor[] = [];
  for (const g of report.groups) {
    for (const r of g.rows) {
      const rawName = get(r, col.name).replace(/\s+/g, ' ');
      const company = get(r, col.company).replace(/\s+/g, ' ');
      if (!rawName && !company) continue;
      const person = rawName ? vendorDisplayName(rawName) : '';
      const name = company || person;

      const street = [get(r, col.street1), get(r, col.street2)].filter(Boolean).join(', ');
      const address = street || get(r, col.city) || get(r, col.zip)
        ? {
            address_street: orNull(street),
            address_city: orNull(get(r, col.city)),
            address_state: orNull(get(r, col.state).toUpperCase()),
            address_zip: orNull(get(r, col.zip)),
          }
        : splitAddress(get(r, col.address));

      const gl = parseGlAccount(get(r, col.gl));
      const paymentRaw = get(r, col.payment);
      const paymentType = parsePaymentType(paymentRaw);

      vendors.push({
        row: r.row,
        name,
        appfolio_name: rawName || company,
        company_name: orNull(company),
        contact_name: company && person && person.toLowerCase() !== company.toLowerCase() ? person : null,
        phones: parseLabeledPhones(get(r, col.phones)).entries.map((p) => ({ number: p.number, type: p.type })),
        emails: splitEmails(get(r, col.email)),
        ...address,
        gl_account_number: gl.number,
        gl_account_label: gl.label,
        payment_type: paymentType,
        payment_type_raw: paymentRaw && !paymentType ? paymentRaw : null,
        send_1099: yes(get(r, col.send1099)),
        workers_comp_expiration: parseAppfolioDate(get(r, col.workers)),
        general_liability_expiration: parseAppfolioDate(get(r, col.liability)),
        epa_certification_expiration: parseAppfolioDate(get(r, col.epa)),
        auto_insurance_expiration: parseAppfolioDate(get(r, col.auto)),
        state_license_expiration: parseAppfolioDate(get(r, col.license)),
        contract_expiration: parseAppfolioDate(get(r, col.contract)),
        tags: orNull(get(r, col.tags)),
        portal_activated: yes(get(r, col.portal)),
        last_payment_date: parseAppfolioDate(get(r, col.lastPaid)),
      });
    }
  }
  if (!vendors.length) return { error: 'The file has no vendors.' };
  return { vendors };
}
