// Checks every static `.from('table').select('...')` in the app against the
// column snapshot in supabase/schema-columns.json. A query that names a column
// the database doesn't have fails at runtime (PostgREST 400), often only on the
// page or email that uses it (past bugs: bills, budgets,
// bank_accounts.balance, portfolios.name). Used by tests/database and
// `npm run check:columns`.
//
// Files are read with the TypeScript parser. Coverage: the table and select
// list written at the query (a string, a constant — local or imported — a
// `+`/`${}` concatenation or a `? :` conditional, every branch checked), or
// passed in as a parameter of a function in the same file, in which case each
// call's argument is checked. Every select that still can't be checked
// statically (columns chosen at run time, `cols.join(', ')`) must be
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
import { dirname, join, relative } from 'node:path';
import ts from 'typescript';

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

// ── Reading the code ─────────────────────────────────────────────────────
// Files are parsed with the TypeScript compiler, so comments, strings,
// template literals and regular expressions are exactly what the language
// says they are; queries, functions, calls and constants come from the
// syntax tree rather than from pattern matching.

const parsed = new Map();
/** The parsed source file at `path` (cached), or null when it doesn't exist. */
function parse(path) {
  if (!parsed.has(path)) {
    let sf = null;
    try {
      const text = readFileSync(path, 'utf8');
      sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    } catch { /* missing */ }
    parsed.set(path, sf);
  }
  return parsed.get(path);
}

/** Visit every node of `sf`. */
function walk(node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

/** Strip wrappers that don't change a value: parentheses, `as`, `!`, `satisfies`. */
function unwrap(node) {
  while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node)
    || ts.isTypeAssertionExpression(node) || (ts.isSatisfiesExpression && ts.isSatisfiesExpression(node)))) node = node.expression;
  return node;
}

/**
 * A string expression as parts: { text }, { id } for an identifier, and
 * { alt: [parts, parts] } for `cond ? a : b` (both branches are checked).
 * Literals, identifiers, `+`, template `${…}` holes and conditionals are
 * understood; anything else (calls, property access, `.join()`) gives null.
 */
function partsOf(node) {
  node = unwrap(node);
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [{ text: node.text }];
  if (ts.isIdentifier(node)) return [{ id: node.text }];
  if (ts.isTemplateExpression(node)) {
    const parts = [{ text: node.head.text }];
    for (const span of node.templateSpans) {
      const hole = partsOf(span.expression);
      if (!hole) return null;
      parts.push(...hole, { text: span.literal.text });
    }
    return parts;
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const a = partsOf(node.left);
    const b = partsOf(node.right);
    return a && b ? [...a, ...b] : null;
  }
  if (ts.isConditionalExpression(node)) {
    const a = partsOf(node.whenTrue);
    const b = partsOf(node.whenFalse);
    return a && b ? [{ alt: [a, b] }] : null;
  }
  return null;
}

/**
 * Every value `parts` can take: { text, complete }. An unresolved identifier
 * stops a variant (complete: false, text = what came before it). `resolve`
 * returns a name's possible values or null. Capped at 32 variants.
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
        else next.push({ text: a.text + o.text, complete: o.complete });
      }
    }
    acc = next.slice(0, 32);
  }
  return acc;
}

/** Resolve a module specifier from `file` to a path (`@/…` is the repo root). */
function resolveImport(root, file, spec) {
  const base = spec.startsWith('@/') ? join(root, spec.slice(2)) : spec.startsWith('.') ? join(dirname(file), spec) : null;
  if (!base) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    try { if (statSync(candidate).isFile()) return candidate; } catch { /* next */ }
  }
  return null;
}

/**
 * Resolves string constants by name for one file: a top-level or local
 * `const X = …` whose value is a string expression, or a named import of an
 * exported constant from another app file. Returns the possible values, or
 * null.
 */
function constantResolver(root, file) {
  const tables = new Map();
  const load = (path) => {
    if (!tables.has(path)) {
      const consts = new Map();
      const imports = new Map();
      const sf = parse(path);
      if (sf) {
        walk(sf, (n) => {
          if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer
            && n.parent && (n.parent.flags & ts.NodeFlags.Const)) {
            const parts = partsOf(n.initializer);
            if (parts && !consts.has(n.name.text)) consts.set(n.name.text, parts);
          }
          if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && n.importClause?.namedBindings
            && ts.isNamedImports(n.importClause.namedBindings)) {
            const target = resolveImport(root, path, n.moduleSpecifier.text);
            if (target) for (const el of n.importClause.namedBindings.elements) {
              imports.set(el.name.text, { path: target, name: (el.propertyName ?? el.name).text });
            }
          }
        });
      }
      tables.set(path, { consts, imports });
    }
    return tables.get(path);
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

/** The callee name of a call: `foo(…)` → foo, `x.foo(…)` → foo. */
function calleeName(call) {
  const e = call.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  return null;
}

/**
 * The `.select(…)` call in the builder chain that starts at the `.from(…)`
 * call `fromCall`: walks outwards through `.eq()`, `.insert()`, … calls to
 * the first `.select(`. Returns its first argument node, or null when the
 * chain has no select.
 */
function chainSelect(fromCall) {
  let node = fromCall;
  for (let i = 0; i < 40; i++) {
    const access = node.parent;
    if (!access || !ts.isPropertyAccessExpression(access) || access.expression !== node) return null;
    const call = access.parent;
    if (!call || !ts.isCallExpression(call) || call.expression !== access) return null;
    if (access.name.text === 'select') return call.arguments[0] ?? null;
    node = call;
  }
  return null;
}

/** Functions are where parameters live. */
function isFunction(n) {
  return ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);
}

/** The name a function is called by: `function f`, `const f = (…) =>`, a method. */
function functionName(fn) {
  if ((ts.isFunctionDeclaration(fn) || ts.isMethodDeclaration(fn)) && fn.name && ts.isIdentifier(fn.name)) return fn.name.text;
  const p = fn.parent;
  if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
  return null;
}

/**
 * When `name` is a parameter of a function around `node`, that function's
 * name, the parameter's position and default, and every call to it in the
 * file (arguments as nodes, with the call's line). Null otherwise.
 */
function parameterSite(sf, node, name) {
  for (let n = node.parent; n; n = n.parent) {
    if (!isFunction(n)) continue;
    const index = n.parameters.findIndex((p) => ts.isIdentifier(p.name) && p.name.text === name);
    if (index === -1) continue;
    const fn = functionName(n);
    if (!fn) return null;
    const calls = [];
    walk(sf, (c) => {
      if (ts.isCallExpression(c) && calleeName(c) === fn && ts.isIdentifier(c.expression)) {
        calls.push({ args: c.arguments, line: sf.getLineAndCharacterOfPosition(c.getStart(sf)).line + 1, text: c.getText(sf) });
      }
    });
    return { fn, index, dflt: n.parameters[index].initializer ?? null, calls, at: n.pos };
  }
  return null;
}

/** Normalized key for a query the scanner can't fully check (see unchecked-selects.json). */
function uncheckedKey(file, table, text) {
  return `${file}  ${table}  ${text.replace(/\s+/g, ' ').trim().slice(0, 160)}`;
}

/** Identifiers used in parts (including inside conditional branches). */
function idsOf(parts) {
  return parts.flatMap((p) => ('id' in p ? [p.id] : 'alt' in p ? p.alt.flatMap(idsOf) : []));
}

/**
 * Check one source file: every `.from(table)…select(columns)` query. The
 * table and the column list may each be a string, a constant (local or
 * imported), a `+`/`${}` concatenation, a conditional (every branch is
 * checked) or a parameter of the enclosing function, in which case every
 * call in the file is checked with the values it passes (or the default).
 */
function checkFile(root, file, schema, fks, out) {
  const sf = parse(file);
  if (!sf) return;
  const rel = relative(root, file);
  const constants = constantResolver(root, file);
  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  walk(sf, (call) => {
    if (!ts.isCallExpression(call) || !ts.isPropertyAccessExpression(call.expression) || call.expression.name.text !== 'from') return;
    const tableNode = call.arguments[0];
    const selectNode = chainSelect(call);
    if (!tableNode || !selectNode) return; // not a query with a select (storage, plain writes)
    const tableText = tableNode.getText(sf);
    const selectText = selectNode.getText(sf);
    const label = ts.isStringLiteral(tableNode) ? tableNode.text : `from(${tableText})`;
    const notChecked = (extra = '') => out.unchecked.add(uncheckedKey(rel, label, selectText + extra));
    const tableParts = partsOf(tableNode);
    const selectParts = partsOf(selectNode);
    if (!tableParts || !selectParts) { notChecked(); return; }

    const run = (resolve, line, extra = '') => {
      const tables = variants(tableParts, resolve);
      const selects = variants(selectParts, resolve);
      for (const t of tables) {
        if (!t.complete) continue;
        for (const v of selects) {
          if (!v.text.trim()) continue;
          out.checked++;
          for (const p of selectProblems(schema, t.text, v.text.replace(/\s+/g, ' '), fks)) out.found.add(`${rel}:${line}  ${p}`);
        }
      }
      if (!(tables.every((t) => t.complete) && selects.every((v) => v.complete))) notChecked(extra);
    };

    // Identifiers no constant explains must be parameters of one enclosing
    // function; each call to it supplies their values.
    const ids = [...new Set(idsOf([...tableParts, ...selectParts]).filter((id) => constants(id) == null))];
    const sites = ids.map((id) => parameterSite(sf, call, id));
    if (!ids.length || sites.some((x) => !x) || new Set(sites.map((x) => x.at)).size !== 1 || !sites[0].calls.length) {
      run(constants, lineOf(call));
      return;
    }
    for (const c of sites[0].calls) {
      const values = {};
      ids.forEach((id, k) => {
        const passed = c.args[sites[k].index] ?? sites[k].dflt;
        const parts = passed ? partsOf(passed) : null;
        const vs = parts ? variants(parts, constants) : null;
        values[id] = vs && vs.every((v) => v.complete) ? vs.map((v) => v.text) : null;
      });
      run((n) => (n in values ? values[n] : constants(n)), c.line, ` ← ${c.text.replace(/\s+/g, ' ').slice(0, 120)}`);
    }
  });
}

/**
 * Every problem across app/, components/ and lib/, as "file:line  message",
 * plus the queries that couldn't be fully checked statically (as stable keys,
 * for the reviewed list in supabase/unchecked-selects.json).
 */
export function findQueryColumnProblems(root, schema, fks = {}) {
  parsed.clear();
  const out = { found: new Set(), unchecked: new Set(), checked: 0 };
  for (const dir of ['app', 'components', 'lib']) {
    for (const file of sourceFiles(join(root, dir))) checkFile(root, file, schema, fks, out);
  }
  return { problems: [...out.found].sort(), unchecked: [...out.unchecked].sort(), checked: out.checked };
}

// ── Test helpers ─────────────────────────────────────────────────────────

/** Parse a snippet as a file (test helper). */
function snippet(src) {
  return ts.createSourceFile('snippet.ts', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

/** The first `.from()` call in a parsed file (on `table`, when given). */
function firstFrom(sf, table) {
  let found = null;
  walk(sf, (n) => {
    if (!found && ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'from'
      && (table == null || (n.arguments[0] && ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text === table))) found = n;
  });
  return found;
}

/**
 * The checkable select list of the first query in `src` (test helper): the
 * first variant, or what precedes an unknown trailing piece; null when it
 * isn't a string expression or nothing static precedes the unknown piece.
 *
 * @param {string} src
 * @param {(name: string) => string | string[] | null} [resolve]
 * @returns {string | null}
 */
function firstSelect(src, resolve = () => null) {
  const call = firstFrom(snippet(src));
  const arg = call && chainSelect(call);
  const parts = arg && partsOf(arg);
  if (!parts) return null;
  const v = variants(parts, (n) => { const r = resolve(n); return r == null ? null : Array.isArray(r) ? r : [r]; })[0];
  return v && v.text.trim() ? v.text : null;
}

/** The argument text passed for `name` at each call of the function around the query on `table` (test helper). */
function parameterArguments(src, table, name) {
  const sf = snippet(src);
  const call = firstFrom(sf, table);
  const site = call && parameterSite(sf, call, name);
  return site ? site.calls.map((c) => ({ arg: c.args[site.index]?.getText(sf) ?? '', line: c.line })) : null;
}

export { firstSelect as _firstSelect, parameterArguments as _parameterArguments };
