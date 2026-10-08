import { describe, expect, it } from 'vitest';
import {
  parseAppfolioDate,
  parseAppfolioVendorDirectory,
  parseGlAccount,
  parsePaymentType,
  splitAddress,
  splitEmails,
  vendorDisplayName,
} from './appfolio-vendors';

// Shaped like AppFolio's "Vendor Directory" export: flat (no row groups),
// Company Name mostly blank, a blank line and a final Total row.
const HEADER =
  'Company Name,Name,Address,Phone Numbers,Email,Default GL Account,Payment Type,Send 1099?,' +
  "Worker's Comp. Expiration,Liability Insurance Expiration,EPA Certification Expiration,Auto Insurance Expiration," +
  'State License Expiration,Contract Expiration,Tags,Vendor Portal Activated,Last Payment Date';

const VENDOR_DIRECTORY = [
  HEADER,
  ',"Abcede, Michael","1234 N Main St, Chicago, IL 60630","Mobile: (773) 670-4165",mabcede@example.com,6371 - Painting & Decorating,Check,Yes,07/15/2026,12/31/2026,,,,,Painter,No,09/01/2026',
  ',"& Associates, INC., Property Services","500 W Madison St, Suite 200, Chicago, IL 60661","Office: (847) 298-8300, Fax: (847) 298-8301","AP@Associates.example.com; billing@associates.example.com",6400 - Repairs & Maintenance,eCheck,No,,01/31/2027,,03/15/2027,06/30/2027,12/31/2026,,Yes,',
  'Acme Roofing LLC,"Doe, Jane",,"Office: (312) 555-0100, Mobile: (312) 555-0199",jane@acmeroofing.example.com,,Wire,Yes,,,,,,,"Roofing, Gutters",No,',
  ',ComEd,"PO Box 6111, Carol Stream, IL 60197",,,6210 - Electricity,Check,No,,,,,,,,No,08/20/2026',
  ',"Nobody, Blank",,,not-an-email,,,,13/45/2026,,,,,,,,',
  '',
  'Total,,,,,,,,,,,,,,,,',
].join('\n');

describe('AppFolio Vendor Directory import', () => {
  it('reads every vendor row, including ones with a blank Company Name, and skips the Total row', () => {
    const { vendors, error } = parseAppfolioVendorDirectory(VENDOR_DIRECTORY);
    expect(error).toBeUndefined();
    expect(vendors).toHaveLength(5);
    expect(vendors!.map((v) => v.name)).toEqual([
      'Michael Abcede',
      '& Associates, INC., Property Services',
      'Acme Roofing LLC',
      'ComEd',
      'Blank Nobody',
    ]);
    expect(vendors![0].row).toBe('2');
  });

  it('maps a person vendor', () => {
    const v = parseAppfolioVendorDirectory(VENDOR_DIRECTORY).vendors![0];
    expect(v).toMatchObject({
      appfolio_name: 'Abcede, Michael',
      company_name: null,
      contact_name: null,
      phones: [{ number: '(773) 670-4165', type: 'mobile' }],
      emails: ['mabcede@example.com'],
      address_street: '1234 N Main St',
      address_city: 'Chicago',
      address_state: 'IL',
      address_zip: '60630',
      gl_account_number: '6371',
      gl_account_label: 'Painting & Decorating',
      payment_type: 'check',
      send_1099: true,
      workers_comp_expiration: '2026-07-15',
      general_liability_expiration: '2026-12-31',
      epa_certification_expiration: null,
      tags: 'Painter',
      portal_activated: false,
      last_payment_date: '2026-09-01',
    });
  });

  it('maps a company vendor with several phones and emails', () => {
    const v = parseAppfolioVendorDirectory(VENDOR_DIRECTORY).vendors![1];
    expect(v.phones).toEqual([
      { number: '(847) 298-8300', type: 'office' },
      { number: '(847) 298-8301', type: 'fax' },
    ]);
    expect(v.emails).toEqual(['ap@associates.example.com', 'billing@associates.example.com']);
    expect(v.address_street).toBe('500 W Madison St, Suite 200');
    expect(v.payment_type).toBe('echeck');
    expect(v.send_1099).toBe(false);
    expect(v.auto_insurance_expiration).toBe('2027-03-15');
    expect(v.state_license_expiration).toBe('2027-06-30');
    expect(v.contract_expiration).toBe('2026-12-31');
    expect(v.portal_activated).toBe(true);
  });

  it('keeps the person on a company vendor as its contact and flags unknown payment types', () => {
    const v = parseAppfolioVendorDirectory(VENDOR_DIRECTORY).vendors![2];
    expect(v).toMatchObject({ name: 'Acme Roofing LLC', contact_name: 'Jane Doe', payment_type: null, payment_type_raw: 'Wire', tags: 'Roofing, Gutters' });
    expect(v.address_street).toBeNull();
  });

  it('drops invalid emails and dates', () => {
    const v = parseAppfolioVendorDirectory(VENDOR_DIRECTORY).vendors![4];
    expect(v.emails).toEqual([]);
    expect(v.workers_comp_expiration).toBeNull();
    expect(v.phones).toEqual([]);
  });

  it('matches headers case-insensitively and uses split address columns when present', () => {
    const csv = [
      'company name,NAME,phone numbers,EMAIL,Street Address 1,Street Address 2,City,State,Zip',
      ',"Lee, Ann","Phone: 312-555-0111",ann@example.com,9 Elm St,Apt 2,Evanston,il,60201',
    ].join('\n');
    const { vendors, error } = parseAppfolioVendorDirectory(csv);
    expect(error).toBeUndefined();
    expect(vendors![0]).toMatchObject({
      name: 'Ann Lee',
      address_street: '9 Elm St, Apt 2',
      address_city: 'Evanston',
      address_state: 'IL',
      address_zip: '60201',
      phones: [{ number: '312-555-0111', type: 'phone' }],
    });
  });

  it('refuses files that are not a Vendor Directory export', () => {
    const { error } = parseAppfolioVendorDirectory('Unit Name,Sqft,Bedrooms,Bathrooms\n101,800,2,1\n');
    expect(error).toMatch(/missing Name, Phone Numbers, Email/);
    expect(parseAppfolioVendorDirectory('').error).toBeTruthy();
    expect(parseAppfolioVendorDirectory(`${HEADER}\nTotal,,,,,,,,,,,,,,,,\n`).error).toBeTruthy();
  });
});

describe('vendor field helpers', () => {
  it('parses dates', () => {
    expect(parseAppfolioDate('07/15/2026')).toBe('2026-07-15');
    expect(parseAppfolioDate('7/5/26')).toBe('2026-07-05');
    expect(parseAppfolioDate('2026-02-28')).toBe('2026-02-28');
    expect(parseAppfolioDate('02/30/2026')).toBeNull();
    expect(parseAppfolioDate('soon')).toBeNull();
    expect(parseAppfolioDate('')).toBeNull();
  });

  it('derives display names', () => {
    expect(vendorDisplayName('Abcede, Michael')).toBe('Michael Abcede');
    expect(vendorDisplayName('Acme Roofing, Inc.')).toBe('Acme Roofing, Inc.');
    expect(vendorDisplayName('City of Chicago, Water Dept')).toBe('City of Chicago, Water Dept');
    expect(vendorDisplayName('ComEd')).toBe('ComEd');
  });

  it('parses GL accounts, payment types, emails and addresses', () => {
    expect(parseGlAccount('6371 - Painting & Decorating')).toEqual({ number: '6371', label: 'Painting & Decorating' });
    expect(parseGlAccount('6371')).toEqual({ number: '6371', label: null });
    expect(parseGlAccount('')).toEqual({ number: null, label: null });
    expect(parsePaymentType('Check')).toBe('check');
    expect(parsePaymentType('E-Check')).toBe('echeck');
    expect(parsePaymentType('Wire')).toBeNull();
    expect(splitEmails('A@x.com, a@x.com; b@y.org bad')).toEqual(['a@x.com', 'b@y.org']);
    expect(splitAddress('PO Box 6111, Carol Stream, IL 60197')).toEqual({
      address_street: 'PO Box 6111', address_city: 'Carol Stream', address_state: 'IL', address_zip: '60197',
    });
    expect(splitAddress('Somewhere')).toMatchObject({ address_street: 'Somewhere', address_city: null });
  });
});
