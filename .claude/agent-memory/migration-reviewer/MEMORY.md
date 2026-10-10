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

## Top lessons (missed or wrong before)
- DELETE with no WHERE in a function body is a blocker (pg_safeupdate; #264 broke Bills/Journal uploads 2026-10-09).
- New company-data table needs the `operator_write_guard` statement trigger (#275 missed it, 2026-10-10).
- Before flagging an unrestricted UPDATE policy, grep ALL migrations for triggers on the table (`_000_self_service_guard`).
- INVOKER RPCs cannot call service_role-only GL helpers; a postgres-run compile/test does not catch EXECUTE gaps.

## Topic files
- [SQL pitfalls](sql-pitfalls.md) — ACLs, inlining, regex/locale, re-runnability, checker false alarms, RLS hoist forms
- [Triggers and scope](triggers-and-scope.md) — trigger order on portfolios/associations/auth.users, association-scope patterns
- [Owners and vendors](owners-vendors.md) — association/login models, self-service guards, many-records-per-login checks
- [Purge and FKs](purge-and-fks.md) — cascade/NO ACTION maps, polymorphic tables, trigger re-enable pitfalls
- [Data writers](data-writers.md) — who writes token/company_name/imported_balances, receivables GL facts
