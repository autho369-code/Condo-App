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
  /** Display name for Portier369: the company name, or "First Last" for a person. */
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
  /** AppFolio's payment type when it is not one Portier369 knows. */
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

const COMPANY_WORDS =
  /\b(inc|llc|l\.l\.c|llp|ltd|co|corp|corporation|company|companies|associates|assoc|group|services?|service|enterprises?|partners|plc|pc|p\.c|bank|trust|dept|department|city|village|county|state|of|the|and|construction|plumbing|electric|roofing|landscaping|management|insurance)\b|&|\d/i;

/**
 * "Abcede, Michael" -> "Michael Abcede". Company names that happen to have a
 * comma ("Acme Roofing, Inc.", "& Associates, INC., ...") are left alone.
 */
export function vendorDisplayName(name: string): string {
  const s = name.trim().replace(/\s+/g, ' ');
  const parts = s.split(',');
  if (parts.length !== 2) return s;
  const [last, first] = parts.map((p) => p.trim());
  if (!last || !first || COMPANY_WORDS.test(s)) return s;
  if (last.split(' ').length > 2 || first.split(' ').length > 3) return s;
  return `${first} ${last}`;
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

/** "123 Main St, Suite 4, Chicago, IL 60630" -> street / city / state / zip (street only when the tail does not parse). */
export function splitAddress(v: string | null | undefined): Pick<AppfolioVendor, 'address_street' | 'address_city' | 'address_state' | 'address_zip'> {
  const s = (v ?? '').trim().replace(/\s+/g, ' ');
  const blank = { address_street: null, address_city: null, address_state: null, address_zip: null };
  if (!s) return blank;
  const m = s.match(/^(.*),\s*([^,]+?),?\s+([A-Za-z]{2})\.?\s+(\d{5}(?:-\d{4})?)$/);
  if (!m) return { ...blank, address_street: s };
  return { address_street: m[1].trim() || null, address_city: m[2].trim(), address_state: m[3].toUpperCase(), address_zip: m[4] };
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
