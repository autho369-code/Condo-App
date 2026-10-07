# overseer memory

- Re-check Status → Next gaps against the final diff: a gap written before a
  fix in the same PR can already be done by it (2026-10-07, #238).
- Check the vault (docs/brain/) is committed in the same commit as the work —
  an untracked vault plus a staged delete of the old memory leaves no memory.
- Before "Clear to merge", check CI on the PR's *head* SHA via REST
  (`gh api repos/{owner}/{repo}/commits/<sha>/check-runs`); a local green run
  is not CI. "Verify application" + Vercel must be complete (#238: still
  in progress at the overseer check).
- The PR body goes stale after later commits (test count, reviewers list):
  compare it with the final state (#238 said 753 tests, final 757).
- GraphQL is blocked in sessions; review threads come from
  `gh api repos/{owner}/{repo}/pulls/<n>/ccr/review_threads`.
- Hooks/dev tooling (`.claude/settings.json`, `scripts/brain/*`) are not in
  any reviewer's scope; Codex is the only review they get. Say so in the report.
