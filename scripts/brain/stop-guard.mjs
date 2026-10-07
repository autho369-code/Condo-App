#!/usr/bin/env node
// Second brain, part 2: Stop hook (runs whenever Claude finishes a reply).
// Steps in only when THIS session has committed work since it started (the
// baseline written by session-start.mjs) and docs/CLAUDE_MEMORY.md is still
// unchanged since then. Ordinary replies and uncommitted work in progress are
// never interrupted. Exits 0 (allow) on any doubt and after one reminder, so
// it can never trap a session in a loop.
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

let input = {};
try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch {}
if (input.stop_hook_active) process.exit(0);

const BASELINE = '.claude/brain-baseline.json';
const MEMORY = 'docs/CLAUDE_MEMORY.md';
if (!existsSync(BASELINE)) process.exit(0);

let baseline;
try { baseline = JSON.parse(readFileSync(BASELINE, 'utf8')); } catch { process.exit(0); }
if (!baseline?.head) process.exit(0);

let newCommits;
try {
  newCommits = Number(execSync(`git rev-list --count ${baseline.head}..HEAD`, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  }).trim());
} catch { process.exit(0); }
if (!newCommits) process.exit(0);

const memory = existsSync(MEMORY) ? readFileSync(MEMORY, 'utf8') : '';
const hash = createHash('sha256').update(memory).digest('hex');
if (hash !== baseline.memoryHash) process.exit(0);

process.stderr.write(
  `Second brain: this session made ${newCommits} commit(s) but ${MEMORY} is unchanged since the session started. ` +
  'Record what shipped, any new rule from Mirsad, and the next gap in it, and commit it with the work.\n',
);
process.exit(2);
