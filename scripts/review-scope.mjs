#!/usr/bin/env node
// Prints the files this branch changes compared with main, one per line as
// "A|M|D<TAB>path". Optional arguments limit it to paths, e.g.
//   node scripts/review-scope.mjs supabase/migrations
// Fetches origin/main first so "main" means the current tip.
import { execFileSync } from 'node:child_process';
import { reviewScope } from './lib/review-scope.mjs';

const cwd = process.cwd();
try {
  execFileSync('git', ['fetch', '-q', 'origin', 'main'], { cwd, stdio: 'ignore' });
} catch {
  console.error('warning: could not fetch origin/main; using the local copy');
}
for (const { status, path } of reviewScope(cwd, { paths: process.argv.slice(2) })) {
  console.log(`${status}\t${path}`);
}
