# Security findings

Evidence date: 2026-07-28. Production queries were read-only.

## SEC-001 — Cross-company report RPC execution

- **Severity:** Critical
- **Affected roles:** Anonymous users and every authenticated role
- **Boundary:** Management company / portfolio and association
- **Workflow:** Direct Supabase RPC call to any `report_data_*` SECURITY DEFINER function
- **Evidence:** A read-only query of `information_schema.routine_privileges` on the production project returned `EXECUTE` for `PUBLIC`, `anon`, and `authenticated` on all nine report-data functions. The functions accept caller-supplied `p_portfolio_id` and query with definer privileges.
- **Reproduction:** With a Supabase anon or authenticated client, invoke `report_data_dispatch` (or a helper) using another portfolio UUID and a supported slug. Do this only in isolated staging with two marked audit portfolios; do not extract customer data from production.
- **Business impact:** Unauthorized disclosure of owner names/emails, delinquencies, unit/property data, vendors, violations, and work-order data across companies.
- **Recommended fix:** Revoke all function privileges from `PUBLIC`, `anon`, and `authenticated`; grant only `service_role`. Keep authorization and portfolio derivation in the authenticated server path.
- **Fix status:** Code committed in `supabase/migrations/20260726050000_security_definer_execution_boundary.sql`; not applied or verified in staging.
- **Test status:** Production grant exposure verified read-only. Negative exploit test and fixed-grant test pending staging.
- **Release status:** Release blocker.

## SEC-002 — Migration history is not reproducible

- **Severity:** High
- **Affected roles:** All
- **Boundary:** Entire database
- **Workflow:** Clean deploy, staging refresh, forward migration, rollback/recovery
- **Evidence:** 41 invalid migration filenames, three duplicate-version groups, and 159 remote applied statements that are not represented as a clean local replay.
- **Business impact:** Security/RLS/payment fixes can appear in source while remaining unapplied; a new environment cannot be trusted to match production.
- **Recommended fix:** Fetch exact remote history into a clean scratch checkout, verify hashes/statements, replay into disposable staging, then add reviewed forward-only fixes.
- **Fix status:** Runbook and snapshot committed; reconciliation blocked by missing CLI authentication in this audit session.
- **Test status:** Strict migration check fails as expected; no production mutation attempted.
- **Release status:** Release blocker.

## SEC-003 — Payment boundaries require provider replay

- **Severity:** High
- **Affected roles:** Owners, property managers, finance staff, associations
- **Boundary:** Association-owned Stripe Connect accounts
- **Workflow:** Checkout, AutoPay, webhook posting, payout attribution, reversal, reconciliation
- **Evidence:** Source and unit tests enforce connected-account scope, USD cents, livemode consistency, signatures, and idempotency. No complete test-mode provider replay and ledger tie-out has been demonstrated.
- **Business impact:** Incorrect association attribution, duplicate postings, or unreconciled money could affect owner balances and association cash.
- **Recommended fix:** Apply the payment migrations together in staging; execute signed duplicate/reordered webhook fixtures for two connected accounts; tie each provider object to ledger, bank feed, reconciliation, and audit records.
- **Fix status:** Code present; environment and end-to-end verification pending.
- **Test status:** Unit tests pass; integration test pending.
- **Release status:** Release blocker.

## SEC-004 — Role and storage isolation not fully demonstrated

- **Severity:** High
- **Affected roles:** Company Admin, Manager, Board, Owner, Tenant, Vendor
- **Boundary:** Company, association, unit, owner, vendor, and private storage paths
- **Workflow:** Direct URL/API/RPC/storage-object access with forged identifiers
- **Evidence:** Guards, RLS policies, and scoped storage helpers exist, and selected unit tests pass. Complete two-company/two-association negative tests with real staging sessions are not yet available.
- **Business impact:** A missed policy or service-role route could expose private operational, owner, board, vendor, or financial data.
- **Recommended fix:** Seed marked personas in staging and run the required horizontal/vertical escalation matrix at UI, API, server-action, RLS, storage, cron, and webhook layers.
- **Fix status:** Partial hardening committed.
- **Test status:** Static/unit evidence only; full staging matrix pending.
- **Release status:** Release blocker.

## SEC-005 — Provider and operational secrets not proven

- **Severity:** Medium
- **Affected roles:** All
- **Boundary:** Deployed Preview and Production environments
- **Workflow:** Cron jobs, Stripe, Plaid, Resend, AI provider, durable rate limiting
- **Evidence:** Required variables are documented and code fails closed in several paths. Actual values and separation across Vercel environments have not been inspected or printed.
- **Business impact:** Jobs or provider workflows may fail; mode mismatch may block payments; missing monitoring may hide failures.
- **Recommended fix:** Verify presence, environment separation, rotation ownership, alerting, and provider test/live modes without exposing values.
- **Fix status:** Configuration pending.
- **Test status:** CI uses non-secret placeholders; deployed configuration pending.
- **Release status:** Release blocker where required for enabled features.

## Controls verified in source/CI

- Secret scanning and production dependency audit pass.
- Cron routes use a fail-closed bearer-secret helper.
- Stripe webhook signature verification and payload limit are present.
- Public AI/photo endpoints use durable scoped rate limits.
- Association Stripe account and cross-account money invariants have passing tests.
- Storage-path validation and tenant-boundary helpers have passing tests.
