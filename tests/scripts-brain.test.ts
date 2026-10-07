import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const START = resolve('scripts/brain/session-start.mjs');
const GUARD = resolve('scripts/brain/stop-guard.mjs');

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.email=t@example.test', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...args], { cwd, stdio: 'pipe' });
const hook = (cwd: string, script: string, input: object) =>
  spawnSync('node', [script], { cwd, input: JSON.stringify(input), encoding: 'utf8' });
const commit = (cwd: string, file: string, msg: string) => {
  appendFileSync(join(cwd, file), `${msg}\n`);
  git(cwd, 'commit', '-qam', msg);
};

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'brain-'));
  git(dir, 'init', '-q', '-b', 'main');
  mkdirSync(join(dir, 'docs'));
  writeFileSync(join(dir, 'docs/CLAUDE_MEMORY.md'), '# memory\n');
  writeFileSync(join(dir, 'docs/TODO.md'), '- [ ] open item\n- [x] done item\n');
  writeFileSync(join(dir, 'app.ts'), 'v1\n');
  git(dir, 'add', '-A'); git(dir, 'commit', '-qm', 'base');
  return dir;
}

describe('second brain hooks', () => {
  it('loads the memory file and the open TODO boxes at session start', () => {
    const dir = repo();
    const out = hook(dir, START, { session_id: 'A', source: 'startup' }).stdout;
    expect(out).toContain('# memory');
    expect(out).toContain('- [ ] open item');
    expect(out).not.toContain('done item');
    expect(existsSync(join(dir, '.claude/brain-baselines/A.json'))).toBe(true);
  });

  it('reminds only when this session committed work without a committed memory update', () => {
    const dir = repo();
    hook(dir, START, { session_id: 'A', source: 'startup' });
    expect(hook(dir, GUARD, { session_id: 'A' }).status).toBe(0); // nothing committed yet

    commit(dir, 'app.ts', 'work');
    expect(hook(dir, GUARD, { session_id: 'A' }).status).toBe(2);
    expect(hook(dir, GUARD, { session_id: 'A', stop_hook_active: true }).status).toBe(0); // one reminder only

    appendFileSync(join(dir, 'docs/CLAUDE_MEMORY.md'), 'uncommitted\n');
    expect(hook(dir, GUARD, { session_id: 'A' }).status).toBe(2); // an uncommitted edit doesn't count

    git(dir, 'commit', '-qam', 'memory');
    expect(hook(dir, GUARD, { session_id: 'A' }).status).toBe(0);
  });

  it('keeps each session baseline through compaction and parallel sessions', () => {
    const dir = repo();
    hook(dir, START, { session_id: 'A', source: 'startup' });
    commit(dir, 'app.ts', 'work by A');
    hook(dir, START, { session_id: 'A', source: 'compact' });
    hook(dir, START, { session_id: 'B', source: 'startup' });

    expect(hook(dir, GUARD, { session_id: 'A' }).status).toBe(2);
    expect(hook(dir, GUARD, { session_id: 'B' }).status).toBe(0);
  });

  it('never blocks without a session id or baseline', () => {
    const dir = repo();
    commit(dir, 'app.ts', 'work');
    expect(hook(dir, GUARD, {}).status).toBe(0);
    expect(hook(dir, GUARD, { session_id: 'unknown' }).status).toBe(0);
  });
});
