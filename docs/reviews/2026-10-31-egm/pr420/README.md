# Goldfish review of #420, 2026-10-31

Three reviewers from Google's Elephant-Goldfish plugin (`egm:egm-zoom-out`,
`egm:egm-design`, `egm:egm-codebase-details`) reviewed the merged #420
(030b9a16) with no conversation history. Each received only the diff, the code,
and the reports in `../`. None found a Blocker. Their findings in short, and
what the follow-up PR (claude/egm-followups) did:

| Finding (who) | Severity | Follow-up |
|---|---|---|
| `platform_flags` (platform-wide resident-email switch) writable by any operator; tables created after the 2026-10-05 sweep miss the operator guard (zoom-out) | Major | Admin-only guard on `platform_flags`; admin-or-support on `profiles`, `user_sessions`, `login_attempts` |
| Stripe late "succeeded": only the status was protected; ledger post, receipt, fee and log still ran (all three) | Major | Early stop for refunded / chargeback / returned / canceled, shared list with the checkout handler |
| Owner ledger total still summed in the app (zoom-out, codebase) | Major | Total from `resident_unit_balances()` (checked equal for all 17 units); warning past 50,000 rows |
| Onboarding checklist bannered stale but still the pilot's procedure (zoom-out) | Major | Checklist refreshed, banner removed; TODO links fixed |
| Two functions patched by text replacement; repo has no readable body (zoom-out, codebase) | Major | Both written out in full |
| Whole-address email hold could release mail to real residents (design) | Major | Back to the broad substring match (over-holds) |
| Vendor records already linked by email stay linked (design) | Major | Checked live: the only vendor login with no invitation is the seeded test vendor; nothing to unlink |
| No tests for the live rules (design, codebase) | Major | `tests/database/egm-review-fixes.test.ts` (migration text + the decision action) |
| Majors dropped from Status without being recorded (design, codebase) | Major | Listed under "Still open" in Status |
| "No rule changes" claim; chart-of-accounts change has no note or rollback (design) | Major | Decisions note with affected roles and rollback SQL |
| Pet/tenant trigger checks only the unit (codebase) | Major | Owner and tenant company checked too |
| Vendor message policy uses an inline subquery (all three) | Nit | Helper `rls_private.vendor_postable_work_order_ids()` |
| Staff can post as `board` (design) | Nit | Trigger sets every signed-in author; `board` refused |
| Vendor calendar cap can drop upcoming visits (all three) | Nit | Upcoming first |
| Approvals page ignores a lookup error (all three) | Nit | Error shown, no forms guessed |
| Bill re-check only adds the board; comment wrong (all three) | Nit | Comment explains why (manual "send to board" choice); Decisions note |
| Chart-of-accounts policy not company-scoped; stale comment; two helpers (zoom-out) | Nit | `my_admin_portfolio()`; comment fixed; one helper |
| Links send finance staff to `/gl-accounts/new` they can't open (codebase) | Nit | Shown to company admins only |
| Payment-application rule lacks the resident gate (codebase) | Nit | Added |
| `resident_payment_ids()` unused but executable (zoom-out) | Nit | Execute revoked |
| Product Rules doesn't name the held association (design, codebase) | Nit | Names Randolph Station; real-or-test is Mirsad's decision |
| One chart per company vs association accounts (design, codebase) | Nit | Kept: association accounts are needed for per-association balances; noted in Decisions |
| Browser-test schema predates the migration (zoom-out, codebase) | Nit | Open: needs a production-linked CLI workdir (Status) |
