import { describe, expect, it } from 'vitest';
import {
  parseAppfolioAgedReceivables,
  parseAppfolioAmount,
  parseAppfolioDate,
  parseReceivableHeading,
  unitFromUnitAndPayer,
} from './appfolio-receivables';

const HEADER = 'Payer Name,Charge Date,Posting Date,GL Account Number,GL Account Name,Total Amount,Amount Receivable,0-30,31-60,61-90,91+';

// Grouped by "Unit & Payer Name", as AppFolio exports it by default.
const GROUPED = [
  HEADER,
  '',
  '"-> 101 - Jane Smith",,,,,,,,,,',
  'Jane Smith,09/01/2026,09/01/2026,4000,Assessment Income,"1,250.00","1,250.00",0.00,"1,250.00",0.00,0.00',
  'Jane Smith,10/01/2026,10/01/2026,4000,Assessment Income,"1,250.00",250.00,250.00,0.00,0.00,0.00',
  ',,,,,"2,500.00","1,500.00",250.00,"1,250.00",0.00,0.00',
  '',
  '"-> 102 - Bob Lee",,,,,,,,,,',
  'Bob Lee,10/01/2026,10/01/2026,4000,Assessment Income,-75.00,-75.00,-75.00,0.00,0.00,0.00',
  'Bob Lee,06/15/2026,06/15/2026,4100,Late Fee Income,25.00,25.00,0.00,0.00,0.00,25.00',
  'Bob Lee,07/01/2026,07/01/2026,4100,Late Fee Income,25.00,0.00,0.00,0.00,0.00,0.00',
  ',,,,,-25.00,-50.00,-75.00,0.00,0.00,25.00',
  '',
  'Total,,,,,"2,475.00","1,450.00",175.00,"1,250.00",0.00,25.00',
].join('\n');

// Company-wide export grouped by property, unit and payer (anonymized, real shape).
const COMPANY = [
  HEADER,
  '',
  '"-> Maple Court Condominium Association  - 100-110 W Maple Ave & 2-4 N Oak St Chicago, IL 60601 - Unit 100-1 - Doe, Jane","","","","","","","","","",""',
  '"Doe, Jane",10/01/2026,10/01/2026,4101,Regular Assessment,241.19,241.19,241.19,0.00,0.00,0.00',
  '"Doe, Jane",10/01/2026,10/01/2026,9010,Reserve Assessment,20.80,20.80,20.80,0.00,0.00,0.00',
  ',,,,,261.99,261.99,261.99,0.00,0.00,0.00',
  '"-> Maple Court Condominium Association  - 100-110 W Maple Ave & 2-4 N Oak St Chicago, IL 60601 - Unit 102 - 1 - Holdings - Pkg#3","","","","","","","","","",""',
  'Holdings - Pkg#3,05/12/2026,05/12/2026,4420,Passthru Maintenance & Repair,450.00,253.33,0.00,0.00,0.00,253.33',
  ',,,,,450.00,253.33,0.00,0.00,0.00,253.33',
  '"-> Birch - Elm Condominium No. 2"" - 55 West Birch Avenue Chicago, IL 60630 - Unit 3D - Roe, Ann","","","","","","","","","",""',
  '"Roe, Ann",10/01/2026,10/01/2026,4101,Regular Assessment,359.94,359.94,359.94,0.00,0.00,0.00',
  '"Roe, Ann",09/10/2024,09/27/2024,2110,Tenant/Owner Deposits,-500.00,-180.12,0.00,0.00,0.00,-180.12',
  ',,,,,-140.06,179.82,359.94,0.00,0.00,-180.12',
  '',
  'Total,,,,,"571.93","695.14","621.93",0.00,0.00,"73.21"',
].join('\n');

// Flat export (no row group) with the optional Unit Name column.
const FLAT = [
  'Property Name,Unit Name,Payer Name,Charge Date,Posting Date,GL Account Number,GL Account Name,Total Amount,Amount Receivable,0-30,31-60,61-90,91+',
  'Pine Tree Court - 5460 W Higgins Ave Chicago IL 60630,2A,Ann Park,08/01/2026,08/02/2026,4000,Assessment Income,400.00,400.00,0.00,0.00,400.00,0.00',
  'Pine Tree Court - 5460 W Higgins Ave Chicago IL 60630,2B,Raj Patel,10/15/2026,10/15/2026,4300,Special Assessment,(100.00),(100.00),(100.00),0.00,0.00,0.00',
  'Total,,,,,,,300.00,300.00,-100.00,0.00,400.00,0.00',
].join('\n');

describe('AppFolio Aged Receivable Detail', () => {
  it('reads amounts, credits and dates the way AppFolio writes them', () => {
    expect(parseAppfolioAmount('1,250.00')).toBe(1250);
    expect(parseAppfolioAmount('$1,250.00')).toBe(1250);
    expect(parseAppfolioAmount('-75.00')).toBe(-75);
    expect(parseAppfolioAmount('(100.00)')).toBe(-100);
    expect(parseAppfolioAmount('')).toBe(0);
    expect(parseAppfolioAmount('abc')).toBeNull();
    expect(parseAppfolioDate('10/31/2026')).toBe('2026-10-31');
    expect(parseAppfolioDate('1/5/26')).toBe('2026-01-05');
    expect(parseAppfolioDate('2026-02-30')).toBeNull();
    expect(parseAppfolioDate('')).toBeNull();
  });

  it('takes the unit from a "Unit & Payer Name" value but not from a property heading', () => {
    expect(unitFromUnitAndPayer('101 - Jane Smith', 'Jane Smith')).toBe('101');
    expect(unitFromUnitAndPayer('A - 101 - Jane Smith', 'Jane Smith')).toBe('A - 101');
    expect(unitFromUnitAndPayer('101 - Jane & John Smith', 'Jane Smith')).toBe('101');
    expect(unitFromUnitAndPayer('Pine Tree Court - 5460 W Higgins Ave', 'Jane Smith')).toBeNull();
    expect(unitFromUnitAndPayer('Pine Tree Court', '')).toBeNull();
  });

  it('groups a grouped export by unit, skips subtotal, Total and fully-paid rows, keeps credits', () => {
    const parsed = parseAppfolioAgedReceivables(GROUPED);
    expect(parsed.error).toBeUndefined();
    expect(parsed.problems).toBeUndefined();
    expect(parsed.associations).toHaveLength(1);
    expect(parsed.associations![0]).toMatchObject({ name: '', address: null });
    expect(parsed.associations![0].units.map((u) => u.unit_number)).toEqual(['101', '102']);
    expect(parsed.fileTotal).toBe(1450);

    const [u101, u102] = parsed.associations![0].units;
    expect(u101.items).toHaveLength(2);
    expect(u101.payers).toEqual(['Jane Smith']);
    expect(u101.total).toBe(1500);
    expect(u101.aging).toEqual({ d0_30: 250, d31_60: 1250, d61_90: 0, d91_plus: 0 });
    expect(u101.items[0]).toMatchObject({
      row: '4', charge_date: '2026-09-01', gl_number: '4000', gl_name: 'Assessment Income', amount: 1250, payer: 'Jane Smith',
    });

    // The paid late fee (Amount Receivable 0.00) is not an open item.
    expect(u102.items.map((i) => i.amount)).toEqual([-75, 25]);
    expect(u102.total).toBe(-50);

    expect(parsed.totals).toEqual({
      amount: 1450, charges: 1525, credits: -75, itemCount: 4,
      aging: { d0_30: 175, d31_60: 1250, d61_90: 0, d91_plus: 25 },
    });
    expect(parsed.associations![0].items.some((i) => /total/i.test(i.payer))).toBe(false);
  });

  it('reads a company-wide export: property, address, unit and payer from each heading', () => {
    expect(parseReceivableHeading(
      'Maple Court Condominium Association  - 100-110 W Maple Ave Chicago, IL 60601 - Unit 100-1 - Doe, Jane', 'Doe, Jane',
    )).toEqual({ name: 'Maple Court Condominium Association', address: '100-110 W Maple Ave Chicago, IL 60601', unit: '100-1' });
    // Unit numbers and payers that contain " - " themselves.
    expect(parseReceivableHeading('Birch - Elm HOA - 55 W Birch Ave - Unit 3817 - G - Lee, Bo', 'Lee, Bo'))
      .toEqual({ name: 'Birch - Elm HOA', address: '55 W Birch Ave', unit: '3817 - G' });
    expect(parseReceivableHeading('Oak HOA - 9 Oak St - Unit 4B - Acme - Pkg#1', 'Someone else'))
      .toMatchObject({ name: 'Oak HOA', unit: '4B' });
    expect(parseReceivableHeading('101 - Jane Smith', 'Jane Smith')).toEqual({ name: '', address: null, unit: '101' });
  });

  it('groups a company-wide export by association, then unit, and ties out to the Total line', () => {
    const parsed = parseAppfolioAgedReceivables(COMPANY);
    expect(parsed.error).toBeUndefined();
    expect(parsed.problems).toBeUndefined();
    expect(parsed.associations?.map((a) => [a.name, a.address])).toEqual([
      ['Maple Court Condominium Association', '100-110 W Maple Ave & 2-4 N Oak St Chicago, IL 60601'],
      ['Birch - Elm Condominium No. 2', '55 West Birch Avenue Chicago, IL 60630'],
    ]);
    const [maple, birch] = parsed.associations!;
    expect(maple.units.map((u) => [u.unit_number, u.total, u.payers])).toEqual([
      ['100-1', 261.99, ['Doe, Jane']],
      ['102 - 1', 253.33, ['Holdings - Pkg#3']],
    ]);
    expect(maple.totals).toMatchObject({ amount: 515.32, charges: 515.32, credits: 0, itemCount: 3 });
    // The deposit credit is read (and reported), not dropped.
    expect(birch.units[0].items.map((i) => i.amount)).toEqual([359.94, -180.12]);
    expect(birch.totals).toMatchObject({ amount: 179.82, charges: 359.94, credits: -180.12 });
    // Subtotal and Total lines are not items; the parsed sum equals the file's Total line.
    expect(parsed.totals).toEqual({
      amount: 695.14, charges: 875.26, credits: -180.12, itemCount: 5,
      aging: { d0_30: 621.93, d31_60: 0, d61_90: 0, d91_plus: 73.21 },
    });
    expect(parsed.fileTotal).toBe(695.14);
  });

  it('keeps two same-named properties at different addresses in separate associations', () => {
    const header = 'Payer Name,Charge Date,Posting Date,GL Account Number,GL Account Name,Total Amount,Amount Receivable,0-30,31-60,61-90,91+';
    const parsed = parseAppfolioAgedReceivables([
      header,
      '"-> Lakeview Condominium - 100 N Main St Chicago, IL 60601 - Unit 101 - Doe, Jane","","","","","","","","","",""',
      '"Doe, Jane",10/01/2026,10/01/2026,4101,Regular Assessment,100.00,100.00,100.00,0.00,0.00,0.00',
      '"-> Lakeview Condominium - 200 S Oak Ave Chicago, IL 60602 - Unit 101 - Roe, Ann","","","","","","","","","",""',
      '"Roe, Ann",10/01/2026,10/01/2026,4101,Regular Assessment,50.00,50.00,50.00,0.00,0.00,0.00',
    ].join('\n'));
    expect(parsed.associations?.map((a) => [a.name, a.address, a.totals.amount])).toEqual([
      ['Lakeview Condominium', '100 N Main St Chicago, IL 60601', 100],
      ['Lakeview Condominium', '200 S Oak Ave Chicago, IL 60602', 50],
    ]);
  });

  it('reads a flat export with a Unit Name column and a parenthesised credit', () => {
    const parsed = parseAppfolioAgedReceivables(FLAT);
    expect(parsed.error).toBeUndefined();
    expect(parsed.associations).toHaveLength(1);
    const [assoc] = parsed.associations!;
    expect(assoc).toMatchObject({ name: 'Pine Tree Court', address: '5460 W Higgins Ave Chicago IL 60630' });
    expect(assoc.units.map((u) => [u.unit_number, u.total])).toEqual([['2A', 400], ['2B', -100]]);
    expect(assoc.items[0]).toMatchObject({ charge_date: '2026-08-01', gl_name: 'Assessment Income', aging: { d61_90: 400 } });
    expect(parsed.totals?.amount).toBe(300);
  });

  it('reads the unit from a flat "Unit & Payer Name" column', () => {
    const csv = [
      'Unit & Payer Name,Payer Name,Charge Date,GL Account Name,Amount Receivable',
      '305 - Maria Gomez,Maria Gomez,10/01/2026,Assessment Income,300.00',
    ].join('\n');
    expect(parseAppfolioAgedReceivables(csv).associations?.[0].units[0]).toMatchObject({ unit_number: '305', total: 300 });
  });

  it('rejects other reports and exports without units', () => {
    expect(parseAppfolioAgedReceivables('Unit Name,Sqft,Bedrooms,Bathrooms\n101,800,2,1').error).toMatch(/Aged Receivable Detail/);
    const noUnits = [HEADER, 'Jane Smith,09/01/2026,09/01/2026,4000,Assessment Income,10.00,10.00,10.00,0,0,0'].join('\n');
    expect(parseAppfolioAgedReceivables(noUnits).error).toMatch(/Unit & Payer Name/);
  });

  it('reports rows it cannot read instead of guessing', () => {
    const csv = [
      HEADER,
      '"-> 101 - Jane Smith",,,,,,,,,,',
      'Jane Smith,09/01/2026,09/01/2026,4000,Assessment Income,10.00,ten,0,0,0,0',
      'Jane Smith,09/01/2026,09/01/2026,4000,Assessment Income,20.00,20.00,20.00,0,0,0',
    ].join('\n');
    const parsed = parseAppfolioAgedReceivables(csv);
    expect(parsed.associations?.[0].items).toHaveLength(1);
    expect(parsed.problems?.[0]).toMatch(/Line 3 \(101\): unreadable Amount Receivable/);
  });
});
