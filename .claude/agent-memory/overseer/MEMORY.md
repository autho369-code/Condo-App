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
- Recurring (2nd time, #245 after #244): the caller planned with the PR as
  "open, not merged" but it had merged (e25b1d1d). Always check REST first and
  remind: apply + read back the PR's migration (20261007100000) before new work.
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
- A new shared component (components/ui/*) should be listed in
  docs/DESIGN_SYSTEM.md so later work reuses it (CopyButton, 2026-10-08).
- Recurring (accept-invitation PR, 2026-10-08): vault Open PR line written in
  the first commit, a later commit (expired/other-account states, rate limit,
  plain errors) not added. Also: a deliberate exception to a Decisions rule
  (accept-invitation allowed on the platform address, unlike /sign,
  /vendor-upload) must be written into Decisions, not only a code comment.
- A "recipient's company" / white-label fix that swaps `me.portfolio` for a
  lookup adds new `.select()`s and embeds (2026-10-08: occupancies ->
  associations(portfolio_id), owners.portfolio_id, portfolios.support_email):
  schema-checker is required even when the caller only ran security +
  white-label. Run `npm test` (static select check) and confirm the FK in
  schema-foreign-keys.json for each embed.
- When a PR fixes a gap a reviewer had recorded, check that reviewer's memory
  line is updated to "fixed in <migration/PR>", not left saying the hole is
  open (2026-10-08 property-group PR: security-reviewer memory still said "no
  DB trigger backs it" while 20261008030000 adds it).
- Pre-PR on staged work: compare `git diff --cached --stat` with `git status`;
  a vault note edited but not staged (Shipped.md, 2026-10-08 after #253) is
  left out of the commit. Also check the Open PR entry of the PR that just
  merged was moved out of Open PR, and "pushed after #N merges" wording.
- Recurring (vendor-login PR, 2026-10-09): the vault edit moved the gap to
  "In PR" in Next gaps but left the Status header ("no open PR") and the
  duplicate "Next gaps: (1) ..." bullet inside Open PR stale. grep
  `Next gaps` and the header line on every Status edit. Also ask whether the
  RLS rewrite was timed per role in a rolled-back tx (Product Rules: Speed).
- Recurring 3rd time (owner-login part 1, 2026-10-09): stale "Next gaps: (1)
  ..." bullet inside Status → Open PR (line ~83) still listed the gap now In
  PR. Grep `Next gaps` on every Status edit. Also 2nd time: reviewer memory
  still records holes the same PR fixed (security-reviewer: no owner
  invite_scope, link_portal_user email linking) — must say "fixed in <mig>".
- "No user text changed" is often wrong: new redirect `?error=` strings in
  actions are user-facing (white-label-checker scope). Check the diff for
  new string literals in redirects.
- Status said "Claude applies once Codex is clean" — PR Rules say apply the
  additive migration as soon as the SQL is settled and put "do not merge
  until the migration is live" in the PR body. Check the wording.
- Recurring 4th time (owner login part 2, 2026-10-09): "Next gaps: (1)"
  bullet inside Status → Open PR still names the in-PR gap; Next gaps -1 still
  "In PR: ..." instead of the leftover as top gap; older merged entries still
  say "No open PR." while one is open. Also 3rd time: security-reviewer memory
  still records the checkLinkedRecords no-association owner hole the same
  diff fixed. And 2nd: new components/ui/* (RecordSwitcher) + OwnerSelect not
  in docs/DESIGN_SYSTEM.md. And again: "apply after Codex is clean" wording.
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
