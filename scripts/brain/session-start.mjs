#!/usr/bin/env node
// Second brain, part 1: runs automatically at the start of every Claude
// session (SessionStart hook in .claude/settings.json). Prints the memory
// file plus live facts read from git and docs, so no session starts blank and
// nothing depends on Claude remembering to look.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';

const sh = (cmd) => {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
};
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

sh('git fetch -q origin main');

// Baseline for the Stop guard: HEAD when this session began, one file per
// session id under .claude/brain-baselines/ (kept out of git by the .claude/*
// ignore rule) so parallel sessions in one checkout don't overwrite each
// other. Written once: SessionStart also fires on resume/clear/compact.
let hookInput = {};
if (!process.stdin.isTTY) {
  try { hookInput = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch {}
}
try {
  const id = String(hookInput.session_id ?? '').replace(/[^A-Za-z0-9_-]/g, '');
  const file = `.claude/brain-baselines/${id}.json`;
  if (id && !existsSync(file)) {
    mkdirSync('.claude/brain-baselines', { recursive: true });
    writeFileSync(file, JSON.stringify({ head: sh('git rev-parse HEAD') }));
  }
} catch {}

const out = [];
out.push('=== PORTIER369 SECOND BRAIN (docs/brain/, an Obsidian vault) — loaded automatically. Follow it. ===');
out.push('Run the overseer agent at the start of every task and before every PR. Record what shipped, new rules and the next gap in docs/brain/ and commit it with the work (a Stop hook reminds you).');
const VAULT = 'docs/brain';
const notes = existsSync(VAULT)
  ? readdirSync(VAULT).filter((f) => f.endsWith('.md')).sort((a, b) => (a === 'Home.md' ? -1 : b === 'Home.md' ? 1 : a.localeCompare(b)))
  : [];
if (!notes.length) out.push('', '(docs/brain/ is missing — recreate the vault.)');
for (const note of notes) out.push('', `----- docs/brain/${note} -----`, read(`${VAULT}/${note}`).trim());

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
