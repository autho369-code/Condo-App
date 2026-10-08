import { describe, expect, it } from 'vitest';
import {
  homeownerName,
  ownershipTotal,
  parseAppfolioHomeownerDirectory,
  parseDues,
  parseHomeownerPct,
} from './appfolio-homeowners';

// Shaped like AppFolio's "Homeowner Directory" export: flat, the association
// in the Property column, a blank line and a final Total row. Made-up people.
const HEADER =
  'Property,Unit,Homeowner,Electronic Delivery Consent,Status,Renter Occupied Unit,Homeowner Type,' +
  'Phone Numbers,Emails,Lockbox ID,Ownership Percentage,Dues,Tags';

const DIRECTORY = [
  HEADER,
  '',
  '"Maple Court Condominium Association - 100 W Example St Chicago, IL 60600",101,"Doe, Jane",No,Current,No,Financially Responsible,"Home: (312) 555-0100, Mobile: (312) 555-0199",jane@example.com,12,25.500000000000,296.25,',
  '"Maple Court Condominium Association - 100 W Example St Chicago, IL 60600",102,"& Sam Roe, Alex Poe",Yes,Current,Yes,Financially Responsible,"Mobile: (312) 555-0111","alex@example.com, sam@example.com",13,24.500000000000,214.90,',
  '"Maple Court Condominium Association - 100 W Example St Chicago, IL 60600",102,"& Sam Roe, Alex Poe",Yes,Current,Yes,Financially Responsible,,,13,24.500000000000,214.90,',
  '"Maple Court Condominium Association - 100 W Example St Chicago, IL 60600",103,"Lee - PKG#23, Kim",No,Past,No,Financially Responsible,,kim@example.com,14,50,0.00,',
  '"Maple Court Condominium Association - 100 W Example St Chicago, IL 60600",103,"Example Holdings, LLC",No,Current,No,Financially Responsible,,,14,50.000000000000,0.00,',
  '"Birch Lofts - 9 N Sample Ave Chicago, IL 60601",1A,"Moe, Pat &",No,Current,No,Financially Responsible,,pat@example.com,,,240.00,',
  '',
  'Total,,,,,,,,,,,,',
].join('\n');

describe('AppFolio Homeowner Directory import', () => {
  it('groups rows by association, imports current homeowners only and skips the Total row', () => {
    const { groups, error } = parseAppfolioHomeownerDirectory(DIRECTORY);
    expect(error).toBeUndefined();
    expect(groups!.map((g) => [g.name, g.address, g.homeowners.length, g.skipped.length])).toEqual([
      ['Maple Court Condominium Association', '100 W Example St Chicago, IL 60600', 4, 1],
      ['Birch Lofts', '9 N Sample Ave Chicago, IL 60601', 1, 0],
    ]);
    const [maple] = groups!;
    expect(maple.skipped[0]).toMatchObject({ unit_number: '103', name: 'Kim Lee', reason: 'status Past' });

    const [doe, poe] = maple.homeowners;
    expect(doe).toMatchObject({
      unit_number: '101', electronic_consent: false, renter_occupied: false,
      phones: 'Home: (312) 555-0100, Mobile: (312) 555-0199', emails: ['jane@example.com'],
      ownership_pct: 25.5, dues: 296.25,
    });
    expect(doe.name).toMatchObject({ display: 'Jane Doe', first_name: 'Jane', last_name: 'Doe', is_company: false });
    expect(poe.name.display).toBe('Alex Poe & Sam Roe');
    expect(poe).toMatchObject({ electronic_consent: true, renter_occupied: true, emails: ['alex@example.com', 'sam@example.com'] });
    expect(maple.homeowners[3].name).toMatchObject({ display: 'Example Holdings, LLC', is_company: true, first_name: null });
  });

  it('counts each unit once in the ownership total (co-owner rows repeat the share)', () => {
    const { groups } = parseAppfolioHomeownerDirectory(DIRECTORY);
    expect(ownershipTotal(groups![0].homeowners)).toEqual({ total: 100, units: 3 });
    expect(ownershipTotal(groups![1].homeowners)).toEqual({ total: 0, units: 0 });
  });

  it('rejects a file that is not a Homeowner Directory', () => {
    expect(parseAppfolioHomeownerDirectory('Unit Name,Sqft\n101,800\n').error).toMatch(/Homeowner Directory/);
  });
});

describe('homeownerName', () => {
  it.each([
    ['Doe, Jane', 'Jane Doe', 'Jane', 'Doe'],
    ['Doe , Jane  A.', 'Jane A. Doe', 'Jane A.', 'Doe'],
    ['Abbey, Leon & Ariel', 'Leon & Ariel Abbey', 'Leon & Ariel', 'Abbey'],
    ['& Sam Roe, Alex Poe', 'Alex Poe & Sam Roe', 'Alex', 'Poe'],
    ['Riley Moe, Pat &', 'Pat & Riley Moe', 'Pat & Riley', 'Moe'],
    ['Kay Lin, Jo Ann Park &', 'Jo Ann Park & Kay Lin', 'Jo Ann', 'Park'],
    ['Fisher, Jr., Robert', 'Robert Fisher, Jr.', 'Robert', 'Fisher, Jr.'],
    ['Kung, Cal, Nan & Rog', 'Cal, Nan & Rog Kung', 'Cal, Nan & Rog', 'Kung'],
    ['DOE, JOHN PAUL', 'John Paul Doe', 'John Paul', 'Doe'],
  ])('%s -> %s', (raw, display, first, last) => {
    expect(homeownerName(raw)).toMatchObject({ raw, display, first_name: first, last_name: last, is_company: false });
  });

  it('takes parking notes out of the name', () => {
    expect(homeownerName('Lee - PKG#149, Kim')).toMatchObject({ display: 'Kim Lee', notes: ['PKG#149'] });
    expect(homeownerName('Ray - P#87 & P#128, Al & Bo')).toMatchObject({ display: 'Al & Bo Ray', notes: ['P#87 & P#128'] });
    expect(homeownerName('Ray - Parking # 12, Al J')).toMatchObject({ display: 'Al J Ray', notes: ['Parking # 12'] });
    expect(homeownerName('Ray Pkg # 189, Al')).toMatchObject({ display: 'Al Ray', notes: ['Pkg # 189'] });
    expect(homeownerName('Ray - Pkg#41/19/39, Al')).toMatchObject({ display: 'Al Ray', notes: ['Pkg#41/19/39'] });
    expect(homeownerName('Ray - Beneficiary, Al')).toMatchObject({ display: 'Al Ray', notes: ['Beneficiary'] });
  });

  it('keeps company and trust names as written', () => {
    expect(homeownerName('Example Realty LLC')).toMatchObject({ display: 'Example Realty LLC', is_company: true });
    expect(homeownerName('/ Sample Investments Inc, Al Ray')).toMatchObject({ display: 'Sample Investments Inc, Al Ray', is_company: true });
    expect(homeownerName('Sample Bank & Trust Company, as Trustee')).toMatchObject({ is_company: true, last_name: null });
  });
});

describe('value parsing', () => {
  it('reads ownership as a percent, not a fraction', () => {
    expect(parseHomeownerPct('0.900000000000')).toBe(0.9);
    expect(parseHomeownerPct('2.851200000000')).toBe(2.8512);
    expect(parseHomeownerPct('')).toBeNull();
    expect(parseHomeownerPct('0')).toBeNull();
    expect(parseHomeownerPct('120')).toBeNull();
  });

  it('reads dues', () => {
    expect(parseDues('296.25')).toBe(296.25);
    expect(parseDues('$1,296.25')).toBe(1296.25);
    expect(parseDues('0.00')).toBe(0);
    expect(parseDues('')).toBeNull();
    expect(parseDues('-5')).toBeNull();
  });
});
