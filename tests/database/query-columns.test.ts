import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { _chainSelect, _parameterArguments, findQueryColumnProblems, selectProblems } from '../../scripts/lib/query-columns.mjs';

const schema = JSON.parse(readFileSync(join(process.cwd(), 'supabase/schema-columns.json'), 'utf8'));
const fks = JSON.parse(readFileSync(join(process.cwd(), 'supabase/schema-foreign-keys.json'), 'utf8'));

describe('query columns', () => {
  it('every static select names columns the database has', () => {
    const { problems, checked } = findQueryColumnProblems(process.cwd(), schema, fks);
    expect(checked).toBeGreaterThan(1000);
    // A failure lists file:line and the missing column. If the column was added
    // by a new migration, refresh supabase/schema-columns.json (SQL in
    // scripts/lib/query-columns.mjs).
    expect(problems).toEqual([]);
  });

  it('every select it cannot check is on the reviewed list, and the list has no stale entries', () => {
    const listed: string[] = JSON.parse(readFileSync(join(process.cwd(), 'supabase/unchecked-selects.json'), 'utf8'));
    const { unchecked } = findQueryColumnProblems(process.cwd(), schema, fks);
    // A new entry here means a select the scanner can't read: write its
    // columns at the query (or as a constant), or add it to the list.
    expect(unchecked.filter((u: string) => !listed.includes(u))).toEqual([]);
    expect(listed.filter((u) => !unchecked.includes(u))).toEqual([]);
  });

  it('catches a column the table does not have', () => {
    expect(selectProblems(schema, 'portfolios', 'company_name, name')).toEqual(['portfolios.name does not exist']);
  });

  it('checks embedded tables and accepts aliases, casts, json paths and counts', () => {
    expect(selectProblems(schema, 'user_invitations', 'portfolio_id, portfolios(company_name)')).toEqual([]);
    expect(selectProblems(schema, 'user_invitations', 'portfolios(company_name, name)')).toEqual(['portfolios.name does not exist']);
    expect(selectProblems(schema, 'occupancies', 'id, owner:owners!owner_id(full_name), created_at::text')).toEqual([]);
    expect(selectProblems(schema, 'dues_increases', 'id, dues_increase_lines(count)')).toEqual([]);
    expect(selectProblems(schema, 'service_requests', 'id, tenants:tenant_id(first_name)', fks)).toEqual([]);
    expect(selectProblems(schema, 'no_such_table', 'id')).toEqual(["table or view 'no_such_table' not found"]);
  });

  it('follows the query chain to its select (writes, filters, comments)', () => {
    const at = (src: string) => _chainSelect(src, src.indexOf(')') + 1);
    expect(at(`db.from('t').update({ note: 'a) b', n: f(1) }).eq('id', id).is('x', null).select('id, note')`)).toBe('id, note');
    expect(at(`db.from('t')
      // a comment with .select('nope')
      /* and another */
      .select('*, owners(full_name)')`)).toBe('*, owners(full_name)');
    expect(at(`db.from('t').insert(row);`)).toBeNull();
    // An unknown trailing piece is dropped; the known columns are still checked.
    expect(at('db.from(\'t\').select(`id, ${cols}`)')).toBe('id, ');
  });

  it('checks columns inside an embed written through a foreign-key column', () => {
    expect(selectProblems(schema, 'service_requests', 'tenants:tenant_id(definitely_not_a_column)', fks))
      .toEqual(['tenants.definitely_not_a_column does not exist']);
    expect(selectProblems(schema, 'service_requests', 'created_by(full_name)', fks))
      .toEqual(["service_requests.created_by is not a foreign key to a public table, so it can't be embedded"]);
  });

  it('resolves constants and concatenations passed to select', () => {
    const consts: Record<string, string> = { COLS: 'id, title', MORE: ', status' };
    const resolve = (name: string) => consts[name] ?? null;
    const at = (src: string) => _chainSelect(src, src.indexOf(')') + 1, resolve);
    expect(at(`db.from('t').select(COLS).eq('id', id)`)).toBe('id, title');
    expect(at(`db.from('t').select(COLS + MORE)`)).toBe('id, title, status');
    expect(at('db.from(\'t\').select(`${COLS}, notes`)')).toBe('id, title, notes');
    // An unknown trailing part (an optional extra-columns parameter) is dropped.
    expect(at(`db.from('t').select(COLS + extraColumns)`)).toBe('id, title');
    expect(at('db.from(\'t\').select(`id, title${optionalJoin}`)')).toBe('id, title');
    // An unknown part before a known one can't be checked.
    expect(at(`db.from('t').select(prefix + COLS)`)).toBeNull();
    expect(at(`db.from('t').select(cols.join(', '))`)).toBeNull();
  });

  it('finds the arguments passed for a select-list parameter at each call', () => {
    const src = [
      'const base = (select: string, opts?: object) => {',
      "  let q = db.from('t').select(select, opts);",
      '  return q;',
      '};',
      "base('id, amount');",
      'base(`id, ${COLS}`, { count: true });',
      'async function load(db: any, columns: string) {',
      "  return db.from('g').select(columns).order('id');",
      '}',
      "load(db, 'id, number');",
    ].join('\n');
    expect(_parameterArguments(src, src.indexOf("from('t')"), 'select')).toEqual([
      { arg: "'id, amount'", line: 5 },
      { arg: '`id, ${COLS}`', line: 6 },
    ]);
    expect(_parameterArguments(src, src.indexOf("from('g')"), 'columns')).toEqual([{ arg: "'id, number'", line: 10 }]);
    expect(_parameterArguments(src, src.indexOf("from('t')"), 'nope')).toBeNull();
  });
});
