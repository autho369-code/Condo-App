import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ownershipHeader, parseAppfolioReport, parseAppfolioUnitDirectory, parseOwnershipPct, splitGroupHeading } from './appfolio';

// A real AppFolio "Unit Directory" export (grouped by property, 2026-10-08).
const UNIT_DIRECTORY = readFileSync(resolve(process.cwd(), 'tests/fixtures/appfolio/unit_directory.csv'), 'utf8');

describe('AppFolio report exports', () => {
  it('splits a group heading into name and street address', () => {
    expect(splitGroupHeading('Pine Tree Court Condominium Association - 5460 W Higgins Ave Chicago, IL 60630'))
      .toEqual({ name: 'Pine Tree Court Condominium Association', address: '5460 W Higgins Ave Chicago, IL 60630' });
    expect(splitGroupHeading('Granville Courts')).toEqual({ name: 'Granville Courts', address: null });
    // A dash inside the name with no street number after it stays in the name.
    expect(splitGroupHeading('North - South Towers')).toEqual({ name: 'North - South Towers', address: null });
  });

  it('skips blank lines, subtotal and grand-total rows and keeps spreadsheet line numbers', () => {
    const { report } = parseAppfolioReport(UNIT_DIRECTORY);
    expect(report?.headers[0]).toBe('Unit Name');
    expect(report?.groups).toHaveLength(1);
    const rows = report!.groups[0].rows;
    expect(rows).toHaveLength(12);
    expect(rows[0]).toMatchObject({ 'Unit Name': '101', row: '4' });
    expect(rows.map((r) => r['Unit Name'])).not.toContain('Total');
  });

  it('reads the real Unit Directory export into one association with its 12 units', () => {
    const { groups, error } = parseAppfolioUnitDirectory(UNIT_DIRECTORY);
    expect(error).toBeUndefined();
    expect(groups).toHaveLength(1);
    expect(groups![0].name).toBe('Pine Tree Court Condominium Association');
    expect(groups![0].address).toBe('5460 W Higgins Ave Chicago, IL 60630');
    expect(groups![0].units.map((u) => u.unit_number)).toEqual(
      ['101', '102', '103', '104', '201', '202', '203', '204', '301', '302', '303', '304'],
    );
    // Blank or zero sqft/bedrooms/bathrooms mean "not set".
    expect(groups![0].units[0]).toMatchObject({ sqft: null, bedrooms: null, bathrooms: null, address: null });
  });

  it('groups a flat export (no row group) by its Property Name column and reads unit details', () => {
    const csv = [
      'Unit Name,Sqft,Bedrooms,Bathrooms,Property Name,Unit Street Address 1,Unit City,Unit State,Unit Zip',
      '1A,850,2,1.50,Granville Courts,1010 W Granville Ave,Chicago,IL,60660',
      '1B,0,0,0.00,Granville Courts,,,,',
      '2,1200,3,2.00,7241 N. Ridge,,,,',
      'Total,2050,5,3.50,,,,,',
    ].join('\n');
    const { groups } = parseAppfolioUnitDirectory(csv);
    expect(groups?.map((g) => [g.name, g.units.length])).toEqual([['Granville Courts', 2], ['7241 N. Ridge', 1]]);
    expect(groups![0].units[0]).toMatchObject({
      unit_number: '1A', sqft: 850, bedrooms: 2, bathrooms: 1.5, address: '1010 W Granville Ave, Chicago, IL 60660',
    });
    expect(groups![0].units[1]).toMatchObject({ sqft: null, bedrooms: null, bathrooms: null, address: null });
  });

  it('reads the ownership percentage under any of its AppFolio column names', () => {
    expect(ownershipHeader(['Unit Name', 'Percentage Ownership'])).toBe('Percentage Ownership');
    expect(ownershipHeader(['Unit Name', 'ownership %'])).toBe('ownership %');
    expect(ownershipHeader(['Unit Name', 'Sqft'])).toBeNull();
    expect(parseOwnershipPct('8.3333')).toBe(8.3333);
    expect(parseOwnershipPct('8.3333%')).toBe(8.3333);
    expect(parseOwnershipPct('0.083333')).toBe(8.3333); // a fraction
    expect(parseOwnershipPct('0.5%')).toBe(0.5);        // a percent sign means percent, even below 1
    expect(parseOwnershipPct('')).toBeNull();
    expect(parseOwnershipPct('0')).toBeNull();
    expect(parseOwnershipPct('150')).toBeNull();

    const csv = 'Unit Name,Sqft,Bedrooms,Bathrooms,Unit Percentage\n"-> Pine Tree Court - 5460 W Higgins Ave"\n101,,,,8.5%\n102,,,,\n';
    const { groups, hasOwnership } = parseAppfolioUnitDirectory(csv);
    expect(hasOwnership).toBe(true);
    expect(groups![0].units.map((u) => u.ownership_pct)).toEqual([8.5, null]);
    expect(parseAppfolioUnitDirectory(UNIT_DIRECTORY).hasOwnership).toBe(false);
  });

  it('refuses a file that is not a Unit Directory export', () => {
    const { error } = parseAppfolioUnitDirectory('Name,Email\nJane,jane@example.com\n');
    expect(error).toMatch(/Unit Directory/);
  });
});
