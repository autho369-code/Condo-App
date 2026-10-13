---
name: vault-staleness
description: Every recorded case of docs/brain Status going stale (header/Open PR after merge, Next gaps "In PR", merged PRs in Open PR, vault Open PR line vs final diff)
metadata:
  type: feedback
---

Rule: at every start and pre-PR, diff Status line 3 + "## Open PR" + every "Next gaps" mention against `gh pr list --state open` and the final diff; merged PRs go to Merged/"Where things stand". Seen 7+ times.

- A gap the PR closes belongs under "Open PR", not still as Next gaps #1
  ("In PR: ..."); the next session would pick it up again.
- The vault's Open PR line goes stale like the PR body: written in the first
  commit, then a reviewer-fix commit widens scope (finance RPC scope PR,
  2026-10-07: vault said "12 RPCs", final migration patches 16). Count the
  final diff against the vault line.
- Recurring (2nd time, #245 after #244): the caller planned with the PR as
  "open, not merged" but it had merged (e25b1d1d). Always check REST first and
  remind: apply + read back the PR's migration (20261007100000) before new work.
- Recurring (accept-invitation PR, 2026-10-08): vault Open PR line written in
  the first commit, a later commit (expired/other-account states, rate limit,
  plain errors) not added. Also: a deliberate exception to a Decisions rule
  (accept-invitation allowed on the platform address, unlike /sign,
  /vendor-upload) must be written into Decisions, not only a code comment.
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
- Recurring 4th time (owner login part 2, 2026-10-09): "Next gaps: (1)"
  bullet inside Status → Open PR still names the in-PR gap; Next gaps -1 still
  "In PR: ..." instead of the leftover as top gap; older merged entries still
  say "No open PR." while one is open. Also 3rd time: security-reviewer memory
  still records the checkLinkedRecords no-association owner hole the same
  diff fixed. And 2nd: new components/ui/* (RecordSwitcher) + OwnerSelect not
  in docs/DESIGN_SYSTEM.md. And again: "apply after Codex is clean" wording.
- Start check 2026-10-10 (project spend list): Status header/Open PR still
  said "#282 open" after #282-#287 merged (TODO/vault-only PRs skip Status).
  Check `gh pr list --state open` vs Status header every start. For a
  definer aggregate replacing an invoker view: totals must equal the detail
  RPC's (incl. its "Restricted accounts" row) and use once-per-query helpers,
  set-based, plpgsql.
- Recurring 3rd time (project spend pre-PR, 2026-10-10): merged PRs
  (#282-#287) written into Status -> Open PR as "Merged meanwhile" instead of
  a Merged/"Where things stand" entry. Open PR holds only the open PR.
  Also: when a PR leaves an object unused (capital_project_financials view),
  the drop is Mirsad's (DROP rule) - list it in docs/TODO.md Mirsad's list.
- Recurring 5th time (operator tap targets pre-PR, 2026-10-11): Status
  header still "open PR: #296" and Open PR still held merged #288
  (project-spend-list) while #296-#303 merged; the PR edited only Next gaps
  + Shipped. Every pre-PR: diff Status line 3 + "## Open PR" against
  `gh pr list --state open`, and add merged PRs to "Where things stand".
- Recurring (csp-nonce pre-PR, 2026-10-11): Status line 3 said "next: no code gaps" while Next gaps got a NEXT code gap; new app/not-found.tsx (UI + text) had only security-reviewer run.
- Recurring 7th time (2026-10-12, after #328): Status line 3 + Open PR still
  "#328 open" after it merged; the vault edit for a PR is written while open
  and nothing moves it after merge. At every start: flag + tell the caller to
  move it to "Merged" in the first commit of the next PR.
- Recurring 6th time (2026-10-12): Status line 3 + Open PR still "#316 open"
  after it merged 05:23Z; `gh pr list --state open` was empty. Check it first.
- Recurring 8th time (2026-10-12, after #332 merged 21:56Z): Status line 3 +
  Open PR still "#332 open". Also the caller called gap #2 (document-repair)
  "the next gap" while Next gaps #1 is aged_receivables - name the real top
  gap and ask for the reason when a lower one is picked.
- Repair tools that exist because RLS hides the rows (document-repair:
  misplaced docs fail document_path_matches_entity) cannot "switch to the
  caller's RLS client"; keep the service client and narrow its ids by the
  caller's scope RPC. Check every caller of the shared finder (page Alert
  listed file names too, not only the action).
- Recurring 9th time (start check 2026-10-12, after #336 merged e5f10859):
  Status line 3 "open PR: claude/rls-twin-scope" + "## Open PR" #336 entry
  stale; `gh pr list --state open` empty. Same fix: move to Merged in the
  next PR's first commit.
- Recurring (plan-completion-window pre-PR, 2026-10-13): Status line 3
  "next: keep watching CSP" while Next gaps holds a "NEXT (measured
  2026-10-13) per-row policies" item; and #344 (merged 2026-10-13 04:01Z)
  filed under "Merged 2026-10-12". Line 3 "next:" must name the top NEXT gap.
  Also reviewer memory (migration-reviewer data-writers.md) said
  "report_data_payment_plans still uses its own raw sum" while 210000 in the
  same PR fixed it.
- Recurring 10th time (start check 2026-10-12, after #346 merged
  161273b9): Status line 3 + "## Open PR" still #346. Also Next gaps had no
  NEXT item; the only open engineering item was the "check each when
  touched" note on definer views/RPCs over payment_methods / physical mail
  / payable checks / automation flows (#335 swept only record-id functions).
  Recommended promoting it, plus a rolled-back Stripe/online-payment ledger
  dry-run (the one flow never exercised) before Mirsad's pilot keys.
- Moving a merged PR from Open PR to Merged (meetings-list-order pre-PR,
  2026-10-13): the condensed Merged entry dropped the "Known, not fixed"
  line (#355: unassigned staff read executive-session attendees/agenda),
  leaving it nowhere in the vault. Grep the old Open PR text for "Known" /
  "not fixed" / "follow-up" and carry each into Next gaps. Same pre-PR: line
  3 "next:" named a gap Next gaps says was already fixed (scoped-manager
  charges, 20261014060000).
- Recurring 11th time (start check 2026-10-13, after #352 merged 06:16Z):
  Status line 3 + "## Open PR" still #352; caller already flagged it.
- Recurring 12th time (start check 2026-10-13, after #362 merged 18:03Z
  6cf899c8): Status line 3 + "## Open PR" still #362; caller already
  planned the move. Line 3 "next:" also named the NSF setting, not the
  task actually picked (owner-portal deep check) - line 3 must follow.
- 2026-10-13 (owner-portal-fixes pre-PR): new Next gap "payments.notes
  readable by owners, move to a private table" had a stale premise:
  payment_private + trigger payments_move_private_fields (20261004200000)
  already null payments.notes. grep `<table>_private` / move_*_private_fields
  before writing a "make X private" gap. Same PR: 3 policies set USING false
  + 2 functions revoked with no Mirsad "Optional cleanup: drop" TODO entries.
