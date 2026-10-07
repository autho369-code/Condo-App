#!/usr/bin/env node
// npm run check:columns — every static select against supabase/schema-columns.json.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findQueryColumnProblems } from './lib/query-columns.mjs';

const root = process.cwd();
const schema = JSON.parse(readFileSync(join(root, 'supabase/schema-columns.json'), 'utf8'));
const { problems, checked } = findQueryColumnProblems(root, schema);
for (const p of problems) console.log(p);
console.log(`\n${problems.length} problem(s) in ${checked} static selects`);
process.exit(problems.length ? 1 : 0);
