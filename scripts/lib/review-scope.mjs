// Which files does this branch change compared with main? Used by the review
// agents in .claude/agents/ so they review the branch's own work only.
//
// A file is in scope when the branch side changed it since the branch left
// main (committed, staged, unstaged or untracked) AND its current content
// still differs from main's tip. So:
//  - work main already has (merged, squash-merged, cherry-picked) drops out;
//  - files only main changed after the branch point never appear;
//  - files the branch deleted are kept (status D) unless main deleted them too.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const git = (cwd, args, opts = {}) =>
  execFileSync('git', args, { cwd, encoding: opts.encoding ?? 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });

function blobAt(cwd, ref, path) {
  try {
    return git(cwd, ['show', `${ref}:${path}`], { encoding: 'buffer' });
  } catch {
    return null; // not in that commit
  }
}

/**
 * @param {string} cwd repository root
 * @param {{ target?: string, paths?: string[] }} [opts]
 * @returns {{ status: 'A'|'M'|'D', path: string }[]}
 */
export function reviewScope(cwd, { target = 'origin/main', paths = [] } = {}) {
  const base = git(cwd, ['merge-base', 'HEAD', target]).trim();
  const changed = new Map();
  // Working tree (incl. staged/unstaged) against the branch point; renames
  // are split into a delete and an add so both sides are judged.
  const out = git(cwd, ['diff', '--name-status', '--no-renames', '-z', base, '--', ...paths]).split('\0').filter(Boolean);
  for (let i = 0; i < out.length; i += 2) changed.set(out[i + 1], out[i][0]);
  for (const p of git(cwd, ['ls-files', '--others', '--exclude-standard', '-z', '--', ...paths]).split('\0').filter(Boolean)) {
    changed.set(p, 'A');
  }

  const scope = [];
  for (const [path, raw] of changed) {
    const onDisk = existsSync(join(cwd, path)) ? readFileSync(join(cwd, path)) : null;
    const onTarget = blobAt(cwd, target, path);
    if (onDisk === null && onTarget === null) continue; // deleted on both sides
    if (onDisk !== null && onTarget !== null && onDisk.equals(onTarget)) continue; // main already has it
    const status = onDisk === null ? 'D' : onTarget === null ? 'A' : raw === 'D' ? 'A' : 'M';
    scope.push({ status, path });
  }
  return scope.sort((a, b) => a.path.localeCompare(b.path));
}
