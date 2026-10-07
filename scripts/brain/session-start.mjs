#!/usr/bin/env node
// Second brain, part 1: runs automatically at the start of every Claude
// session (SessionStart hook in .claude/settings.json). Prints the memory
// file plus live facts read from git and docs, so no session starts blank and
// nothing depends on Claude remembering to look.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const sh = (cmd) => {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
};
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

sh('git fetch -q origin main');

// Baseline for the Stop guard: what HEAD and the memory file looked like when
// this session began (kept out of git by the .claude/* ignore rule).
try {
  mkdirSync('.claude', { recursive: true });
  writeFileSync('.claude/brain-baseline.json', JSON.stringify({
    head: sh('git rev-parse HEAD'),
    memoryHash: createHash('sha256').update(read('docs/CLAUDE_MEMORY.md')).digest('hex'),
  }));
} catch {}
const out = [];
out.push('=== PORTIER369 SECOND BRAIN — loaded automatically. Follow it. ===');
out.push('Update docs/CLAUDE_MEMORY.md and commit it with the work before the session ends (a Stop hook enforces this).');
out.push('');
out.push(read('docs/CLAUDE_MEMORY.md') || '(docs/CLAUDE_MEMORY.md is missing — recreate it.)');

out.push('', '=== Latest work merged to main (live from git) ===');
out.push(sh('git log origin/main -15 --format="%h %cs %s"') || '(could not read git log)');

const branch = sh('git rev-parse --abbrev-ref HEAD');
const ahead = sh('git log origin/main..HEAD --format="%h %s"');
out.push('', `=== This checkout: branch ${branch || '?'} ===`);
out.push(ahead ? `Commits not on main yet:\n${ahead}` : 'No commits beyond main.');
const dirty = sh('git status --short');
if (dirty) out.push(`Uncommitted changes:\n${dirty}`);

const todo = read('docs/TODO.md').split('\n').filter((l) => /^\s*- \[ \]/.test(l));
out.push('', `=== Open boxes in docs/TODO.md (${todo.length}) ===`);
out.push(todo.map((l) => l.trim()).join('\n') || '(none)');

process.stdout.write(out.join('\n') + '\n');
