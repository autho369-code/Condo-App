// Which files does this branch change compared with main? Used by the review
// agents in .claude/agents/ so they review the branch's own work only.
//
// A file is in scope when the branch side changed it since the branch left
// main (committed, staged, unstaged or untracked) AND what would be committed
// or is on disk still differs from main's tip, comparing both content and
// file mode. So:
//  - work main already has (merged, squash-merged, cherry-picked) drops out;
//  - files only main changed after the branch point never appear;
//  - files the branch deleted are kept (status D) unless main deleted them too;
//  - a staged change stays in scope even if the working tree undid it, and a
//    mode-only change (e.g. chmod +x) counts as a change.
import { execFileSync } from 'node:child_process';
import { lstatSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';

const git = (cwd, args, input) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });

const nulList = (text) => text.split('\0').filter(Boolean);

/** "<mode> <sha>" of a path in a commit, or null when it isn't there. */
function treeEntry(cwd, ref, path) {
  const line = git(cwd, ['ls-tree', '-z', ref, '--', path]).split('\0')[0];
  if (!line) return null;
  const [meta] = line.split('\t');
  const [mode, , sha] = meta.split(' ');
  return `${mode} ${sha}`;
}

/** "<mode> <sha>" of a path in the index (what would be committed), or null. */
function indexEntry(cwd, path) {
  const line = git(cwd, ['ls-files', '-s', '-z', '--', path]).split('\0')[0];
  if (!line) return null;
  const [meta] = line.split('\t');
  const [mode, sha] = meta.split(' ');
  return `${mode} ${sha}`;
}

/** Whether git tracks the executable bit here (off on Windows checkouts). */
function tracksFileMode(cwd) {
  try {
    return git(cwd, ['config', '--bool', 'core.fileMode']).trim() !== 'false';
  } catch {
    return true; // unset: git's default is true
  }
}

/**
 * "<mode> <sha>" of a path on disk, as git would store it, or null. Where git
 * ignores the executable bit, the mode is taken from `fallbackMode` (the
 * index's) like git itself does.
 */
function diskEntry(cwd, path, fileMode, fallbackMode) {
  let st;
  try {
    st = lstatSync(join(cwd, path));
  } catch {
    return null;
  }
  if (st.isSymbolicLink()) {
    return `120000 ${git(cwd, ['hash-object', '--stdin'], readlinkSync(join(cwd, path))).trim()}`;
  }
  if (!st.isFile()) return null;
  const mode = fileMode ? (st.mode & 0o111 ? '100755' : '100644') : fallbackMode ?? '100644';
  return `${mode} ${git(cwd, ['hash-object', '--', path]).trim()}`;
}

/** origin/main when it exists, else the local main. */
export function defaultTarget(cwd) {
  try {
    git(cwd, ['rev-parse', '--verify', '-q', 'origin/main^{commit}']);
    return 'origin/main';
  } catch {
    return 'main';
  }
}

/**
 * @param {string} cwd repository root
 * @param {{ target?: string, paths?: string[] }} [opts]
 * @returns {{ status: 'A'|'M'|'D', path: string }[]}
 */
export function reviewScope(cwd, { target = defaultTarget(cwd), paths = [] } = {}) {
  const base = git(cwd, ['merge-base', 'HEAD', target]).trim();
  const candidates = new Set([
    // working tree against the branch point (includes staged and unstaged)
    ...nulList(git(cwd, ['diff', '--name-only', '--no-renames', '-z', base, '--', ...paths])),
    // the index against the branch point: staged changes the working tree undid
    ...nulList(git(cwd, ['diff', '--cached', '--name-only', '--no-renames', '-z', base, '--', ...paths])),
    ...nulList(git(cwd, ['ls-files', '--others', '--exclude-standard', '-z', '--', ...paths])),
  ]);

  const fileMode = tracksFileMode(cwd);
  const scope = [];
  for (const path of candidates) {
    const onTarget = treeEntry(cwd, target, path);
    const staged = indexEntry(cwd, path);
    const onDisk = diskEntry(cwd, path, fileMode, (staged ?? onTarget)?.split(' ')[0]);
    // An untracked file that didn't exist when the branch left main has no
    // index entry to compare. One the branch deleted and then recreated does:
    // the next commit still deletes it, so its index absence counts.
    const newUntracked = staged === null && onDisk !== null && treeEntry(cwd, base, path) === null;
    const indexMatches = newUntracked || staged === onTarget;
    // Out of scope only if both what is on disk and what would be committed
    // match main exactly (same content, same mode, or absent on all sides).
    if (onDisk === onTarget && indexMatches) continue;
    // D only when main still has the file the next commit removes; with main
    // lacking it too, whatever is on disk is new relative to main.
    const status = onTarget === null ? 'A'
      : staged === null && !newUntracked ? 'D'
      : 'M';
    scope.push({ status, path });
  }
  return scope.sort((a, b) => a.path.localeCompare(b.path));
}
