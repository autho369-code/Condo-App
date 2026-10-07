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
