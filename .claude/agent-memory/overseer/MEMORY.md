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
- A trigger that rewrites a column by `current_user` (e.g. user_invitations
  token, 20261007040000): list every writer. SECURITY DEFINER functions run as
  owner (trigger skips them); INVOKER ones and API inserts must read the value
  back via RETURNING / `.select()`, never return a local variable. Checked
  clean for invite_* / provision_portfolio / app inserts (2026-10-07).
- A gap the PR closes belongs under "Open PR", not still as Next gaps #1
  ("In PR: ..."); the next session would pick it up again.
- After a new push to an open PR, check the Codex summary's commit column
  equals the head SHA; if not, "@codex review" must be posted again (#239:
  Codex had only reviewed 71dcf09, head was baef97e).
- A stacked second part makes the PR *title* stale too, not only the body.
- When a PR adds validation/DB checks for a column, grep every writer of it
  (incl. platform-operator actions, service client) and compare: #239
  validated support_email in Branding + Company Admin but not in
  platform-operator `updateCompanyDetails`.
- After a merge, check main has every commit pushed before the merge — #239 merged before its third commit; cherry-pick the rest into a follow-up PR. After applying a migration, read the definition back from production.
- When a page guard is widened with a read-only branch (e.g. /settings/ai,
  2026-10-07), grep every inbound link + API `hint` text for admin-only wording
  ("Set up AI in Settings → AI") still shown to non-admins, and check the save
  form uses `PendingSubmit` (+ `confirm` if it can remove access/keys).
- The vault's Open PR line goes stale like the PR body: written in the first
  commit, then a reviewer-fix commit widens scope (finance RPC scope PR,
  2026-10-07: vault said "12 RPCs", final migration patches 16). Count the
  final diff against the vault line.
- Start-of-task: check the open PR's real state via REST
  (`gh api repos/autho369-code/Condo-App/pulls/<n> --jq .merged`) before
  accepting "open, not merged". #244 was planned as still open but had merged
  (squash f0da498, 2026-10-07 21:01Z); plan was to edit its migration. A merged
  migration file is never edited; new work gets a new migration + new PR. Squash
  merges: compare trees with `git diff --stat <head> origin/main` (empty = all in).
- When Next gaps is rewritten, diff the old gap text item by item against the
  final code: the sweep PR (2026-10-07) dropped `update_record_note`
  (portfolio-only check) from the gap list without fixing it. Also count the
  vault's "N fixed" against the diff (vault said 35 saves, diff has 30 checks).
- "Only error handling changed" on `app/**` pages still triggers
  design-reviewer: the error lands in an ad-hoc red div, not `<Alert>`
  (letters/templates edit, portal/profile).
