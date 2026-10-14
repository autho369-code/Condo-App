import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { amenityEndsNextDay, nextCalendarDate, withinAmenityHours } from '@/lib/amenities/portal';

const root = process.cwd();
const read = (p: string) => readFileSync(resolve(root, p), 'utf8').replace(/\r\n/g, '\n');
const migration = read('supabase/migrations/20261015110000_codex_379_380_followups.sql');
const sql = migration.replace(/--[^\n]*/g, '');
const inspectionsPage = read('app/(app)/inspections/page.tsx');
const amenitiesPage = read('app/portal/amenities/page.tsx');

describe('board seats matched by email are linked, then the email branch goes', () => {
  const block = migration.slice(migration.indexOf('-- ── 1.'), migration.indexOf('-- ── 2.'));

  it('links exactly the seats the removed branch granted', () => {
    expect(block).toContain('update public.board_members bm');
    expect(block).toContain('join public.associations a on a.id = b.association_id and a.archived_at is null');
    expect(block).toContain('join auth.users u on lower(u.email) = lower(b.email)');
    expect(block).toContain("p.disabled_at is null and p.hoa_role = 'board' and p.portfolio_id = a.portfolio_id");
    expect(block).toMatch(/where b\.active\s+and b\.auth_user_id is null/);
    expect(block).toMatch(/and bm\.auth_user_id is null;/);
  });

  it('removes the branch unconditionally after linking, re-runnably', () => {
    expect(block).toContain("chr(13), ''");
    expect(block).toContain("if position('board_vendor_fixes' in d) > 0 then return; end if;");
    expect(block).toContain('anchor not found exactly once');
    expect(block).not.toMatch(/if n > 0 then/);
    expect(block.indexOf('update public.board_members')).toBeLessThan(block.indexOf('execute replace(d, a,'));
    expect(block).toContain('linked login only, never by email match');
  });
});

describe('amenity hours past midnight', () => {
  it('accepts requests inside 18:00–02:00', () => {
    expect(withinAmenityHours('19:00', '21:00', '18:00:00', '02:00:00')).toBe(true);
    expect(withinAmenityHours('18:00', '23:59', '18:00', '02:00')).toBe(true);
    expect(withinAmenityHours('00:30', '01:30', '18:00', '02:00')).toBe(true);
    expect(withinAmenityHours('23:00', '01:00', '18:00', '02:00')).toBe(true);
    expect(withinAmenityHours('18:00', '02:00', '18:00', '02:00')).toBe(true);
    expect(withinAmenityHours('22:00', '00:00', '18:00', '02:00')).toBe(true);
  });

  it('rejects requests outside 18:00–02:00', () => {
    expect(withinAmenityHours('16:00', '19:00', '18:00', '02:00')).toBe(false);
    expect(withinAmenityHours('01:00', '03:00', '18:00', '02:00')).toBe(false);
    expect(withinAmenityHours('03:00', '05:00', '18:00', '02:00')).toBe(false);
    expect(withinAmenityHours('01:00', '19:00', '18:00', '02:00')).toBe(false);
    expect(withinAmenityHours('23:00', '03:00', '18:00', '02:00')).toBe(false);
    expect(withinAmenityHours('17:00', '01:00', '18:00', '02:00')).toBe(false);
  });

  it('keeps the same-day rule for normal hours', () => {
    expect(withinAmenityHours('10:00', '11:00', '08:00', '20:00')).toBe(true);
    expect(withinAmenityHours('19:00', '21:00', '08:00', '20:00')).toBe(false);
    expect(amenityEndsNextDay('23:00', '01:00', '08:00', '20:00')).toBe(false);
    expect(amenityEndsNextDay('22:00', '00:00', null, null)).toBe(true);
  });

  it('ends the request on the next day when it crosses midnight', () => {
    expect(amenityEndsNextDay('23:00', '01:00', '18:00', '02:00')).toBe(true);
    expect(amenityEndsNextDay('19:00', '21:00', '18:00', '02:00')).toBe(false);
    expect(nextCalendarDate('2026-12-31')).toBe('2027-01-01');
    expect(nextCalendarDate('2028-02-28')).toBe('2028-02-29');
    expect(nextCalendarDate('2026-02-30')).toBeNull();
    expect(nextCalendarDate('tomorrow')).toBeNull();
    expect(amenitiesPage).toContain('amenityEndsNextDay(startTime, endTime, amenity.opens_at, amenity.closes_at) ? nextCalendarDate(date) : date');
  });

  it('the database guard enforces the same window', () => {
    const block = migration.slice(migration.indexOf('-- ── 2.'), migration.indexOf('-- ── 3.'));
    expect(block).toContain("if position('codex_379_380_followups' in d) > 0 then return; end if;");
    expect(block).toContain("chr(13), ''");
    expect(block).toContain('anchor not found exactly once');
    expect(block).toContain('am.opens_at > am.closes_at');
    expect(block).toContain('if v_start::time < am.opens_at and v_end::time > am.closes_at then');
    expect(block).toContain('elsif v_end::date = v_start::date + 1 then');
    expect(block).toContain('if v_start::time < am.opens_at or v_end::time > am.closes_at then');
    expect(block).toContain('A reservation must end by the next day');
  });
});

describe('inspection search runs in the database', () => {
  it('is a security invoker function over every related name and the notes', () => {
    expect(sql).toMatch(/create or replace function public\.inspection_search\(p_term text\)\nreturns setof public\.inspections/);
    expect(sql).toContain('security invoker');
    for (const part of ['a.name ilike t.pat', 'u.unit_number ilike t.pat', 'v.name ilike t.pat', 'p.notes ilike t.pat', 'i.inspection_type ilike t.pat']) {
      expect(sql).toContain(part);
    }
    expect(sql).toContain('revoke all on function public.inspection_search(text) from public, anon;');
    expect(sql).toContain('grant execute on function public.inspection_search(text) to authenticated;');
    expect(sql).not.toMatch(/\b(delete from|drop )/i);
  });

  it('the list page uses it for the rows and the count, with no 200-id cap', () => {
    expect(inspectionsPage).toContain("db.rpc('inspection_search', { p_term: term }, { count: 'exact' }).select(columns)");
    expect(inspectionsPage).not.toMatch(/SEARCH_MATCH_LIMIT|limit\(200\)|inspectionSearchOr/);
    expect(inspectionsPage).toContain(".range(from, from + PAGE_SIZE - 1)");
  });
});
