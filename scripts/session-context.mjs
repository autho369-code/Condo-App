#!/usr/bin/env node
// SessionStart briefing for every Claude Code session on Portier369 (main
// checkout, app worktrees, resumed and compacted sessions). Built from git and
// GitHub, which every session writes to, so it is complete even when a
// session forgot to update its notes. Printed as SessionStart additionalContext.
//
// Registered in ~/.claude/settings.json; safe to run by hand:
//   node scripts/session-context.mjs --text

import { execFileSync } from 'node:child_process';
import { existsSync, statSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const run = (cmd, args, timeout = 8000) => {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

const MEMORY_DIR = join(homedir(), '.claude', 'projects', 'C--Users-autho-Portier369', 'memory');
const MEMORY_FILE = join(MEMORY_DIR, 'finish-program-2026-09.md');
const lines = [];
const out = (s = '') => lines.push(s);

run('git', ['fetch', '--quiet', 'origin', 'main'], 15000);

out('# PORTIER369 LIVE STATE (auto-generated at session start from git + GitHub)');
out('Ground truth beats memory notes. Read MEMORY.md + finish-program-2026-09.md, then reconcile with this.');
out();

const branch = run('git', ['branch', '--show-current']) || '(detached)';
const dirty = run('git', ['status', '--porcelain']).split('\n').filter(Boolean).length;
const behind = run('git', ['rev-list', '--count', `HEAD..origin/main`]);
out(`This checkout: branch ${branch} @ ${run('git', ['rev-parse', '--short', 'HEAD'])}; ${dirty} uncommitted file(s); ${behind || '?'} commit(s) behind origin/main.`);
out(`origin/main: ${run('git', ['log', '-1', '--format=%h %cd %s', '--date=format:%Y-%m-%d %H:%M', 'origin/main'])}`);
out();

// Memory freshness: everything merged after the notes were last written.
let memoryMtime = null;
if (existsSync(MEMORY_FILE)) memoryMtime = statSync(MEMORY_FILE).mtime;
if (memoryMtime) {
  const since = memoryMtime.toISOString();
  const missed = run('git', ['log', 'origin/main', '--first-parent', `--since=${since}`, '--format=%h %cd %s', '--date=format:%m-%d %H:%M']).split('\n').filter(Boolean);
  if (missed.length) {
    out(`## ⚠ MEMORY IS STALE: ${missed.length} commit(s) merged to main after finish-program memory was last updated (${since.slice(0, 16)}Z)`);
    out('Another session did this work without writing notes. Skim these before acting; add a summary to memory once understood.');
    for (const m of missed.slice(0, 60)) out(`- ${m}`);
    if (missed.length > 60) out(`- … ${missed.length - 60} more (git log origin/main --first-parent --since=${since})`);
    out();
  } else {
    out(`Memory notes are current (last updated ${since.slice(0, 16)}Z; nothing merged since).`);
    out();
  }
} else {
  out('## ⚠ No finish-program memory file found — read MEMORY.md and git log before acting.');
  out();
}

out('## Last 15 merges to main');
for (const l of run('git', ['log', 'origin/main', '--first-parent', '-15', '--format=%h %cd %s', '--date=format:%m-%d %H:%M']).split('\n').filter(Boolean)) out(`- ${l}`);
out();

const prs = run('gh', ['pr', 'list', '--state', 'open', '--limit', '20', '--json', 'number,title,headRefName,updatedAt', '--jq', '.[] | "#\\(.number) [\\(.headRefName)] \\(.title) (updated \\(.updatedAt[0:16]))"'], 12000);
out('## Open PRs');
out(prs ? prs.split('\n').map((l) => `- ${l}`).join('\n') : '- none (or gh unavailable)');
out();

// Other sessions' in-flight work: worktrees and their branches.
const worktrees = run('git', ['worktree', 'list', '--porcelain']).split('\n\n').filter(Boolean).map((block) => {
  const path = block.match(/^worktree (.+)$/m)?.[1];
  const wtBranch = block.match(/^branch refs\/heads\/(.+)$/m)?.[1] ?? '(detached)';
  return { path, wtBranch };
}).filter((w) => w.path);
if (worktrees.length > 1) {
  out('## Other checkouts / worktrees (other sessions may be working here)');
  for (const w of worktrees) {
    const ahead = run('git', ['rev-list', '--count', `origin/main..${w.wtBranch}`]);
    out(`- ${w.path} → ${w.wtBranch}${ahead && ahead !== '0' ? ` (${ahead} commit(s) not on main)` : ''}`);
  }
  out();
}

const migDir = 'supabase/migrations';
if (existsSync(migDir)) {
  const latest = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort().slice(-5);
  out('## Newest migration files in the repo (confirm they are applied in prod before relying on them)');
  for (const f of latest) out(`- ${f}`);
  out();
}

out('## Standing rules');
out('- After merges or new work: update finish-program-2026-09.md in memory with PR numbers + what changed (other sessions read it).');
out('- Verify before claiming: npm run typecheck · npx vitest run --exclude ".claude/**" · npm run build · npm run check:queries.');
out('- Mirsad merges PRs himself; after he merges, diff branch vs main and land leftovers in one follow-up PR.');

const text = lines.join('\n').slice(0, 9500);
if (process.argv.includes('--text')) {
  process.stdout.write(text + '\n');
} else {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } }));
}
