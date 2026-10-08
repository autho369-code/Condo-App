import { describe, expect, it } from 'vitest';
import {
  parseAppfolioAgedReceivables,
  parseAppfolioAmount,
  parseAppfolioDate,
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
    expect(parsed.units?.map((u) => u.unit_number)).toEqual(['101', '102']);

    const [u101, u102] = parsed.units!;
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
    expect(parsed.items?.some((i) => /total/i.test(i.payer))).toBe(false);
  });

  it('reads a flat export with a Unit Name column and a parenthesised credit', () => {
    const parsed = parseAppfolioAgedReceivables(FLAT);
    expect(parsed.error).toBeUndefined();
    expect(parsed.units?.map((u) => [u.unit_number, u.total])).toEqual([['2A', 400], ['2B', -100]]);
    expect(parsed.items?.[0]).toMatchObject({ charge_date: '2026-08-01', gl_name: 'Assessment Income', aging: { d61_90: 400 } });
    expect(parsed.totals?.amount).toBe(300);
  });

  it('reads the unit from a flat "Unit & Payer Name" column', () => {
    const csv = [
      'Unit & Payer Name,Payer Name,Charge Date,GL Account Name,Amount Receivable',
      '305 - Maria Gomez,Maria Gomez,10/01/2026,Assessment Income,300.00',
    ].join('\n');
    expect(parseAppfolioAgedReceivables(csv).units?.[0]).toMatchObject({ unit_number: '305', total: 300 });
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
    expect(parsed.items).toHaveLength(1);
    expect(parsed.problems?.[0]).toMatch(/Line 3 \(101\): unreadable Amount Receivable/);
  });
});
