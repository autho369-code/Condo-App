# migration-reviewer memory

## Confirmed rules (Mirsad)
- DELETE/DROP SQL goes to Mirsad for the SQL editor; additive migrations Claude applies after merge.
- Only project `termxngysvotnfbzbgrv`; never staging or stellar-ops without asking.

## Checks that caught real bugs
- Migrations must pass `node scripts/check-supabase-migrations.mjs`.
- `payment_processor` enum value 'stripe' is LIVE (`app/api/stripe/webhook/route.ts:358` inserts payment_methods with processor 'stripe'; `select_payment_processor()` falls back to 'stripe', baseline :7794). Flag any migration that drops/recreates the enum without 'stripe' as breaking online payments, despite the old docs/TODO.md note calling it unused.

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

## Topic files
- [SQL pitfalls](sql-pitfalls.md) — ACLs, inlining, regex/locale, re-runnability, checker false alarms, RLS hoist forms, revoke-unused-function checks, definer scope sweeps + twin drift
- [Triggers and scope](triggers-and-scope.md) — trigger order on portfolios/associations/auth.users, association-scope patterns
- [Owners and vendors](owners-vendors.md) — association/login models, self-service guards, many-records-per-login checks
- [Purge and FKs](purge-and-fks.md) — cascade/NO ACTION maps, polymorphic tables, trigger re-enable pitfalls
- [Data writers](data-writers.md) — who writes token/company_name/imported_balances, receivables GL facts, GL map keys, payment reversal, bank recon writers
