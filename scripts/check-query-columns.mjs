#!/usr/bin/env node
// npm run check:columns — every static select against supabase/schema-columns.json
// (and schema-foreign-keys.json for foreign-key-column embeds).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findQueryColumnProblems } from './lib/query-columns.mjs';

const root = process.cwd();
const schema = JSON.parse(readFileSync(join(root, 'supabase/schema-columns.json'), 'utf8'));
const fks = JSON.parse(readFileSync(join(root, 'supabase/schema-foreign-keys.json'), 'utf8'));
const { problems, checked } = findQueryColumnProblems(root, schema, fks);
for (const p of problems) console.log(p);
console.log(`\n${problems.length} problem(s) in ${checked} static selects`);
process.exit(problems.length ? 1 : 0);
