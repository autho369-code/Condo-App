# Audit branch changelog

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

## 2026-07-27

- Created `audit/portier369-prelaunch-verification` from the release-readiness branch without pushing to `main`.
- Centralized financial account classification/normal-balance calculations.
- Corrected trial-balance and balance-sheet as-of accounting behavior and selected-association account scoping.
- Added real CSV/JSON/PDF report serialization and server-side output-format validation.
- Documented test evidence, migration risks, security gates, and staging-only fixture guidance.
