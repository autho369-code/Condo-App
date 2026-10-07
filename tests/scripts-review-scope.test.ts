import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { reviewScope } from '../scripts/lib/review-scope.mjs';

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.email=t@example.test', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...args], { cwd, stdio: 'pipe' });
const write = (cwd: string, path: string, text: string) => {
  mkdirSync(join(cwd, path, '..'), { recursive: true });
  writeFileSync(join(cwd, path), text);
};

describe('review scope', () => {
  it("lists only the branch's own changes against main's tip", () => {
    const dir = mkdtempSync(join(tmpdir(), 'scope-'));
    git(dir, 'init', '-q', '-b', 'main');
    for (const f of ['keep.ts', 'mine.ts', 'theirs.ts', 'gone.ts', 'both-gone.ts', 'merged.ts']) write(dir, f, `${f} v1\n`);
    write(dir, 'supabase/migrations/001_old.sql', 'select 1;\n');
    git(dir, 'add', '-A'); git(dir, 'commit', '-qm', 'base');

    git(dir, 'checkout', '-qb', 'topic');
    write(dir, 'mine.ts', 'mine.ts v2\n');
    write(dir, 'merged.ts', 'merged.ts v2\n');
    write(dir, 'supabase/migrations/002_new.sql', 'select 2;\n');
    git(dir, 'rm', '-q', 'gone.ts', 'both-gone.ts');
    git(dir, 'add', '-A'); git(dir, 'commit', '-qm', 'topic work');

    // main moves on: changes a file the branch never touched, squash-merges
    // one of the branch's changes, and deletes a file the branch deleted too.
    git(dir, 'checkout', '-q', 'main');
    write(dir, 'theirs.ts', 'theirs.ts v2\n');
    write(dir, 'merged.ts', 'merged.ts v2\n');
    git(dir, 'rm', '-q', 'both-gone.ts');
    git(dir, 'add', '-A'); git(dir, 'commit', '-qm', 'main work');
    git(dir, 'checkout', '-q', 'topic');

    // Uncommitted work counts too.
    write(dir, 'keep.ts', 'keep.ts edited\n');
    write(dir, 'untracked.ts', 'new\n');

    try {
      expect(reviewScope(dir, { target: 'main' })).toEqual([
        { status: 'D', path: 'gone.ts' },
        { status: 'M', path: 'keep.ts' },
        { status: 'M', path: 'mine.ts' },
        { status: 'A', path: 'supabase/migrations/002_new.sql' },
        { status: 'A', path: 'untracked.ts' },
      ]);
      expect(reviewScope(dir, { target: 'main', paths: ['supabase/migrations'] })).toEqual([
        { status: 'A', path: 'supabase/migrations/002_new.sql' },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps staged changes the working tree undid, and mode-only changes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scope-'));
    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'config', 'core.fileMode', 'true');
    write(dir, 'staged.ts', 'v1\n');
    write(dir, 'run.sh', 'echo hi\n');
    write(dir, 'guard.ts', 'guard v1\n');
    git(dir, 'add', '-A'); git(dir, 'commit', '-qm', 'base');
    git(dir, 'checkout', '-qb', 'topic');
    git(dir, 'rm', '-q', 'guard.ts'); git(dir, 'commit', '-qm', 'drop guard');
    write(dir, 'guard.ts', 'guard v1\n'); // recreated, untracked, same bytes as main

    write(dir, 'staged.ts', 'v2\n');
    git(dir, 'add', 'staged.ts');
    write(dir, 'staged.ts', 'v1\n'); // undone on disk only; v2 is still staged
    chmodSync(join(dir, 'run.sh'), 0o755);

    try {
      // No origin remote: falls back to the local main branch.
      expect(reviewScope(dir)).toEqual([
        { status: 'D', path: 'guard.ts' },
        { status: 'M', path: 'run.sh' },
        { status: 'M', path: 'staged.ts' },
      ]);
      // Where git ignores the executable bit (Windows), a chmod is not a change.
      git(dir, 'config', 'core.fileMode', 'false');
      expect(reviewScope(dir)).toEqual([
        { status: 'D', path: 'guard.ts' },
        { status: 'M', path: 'staged.ts' },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
