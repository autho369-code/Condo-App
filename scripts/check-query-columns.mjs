#!/usr/bin/env node
// npm run check:columns — every static select against supabase/schema-columns.json
// (and schema-foreign-keys.json for foreign-key-column embeds).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findQueryColumnProblems } from './lib/query-columns.mjs';

const root = process.cwd();
const schema = JSON.parse(readFileSync(join(root, 'supabase/schema-columns.json'), 'utf8'));
const fks = JSON.parse(readFileSync(join(root, 'supabase/schema-foreign-keys.json'), 'utf8'));
const listed = new Set(JSON.parse(readFileSync(join(root, 'supabase/unchecked-selects.json'), 'utf8')));
const { problems, unchecked, checked } = findQueryColumnProblems(root, schema, fks);
for (const p of problems) console.log(p);
const unlisted = unchecked.filter((u) => !listed.has(u));
const stale = [...listed].filter((u) => !unchecked.includes(u));
for (const u of unlisted) console.log(`can't check statically (rewrite it, or add it to supabase/unchecked-selects.json): ${u}`);
for (const u of stale) console.log(`no longer in the code (remove it from supabase/unchecked-selects.json): ${u}`);
console.log(`\n${problems.length} problem(s) in ${checked} checked selects; ${unchecked.length} listed as not statically checkable`);
process.exit(problems.length || unlisted.length || stale.length ? 1 : 0);
