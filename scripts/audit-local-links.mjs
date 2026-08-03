import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const appDir = join(root, 'app');
const sourceDirs = ['app', 'components', 'lib'].map((dir) => join(root, dir)).filter(existsSync);
const ignoredPrefixes = ['/api/', '/portal/pay/success', '/portal/pay/cancel'];

function walk(dir, predicate = () => true) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      files.push(...walk(path, predicate));
    } else if (predicate(path)) {
      files.push(path);
    }
  }
  return files;
}

function routeFromPage(path) {
  let route = relative(appDir, path).split(sep).join('/');
  route = route.replace(/\/page\.tsx$/, '');
  route = route.replace(/(^|\/)\([^/]+\)/g, '');
  route = route.replace(/\[([^\]]+)\]/g, ':$1');
  route = '/' + route.replace(/^\/+/, '');
  return route === '/' ? '/' : route.replace(/\/$/, '');
}

// Route handlers (route.ts) and static assets under public/ resolve too.
const routePatterns = [
  ...walk(appDir, (path) => path.endsWith('page.tsx')).map(routeFromPage),
  ...walk(appDir, (path) => path.endsWith(`${sep}route.ts`)).map((path) =>
    routeFromPage(path.replace(/route\.ts$/, 'page.tsx'))),
];
const publicDir = join(root, 'public');
const publicFiles = new Set(
  existsSync(publicDir)
    ? walk(publicDir).map((path) => '/' + relative(publicDir, path).split(sep).join('/'))
    : [],
);
function splitSqlList(source) {
  const values = [];
  let current = '';
  let quoted = false;
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (char === "'" && quoted && next === "'") {
      current += "''";
      index += 1;
      continue;
    }
    if (char === "'") quoted = !quoted;
    if (!quoted && ['(', '[', '{'].includes(char)) depth += 1;
    if (!quoted && [')', ']', '}'].includes(char)) depth -= 1;
    if (char === ',' && !quoted && depth === 0) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) values.push(current.trim());
  return values;
}

function sqlString(value) {
  const match = value.trim().match(/^'((?:[^']|'')*)'(?:\s*::[\w.\[\]]+)?$/s);
  return match ? match[1].replace(/''/g, "'") : null;
}

function sqlLike(value, pattern) {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${escaped}$`, 'i').test(value ?? '');
}

function applyReportSql(sql, reportCatalog) {
  const statementRegex = /(insert\s+into\s+(?:"?public"?\.)?"?report_definitions"?\s*\([\s\S]*?;|update\s+(?:"?public"?\.)?"?report_definitions"?\s+set\s+active\s*=\s*false\s+where[\s\S]*?;)/gi;
  let statementMatch;
  while ((statementMatch = statementRegex.exec(sql))) {
    const statement = statementMatch[1];
    const insert = statement.match(/^insert\s+into\s+(?:"?public"?\.)?"?report_definitions"?\s*\(([^)]+)\)\s*values\s*([\s\S]*);$/i);
    if (insert) {
      const columns = splitSqlList(insert[1]).map((column) => column.replace(/"/g, '').trim().toLowerCase());
      const slugIndex = columns.indexOf('slug');
      const portfolioIndex = columns.indexOf('portfolio_id');
      const nameIndex = columns.indexOf('name');
      const descriptionIndex = columns.indexOf('description');
      const activeIndex = columns.indexOf('active');
      if (slugIndex < 0) continue;
      const tupleRegex = /\(([^;]*?)\)(?=\s*,|\s*$)/gs;
      let tupleMatch;
      while ((tupleMatch = tupleRegex.exec(insert[2]))) {
        const values = splitSqlList(tupleMatch[1]);
        if (values.length !== columns.length) continue;
        if (portfolioIndex >= 0 && values[portfolioIndex].trim().toLowerCase() !== 'null') continue;
        const slug = sqlString(values[slugIndex]);
        if (!slug) continue;
        reportCatalog.set(slug, {
          active: activeIndex < 0 || values[activeIndex].trim().toLowerCase() !== 'false',
          description: descriptionIndex < 0 ? '' : (sqlString(values[descriptionIndex]) ?? ''),
          name: nameIndex < 0 ? '' : (sqlString(values[nameIndex]) ?? ''),
          slug,
        });
      }
      continue;
    }

    const condition = statement.match(/\bwhere\b([\s\S]*);$/i)?.[1] ?? '';
    const likeRules = [...condition.matchAll(/\b(slug|name|description)\s+ilike\s+'([^']+)'/gi)]
      .map((match) => ({ field: match[1].toLowerCase(), pattern: match[2] }));
    const equalSlugs = new Set([...condition.matchAll(/\bslug\s*=\s*'([^']+)'/gi)].map((match) => match[1]));
    const inSlugs = new Set();
    for (const match of condition.matchAll(/\bslug\s+in\s*\(([^)]+)\)/gi)) {
      splitSqlList(match[1]).map(sqlString).filter(Boolean).forEach((slug) => inSlugs.add(slug));
    }
    for (const report of reportCatalog.values()) {
      const deactivated = equalSlugs.has(report.slug)
        || inSlugs.has(report.slug)
        || likeRules.some((rule) => sqlLike(report[rule.field], rule.pattern));
      if (deactivated) report.active = false;
    }
  }
}

const reportMigrationDirs = [
  join(root, 'supabase', 'fetched-production-migrations'),
  join(root, 'supabase', 'migrations'),
].filter(existsSync);
const reportCatalog = new Map();
for (const file of reportMigrationDirs.flatMap((dir) => walk(dir, (path) => path.endsWith('.sql')).sort())) {
  applyReportSql(readFileSync(file, 'utf8'), reportCatalog);
}
const seededReportSlugs = new Set(
  [...reportCatalog.values()].filter((report) => report.active).map((report) => report.slug),
);
const staticReportRoutes = new Set(routePatterns.filter((route) => route.startsWith('/reports/') && !route.includes(':')));

function unresolvedReportSlug(href) {
  const path = href.split('?')[0].split('#')[0].replace(/\/$/, '') || '/';
  const match = path.match(/^\/reports\/([a-z0-9_-]+)$/);
  if (!match || staticReportRoutes.has(path)) return null;
  return seededReportSlugs.has(match[1]) ? null : match[1];
}

function matchesRoute(href) {
  const path = href.split('?')[0].split('#')[0].replace(/\/$/, '') || '/';
  if (ignoredPrefixes.some((prefix) => path.startsWith(prefix))) return true;
  if (publicFiles.has(path)) return true;
  return routePatterns.some((pattern) => {
    const escaped = pattern
      .split('/')
      .map((part) => (part.startsWith(':') ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      .join('/');
    return new RegExp(`^${escaped}$`).test(path);
  });
}

const hrefRegex = /href=(?:\{`([^`]+)`\}|"([^"]+)"|'([^']+)')/g;
const missing = [];
const missingReportSlugs = [];
const placeholders = [];

for (const file of sourceDirs.flatMap((dir) => walk(dir, (path) => /\.(tsx|ts)$/.test(path)))) {
  const text = readFileSync(file, 'utf8');
  let match;
  while ((match = hrefRegex.exec(text))) {
    const raw = match[1] ?? match[2] ?? match[3];
    if (raw.startsWith('#')) {
      const anchor = raw.slice(1);
      const escapedAnchor = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (!anchor || !new RegExp(`id=["']${escapedAnchor}["']`).test(text)) {
        placeholders.push({ file, href: raw });
      }
      continue;
    }
    if (!raw.startsWith('/')) continue;
    if (raw.includes('${')) continue;
    const missingReportSlug = unresolvedReportSlug(raw);
    if (missingReportSlug) missingReportSlugs.push({ file, href: raw, slug: missingReportSlug });
    if (!matchesRoute(raw)) missing.push({ file, href: raw });
  }
}

const lines = [
  '# Placeholder and Route Audit',
  '',
  'Generated by `npm run check:routes`.',
  '',
  '## Placeholder Links',
  '',
  ...(
    placeholders.length
      ? placeholders.map((item) => `- \`${relative(root, item.file).split(sep).join('/')}\` -> \`${item.href}\``)
      : ['- None found.']
  ),
  '',
  '## Missing Local Routes',
  '',
  ...(
    missing.length
      ? missing.map((item) => `- \`${relative(root, item.file).split(sep).join('/')}\` -> \`${item.href}\``)
      : ['- None found.']
  ),
  '',
  '## Missing Seeded Report Slugs',
  '',
  ...(
    missingReportSlugs.length
      ? missingReportSlugs.map((item) => `- \`${relative(root, item.file).split(sep).join('/')}\` -> \`${item.href}\` (missing \`${item.slug}\`)`)
      : ['- None found.']
  ),
  '',
];

writeFileSync(join(root, 'docs', 'placeholder-inventory.md'), lines.join('\n'));

if (missing.length || missingReportSlugs.length) {
  console.error(`Found ${missing.length} local links and ${missingReportSlugs.length} report links without matching routes. See docs/placeholder-inventory.md.`);
  process.exit(1);
}

console.log(`Route audit complete. ${placeholders.length} placeholders documented in docs/placeholder-inventory.md.`);
