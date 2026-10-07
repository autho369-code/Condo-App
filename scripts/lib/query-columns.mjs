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
// listed in supabase/unchecked-selects.json with how it is covered instead
// (a dedicated test): the test fails on an unlisted one or an entry without a
// reason, so nothing is skipped silently.
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

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.next', 'mobile', 'tests', 'scripts']);

function sourceFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
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
 * If a regular-expression literal starts at `i` (a `/` where an expression
 * can begin), the index just past it; otherwise -1. Keeps quotes and brackets
 * inside patterns like /"/g from confusing the bracket matching.
 */
function regexEnd(src, i) {
  if (src[i] !== '/' || src[i + 1] === '/' || src[i + 1] === '*') return -1;
  let k = i - 1;
  while (k >= 0 && /\s/.test(src[k])) k--;
  if (k >= 0 && !/[(,=:[!&|?{};+\-*%<>~^]/.test(src[k]) && !/\b(return|typeof|case|in|of)$/.test(src.slice(Math.max(0, k - 6), k + 1))) return -1;
  let inClass = false;
  for (let j = i + 1; j < src.length; j++) {
    const ch = src[j];
    if (ch === '\\') { j++; continue; }
    if (ch === '\n') return -1;
    if (ch === '[') inClass = true;
    else if (ch === ']') inClass = false;
    else if (ch === '/' && !inClass) {
      let e = j + 1;
      while (/[a-z]/i.test(src[e] ?? '')) e++;
      return e;
    }
  }
  return -1;
}

/** Index just past the closing bracket matching the one at `open` (strings and comments skipped). */
function closeBracket(src, open) {
  const pairs = { '(': ')', '[': ']', '{': '}' };
  const stack = [];
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    const re = ch === '/' ? regexEnd(src, i) : -1;
    if (re !== -1) { i = re - 1; continue; }
    if (ch === "'" || ch === '"') {
      for (i++; i < src.length && src[i] !== ch; i++) if (src[i] === '\\') i++;
    } else if (ch === '`') {
      for (i++; i < src.length && src[i] !== '`'; i++) {
        if (src[i] === '\\') i++;
        else if (src[i] === '$' && src[i + 1] === '{') { const e = closeBracket(src, i + 1); if (e === -1) return -1; i = e - 1; }
      }
    } else if (src.startsWith('//', i)) {
      const e = src.indexOf('\n', i); i = e === -1 ? src.length : e;
    } else if (src.startsWith('/*', i)) {
      const e = src.indexOf('*/', i + 2); i = e === -1 ? src.length : e + 1;
    } else if (pairs[ch]) stack.push(pairs[ch]);
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (stack.pop() !== ch) return -1;
      if (!stack.length) return i + 1;
    }
  }
  return -1;
}

/**
 * Index of the first top-level occurrence (outside brackets, strings and
 * comments) of any of `chars` in `text` from `from`, or -1.
 */
function topLevel(text, chars, from = 0) {
  for (let i = from; i < text.length; i++) {
    const ch = text[i];
    const re = ch === '/' ? regexEnd(text, i) : -1;
    if (re !== -1) { i = re - 1; continue; }
    if (ch === "'" || ch === '"' || ch === '`' || ch === '(' || ch === '[' || ch === '{') {
      if (ch === "'" || ch === '"') { for (i++; i < text.length && text[i] !== ch; i++) if (text[i] === '\\') i++; continue; }
      const e = ch === '`' ? closeTemplate(text, i) : closeBracket(text, i);
      if (e === -1) return -1;
      i = e - 1;
      continue;
    }
    if (chars.includes(ch)) return i;
  }
  return -1;
}

/** Index just past the template literal starting at `open`. */
function closeTemplate(src, open) {
  for (let i = open + 1; i < src.length; i++) {
    if (src[i] === '\\') { i++; continue; }
    if (src[i] === '`') return i + 1;
    if (src[i] === '$' && src[i + 1] === '{') { const e = closeBracket(src, i + 1); if (e === -1) return -1; i = e - 1; }
  }
  return -1;
}

/** Split text on top-level commas. */
function splitArgs(text) {
  const out = [];
  let start = 0;
  for (;;) {
    const k = topLevel(text, ',', start);
    if (k === -1) { out.push(text.slice(start)); break; }
    out.push(text.slice(start, k));
    start = k + 1;
  }
  return out.map((a) => a.trim()).filter((a, i, all) => a || i < all.length - 1);
}

/**
 * Parse a string expression into parts: { text } for literal text, { id } for
 * an identifier, and { alt: [parts, parts] } for `cond ? a : b` (both
 * branches are checked). Literals, identifiers, `+` concatenation and
 * template `${…}` holes holding any of these are understood; anything else
 * (calls, property access, `.join()`) gives null.
 */
function parseExpr(text) {
  text = text.trim();
  if (!text) return null;
  while (text.startsWith('(') && closeBracket(text, 0) === text.length) text = text.slice(1, -1).trim();
  const q = topLevel(text, '?');
  if (q !== -1 && text[q + 1] !== '?' && text[q + 1] !== '.') {
    const c = topLevel(text, ':', q + 1);
    if (c === -1) return null;
    const a = parseExpr(text.slice(q + 1, c));
    const b = parseExpr(text.slice(c + 1));
    return a && b ? [{ alt: [a, b] }] : null;
  }
  const parts = [];
  let i = 0;
  for (;;) {
    i = skipSpace(text, i);
    const ch = text[i];
    if (ch === "'" || ch === '"') {
      let j = i + 1;
      let lit = '';
      for (; j < text.length && text[j] !== ch; j++) { if (text[j] === '\\') j++; lit += text[j]; }
      parts.push({ text: lit });
      i = j + 1;
    } else if (ch === '`') {
      const end = closeTemplate(text, i);
      if (end === -1) return null;
      let lit = '';
      for (let j = i + 1; j < end - 1; j++) {
        if (text[j] === '\\') { j++; lit += text[j]; continue; }
        if (text[j] === '$' && text[j + 1] === '{') {
          const close = closeBracket(text, j + 1);
          const hole = parseExpr(text.slice(j + 2, close - 1));
          if (!hole) return null;
          parts.push({ text: lit }, ...hole);
          lit = '';
          j = close - 1;
          continue;
        }
        lit += text[j];
      }
      parts.push({ text: lit });
      i = end;
    } else {
      const id = /^[A-Za-z_$][\w$]*/.exec(text.slice(i));
      if (!id) return null;
      parts.push({ id: id[0] });
      i += id[0].length;
    }
    i = skipSpace(text, i);
    if (i >= text.length) return parts;
    if (text[i] !== '+') return null;
    i++;
  }
}

/** End of the expression statement starting at `i` (first top-level `;` or line end). */
function statementEnd(src, i) {
  for (let j = i; j < src.length; j++) {
    const ch = src[j];
    const re = ch === '/' ? regexEnd(src, j) : -1;
    if (re !== -1) { j = re - 1; continue; }
    if (ch === "'" || ch === '"') { for (j++; j < src.length && src[j] !== ch; j++) if (src[j] === '\\') j++; continue; }
    if (ch === '`') { const e = closeTemplate(src, j); if (e === -1) return src.length; j = e - 1; continue; }
    if (ch === '(' || ch === '[' || ch === '{') { const e = closeBracket(src, j); if (e === -1) return src.length; j = e - 1; continue; }
    if (ch === ';' || ch === ')' || ch === '}' || ch === ']') return j;
    if (ch === ',') return j;
    if (ch === '\n') {
      // A line that continues the expression starts with an operator.
      const next = skipSpace(src, j);
      if (!/^(\?|:|\+|\|\||&&|\.(?!\.\.))/.test(src.slice(next, next + 3))) return j;
    }
  }
  return src.length;
}

/**
 * Resolves string constants by name for one file: `const X = …` in the file
 * itself (built from literals, other constants, `+`, `${}` or `? :`), or a
 * named import of an exported constant from another app file. Returns the
 * possible values (several when a conditional is involved), or null.
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
        for (const m of src.matchAll(/(?:^|[\s;])(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::\s*string\s*)?=\s*/g)) {
          const start = m.index + m[0].length;
          const parts = parseExpr(src.slice(start, statementEnd(src, start)));
          if (parts && !consts.has(m[1])) consts.set(m[1], parts);
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
    if (consts.has(name)) {
      const vs = variants(consts.get(name), (n) => resolve(path, n, depth + 1));
      return vs.every((v) => v.complete) ? vs.map((v) => v.text) : null;
    }
    const imp = imports.get(name);
    return imp ? resolve(imp.path, imp.name, depth + 1) : null;
  };
  return (name) => resolve(file, name);
}

/**
 * Every value `parts` can take: { text, complete }. An unresolved identifier
 * stops a variant (complete: false, text = what came before it). Capped at
 * 32 variants.
 */
function variants(parts, resolve) {
  let acc = [{ text: '', complete: true }];
  for (const p of parts) {
    const options = 'text' in p ? [p.text]
      : 'alt' in p ? p.alt.flatMap((branch) => variants(branch, resolve))
      : resolve(p.id);
    const next = [];
    for (const a of acc) {
      if (!a.complete) { next.push(a); continue; }
      if (options == null) { next.push({ text: a.text, complete: false }); continue; }
      for (const o of options) {
        if (typeof o === 'string') next.push({ text: a.text + o, complete: true });
        else next.push({ text: a.text + o.text, complete: a.complete && o.complete });
      }
    }
    acc = next.slice(0, 32);
  }
  return acc;
}

/**
 * The `.select(…)` call of the query chain starting at `i` (just past
 * `.from(…)`): follows the builder calls (.insert/.update/.eq/…, comments
 * allowed) to the first `.select(`. Returns its first argument's text and
 * parsed parts (null parts when it isn't a string expression), or null when
 * the chain has no select.
 */
function chainSelectArg(src, i) {
  for (let calls = 0; calls < 40; calls++) {
    i = skipSpace(src, i);
    const call = /^\.\s*([A-Za-z_]+)\s*\(/.exec(src.slice(i, i + 60));
    if (!call) return null;
    const open = i + call[0].length - 1;
    const end = closeBracket(src, open);
    if (end === -1) return null;
    if (call[1] === 'select') {
      const text = splitArgs(src.slice(open + 1, end - 1))[0] ?? '';
      return { text, parts: parseExpr(text) };
    }
    i = end;
  }
  return null;
}

/**
 * The checkable select list of the query chain at `i` with constants from
 * `resolve` (test helper): the first variant, or what precedes an unknown
 * trailing piece; null when nothing static precedes it.
 *
 * @param {string} src
 * @param {number} i
 * @param {(name: string) => string | string[] | null} [resolve]
 * @returns {string | null}
 */
function chainSelect(src, i, resolve = () => null) {
  const arg = chainSelectArg(src, i);
  if (!arg?.parts) return null;
  const r = (n) => { const v = resolve(n); return v == null ? null : Array.isArray(v) ? v : [v]; };
  const v = variants(arg.parts, r)[0];
  return v && v.text.trim() ? v.text : null;
}

/**
 * When `name` is a parameter of a function around `pos` (`const base =
 * (select: string) => …`, `function load(db, columns) { … }`, or an arrow
 * with an expression body), that parameter's position and default, and each
 * call to the function in the same file with its arguments and line. Null
 * when `name` isn't such a parameter.
 */
function parameterSite(src, pos, name) {
  const header = /(?:function\s+([A-Za-z_$][\w$]*)\s*\(|(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\()/g;
  let best = null;
  for (const m of src.matchAll(header)) {
    if (m.index > pos) break;
    const open = m.index + m[0].length - 1;
    const close = closeBracket(src, open);
    if (close === -1 || close > pos) continue;
    const params = splitArgs(src.slice(open + 1, close - 1));
    const index = params.findIndex((p) => /^([A-Za-z_$][\w$]*)/.exec(p)?.[1] === name);
    if (index === -1) continue;
    // Body: after the parameters (optionally `: Type`), a block or an arrow's expression.
    let b = close;
    while (b < src.length && src[b] !== '{' && src[b] !== ';' && src.slice(b, b + 2) !== '=>') b++;
    let end;
    if (src.slice(b, b + 2) === '=>') {
      b = skipSpace(src, b + 2);
      end = src[b] === '{' ? closeBracket(src, b) : statementEnd(src, b);
    } else if (src[b] === '{') end = closeBracket(src, b);
    else continue;
    if (end === -1 || end < pos) continue;
    const eq = topLevel(params[index], '=');
    best = { fn: m[1] ?? m[2], index, dflt: eq === -1 ? null : params[index].slice(eq + 1).trim(), headerAt: m.index };
  }
  if (!best) return null;
  const calls = [];
  for (const m of src.matchAll(new RegExp(`(?<![\\w$.])${best.fn.replace(/\$/g, '\\$')}\\s*\\(`, 'g'))) {
    if (m.index === best.headerAt || /(function|const|let)\s*$/.test(src.slice(Math.max(0, m.index - 10), m.index))) continue;
    const open = m.index + m[0].length - 1;
    const close = closeBracket(src, open);
    if (close === -1) continue;
    calls.push({ args: splitArgs(src.slice(open + 1, close - 1)), line: src.slice(0, m.index).split('\n').length });
  }
  return { ...best, calls };
}

/** The argument passed for `name` at each call (test helper; see parameterSite). */
function parameterArguments(src, pos, name) {
  const site = parameterSite(src, pos, name);
  return site ? site.calls.map((c) => ({ arg: c.args[site.index] ?? '', line: c.line })) : null;
}

/** Normalized key for a query the scanner can't fully check (see unchecked-selects.json). */
function uncheckedKey(file, table, text) {
  return `${file}  ${table}  ${text.replace(/\s+/g, ' ').trim().slice(0, 160)}`;
}

/**
 * Every problem across app/, components/ and lib/, as "file:line  message",
 * plus the queries that couldn't be fully checked statically (as stable keys,
 * for the reviewed list in supabase/unchecked-selects.json).
 *
 * The table name and the select list may each be a string, a constant (local
 * or imported), a `+`/`${}` concatenation, a `cond ? a : b` (every branch is
 * checked) or a parameter of the enclosing function, in which case every call
 * in the file is checked with the values it passes (or the default).
 */
export function findQueryColumnProblems(root, schema, fks = {}) {
  const found = new Set();
  const unchecked = new Set();
  const cache = new Map();
  let checked = 0;
  for (const dir of ['app', 'components', 'lib']) {
    for (const file of sourceFiles(join(root, dir))) {
      const src = readFileSync(file, 'utf8');
      const rel = relative(root, file);
      const constants = constantResolver(root, file, cache);
      for (const m of src.matchAll(/\.from\(/g)) {
        // Skip examples in comments (`// … .from(table) …`, ` * …`).
        const lineStart = src.lastIndexOf('\n', m.index) + 1;
        const before = src.slice(lineStart, m.index);
        if (/^\s*(\*|\/\*)/.test(before) || /(^|[^:'"`])\/\//.test(before)) continue;
        const open = m.index + m[0].length - 1;
        const close = closeBracket(src, open);
        if (close === -1) continue;
        const tableText = src.slice(open + 1, close - 1).trim();
        const arg = chainSelectArg(src, close);
        if (!arg) continue; // no select in this chain (storage, plain writes)
        const line = src.slice(0, m.index).split('\n').length;
        const label = /^['"][a-z_0-9]+['"]$/.test(tableText) ? tableText.slice(1, -1) : `from(${tableText})`;
        const tableParts = parseExpr(tableText);
        const notChecked = (extra = '') => unchecked.add(uncheckedKey(rel, label, arg.text + extra));
        if (!tableParts || !arg.parts) { notChecked(); continue; }

        const check = (table, select, at) => {
          checked++;
          for (const p of selectProblems(schema, table, select.replace(/\s+/g, ' '), fks)) found.add(`${rel}:${at}  ${p}`);
        };
        const run = (resolve, at, extra = '') => {
          const tables = variants(tableParts, resolve);
          const selects = variants(arg.parts, resolve);
          let complete = tables.every((t) => t.complete) && selects.every((v) => v.complete);
          for (const t of tables) {
            if (!t.complete) continue;
            for (const v of selects) if (v.text.trim()) check(t.text, v.text, at);
          }
          if (!complete) notChecked(extra);
        };

        // Identifiers no constant explains must be parameters of one enclosing
        // function; each call to it supplies their values.
        const idsOf = (parts) => parts.flatMap((p) => ('id' in p ? [p.id] : 'alt' in p ? p.alt.flatMap(idsOf) : []));
        const ids = [...new Set(idsOf([...tableParts, ...arg.parts]).filter((id) => constants(id) == null))];
        const sites = ids.map((id) => parameterSite(src, m.index, id));
        if (!ids.length || sites.some((x) => !x) || new Set(sites.map((x) => x.headerAt)).size !== 1 || !sites[0].calls.length) {
          run(constants, line);
          continue;
        }
        for (const call of sites[0].calls) {
          const values = {};
          ids.forEach((id, k) => {
            const passed = call.args[sites[k].index] ?? sites[k].dflt ?? null;
            const parts = passed == null ? null : parseExpr(passed);
            const vs = parts ? variants(parts, constants) : null;
            values[id] = vs && vs.every((v) => v.complete) ? vs.map((v) => v.text) : null;
          });
          run((n) => (n in values ? values[n] : constants(n)), call.line, ` ← ${sites[0].fn}(${call.args.join(', ')})`);
        }
      }
    }
  }
  return { problems: [...found].sort(), unchecked: [...unchecked].sort(), checked };
}

export { chainSelect as _chainSelect, parameterArguments as _parameterArguments };
