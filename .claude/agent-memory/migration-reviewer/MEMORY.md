# migration-reviewer memory

## Confirmed rules (Mirsad)
- DELETE/DROP SQL goes to Mirsad for the SQL editor; additive migrations Claude applies after merge.
- Only project `termxngysvotnfbzbgrv`; never staging or stellar-ops without asking.

## Checks that caught real bugs
- Migrations must pass `node scripts/check-supabase-migrations.mjs`.
- `payment_processor` enum value 'stripe' is LIVE (`app/api/stripe/webhook/route.ts:358` inserts payment_methods with processor 'stripe'; `select_payment_processor()` falls back to 'stripe', baseline :7794). Flag any migration that drops/recreates the enum without 'stripe' as breaking online payments, despite the old docs/TODO.md note calling it unused.

- Migration version must be a REAL UTC timestamp: `20261013240000` (hour 24) fails the checker as an invalid filename. After ...230000 use ...233000 or the next day's 000000. RECURRING (again 20261014240000_comms_followups, already applied live): if applied, check the live schema_migrations row first: apply_migration records its own real-time version (comms_followups is 20261013192146 live), so a file rename usually needs no history fix.
- In-place patches of trigger guards: `current_user` only works if the guard is NOT security definer (email_queue_guard_worker_columns isn't); check before accepting an auth.role() -> current_user swap.

## False alarms to skip
- The checker prints ~40 warnings on old, already-merged migrations even when it PASSES. Only warnings on in-scope files count. (Codex on PR #229.)
- `git show origin/main:<f> | diff - <f>` shows every line changed on Windows (CRLF checkout). Compare `git ls-tree` blob hashes or use `diff --strip-trailing-cr`.
- Get scope from `node scripts/review-scope.mjs supabase/migrations`, not a hand-written `git diff`: merge-base diffs keep squash-merged files, tip diffs pull in main-only changes. (Codex on PR #230.)

- `set plan_cache_mode = force_generic_plan` on invoker RPCs over RLS views is the house pattern (20261011110000 explains why); don't flag it. Only check a CREATE OR REPLACE keeps it.
- RETURNS TABLE names equal to view columns are fine in plpgsql if every reference is `alias.col`; only unqualified refs conflict.

## Top lessons (missed or wrong before)
- DELETE with no WHERE in a function body is a blocker (pg_safeupdate; #264 broke Bills/Journal uploads 2026-10-09).
- New company-data table needs the `operator_write_guard` statement trigger (#275 missed it, 2026-10-10).
- Before flagging an unrestricted UPDATE policy, grep ALL migrations for triggers on the table (`_000_self_service_guard`).
- INVOKER RPCs cannot call service_role-only GL helpers; a postgres-run compile/test does not catch EXECUTE gaps.
- A measure that excludes a pair (receipt + its reversal charge) must apply the SAME window to both sides; #342 (20261013150000/170000) skipped every reversal charge, even for pre-plan receipts never counted. Codex caught it, I missed it.
- A measure bounded by `current_date` but rechecked only by event triggers misses future-dated rows: nothing re-fires when the date arrives. #343 `payment_plan_paid_amount` skipped bounce charges with a future due date, so the plan stayed completed (Codex caught it, I missed it). Ask "what recheck fires on day X?"
- Windowed measures (payment_plan_paid_amount, 20261013200000): bound BOTH sides by the same clock. Receipts used created_at but charges used due_date <= completed_at::date, so a dues/late-fee charge posted later the same UTC day (or backdated) entered a frozen completed plan; and a backdated bounce (due < plan start) of a pre-plan receipt was never counted. Use recording time (created_at/reversed_at) for window edges.
- Multi-plan units: ask which plan owns a bounce, for EVERY receipt age (inside plan 1, between plans, before both). 20261013200000 v2 fixed in-window receipts but a receipt older than both plans still hit both. Exclusions of 'another plan's' rows must copy that plan's own filters exactly (created_at bound too), or rows fall between plans.
- A changed measure needs a recheck of stored statuses: rows already completed/flagged under the old measure stay stale until an event re-fires. #345 changed payment_plan_paid_amount without rechecking plans (Codex caught; fix 20261013230000 loops app_recheck_payment_plan per unit). Ask "what re-evaluates existing rows?"
- Narrowing a permissive USING (true) policy: demand per-role before/after row counts; shared portfolio_id-NULL rows may rely on it (20261012010000).
- A tenure/scope cutoff helper that returns NULL for "no cutoff" also returns NULL when the caller has NO matching row; pair it with the same membership helper (rate_work_order 20261014090000:50 vs current_resident_unit_ids).
- A lock trigger that is BEFORE UPDATE only ("completed rows can't change") leaves INSERT-as-final-state and DELETE+reinsert open; check all three ops (20261014130000:121). Repair predicates on auth.role() IS NULL fail open; prefer also session_user <> 'authenticator'.
- A definer RPC that "reads for everyone, writes for editors" must gate the write with the SAME helper as the table UPDATE policy and re-check status after FOR UPDATE (20261014100000:67-72 does). Also ask: does the read path count the same rows as the page (date window vs status=current)?

- Narrowing a SELECT policy (e.g. exec sessions -> my_confidential_meeting_association_ids, 20261014140000): sweep DEFINER RPCs on the same rows; they bypass RLS. `can_view_association_row`/`manager_is_scoped()` is TRUE for staff with ZERO association_managers rows, so an unassigned assistant passes it (calculate_meeting_quorum).

- A BEFORE INSERT trigger that stamps author/role for "non-staff" callers also fires inside DEFINER RPCs run by non-staff (board): grep every `insert into public.<t>` in migrations. Found in 20261014190000 arch_msg_set_author (would relabel board_decide_architectural_request's 'board' rows); fixed before the PR: it now stamps only author_role='owner' rows.
- This agent has had no live DB tool (no Supabase MCP/psql/DB URL): give the caller read-only verification SQL instead of claiming live parity.

- A guard that recomputes a total from child rows must also fix the child rows' CLASS (type/sign) and forbid duplicates; recomputing amounts alone still lets a client mislabel or double a row (20261014170000 recon items). Treat every terminal status (void, cancelled) as terminal, not just 'completed'.
- Guards that pin a column back to OLD on UPDATE (`new.x := old.x`) must AUTHORIZE against OLD too. 20261014170000:510 checked the parent via new.reconciliation_id, then reset it, so naming an open recon unlocked a completed one's item (Codex P1 on #361; fix 20261014180000:32). Either look up by old.* on UPDATE/DELETE or raise if the key changes (app_guard_bank_reconciliation does the latter).
- A backfill/trigger that derives a column (fund_type from purpose) must not overwrite explicit values outside the derived set (insurance_proceeds/construction_escrow); restrict the UPDATE WHERE to null-or-derived values and ask for a pre-run count (20261014170000, Codex on #361).

- Column-freeze triggers keyed on `current_user in ('authenticated','anon')` are bypassed by every DEFINER writer (runs as owner): sweep `update/insert public.<t>` in ALL migrations + app `.from('<t>').update/insert` and confirm each definer is service_role-gated (auth.role() check + revoke/grant) and each app writer of frozen cols uses createServiceClient (20261014234500 sms_messages: clean).

- INVOKER triggers run their callees as the caller: every helper an invoker trigger calls needs EXECUTE for authenticated (first draft of 20261015010000 revoked them -> all staff sends broken; FIXED: key helpers granted :77-78, suppression moved to definer email_prepare_batch). Details in sql-pitfalls "Email suppression".

- Local-date patches: `association_local_date` is a definer SQL fn (never inlined); check each call is once per association/initplan, not per row. Lateral pullup trap in sql-pitfalls.
- Text-patch migrations: run every multi-line anchor against the latest repo body with a node count script; a skipped comment line aborts the migration (20261015020000:56). See sql-pitfalls. (Fixed before apply: anchor, indexes, draft early-return, association_id, adjustment refused on any open reconciliation.)

- Replacing a per-row definer helper (association_local_date(pb.association_id,..)) with an inner JOIN to the parent changes semantics: rows with a NULL/hidden FK drop (payable_bills.association_id is nullable; 20261015030000 vendor_1099_totals), and the join now evaluates parent-only expressions (free-text timezone) for parents with no rows. Check nullability + RLS parity + caller's null handling.

- Revoking table DML from authenticated (20261015060000 journal_*): sweep latest bodies for invoker writers AND invoker `FOR UPDATE/SHARE` on the table (needs UPDATE priv), non-invoker updatable views over it, and later `grant ... on all tables` re-grants. FK cascades run as owner (safe). Node regex sweep over latest fn bodies works.

## Topic files
- [SQL pitfalls](sql-pitfalls.md) — ACLs, inlining, regex/locale, re-runnability, checker false alarms, RLS hoist forms, revoke-unused-function checks, definer scope sweeps + twin drift, queue insert guards
- [Triggers and scope](triggers-and-scope.md) — trigger order on portfolios/associations/auth.users, association-scope patterns
- [Owners and vendors](owners-vendors.md) — association/login models, self-service guards, many-records-per-login checks
- [Purge and FKs](purge-and-fks.md) — cascade/NO ACTION maps, polymorphic tables, trigger re-enable pitfalls
- [Data writers](data-writers.md) — who writes token/company_name/imported_balances, receivables GL facts, GL map keys, payment reversal, bank recon writers, charge GL dating (charge_ledger_date), violation hearing clocks, meeting quorum record-vs-read, approval_requests status writers, bill payment-date rules
