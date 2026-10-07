// Checks every static `.from('table').select('...')` in the app against the
// column snapshot in supabase/schema-columns.json. A query that names a column
// the database doesn't have fails at runtime (PostgREST 400), often only on the
// page or email that uses it (past bugs: bills, budgets,
// bank_accounts.balance, portfolios.name). Used by tests/database and
// `npm run check:columns`.
//
// Coverage: the select list written at the query (a string, a constant —
// local or imported — or a `+`/`${}` concatenation of those), or passed in
// as a parameter of a function in the same file, in which case each call's
// argument is checked. Every select that still can't be checked statically
// (columns chosen at run time, `cols.join(', ')`, conditional pieces) must be
// listed in supabase/unchecked-selects.json: the test fails on an unlisted
// one, so nothing is skipped silently, and the list shows reviewers exactly
// which queries rely on `npm run check:queries` (the live API probe) instead.
//
// Refresh the snapshot after a migration adds or renames columns: run this in
// the Supabase SQL editor and save the result as supabase/schema-columns.json
// (any JSON formatting works; the committed file keeps one table per line):
//
//   select json_object_agg(table_name, cols order by table_name) from (
//     select table_name, json_agg(column_name order by column_name) cols
//     from information_schema.columns where table_schema = 'public'
//     group by table_name) t;
//
// and, for embeds written through a foreign-key column (tenant_id(...)),
// supabase/schema-foreign-keys.json ("table.column": "referenced table"):
//
//   select json_object_agg(k, v order by k) from (
//     select c.conrelid::regclass::text || '.' || a.attname k,
//            min(c.confrelid::regclass::text) v
//     from pg_constraint c
//     join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
//     where c.contype = 'f' and array_length(c.conkey, 1) = 1
//       and c.connamespace = 'public'::regnamespace
//       and c.confrelid::regclass::text not like '%.%'
//     group by 1) t;

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
export function selectProblems(schema, table, select, fks = {}) {
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
      if (schema[resource]) problems.push(...selectProblems(schema, resource, inner, fks));
      else if (have.has(resource)) {
        // Embedding through a foreign-key column (tenant_id(first_name)):
        // check the inner columns against the table the key references.
        const target = fks[`${table}.${resource}`];
        if (target) problems.push(...selectProblems(schema, target, inner, fks));
        else problems.push(`${table}.${resource} is not a foreign key to a public table, so it can't be embedded`);
      } else if (resource !== 'count') problems.push(`${table}: embedded '${resource}' is neither a table nor a column`);
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
 * Parse a string expression at `i`: string/template literals and identifiers
 * joined by `+`. Returns its parts and the index after it, or null.
 * Template literals keep their `${…}` holes as identifier parts when the
 * hole is a bare identifier, and fail otherwise.
 */
function parseConcat(src, i) {
  const parts = [];
  for (;;) {
    i = skipSpace(src, i);
    const ch = src[i];
    if (ch === "'" || ch === '"') {
      let j = i + 1;
      let text = '';
      for (; j < src.length && src[j] !== ch; j++) {
        if (src[j] === '\\') { j++; text += src[j]; } else text += src[j];
      }
      parts.push({ text });
      i = j + 1;
    } else if (ch === '`') {
      let j = i + 1;
      let text = '';
      for (; j < src.length && src[j] !== '`'; j++) {
        if (src[j] === '\\') { j++; text += src[j]; continue; }
        if (src[j] === '$' && src[j + 1] === '{') {
          const close = src.indexOf('}', j);
          const name = src.slice(j + 2, close).trim();
          if (!/^[A-Za-z_$][\w$]*$/.test(name)) return null;
          parts.push({ text }, { id: name });
          text = '';
          j = close;
          continue;
        }
        text += src[j];
      }
      parts.push({ text });
      i = j + 1;
    } else {
      const id = /^[A-Za-z_$][\w$]*/.exec(src.slice(i, i + 80));
      if (!id) return null;
      parts.push({ id: id[0] });
      i += id[0].length;
    }
    const next = skipSpace(src, i);
    if (src[next] !== '+') return { parts, end: i };
    i = next + 1;
  }
}

/**
 * Resolves string constants by name for one file: `const X = '…'` (possibly
 * built from other constants with `+` or `${}`) in the file itself, or a
 * named import of an exported constant from another app file.
 */
function constantResolver(root, file, cache = new Map()) {
  const load = (path) => {
    if (!cache.has(path)) {
      let src = null;
      for (const candidate of [path, `${path}.ts`, `${path}.tsx`, join(path, 'index.ts')]) {
        try { if (statSync(candidate).isFile()) { src = readFileSync(candidate, 'utf8'); path = candidate; break; } } catch { /* next */ }
      }
      const consts = new Map();
      const imports = new Map();
      if (src != null) {
        for (const m of src.matchAll(/(?:^|[\s;])(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*/g)) {
          const expr = parseConcat(src, m.index + m[0].length);
          if (!expr) continue;
          const after = skipSpace(src, expr.end);
          if (!/[;,)\n]|^$/.test(src[after] ?? '') && !/^(const|let|export|function|return|\})/.test(src.slice(after, after + 8))) continue;
          if (!consts.has(m[1])) consts.set(m[1], expr.parts);
        }
        for (const m of src.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
          const spec = m[2];
          const base = spec.startsWith('@/') ? join(root, spec.slice(2)) : spec.startsWith('.') ? join(path, '..', spec) : null;
          if (!base) continue;
          for (const name of m[1].split(',')) {
            const [orig, local] = name.trim().split(/\s+as\s+/);
            if (orig) imports.set((local ?? orig).trim(), { path: base, name: orig.trim() });
          }
        }
      }
      cache.set(path, { consts, imports });
    }
    return cache.get(path);
  };

  const resolve = (path, name, depth = 0) => {
    if (depth > 8) return null;
    const { consts, imports } = load(path);
    if (consts.has(name)) return joinParts(consts.get(name), (n) => resolve(path, n, depth + 1));
    const imp = imports.get(name);
    return imp ? resolve(imp.path, imp.name, depth + 1) : null;
  };
  return (name) => resolve(file, name);
}

/** Join parsed parts; null if any identifier doesn't resolve. */
function joinParts(parts, resolve) {
  let out = '';
  for (const p of parts) {
    if ('text' in p) out += p.text;
    else {
      const v = resolve(p.id);
      if (v == null) return null;
      out += v;
    }
  }
  return out;
}

/**
 * The `.select(…)` argument of the query chain starting at `i` (just past
 * `.from('table')`): follows the builder calls (.insert/.update/.eq/…,
 * comments allowed) to the first `.select(`. Returns the argument's source
 * range and, when it is a string expression, its parsed parts. Null when the
 * chain has no select.
 */
function chainSelectArg(src, i) {
  for (let calls = 0; calls < 40; calls++) {
    i = skipSpace(src, i);
    const call = /^\.\s*([A-Za-z_]+)\s*\(/.exec(src.slice(i, i + 60));
    if (!call) return null;
    const open = i + call[0].length - 1;
    const end = closeParen(src, open);
    if (call[1] === 'select') {
      const expr = parseConcat(src, open + 1);
      const after = expr ? skipSpace(src, expr.end) : -1;
      const whole = expr && (src[after] === ')' || src[after] === ',');
      return { text: src.slice(open + 1, end === -1 ? open + 1 : end - 1), parts: whole ? expr.parts : null };
    }
    if (end === -1) return null;
    i = end;
  }
  return null;
}

/**
 * Evaluate parsed parts: unresolved trailing parts (an optional extra-columns
 * parameter) are dropped; an unresolved part before a resolved one, or an
 * empty result, gives null.
 */
function evaluateParts(parts, resolve) {
  let out = '';
  let unresolved = false;
  for (const p of parts) {
    if ('text' in p && p.text === '') continue;
    const v = 'text' in p ? p.text : resolve(p.id);
    if (v == null) { unresolved = true; continue; }
    if (unresolved) return null;
    out += v;
  }
  return out.trim() ? out : null;
}

/**
 * The static select list of the query chain at `i`, or null (see
 * chainSelectArg and evaluateParts).
 *
 * @param {string} src
 * @param {number} i
 * @param {(name: string) => string | null} [resolve]
 * @returns {string | null}
 */
function chainSelect(src, i, resolve = () => null) {
  const arg = chainSelectArg(src, i);
  return arg?.parts ? evaluateParts(arg.parts, resolve) : null;
}

/** Index just past the `}` matching the `{` at `open` (strings and comments skipped). */
function closeBrace(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === "'" || ch === '"' || ch === '`') {
      for (i++; i < src.length && src[i] !== ch; i++) if (src[i] === '\\') i++;
    } else if (src.startsWith('//', i)) {
      const e = src.indexOf('\n', i); i = e === -1 ? src.length : e;
    } else if (src.startsWith('/*', i)) {
      const e = src.indexOf('*/', i + 2); i = e === -1 ? src.length : e + 1;
    } else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return i + 1;
  }
  return -1;
}

/** Split a call's argument text on top-level commas. */
function splitArgs(text) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1;
      for (; j < text.length && text[j] !== ch; j++) if (text[j] === '\\') j++;
      cur += text.slice(i, j + 1);
      i = j;
      continue;
    }
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((a) => a.trim());
}

/**
 * When a select list is a parameter of the function around `pos`
 * (`const base = (select: string) => db.from('t').select(select)` or
 * `function load(db, columns) { … .select(columns) … }`), the arguments
 * passed for it at that function's call sites in the same file, with the
 * line of each call. Null when `name` isn't such a parameter.
 */
function parameterArguments(src, pos, name) {
  const header = /(?:function\s+([A-Za-z_$][\w$]*)\s*\(|(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\()/g;
  let best = null;
  for (const m of src.matchAll(header)) {
    if (m.index > pos) break;
    const open = m.index + m[0].length - 1;
    const close = closeParen(src, open);
    if (close === -1 || close > pos) continue;
    const params = splitArgs(src.slice(open + 1, close - 1)).map((p) => /^([A-Za-z_$][\w$]*)/.exec(p)?.[1]);
    const index = params.indexOf(name);
    if (index === -1) continue;
    // Body: the block after the parameters (optionally `: Type` and `=>`).
    let b = close;
    while (b < src.length && src[b] !== '{' && src[b] !== ';' && src.slice(b, b + 2) !== '=>') b++;
    if (src.slice(b, b + 2) === '=>') { b = skipSpace(src, b + 2); }
    if (src[b] !== '{') continue;
    const end = closeBrace(src, b);
    if (end === -1 || end < pos) continue;
    best = { fn: m[1] ?? m[2], index, headerAt: m.index };
  }
  if (!best) return null;
  const calls = [];
  for (const m of src.matchAll(new RegExp(`\\b${best.fn.replace(/\$/g, '\\$')}\\s*\\(`, 'g'))) {
    if (m.index === best.headerAt || src.slice(Math.max(0, m.index - 9), m.index).includes('function')) continue;
    const open = m.index + m[0].length - 1;
    const close = closeParen(src, open);
    if (close === -1) continue;
    const arg = splitArgs(src.slice(open + 1, close - 1))[best.index];
    calls.push({ arg: arg ?? '', line: src.slice(0, m.index).split('\n').length });
  }
  return calls;
}

/** Parse a whole argument text as a string expression (null if it isn't one). */
function parseWholeArg(text) {
  const expr = parseConcat(text, 0);
  return expr && skipSpace(text, expr.end) >= text.length ? expr.parts : null;
}

/** Normalized key for a select the scanner can't check (see unchecked-selects.json). */
function uncheckedKey(file, table, text) {
  return `${file}  ${table}  ${text.replace(/\s+/g, ' ').trim().slice(0, 160)}`;
}

/**
 * Every problem across app/, components/ and lib/, as "file:line  message",
 * plus the selects that couldn't be checked statically (as stable keys, for
 * the reviewed list in supabase/unchecked-selects.json).
 */
export function findQueryColumnProblems(root, schema, fks = {}) {
  const from = /\.from\(\s*['"]([a-z_0-9]+)['"]\s*\)/g;
  const found = new Set();
  const unchecked = new Set();
  const cache = new Map();
  let checked = 0;
  for (const dir of ['app', 'components', 'lib']) {
    for (const file of sourceFiles(join(root, dir))) {
      const src = readFileSync(file, 'utf8');
      const rel = relative(root, file);
      const resolve = constantResolver(root, file, cache);
      const check = (table, select, line) => {
        checked++;
        for (const p of selectProblems(schema, table, select.replace(/\s+/g, ' '), fks)) found.add(`${rel}:${line}  ${p}`);
      };
      for (const m of src.matchAll(from)) {
        const arg = chainSelectArg(src, m.index + m[0].length);
        if (!arg) continue; // no select in this chain
        const line = src.slice(0, m.index).split('\n').length;
        const value = arg.parts ? evaluateParts(arg.parts, resolve) : null;
        if (value != null) { check(m[1], value, line); continue; }
        // A select list passed in as a parameter: check what each call passes.
        const single = arg.parts?.length === 1 && 'id' in arg.parts[0] ? arg.parts[0].id : null;
        const calls = single ? parameterArguments(src, m.index, single) : null;
        if (calls?.length) {
          for (const call of calls) {
            const parts = parseWholeArg(call.arg);
            const v = parts ? evaluateParts(parts, resolve) : null;
            if (v != null) check(m[1], v, call.line);
            else unchecked.add(uncheckedKey(rel, m[1], `${single} = ${call.arg}`));
          }
          continue;
        }
        unchecked.add(uncheckedKey(rel, m[1], arg.text));
      }
    }
  }
  return { problems: [...found].sort(), unchecked: [...unchecked].sort(), checked };
}

export { chainSelect as _chainSelect, parameterArguments as _parameterArguments };
