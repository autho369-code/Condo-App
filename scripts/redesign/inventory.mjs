// Redesign inventory: every capability the six role areas expose, read from the
// code (not from screenshots). Used twice:
//   1. `node scripts/redesign/inventory.mjs --write-baseline` once, before the
//      redesign, saves docs/redesign/baseline-inventory.json and the human
//      matrices (FUNCTION_PRESERVATION_MATRIX.csv, ROLE_ACCESS_MATRIX.md).
//   2. tests/redesign/parity.test.ts rebuilds the inventory from the working
//      tree and fails when a baseline capability is gone (see check()).
//
// A route's capabilities are collected over its page and everything it imports
// (relative and '@/' imports, transitively), so moving a form or link into a
// shared component keeps it counted. Layout capabilities (navigation) are
// collected per role area from its layout's import closure plus the navigation
// definitions in lib/navigation.

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, sep, resolve } from 'node:path';

const root = process.cwd();
const appDir = join(root, 'app');

export const ROLE_AREAS = [
  { role: 'manager', dir: 'app/(app)', layoutGuard: 'requireAuth + workspace role routing (app/(app)/layout.tsx)' },
  { role: 'company_admin', dir: 'app/company-admin', layoutGuard: 'requirePortfolioAdmin' },
  { role: 'operator', dir: 'app/platform-operator', layoutGuard: 'requirePlatformOperator' },
  { role: 'owner', dir: 'app/portal', layoutGuard: 'requireOwner' },
  { role: 'board', dir: 'app/board', layoutGuard: 'requireBoard' },
  { role: 'vendor', dir: 'app/vendor', layoutGuard: 'requireVendor' },
  // Not one of the six roles, but it shares the shell: kept so nothing it has is lost.
  { role: 'resident', dir: 'app/resident', layoutGuard: 'requireTenant' },
];

const toPosix = (p) => p.split(sep).join('/');

function walk(dir, predicate) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.next') out.push(...walk(p, predicate)); }
    else if (predicate(p)) out.push(p);
  }
  return out;
}

export function routeFromPage(path) {
  let route = toPosix(relative(appDir, path)).replace(/\/?page\.tsx$/, '');
  route = route.replace(/(^|\/)\([^/]+\)/g, '').replace(/\[([^\]]+)\]/g, ':$1');
  route = '/' + route.replace(/^\/+/, '');
  return route === '/' ? '/' : route.replace(/\/$/, '');
}

const fileCache = new Map();
const read = (p) => { if (!fileCache.has(p)) fileCache.set(p, readFileSync(p, 'utf8')); return fileCache.get(p); };

function resolveImport(fromFile, spec) {
  let base;
  if (spec.startsWith('@/')) base = join(root, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
  else return null;
  for (const c of [base, `${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')]) {
    if (existsSync(c) && /\.(tsx?|mjs)$/.test(c)) return c;
  }
  return null;
}

// Files the closure never enters: they are data/auth plumbing, not UI, and
// would make every route "contain" the whole app.
const STOP = [/[\\/]lib[\\/]supabase[\\/]/, /[\\/]lib[\\/]auth[\\/]/, /[\\/]lib[\\/]types[\\/]/, /[\\/]node_modules[\\/]/];

export function importClosure(entry) {
  const seen = new Set();
  const stack = [entry];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    const src = read(f);
    for (const m of src.matchAll(/(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const r = resolveImport(f, m[1] ?? m[2]);
      if (r && !STOP.some((s) => s.test(r)) && !seen.has(r)) stack.push(r);
    }
  }
  return [...seen];
}

const uniq = (a) => [...new Set(a)].sort();

/** Capabilities in one source file. */
export function extract(src) {
  const caps = { link: [], action: [], field: [], button: [], data: [], guard: [], confirm: [] };
  // Links: href="/x", href={'/x'}, href={`/x/${id}`} (template keeps its static shape), router.push('/x'), redirect('/x').
  for (const m of src.matchAll(/href=(?:"([^"]+)"|\{\s*'([^']+)'\s*\}|\{\s*`([^`]+)`\s*\})/g)) caps.link.push(norm(m[1] ?? m[2] ?? m[3]));
  for (const m of src.matchAll(/\bhref:\s*(?:'([^']+)'|`([^`]+)`)/g)) caps.link.push(norm(m[1] ?? m[2]));
  for (const m of src.matchAll(/(?:router\.push|redirect)\(\s*(?:'([^']+)'|`([^`]+)`)/g)) caps.link.push(norm(m[1] ?? m[2]));
  // Form handlers: action={x} / formAction={x} / action={x.bind(...)} / onSubmit={x}.
  for (const m of src.matchAll(/\b(?:action|formAction)=\{\s*([A-Za-z_$][\w$]*)/g)) caps.action.push(m[1]);
  // Server actions exported from 'use server' files, and inline 'use server' functions.
  if (/^\s*['"]use server['"]/m.test(src)) for (const m of src.matchAll(/export\s+async\s+function\s+([A-Za-z_$][\w$]*)/g)) caps.action.push(m[1]);
  for (const m of src.matchAll(/async\s+function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::[^{]+)?\{\s*['"]use server['"]/g)) caps.action.push(m[1]);
  // Submitted field names.
  for (const m of src.matchAll(/\bname=(?:"([^"]+)"|\{\s*'([^']+)'\s*\})/g)) caps.field.push(m[1] ?? m[2]);
  // Button / submit labels (static text only).
  for (const m of src.matchAll(/<(Button|PendingSubmit|button)\b[^>]*>\s*(?:<[^>]+\/>\s*)?([^<{}]{2,60}?)\s*</g)) caps.button.push(m[2].replace(/\s+/g, ' ').trim());
  for (const m of src.matchAll(/confirm=(?:"([^"]+)"|\{`([^`]+)`\})/g)) caps.confirm.push((m[1] ?? m[2]).slice(0, 80));
  // Data sources.
  for (const m of src.matchAll(/\.from\(\s*['"]([\w.]+)['"]\s*\)/g)) caps.data.push(`table:${m[1]}`);
  for (const m of src.matchAll(/\.rpc\(\s*['"]([\w.]+)['"]/g)) caps.data.push(`rpc:${m[1]}`);
  for (const m of src.matchAll(/fetch\(\s*['"`](\/api\/[^'"`?$]+)/g)) caps.data.push(`api:${m[1]}`);
  // Authorization guards.
  for (const m of src.matchAll(/\b(require[A-Z]\w*|hasPortfolioAdminAccess|managesAssociation|checkLinkedRecords)\(/g)) caps.guard.push(m[1]);
  for (const k of Object.keys(caps)) caps[k] = uniq(caps[k].filter(Boolean));
  return caps;
}

// `/owners/${owner.id}?tab=x` -> `/owners/:param?tab=x`
function norm(href) {
  return href.replace(/\$\{[^}]*\}/g, ':param').trim();
}

function merge(list) {
  const out = { link: [], action: [], field: [], button: [], data: [], guard: [], confirm: [] };
  for (const c of list) for (const k of Object.keys(out)) out[k].push(...c[k]);
  for (const k of Object.keys(out)) out[k] = uniq(out[k]);
  return out;
}

/** Navigation definitions: { role, source, label, href, group }. */
export function navigation() {
  const items = [];
  const parse = (file, role, arrayName) => {
    const src = read(join(root, file));
    const start = arrayName ? src.indexOf(`export const ${arrayName}`) : 0;
    if (start < 0) return;
    let body = src.slice(start);
    if (arrayName) { const end = body.indexOf('\n];'); body = body.slice(0, end > 0 ? end : undefined); }
    let group = null;
    for (const m of body.matchAll(/(?:group:\s*'([^']+)')|(?:label:\s*'((?:[^'\\]|\\.)+)',\s*href:\s*'([^']+)')/g)) {
      if (m[1]) { group = m[1]; continue; }
      items.push({ role, source: arrayName ? `${file}#${arrayName}` : file, label: m[2].replace(/\\'/g, "'"), href: m[3], group });
    }
  };
  parse('lib/navigation/modules.ts', 'manager', 'appModules');
  for (const [name, role] of [['boardModules', 'board'], ['ownerModules', 'owner'], ['residentModules', 'resident'], ['companyAdminModules', 'company_admin'], ['platformOperatorModules', 'operator'], ['vendorModules', 'vendor']]) {
    parse('lib/navigation/role-modules.ts', role, name);
  }
  parse('lib/navigation/action-center.ts', 'manager:action-center', null);
  const seen = new Set();
  return items.filter((i) => { const k = `${i.role}|${i.label}|${i.href}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

export function buildInventory() {
  const routes = [];
  for (const area of ROLE_AREAS) {
    const pages = walk(join(root, area.dir), (p) => p.endsWith(`${sep}page.tsx`));
    for (const page of pages) {
      const closure = importClosure(page);
      const own = extract(read(page));
      const caps = merge(closure.map((f) => extract(read(f))));
      routes.push({
        role: area.role,
        route: routeFromPage(page),
        file: toPosix(relative(root, page)),
        pageGuards: own.guard,
        caps,
      });
    }
  }
  routes.sort((a, b) => (a.role + a.route).localeCompare(b.role + b.route));
  return { generatedFrom: 'code', routes, navigation: navigation() };
}

/** Rows of the function-preservation matrix: one per route capability, stable IDs. */
export function matrixRows(inv) {
  const rows = [];
  const label = { link: 'Link / navigation', action: 'Form or server action', field: 'Submitted field', button: 'Button', confirm: 'Confirmation', data: 'Data source' };
  for (const r of inv.routes) {
    rows.push({ id: `${r.role}|${r.route}|page`, role: r.role, route: r.route, type: 'Screen', item: r.file, guard: r.pageGuards.join(' ') });
    for (const t of Object.keys(label)) for (const v of r.caps[t]) {
      rows.push({ id: `${r.role}|${r.route}|${t}|${v}`, role: r.role, route: r.route, type: label[t], item: v, guard: r.pageGuards.join(' ') });
    }
  }
  for (const n of inv.navigation) rows.push({ id: `nav|${n.role}|${n.href}|${n.label}`, role: n.role, route: n.href, type: 'Navigation entry', item: `${n.group ? n.group + ' > ' : ''}${n.label}`, guard: n.source });
  return rows;
}

/**
 * Compares a fresh inventory with the baseline. Returns the baseline
 * capabilities that are gone. Links, actions, fields, data sources, guards,
 * pages and navigation entries must all remain; button and confirmation
 * labels may be reworded, so they are reported separately as `reworded`.
 */
export function check(baseline, current) {
  const missing = [];
  const reworded = [];
  const cur = new Map(current.routes.map((r) => [`${r.role}|${r.route}`, r]));
  for (const b of baseline.routes) {
    const c = cur.get(`${b.role}|${b.route}`);
    if (!c) { missing.push(`${b.role} ${b.route}: page is gone`); continue; }
    for (const t of ['link', 'action', 'field', 'data', 'guard']) {
      for (const v of b.caps[t]) if (!c.caps[t].includes(v)) missing.push(`${b.role} ${b.route}: ${t} "${v}" is gone`);
    }
    for (const g of b.pageGuards) if (!c.pageGuards.includes(g) && !c.caps.guard.includes(g)) missing.push(`${b.role} ${b.route}: page guard ${g} is gone`);
    for (const t of ['button', 'confirm']) for (const v of b.caps[t]) if (!c.caps[t].includes(v)) reworded.push(`${b.role} ${b.route}: ${t} "${v}"`);
  }
  const navNow = new Set(current.navigation.map((n) => `${n.role}|${n.href}`));
  for (const n of baseline.navigation) if (!navNow.has(`${n.role}|${n.href}`)) missing.push(`navigation ${n.role}: "${n.label}" -> ${n.href} is gone`);
  return { missing, reworded };
}

function csv(rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const cols = ['id', 'role', 'route', 'type', 'item', 'guard', 'redesigned_location', 'verification'];
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c] ?? (c === 'redesigned_location' ? 'unchanged route' : c === 'verification' ? 'static parity: pending' : ''))).join(','))].join('\n') + '\n';
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(root, 'scripts/redesign/inventory.mjs')) {
  const inv = buildInventory();
  const outDir = join(root, 'docs/redesign');
  mkdirSync(outDir, { recursive: true });
  if (process.argv.includes('--write-baseline')) {
    writeFileSync(join(outDir, 'baseline-inventory.json'), JSON.stringify(inv, null, 1) + '\n');
    writeFileSync(join(outDir, 'FUNCTION_PRESERVATION_MATRIX.csv'), csv(matrixRows(inv)));
  }
  const rows = matrixRows(inv);
  const byRole = {};
  for (const r of inv.routes) byRole[r.role] = (byRole[r.role] ?? 0) + 1;
  console.log(`routes: ${inv.routes.length} ${JSON.stringify(byRole)}; navigation entries: ${inv.navigation.length}; matrix rows: ${rows.length}`);
  if (existsSync(join(outDir, 'baseline-inventory.json')) && !process.argv.includes('--write-baseline')) {
    const { missing, reworded } = check(JSON.parse(readFileSync(join(outDir, 'baseline-inventory.json'), 'utf8')), inv);
    console.log(`missing: ${missing.length}; reworded labels: ${reworded.length}`);
    for (const m of missing.slice(0, 50)) console.log('  MISSING', m);
  }
}
