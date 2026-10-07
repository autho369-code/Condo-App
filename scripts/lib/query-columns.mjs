// Checks every static `.from('table').select('...')` in the app against the
// column snapshot in supabase/schema-columns.json. A query that names a column
// the database doesn't have fails at runtime (PostgREST 400), often only on the
// page or email that uses it (past bugs: bills, budgets,
// bank_accounts.balance, portfolios.name). Used by tests/database and
// `npm run check:columns`.
//
// Refresh the snapshot after a migration adds or renames columns: run this in
// the Supabase SQL editor and save the result as supabase/schema-columns.json
// (any JSON formatting works; the committed file keeps one table per line):
//
//   select json_object_agg(table_name, cols order by table_name) from (
//     select table_name, json_agg(column_name order by column_name) cols
//     from information_schema.columns where table_schema = 'public'
//     group by table_name) t;

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.next', 'mobile', 'tests', 'scripts']);

function sourceFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.|database\.ts$/.test(name)) out.push(p);
  }
  return out;
}

/** Split a select list on top-level commas (not those inside embeds). */
function splitTop(select) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of select) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

const EMBED = /^(?:[A-Za-z_0-9]+:)?([A-Za-z_0-9]+)(?:![A-Za-z_0-9]+)*\s*\(([\s\S]*)\)$/;

/** Problems in one select list for `table`, recursing into embedded tables. */
export function selectProblems(schema, table, select) {
  const columns = schema[table];
  if (!columns) return [`table or view '${table}' not found`];
  const have = new Set(columns);
  const problems = [];
  for (let item of splitTop(select)) {
    if (item.startsWith('...')) item = item.slice(3).trim();
    if (item === '*') continue;
    const embed = EMBED.exec(item);
    if (embed) {
      const [, resource, inner] = embed;
      if (schema[resource]) problems.push(...selectProblems(schema, resource, inner));
      // Embedding through a foreign-key column (owner_id(full_name)): the
      // column must exist; its target table isn't in the snapshot.
      else if (!have.has(resource) && resource !== 'count') problems.push(`${table}: embedded '${resource}' is neither a table nor a column`);
      continue;
    }
    let col = item;
    // alias:column (not column::cast)
    const alias = /^[A-Za-z_0-9]+:(?!:)(.*)$/.exec(col);
    if (alias) col = alias[1];
    col = col.split('::')[0].split(/->>?/)[0].trim();
    if (col === 'count' || col.includes('(') || !/^[A-Za-z_0-9]+$/.test(col)) continue; // aggregates, expressions
    if (!have.has(col)) problems.push(`${table}.${col} does not exist`);
  }
  return problems;
}

/** Skip whitespace and comments from `i`; returns the next index. */
function skipSpace(src, i) {
  for (;;) {
    while (i < src.length && /\s/.test(src[i])) i++;
    if (src.startsWith('//', i)) { const e = src.indexOf('\n', i); i = e === -1 ? src.length : e + 1; continue; }
    if (src.startsWith('/*', i)) { const e = src.indexOf('*/', i + 2); i = e === -1 ? src.length : e + 2; continue; }
    return i;
  }
}

/** Index just past the `)` matching the `(` at `open`, skipping strings and comments. */
function closeParen(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === "'" || ch === '"' || ch === '`') {
      for (i++; i < src.length && src[i] !== ch; i++) if (src[i] === '\\') i++;
    } else if (src.startsWith('//', i)) {
      const e = src.indexOf('\n', i); i = e === -1 ? src.length : e;
    } else if (src.startsWith('/*', i)) {
      const e = src.indexOf('*/', i + 2); i = e === -1 ? src.length : e + 1;
    } else if (ch === '(') depth++;
    else if (ch === ')' && --depth === 0) return i + 1;
  }
  return -1;
}

/**
 * The static select list of the query chain starting at `i` (just past
 * `.from('table')`): follows the builder calls (.insert/.update/.eq/…,
 * comments allowed) to the first `.select('…')`. Null when the chain has no
 * select or its select isn't a plain string.
 */
function chainSelect(src, i) {
  for (let calls = 0; calls < 40; calls++) {
    i = skipSpace(src, i);
    const call = /^\.\s*([A-Za-z_]+)\s*\(/.exec(src.slice(i, i + 60));
    if (!call) return null;
    const open = i + call[0].length - 1;
    if (call[1] === 'select') {
      const arg = /^\(\s*(['"`])([\s\S]*?)\1/.exec(src.slice(open));
      return arg && !arg[2].includes('${') ? arg[2] : null;
    }
    const end = closeParen(src, open);
    if (end === -1) return null;
    i = end;
  }
  return null;
}

/** Every problem across app/, components/ and lib/, as "file:line  message". */
export function findQueryColumnProblems(root, schema) {
  const from = /\.from\(\s*['"]([a-z_0-9]+)['"]\s*\)/g;
  const found = new Set();
  let checked = 0;
  for (const dir of ['app', 'components', 'lib']) {
    for (const file of sourceFiles(join(root, dir))) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(from)) {
        const select = chainSelect(src, m.index + m[0].length);
        if (select == null) continue;
        checked++;
        const line = src.slice(0, m.index).split('\n').length;
        for (const p of selectProblems(schema, m[1], select.replace(/\s+/g, ' '))) {
          found.add(`${relative(root, file)}:${line}  ${p}`);
        }
      }
    }
  }
  return { problems: [...found].sort(), checked };
}

export { chainSelect as _chainSelect };
