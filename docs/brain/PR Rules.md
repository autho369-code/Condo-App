# PR rules

Back to [[Home]].

- **Open PRs, never merge — Mirsad merges** (unless he says "merge it" for
  that PR).
- Before opening: the overseer and matching reviewers ([[Agents]]) have run and
  their findings are fixed.
- After opening: subscribe to PR activity, comment "@codex review", set a
  ~50-min `send_later` check-in. Drive it: CI green, Codex clean, every thread
  answered and resolved, "@codex review" again after each fix. Then post
  "✅ **Clear to merge.**" on the PR and tell him. Delete the check-in after.
- After a merge: `git fetch origin main`, then
  `git checkout -B <branch> origin/main && git push --force-with-lease`. If a
  PR merged before your last push, cherry-pick the missed commit into a
  follow-up PR. Apply any additive migration from it, then **verify it in
  production** (read the constraint/function definition back). Write
  non-ASCII characters in SQL as `chr(n)` — they can be lost when applied
  through the MCP.
- **When merged code needs a new column or function, get the migration live
  before the PR can be merged.** Mirsad can merge any time once CI is green
  (#261 was merged mid-review, before its migrations ran). So: apply the
  additive migration (and hand Mirsad any DELETE-containing SQL to paste)
  as soon as the SQL is settled, and say in the PR body "do not merge until
  the migration is live" until it is.

## Auto-merge (Mirsad, 2026-10-14)
Mirsad: "you have my permission to auto merge, keep on working until to do
is done". After a PR is open, its migration live, reviewers clean, Codex
clean on the head commit, CI green on the head SHA and every thread
resolved, Claude enables auto-merge with the app's PR tool (never
`gh pr merge`) and moves on to the next TODO / Next gap without waiting.
Anything in TODO that needs Mirsad's accounts, keys, DNS, legal sign-off or
a business decision stays his.
How (learned 2026-10-14): GitHub auto-merge only queues while checks are
pending and this repo has no required checks, so `set_auto_merge` is
refused ("clean"/"unstable status"). Once Codex is clean, CI is green on
the head SHA and threads are resolved, Claude squash-merges with
`gh pr merge <n> --squash` (Mirsad: "I told you to automerge").
