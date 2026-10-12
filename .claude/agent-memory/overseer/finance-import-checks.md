---
name: finance-import-checks
description: Pre-PR checks for the previous-system importer (credits, tie-out prior years, opening-balance posting), 2026-10-09/10
metadata:
  type: project
---

- Importer credits (2026-10-09 start check): the trial balance step is a
  read-only tie-out (posts nothing); open-balance charges post Dr A/R /
  Cr income ("OTHER" category GL) via import_opening_balance ->
  post_ad_hoc_charge. Credits are skipped at receivables-actions.ts:214.
  The only credit path, post_homeowner_credit, allows income/expense
  accounts only (Dr that / Cr A/R); no prepaid-liability account exists in
  gl_pick. Check any credit PR for: offset GL stated, a record in
  imported_balances (repeat-import dedupe + Import Variances), and the
  "Credits are not imported" text in receivables-section.tsx:142 updated.
  The end-to-end import is Mirsad's to run (his files, his data).
- Recurring 2nd time (importer credits pre-PR, 2026-10-09): the just-merged
  PR (#268) was put under Status → Open PR as "#268 merged" instead of
  "Where things stand"; merged #267 sat in both sections. Open PR must hold
  only the open PR. Also: Product Rules line 6 still said "Additive
  migrations: Claude applies after merge" (contradicts PR Rules: apply as
  soon as the SQL is settled) - the source of the repeated wrong wording.
- Import credits: the "no longer in this file (paid or removed ...)" message
  in receivables-actions.ts also fires for an imported credit that was used
  up; check wording when a sign-flipped row type joins an existing loop.
- Tie-out prior-years fix (start check 2026-10-10): the edit was already in
  the working tree before the start check. Pre-PR, check: absorption only when
  the file has a prior-years line; totals unchanged (row moved, not dropped);
  a unit test exists (logic sits in the server action, untested - extract the
  matching to lib/imports/appfolio-gl.ts); Status Next gaps 0 drops the
  "possible gap"; Decisions records the rule.
- When the branch is reused after a merge (tie-out PR on the #270 branch,
  2026-10-10), grep Status for "the open PR" / "fixed in the open PR": older
  entries still pointing at the merged PR now read as the new one (Status
  :53 said the pg_safeupdate fix was "in the open PR" after #270 merged).
  The tie-out matching stayed in the action, tested via vi.mock (accepted).
- Opening-balance step (start check 2026-10-10): posting tie-out
  differences must be idempotent through the tie-out itself. Pre-PR check:
  the retained-earnings target is one the tie-out absorbs (equity,
  isPriorRetainedEarnings name, not in the file) else a re-run shows a
  difference and a second click double-posts; prior-years part refused when
  the file has no prior-years line; withImportLock around tie-out + RPC (no
  double post on double click); csv_gl_id needs g.active but the tie-out
  reads inactive accounts too (refuse up front with a named list);
  not_in_appfolio rows (ledger-only) policy stated in Decisions; confirm
  button; no "AppFolio" in batch name / memo / reference.

