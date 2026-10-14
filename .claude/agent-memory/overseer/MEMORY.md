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
  Again 2026-10-13 (payables-followups): "purchase-order generated bills"
  dropped from the gap silently (they go through create_payable_bill, so
  covered - but the vault must say so).
- "Only error handling changed" on `app/**` pages still triggers
  design-reviewer: the error lands in an ad-hoc red div, not `<Alert>`
  (letters/templates edit, portal/profile).
- Public pages (`app/(public)/*`, `lib/server/public-paths.ts`) use the
  service client: check every read is filtered by the host's tenant
  (`tenantFromHeaders().portfolioId`). /report-violation listed every
  company's associations to anyone (found 2026-10-07).
- A rule found in review that applies to future work (e.g. "public pages filter
  every service-client read by the host's tenant", 2026-10-07) belongs in
  docs/brain/Product Rules.md too, not only in reviewer/overseer memory.
- Vault edits made after `git add` stay unstaged (2026-10-08 report-link PR:
  Shipped.md unstaged, Status.md MM). Before commit check `git status` shows
  no ` M docs/brain/*`; run `git add docs/brain` last.
- A new shared component (components/ui/* or components/workspace/*) must be
  listed in docs/DESIGN_SYSTEM.md (3rd miss: NoCompanyNotice 2026-10-11) and
  use Card, not a hand-copied card div. Grep for a pre-existing guard before
  adding one (automation-flows got a duplicate check).
- A "recipient's company" / white-label fix that swaps `me.portfolio` for a
  lookup adds new `.select()`s and embeds (2026-10-08: occupancies ->
  associations(portfolio_id), owners.portfolio_id, portfolios.support_email):
  schema-checker is required even when the caller only ran security +
  white-label. Run `npm test` (static select check) and confirm the FK in
  schema-foreign-keys.json for each embed.
- Pre-PR on staged work: compare `git diff --cached --stat` with `git status`;
  a vault note edited but not staged (Shipped.md, 2026-10-08 after #253) is
  left out of the commit. Also check the Open PR entry of the PR that just
  merged was moved out of Open PR, and "pushed after #N merges" wording.
- "No user text changed" is often wrong: new redirect `?error=` strings in
  actions are user-facing (white-label-checker scope). Check the diff for
  new string literals in redirects. Again 2026-10-13 (reconcile statement
  balance: 3 error redirects + success Alert + hint, only security+design ran).
  Also SQL `raise exception '...'` text in RPCs reaches users via ?error=
  (collections-codex-fixes 2026-10-13: new "income account ... inactive").
  4th: codex-379-380-followups 2026-10-14 (3 new raise texts + portal
  amenities empty/confirm text; also db.rpc(..).select() needs schema-checker,
  npm test's static check does not cover rpc selects).
- Hardening added after a reviewer's pass (security pin added to a definer RPC
  after migration-reviewer's "clean"): ask whether migration-reviewer saw the
  FINAL file; its memory note should mention the change.
- Status said "Claude applies once Codex is clean" — PR Rules say apply the
  additive migration as soon as the SQL is settled and put "do not merge
  until the migration is live" in the PR body. Check the wording.
- Multi-record login PRs: diff the migration-reviewer's "still first-record
  only" follow-up list against Status Next gaps; part 2 vault listed only
  home/account, dropped owner_open_emergencies, form_submissions_owner_insert,
  form_templates_owner_read, suspended-company check.
- Gap lists copied from a reviewer's follow-up list can be stale: owner
  leftovers (2026-10-09, after #267) listed owner_open_emergencies (already
  on current_resident_* since 20261004170000, rewritten over
  current_owner_ids() in 20261009050000), form_* owner policies (already
  altered in 20261009050000; form_submissions has no owner/association
  column) and the suspended check (current_owner_ids() is limited to the
  profile's company, so the profile branch covers every record). Check each
  premise against the latest migration + live pg_get_functiondef before
  planning a migration; record "verified, no change" in Status/Decisions.
- Recurring 3rd time (owner leftovers pre-PR, 2026-10-09): caller restated
  the migration rule as "apply after Codex is clean". PR Rules: apply as soon
  as the SQL is settled (reviewers clean), read back, then open the PR with
  "do not merge until live". Also check Status "Where things stand" gets the
  just-merged PR, not only Open PR.
- Multi-round Codex PRs (#383, 5 rounds, 2026-10-14): PR body, Shipped.md,
  Product Rules and reviewer memories all described round 1 only; no
  "missed:" lines; security memory still called the method/reversed_at hole
  "low" after 130000/160000 fixed it; round-N raise texts + page Alert got no
  white-label pass. Pre-merge: diff each artifact against the LAST round.
- Importer credits / tie-out / opening-balance pre-PR checks: see [finance-import-checks](finance-import-checks.md).

## Topic files
- Vault staleness (recurring 8x: Status header/Open PR after merge, Next gaps "In PR", stale gap premise, missing DROP TODO for USING-false policies, guessed PR number; policies: check pg_policy live not migration files): see [vault-staleness](vault-staleness.md) - check first.
- Reviewer memory still naming holes the same PR fixed (7x; 2026-10-13 twice): see [reviewer-memory-staleness](reviewer-memory-staleness.md).
- Audit/feature checks 2026-10-10..13 (settings fields, anon helpers, DROP POLICY, deep-audit roles, owner portal, email suppression, SMS routing, renamed migrations): see [audit-and-feature-checks](audit-and-feature-checks.md) - read before any start/pre-PR check in those areas.
- Reused branch names: `gh pr list --head <branch> --state all` (claude/payables-followups was #360, MERGED; 2026-10-13 reuse OK: remote deleted, based on main). Also `git log origin/main..HEAD` for unpushed vault commits that ride in the new PR.
