import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The DB check in this migration must refuse exactly the code points that
// hasVisibleText (lib/company-admin/settings.ts) treats as invisible.
const MIGRATION = 'supabase/migrations/20261007070000_portfolio_company_name_visible_chars.sql';
const INVISIBLE = /[\s\p{Cf}\p{Default_Ignorable_Code_Point}]/u;

function jsRanges(): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let start = -1;
  for (let c = 0; c <= 0x110000; c += 1) {
    const hit = c < 0x110000 && !(c >= 0xd800 && c <= 0xdfff) && INVISIBLE.test(String.fromCodePoint(c));
    if (hit && start < 0) start = c;
    if (!hit && start >= 0) { ranges.push([start, c - 1]); start = -1; }
  }
  return ranges;
}

function sqlRanges(): Array<[number, number]> {
  const sql = readFileSync(MIGRATION, 'utf8');
  const cls = sql.slice(sql.indexOf("'[^'"), sql.indexOf("|| ']'"));
  const ranges: Array<[number, number]> = [];
  for (const m of cls.matchAll(/chr\((\d+)\)(?:\s*\|\|\s*'-'\s*\|\|\s*chr\((\d+)\))?/g)) {
    ranges.push([Number(m[1]), Number(m[2] ?? m[1])]);
  }
  return ranges;
}

describe('company name visible-characters DB check', () => {
  it('matches hasVisibleText exactly', () => {
    expect(sqlRanges()).toEqual(jsRanges());
  });
});
