---
name: finance-imports-audits
description: Opening-balance credits, trial-balance import, third audit (operator_write_guard, storage policies, middleware deadlines)
metadata:
  type: feedback
---

## Opening-balance credits (2026-10-09 review, 20261009080000)
- INVOKER RPCs cannot call the GL helpers: `charge_gl_accounts`, `payment_gl_accounts`, `gl_pick`, `app_gl_map`, `unit_association_id`, `post_*_to_gl` are EXECUTE service_role only (20260930020000:229, 20261003200000:79). `import_opening_credit` called `charge_gl_accounts` from INVOKER -> "permission denied" for every caller; mocked action tests do not catch it. `budget_gl_account_scope_valid` IS granted to authenticated. Grep a helper's grants before approving an INVOKER caller.
- Auth chain was otherwise sound: `post_homeowner_credit` (DEFINER) derives association from the unit and checks can_manage_finance + can_manage_association + GL scope; the imported_balances insert is the same invoker path as `import_opening_balance` (staff_insert + `mgr_assoc_scope`).
- Fixed in 7a0d262: DEFINER `import_credit_income_account` gates `charge_gl_accounts` with `can_manage_finance(pid)` + `can_manage_association(assoc)` (assoc from `unit_association_id`, same as post_homeowner_credit) before the category check; out-of-scope and missing units both give 'Unit not found' (no oracle). Pattern to reuse when an INVOKER RPC needs a service-only GL helper.

## Trial-balance opening entry (2026-10-10 review, uncommitted diff)
- `postOpeningBalancesFromTrialBalance`: auth chain clean (requireFinanceStaff, `claim_import_lock` = can_manage_association, server-side tie-out, DEFINER `import_journal_entry_batch` re-checks can_manage_finance + can_manage_association; `csv_gl_id` limits GL to the company + own association + active). Client rows only pick amounts within the caller's own association.
- "Recompute the differences, so a rerun posts nothing" is idempotent only for the same as-of date: the ledger read is `to: asOf`, so a rerun with an EARLIER date skips the first entry and posts again. Check the date window of any "diff vs ledger" dedupe.

## Third audit (2026-10-10)
- New company-data tables need `operator_write_guard` (statement trigger,
  `operator_write_guard('false')`), which is attached per table, not
  automatically: a write policy using can_admin_portfolio is true for EVERY
  platform operator. Missed in #275 (company_state_rules), caught here; fixed by
  20261010020000. Check every `create table` in a migration for it.
- Storage policies are not in the repo's migrations (dashboard-made): when a
  table policy is moved to a new identity helper, look for its storage.objects
  twin in live pg_policies (association-documents missed in #268, fixed by
  20261010030000).
- Middleware timeouts (2026-10-11, deadline diff): a deadline turns a hang (504, closed) into an error. Found: on apex a failed `me` only blocked writes and skipped the MFA gate on reads; fixed in claude/middleware-deadlines (any identity error on a protected path -> 503, every method and host). Lesson: check every new error source against the MFA/operator gates.
