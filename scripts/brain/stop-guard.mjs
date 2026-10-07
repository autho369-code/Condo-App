#!/usr/bin/env node
// Second brain, part 2: Stop hook. If this session changed the project but
// did not update docs/CLAUDE_MEMORY.md, block the stop and tell Claude to
// record what happened. Exits 0 (allow) on any doubt so it can never trap a
// session in a loop.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let input = {};
try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch {}
if (input.stop_hook_active) process.exit(0); // already reminded once

const sh = (cmd) => {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
};

const MEMORY = 'docs/CLAUDE_MEMORY.md';
const committed = sh('git diff --name-only origin/main...HEAD');
const working = sh('git status --porcelain');
if (committed === null || working === null) process.exit(0);

const changed = new Set([
  ...committed.split('\n'),
  ...working.split('\n').map((l) => l.slice(3)),
].map((f) => f.trim()).filter(Boolean));

if (changed.size === 0 || changed.has(MEMORY)) process.exit(0);

process.stderr.write(
  `Second brain: this session changed ${changed.size} file(s) but ${MEMORY} was not updated. ` +
  'Record what shipped, any new rule from Mirsad, and the next gap in it, commit it with the work, then stop.\n',
);
process.exit(2);
