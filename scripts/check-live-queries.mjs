#!/usr/bin/env node
// Sends every static `.from('table').select('...')` in the app to PostgREST
// with limit=0 using the public anon key. RLS hides every row from anon, but
// schema problems — unknown columns, missing or ambiguous relationships,
// missing tables — still come back as errors, so anything other than a
// permission error is a query that is broken in production.
//
// Usage: npm run check:queries   (reads NEXT_PUBLIC_SUPABASE_* from .env.local)

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const env = Object.fromEntries(
  readFileSync(join(ROOT, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]),
);
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL || !KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.');
  process.exit(2);
}

const SKIP = ['node_modules', '.next', `${sep}mobile${sep}`, `${sep}tests${sep}`, `${sep}scripts${sep}`];
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (SKIP.some((s) => p.includes(s.replaceAll('/', sep)) || name === s)) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.|database\.ts$/.test(name)) out.push(p);
  }
  return out;
}

const queries = new Map();
for (const dir of ['app', 'components', 'lib']) {
  for (const file of walk(join(ROOT, dir))) {
    const src = readFileSync(file, 'utf8');
    const re = /\.from\(\s*['"]([a-z_0-9]+)['"]\s*\)\s*\.select\(\s*(['"`])([\s\S]*?)\2/g;
    for (const m of src.matchAll(re)) {
      if (m[3].includes('${')) continue;
      const key = `${m[1]}|${m[3].replace(/\s+/g, '')}`;
      const line = src.slice(0, m.index).split('\n').length;
      if (!queries.has(key)) queries.set(key, []);
      queries.get(key).push(`${relative(ROOT, file)}:${line}`);
    }
  }
}

const broken = [];
const entries = [...queries.entries()];
async function probe([key, wheres]) {
  const [table, select] = key.split('|');
  const res = await fetch(`${URL}/rest/v1/${table}?${new URLSearchParams({ select, limit: '0' })}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (res.ok || res.status === 401) return;
  const body = await res.json().catch(() => ({}));
  if (body.code === '42501') return; // permission denied: expected for anon
  broken.push({ wheres, table, select, status: res.status, code: body.code, message: body.message });
}
for (let i = 0; i < entries.length; i += 8) await Promise.all(entries.slice(i, i + 8).map(probe));

for (const b of broken) {
  console.log(`${b.wheres[0]}${b.wheres.length > 1 ? ` (+${b.wheres.length - 1} more)` : ''}\n  ${b.table}: ${b.status} ${b.code} ${b.message}\n  select=${b.select.slice(0, 200)}`);
}
console.log(`\n${broken.length} broken of ${queries.size} distinct static queries`);
process.exit(broken.length ? 1 : 0);
