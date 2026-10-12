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
  new string literals in redirects.
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
- Importer credits / tie-out / opening-balance pre-PR checks: see [finance-import-checks](finance-import-checks.md).

## Third audit (2026-10-10)
- Wrong finding: "no page edits an association's address/state". The profile's
  settings sections (`lib/associations/settings-fields.ts` 'general': address,
  city, state, zip) render through AssociationSettingsSection. Before calling a
  field uneditable, grep the field key in `lib/associations/settings-fields.ts`
  and other generic settings renderers, not only `lib/rpcs/*`.
- RLS rewrites that swap a helper for new my_*() functions (rls-hoist,
  2026-10-10): the old helper (can_access_portfolio) is granted to anon in
  the baseline; new helpers revoke anon. Check pg_policies with roles
  {public}/{anon} that now call a revoked function, and that the
  equivalence test includes an anon caller. Also CLAUDE.md rule 6 names the
  policy helpers - update it when the preferred form changes.
- DROP POLICY is DROP SQL (start check 2026-10-12, signed-in-only policies):
  a migration that removes a policy outright goes to Mirsad. Neutralise with
  `alter policy ... to authenticated using (false)` + TODO the drop, or hand
  him the SQL. drop-then-create of the same policy has precedent (20261010010000).
- Empty build queue (2026-10-12): the 1,000-row cap sweep is thorough (pages,
  app/api crons, lib all use fetchAllRows/limit). Don't re-propose it. Status
  "left per-row: small tables" predates the "judge RLS at scale" rule; those
  tables (budget_lines, meetings, signatures, bank_transfers) are still unmeasured.
- Vault staleness (recurring 7x: Status header/Open PR after merge, Next gaps "In PR"): see [vault-staleness](vault-staleness.md) - check first.
- Reviewer memory still naming holes the same PR fixed (5x): see [reviewer-memory-staleness](reviewer-memory-staleness.md).
