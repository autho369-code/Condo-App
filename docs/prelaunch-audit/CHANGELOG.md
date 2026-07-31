# Audit branch changelog

## 2026-07-31 — live identity and document-storage checkpoint

- Added a reversible live stale-session verifier and proved immediate database authorization revocation for Platform Operator, Company Admin, Manager, Board, Owner, and Vendor while each already-issued access token remained active; every profile was restored and re-authenticated.
- Added a live API-boundary verifier: anonymous and manager clients cannot execute service-only report functions; Manager A and Company Admin A cannot mutate tenant B; Board cannot mutate its association; Owner cannot alter charges; Vendor cannot alter payables.
- Found that every document workflow depended on an `association-documents` bucket that was absent from all migrations and staging. Added an idempotent private 25 MB MIME-restricted bucket migration and applied it only to staging.
- Proved a signed PDF upload/download succeeds while public reads, unsigned uploads, and executable MIME uploads are denied; temporary verification objects are removed in `finally`.
- Replayed all 188 migrations from an empty local database and passed 166 tests across 50 files, TypeScript, lint without errors, route/dashboard checks, migration validation, secret scanning, and the production build.

## 2026-07-31 — role-browser report storage checkpoint

- Restored the staging browser-test boundary by replacing empty branch-specific Vercel Preview Supabase variables with staging-only values; production configuration and data were not changed.
- Verified manager, platform-operator, company-admin, board, owner, and vendor login routing in isolated browser sessions with tenant-scoped staging data and no page errors.
- Browser execution found that PDF report runs failed after generation because the private `reports` storage bucket existed only as manual environment state. Added an idempotent migration for a private, 20 MB, MIME-restricted report bucket and made signed-URL failures explicit instead of recording a false success.
- Replayed the manager Balance Sheet export after the migration, downloaded a 12,113-byte `%PDF-` output through its private signed URL, verified board financials/delinquencies, owner ledger/communications, vendor payments/work orders, and confirmed five higher-privilege direct-URL attempts redirect to the correct role home.
- Rebased the release audit documents on current staging evidence while retaining a production `NO-GO` for recovery, provider, report-reconciliation, and adversarial authorization/storage gates.
- Reset the local Supabase database with seeding disabled and replayed all then-current migrations successfully from an empty database.
- Confirmed Owner, Vendor, and Board cannot open a manager report-run ID; Manager A receives 404 for Association/Owner/Vendor B IDs; Company Admin A is redirected to its own role home for those manager routes; and a direct public-bucket URL cannot retrieve the private report object.

## 2026-07-31 — placeholder removal checkpoint

- Replaced the generic “Help center coming soon” fallback with authenticated, workflow-specific guidance for every linked staff help topic; unsupported help slugs now return a real 404.
- Removed stale route-audit classifications that labeled implemented create/update screens as placeholders, and extended the audit to reject fragment links without a matching local anchor.
- Reconnected association task-panel links to real email, approval, meeting, violation, amenity, architectural-review, and report workflows; removed three advertised Bills tabs that had no implementation.
- Removed fabricated letter-preview identities, addresses, balances, dates, payment instructions, and policy values. Merge data now comes from selected association, owner/unit, vendor, manager, and active board records; unavailable fields remain visibly unresolved for review.

## 2026-07-31 — scheduled delivery and automation recovery checkpoint

- Reworked scheduled-report email delivery to recover every successful run whose 30-day signed link remains valid, independently of the generation invocation; normalized/deduplicated up to 100 recipients and added deterministic run/recipient queue keys with portfolio branding and scope.
- Replaced automation's “failed means fired forever” behavior with service-role-only atomic claims, a ten-minute concurrency/crash cooldown, preservation of already-successful action outcomes, deterministic action/recipient email keys, and a five-attempt ceiling.
- Applied migrations `20260731000000` through `20260731002000` only to staging. Live verification passed for non-service rejection, overlapping-claim denial, partial retry/outcome preservation, successful-run immutability, fifth/sixth-attempt behavior, scheduled-report recovery, duplicate-cased recipient normalization, exact replay deduplication, and queue portfolio scope; fixtures were removed.

## 2026-07-30 — replay-safe reminder producers checkpoint

- Made the shared queue helper replay-safe for producers that provide deterministic idempotency keys while preserving normal inserts for unkeyed messages.
- Added per-task/window/recipient keys to maintenance and insurance reminders and converted maintenance content back to escaped text-generated HTML.
- Moved insurance reminder timestamps after successful durable queue insertion, so a queue failure no longer records a notice as sent; retries deduplicate already-queued recipients before safely stamping the policy window.

## 2026-07-30 — durable email worker checkpoint

- Added the missing Vercel email-queue worker and one-minute Pro cron schedule; the old repository only referenced a Supabase Edge Function that was not present, so queued mail had no verifiable delivery path.
- Added service-role-only atomic claims with stale-claim recovery, four-way bounded processing, deterministic Resend idempotency keys, exponential retry delays, a five-attempt ceiling, provider IDs, and communication-message completion/failure reconciliation.
- Applied migration `20260730004000` only to staging. Non-service access, double claims, retry timing, two-recipient completion, terminal failure, and sixth-attempt rejection all passed without sending external email; temporary verification rows were removed.

## 2026-07-30 — staff communication delivery checkpoint

- Replaced direct staff-letter Resend calls with the shared durable email queue, server-side recipient/template/tenant validation, conservative HTML-to-text normalization, and per-request idempotency.
- Added an authenticated atomic communication-center queue RPC with a 500-recipient bound, deterministic per-message/per-recipient keys, queue-to-message traceability, and honest `queued` status until delivery is confirmed.
- Applied migration `20260730003000` only to staging. Vendor access, invalid recipients, cross-tenant dispatch, duplicate recipients, and replay attempts were rejected or deduplicated as intended; queue attribution and pending delivery state were verified and temporary rows were removed.
- Confirmed the preceding owner-communications checkpoint passed GitHub CI and Vercel preview deployment.

## 2026-07-30 — payable approval checkpoint

- Removed direct authenticated bill mutations and introduced finance-guarded creation, submission, approval, and void RPC boundaries.
- Derived board-routing requirements from each association's approval settings and bill threshold; linked payable bills to immutable board approval requests.
- Restricted board decisions to configured active voters, required signatures when configured, rejected changes after finalization, and revoked direct decision-table writes.
- Added finance-role guards to bill, owner-payable, check-run, print, and PDF routes.
- Applied migrations `20260730000000` and `20260730001000` only to staging `zalfkrtjeswvfmucicea`; production was not mutated.
- Seeded two active board members with one selected approver and ran the staging manager → board → manager lifecycle. Direct writes, cross-tenant vendor use, draft approval before submission, unselected voting, unsigned voting, premature posting, and finalized-decision replay were rejected. The approved $650 bill posted a balanced two-line accrual.
- Full checkpoint gate: 136/136 tests, TypeScript, lint, production build, secret scans, route audit, dashboard-text audit, migration validation, and diff checks passed.

## 2026-07-30 — generated document PDF checkpoint

- Replaced the client-side empty `file_url` placeholder with a staff-guarded server action that renders a real Letter-size PDF, uploads it to the private association bucket, and saves a tenant/path-scoped document row.
- Made association selection mandatory, scoped owner choices and notice recipients to active association occupancies, and changed the ambiguous “send as notice” control to an explicit draft-notice workflow that sends no email before review.
- Added one-hour signed links for generated documents while failing closed for invalid or legacy-unscoped storage paths.
- Rendered and inspected a four-page representative PDF: association branding repeats on continuation pages, normal paragraphs stay together, footers show page X of Y, and text extraction preserved the title, association, and final section.

## 2026-07-30 — owner communications checkpoint

- Replaced the owner portal's service-role insert/queue path with one authenticated, security-definer transaction that derives portfolio and association from the active owner occupancy.
- Added bounded subject/body validation, double-submit idempotency, a durable 10-messages-per-hour owner limit, management-recipient priority/fallback, escaped email content, full owner-readable message history, and a queue-to-log audit link.
- Corrected the resident history policy to compare `communications_log.sender_id` with `auth.uid()` rather than the unrelated owner-row UUID.
- Applied migration `20260730002000` only to staging. Owner A/Owner B tenant isolation, Vendor A rejection, exact queue traceability, replay idempotency, body history, and rejection of message 11 within an hour all passed; the verifier removed its messages and queue rows afterward.

## 2026-07-27

- Created `audit/portier369-prelaunch-verification` from the release-readiness branch without pushing to `main`.
- Centralized financial account classification/normal-balance calculations.
- Corrected trial-balance and balance-sheet as-of accounting behavior and selected-association account scoping.
- Added real CSV/JSON/PDF report serialization and server-side output-format validation.
- Documented test evidence, migration risks, security gates, and staging-only fixture guidance.
