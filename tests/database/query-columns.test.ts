import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { _chainSelect, _parameterArguments, findQueryColumnProblems, selectProblems } from '../../scripts/lib/query-columns.mjs';
import { VENDOR_EXPIRATION_COLUMNS, VENDOR_EXPIRATION_FIELDS } from '../../lib/company-admin/vendor-compliance';
import { BUILDER_SOURCES } from '../../lib/reports/builder-catalog';

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
    const listedMap: Record<string, string> = JSON.parse(readFileSync(join(process.cwd(), 'supabase/unchecked-selects.json'), 'utf8'));
    const listed = Object.keys(listedMap);
    // Each entry says how that query is covered instead.
    expect(Object.entries(listedMap).filter(([, why]) => !why.trim())).toEqual([]);
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

  it('checks every branch of a conditional, through regex literals, arrows and variable tables', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qcols-'));
    mkdirSync(join(dir, 'app'));
    writeFileSync(join(dir, 'app', 'page.tsx'), [
      "const join = assoc ? ', units!inner(unit_number)' : ', units(unit_numbr)';",
      "db.from('payments').select(`id${join}`);",
      "const headCount = (table: string) => db.from(table).select('id', { count: 'exact', head: true });",
      "headCount('payments'); headCount('no_such_table');",
      'const list = (extra = \'\') => {',
      "  const like = q.replace(/\"/g, '\\\\\"');",
      "  return db.from('owners').select('id, full_name' + extra);",
      '};',
      "list(); list(', emial');",
      "db.from(source.table).select(cols);",
    ].join('\n'));
    const r = findQueryColumnProblems(dir, schema, fks);
    expect(r.problems).toEqual([
      'app/page.tsx:2  units.unit_numbr does not exist',
      "app/page.tsx:4  table or view 'no_such_table' not found",
      'app/page.tsx:9  owners.emial does not exist',
    ]);
    expect(r.unchecked).toEqual(['app/page.tsx  from(source.table)  cols']);
  });

  it('vendor expiration select list matches the expiration fields', () => {
    expect(VENDOR_EXPIRATION_COLUMNS).toBe(VENDOR_EXPIRATION_FIELDS.join(', '));
  });

  // Covers the listed lib/private-fields.ts query: its table and columns come from each call.
  it('private-fields calls name private tables, keys and columns that exist', () => {
    const root = process.cwd();
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name === '.next') continue;
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) files.push(p);
      }
    };
    ['app', 'components', 'lib'].forEach((d) => walk(join(root, d)));
    const call = /\bmergePrivateFields(?:One)?\(/g;
    const literal = /^\bmergePrivateFields(?:One)?\(\s*[\w.]+(?:\s+as\s+any)?\s*,\s*'([a-z_]+)'\s*,\s*'([a-z_]+)'\s*,\s*\[([^\]]*)\]/;
    const problems: string[] = [];
    let calls = 0;
    for (const file of files) {
      if (file.endsWith(join('lib', 'private-fields.ts'))) continue;
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(call)) {
        calls++;
        const at = `${file.slice(root.length + 1)}:${src.slice(0, m.index).split('\n').length}`;
        const lit = literal.exec(src.slice(m.index!, m.index! + 400));
        if (!lit) { problems.push(`${at}  call not written with a literal table, key and column list`); continue; }
        const [, table, key, cols] = lit;
        const columns = cols.split(',').map((c) => c.trim().replace(/^'|'$/g, '')).filter(Boolean);
        for (const p of selectProblems(schema, table, [key, ...columns].join(', '))) problems.push(`${at}  ${p}`);
      }
    }
    expect(calls).toBeGreaterThan(10);
    expect(problems).toEqual([]);
  });

  // Covers the listed lib/reports/builder-catalog.ts query: its table and columns come from the catalog.
  it('report builder catalog names tables and columns that exist', () => {
    const problems: string[] = [];
    for (const src of BUILDER_SOURCES) {
      const cols = [
        ...src.columns.map((c) => c.key),
        ...(src.dateColumn ? [src.dateColumn] : []),
        ...(src.statusColumn ? [src.statusColumn] : []),
        ...(src.filterableAssociation ? ['association_id'] : []),
        ...(src.archivable ? ['archived_at'] : []),
      ];
      problems.push(...selectProblems(schema, src.table, cols.join(', ')).map((p: string) => `${src.key}: ${p}`));
    }
    expect(BUILDER_SOURCES.length).toBeGreaterThan(3);
    expect(problems).toEqual([]);
  });
});
