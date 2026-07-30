# Portier369 True-State Audit

**Audit branch:** `codex/portier369-stabilization`  
**Baseline commit:** `0c4ca96b70d04a44dc078453602490b1c5456c00`  
**Audit opened:** 2026-07-29  
**Production posture:** FROZEN — no migration, seed, destructive command, or unapproved deployment is authorized by this audit.  
**Current release decision:** **NO-GO**

## Purpose and evidence standard

This is the controlling, evidence-backed record for stabilizing Portier369. It intentionally distinguishes code presence from verified behavior. A page, component, database table, or passing build is not proof that a workflow works end to end.

Statuses used below:

- **VERIFIED** — exercised against a real deployed environment and real service boundary, with an observable result.
- **PARTIAL** — meaningful implementation exists, but the complete workflow or all required variants have not been exercised.
- **PLACEHOLDER / DISCONNECTED** — the UI advertises an action that does not reach a completed workflow, or explicitly says it is coming soon.
- **BLOCKED** — verification requires credentials, external configuration, or safe isolated data that is not yet established.
- **NOT VERIFIED** — present in code but not yet exercised to the required standard.

## Repository baseline

| Surface | Observed inventory | What it proves |
|---|---:|---|
| Next.js pages | 304 | Route implementation exists; not proof of workflow correctness |
| API route handlers | 30 | Server endpoints exist; authorization and side effects require testing |
| Shared components | 54 | UI building blocks exist |
| Supabase migrations | 178 | Substantial schema history exists; staging drift must still be checked |
| RLS/policy statements | 765 matches | Broad tenant-security intent exists; isolation must still be tested with multiple tenants |
| Automated test files | 35 | Automated coverage exists; coverage is not equivalent to product certification |
| Vercel cron jobs | 7 | Schedules are declared; execution and downstream delivery remain to be verified |

Role-area route counts observed: manager/staff application 161, platform operator 20, company admin 23, board 24, owner portal 31, and vendor portal 10.

The production baseline inherited by this branch had passing GitHub CI and a successful Vercel deployment. Those facts establish build health only. They do not upgrade any unexercised business workflow to VERIFIED.

## Current product truth by area

| Area | Status | Evidence and remaining proof |
|---|---|---|
| Authentication and role resolution | PARTIAL | Real sign-in and the `me()` role resolution were previously exercised for operator, company admin, manager, board, owner, and vendor identities. Password recovery, invitation acceptance, deactivation, cross-role identities, and session expiry still require controlled tests. |
| Platform Operator | PARTIAL | Dedicated guarded routes exist. Tenant creation/configuration, support operations, audit logs, and isolation controls are not yet fully exercised. |
| Company Admin | PARTIAL | Dedicated routes and `requirePortfolioAdmin()` exist. Manager provisioning, defaults, portfolio settings, role changes, and removal need end-to-end verification. |
| Manager / staff | PARTIAL | The largest implemented surface exists and core accounting report generation works. Operational CRUD, permissions, document actions, approvals, communications, and all accounting lifecycle paths are not fully verified. |
| Board portal | PARTIAL | Guarded board surface exists. Read-only financial access, packets, approvals, meetings, communications, and forbidden manager actions require full role testing. |
| Owner portal | PARTIAL | Owner guard checks an active tenant-local owner record. Ledger visibility and several PDF reports were exercised; payments, requests, documents, architectural submissions, communications, and cross-unit isolation require testing. |
| Tenant portal | NOT VERIFIED | No independently certified tenant role/workflow has yet been demonstrated. The current owner/resident model must be reconciled with the promised tenant experience before claiming support. |
| Vendor portal | PARTIAL | Vendor guard checks an active tenant-local vendor record. Work orders, schedule, invoices, documents, messages, and cross-vendor isolation require end-to-end testing. |
| Core general ledger | PARTIAL | Trial balance, balance sheet, income statement, and general ledger PDF paths produced real outputs. Posting, reversal, close, audit trail, and accounting invariants need lifecycle tests. |
| A/R, charges, and delinquency | PARTIAL | A/R aging, delinquency detail, and delinquency summary PDFs produced real outputs. Charge creation, receipts, allocations, late fees, owner balances, and aging reconciliation require controlled fixtures and invariant checks. |
| A/P, bills, vendors, and checks | PARTIAL | A hardened staging lifecycle now proves tenant scope, atomicity, sequencing, balanced bill/check/void entries, immutable history, void, stop-payment, reissue, and run-scoped historical reprint logic. Visual stock/PDF evidence and signature authorization are not certified. The bills page explicitly advertises unfinished recurring bills, loans, and online payables. |
| Bank reconciliation and Plaid | BLOCKED | API routes exist. Safe sandbox credentials, linked test accounts, import/idempotency tests, and reconciliation invariants are required. |
| Report catalog and exports | PARTIAL | Seven required PDF outputs were generated through real auth/RPC/process/storage paths. The active catalog is much larger and contains definitions whose processors have not been proven; catalog presence is not treated as support. |
| Scheduled reports | NOT VERIFIED | UI, RPCs, queueing, and hourly cron route exist. Actual enqueue, generation, recipient delivery, retry, and tenant isolation need testing. |
| Stripe payments/autopay | BLOCKED | Webhook, reconcile, and autopay endpoints exist. Verification requires confirmed sandbox configuration, signature tests, idempotency, ledger matching, and failure recovery. |
| Email and notifications | BLOCKED | Resend-backed queue architecture exists and `hello@portier369.com` is the known working sender. Queue processing, templates, recipient scoping, bounces, retries, and every role notification need isolated verification. |
| Documents and storage | NOT VERIFIED | Upload/download surfaces exist. Bucket policy, malware/content constraints, visibility, signed URLs, deletion/archive behavior, and tenant isolation need tests. |
| Background automation | NOT VERIFIED | Seven Vercel schedules are configured and cron endpoints use a fail-closed secret helper in code. Successful hosted execution and downstream effects have not been evidenced. |
| AI assistants/extraction | BLOCKED | Multiple AI endpoints exist and depend on provider credentials. Authorization, privacy boundaries, malformed inputs, and deterministic failure handling require testing. |

## Verified deployed report evidence

The following outputs were previously exercised using real authentication, RPC execution, report processing, and storage. These are narrow report-path results, not certification of the surrounding modules.

| Output | Observed rows/items | Observed PDF bytes |
|---|---:|---:|
| Trial balance | 295 | 442,385 |
| Balance sheet | 112 | 148,178 |
| Income statement | 185 | 242,661 |
| General ledger | 0 | 3,525 |
| A/R aging | 12 | 28,593 |
| Delinquency detail | 4 | 10,683 |
| Delinquency summary | 1 | 6,535 |

The zero-row general-ledger result proves that a valid PDF was produced, not that populated-ledger content is correct. The next test dataset must generate non-empty, reconcilable accounting activity.

## Confirmed placeholders and overstatement risks

These are confirmed code findings and must be removed, completed, or visibly disabled before launch:

- `app/help/[...slug]/page.tsx` renders “Help center coming soon.”
- `app/(app)/bills/page.tsx` renders “Recurring bills coming soon,” “Loans coming soon,” and “Online payables coming soon.”
- `app/(app)/associations/_panel.tsx` contains hash-only advertised actions such as email board, share packets, create approval, create committee, create amenity, and edit association.
- `docs/placeholder-inventory.md` records 43 intentionally allowed placeholder links, including manager “new” workflows for G/L accounts, bank transfers, charges, fixed assets, forms, inspections, inventory, journal entries, letters, projects, purchase orders, recurring work orders, and surveys.
- `components/workspace/module-page.tsx` is an explicit reusable “Coming soon” component. No current import was found in the initial scan, so it is dormant rather than proof of a live placeholder page.
- The route-link audit permits documented placeholders. A passing route audit therefore means “known/allowlisted,” not “functional.”
- The report catalog contains substantially more active definitions than the currently proven report processors. Unimplemented reports must fail honestly or be removed from customer-facing availability; they must never return plausible invented data.

## Security and isolation observations

- Middleware refreshes Supabase sessions and redirects unauthenticated non-public requests.
- Role guards exist for platform operator, portfolio admin, staff, board, vendor, and owner.
- Owner and vendor guards fail closed when the tenant-local record is missing, archived, or not portal-activated.
- `LOCAL_PREVIEW_MODE` fabricates a platform-operator identity only outside production, and application startup throws if it is enabled in a production build.
- Public middleware exceptions include cron and webhook endpoints. Their route-level authentication must be verified individually; middleware publicity is not authorization.
- The schema has extensive RLS policy coverage, but a policy count is not a tenant-isolation test. Two isolated portfolios plus cross-tenant negative tests are required.
- Empty or swallowed error handlers were found in architectural attachments, task rails, architectural and insurance RPCs, AI/Piper, portal, communications, emergency, insurance, association detail, board, and platform-operator surfaces. Each needs triage so failures are observable without leaking sensitive information.

## External dependencies and configuration to verify

The code references Supabase, Resend, Stripe, Plaid, AI providers, rate limiting, cron authentication, and Vercel environment configuration. Secret values must never be copied into this document or committed. Required checks are presence, correct environment scoping, least privilege, rotation readiness, and safe failure when missing.

Seven hosted schedules are declared for maintenance reminders, insurance reminders, payment reconciliation, autopay, scheduled reports, late fees, and automation flows. Their declaration alone does not establish that they run successfully.

## Required isolated verification dataset

Before further claims, create reversible data identified by a unique `CODEX_TEST` run marker in staging (or another explicitly non-production project):

- two portfolios/management companies;
- at least two associations per portfolio;
- managers with distinct permission levels;
- board, owner/resident, tenant-if-supported, and vendor identities;
- units, ownership/occupancy, vendors, work orders, violations, architectural requests, documents, messages, meetings, and announcements;
- a balanced chart of accounts with opening balances, charges, receipts, allocations, bills, approvals, payments, checks, bank transactions, reconciliations, budgets, and period activity;
- current, 30/60/90+ day receivables so every delinquency bucket is non-empty;
- explicit expected totals used to verify trial balance, balance sheet, income statement, budget variance, owner ledger, A/R aging, delinquency reports, A/P aging, cash, and reconciliation.

The seed and cleanup routines must be idempotent, scoped only to the run marker, and refuse production unless a separate explicit safety confirmation is supplied. No cleanup may target unmarked records.

## Release gates

Portier369 remains **NO-GO** until all of the following have evidence:

1. Staging migration history matches the branch without unsafe drift.
2. Reversible `CODEX_TEST` fixtures cover two tenants and all supported roles.
3. Every advertised P0 workflow succeeds end to end, including failure and permission cases.
4. Cross-tenant reads and writes fail for every role and service boundary tested.
5. Accounting invariants reconcile and all required monthly statements export valid, readable PDFs with correct filters, dates, headings, totals, and page layout.
6. Check printing is exercised against an approved check format, with void/reprint/number controls and balanced ledger entries.
7. Stripe, Plaid, Resend, storage, cron, and webhook behavior is verified in safe non-production modes.
8. Placeholders and catalog-only reports are implemented, removed, or clearly disabled without misleading users.
9. TypeScript, lint, route audit, migration audit, secret scan, automated tests, production build, and role-based browser tests pass on the approved commit.
10. A final defects register, test matrix, reconciliation evidence, and production deployment/rollback checklist are reviewed before any merge to `main`.

## Audit work log

### Phase 1 — Inventory and initial truth classification

- **Inspected:** repository structure, route surfaces, API routes, auth middleware/guards, environment references, Vercel cron declarations, migration/RLS footprint, report evidence, and placeholder inventory.
- **Working:** build/CI baseline; deployed role resolution; seven narrowly scoped report PDF paths listed above.
- **Fake/disconnected:** confirmed coming-soon text, hash-only association actions, allowlisted placeholder routes, and report-catalog overstatement risk.
- **Repaired:** none in this phase; this phase establishes the factual baseline before mutation.
- **Remaining:** safe seed/cleanup tooling, staging drift check, full role matrix, accounting lifecycle/reconciliation, integrations, background jobs, storage, and every advertised P0 workflow.
- **Decisions:** production remains frozen; no merge to `main`; no feature expansion; presence is not treated as proof.

This document will be updated after each major verification and repair phase with exact tests, artifacts, commits, defects, and release decisions.

### Phase 2 — Isolated fixture harness (in progress)

- **Inspected:** inherited staging seed, report verifier, local environment-variable availability, and cleanup requirements.
- **Working:** the seed already refuses every project except staging ref `zalfkrtjeswvfmucicea` and requires an explicit staging confirmation; its accounting fixtures are deterministic and idempotently upserted.
- **Repaired:** fixture names/emails now carry a visible `CODEX_TEST` marker; an exact-ID, child-first cleanup command was added with independent staging-ref, marker-ownership, and cleanup-confirmation gates; staging variable names were documented without secrets.
- **Tests:** both scripts pass Node syntax checks; 124 automated tests and TypeScript pass; the repository secret scan passes; the strict 173-file migration check passes. The guarded seed executed successfully against staging and created two marked portfolios, two associations, six balanced entries, and twelve journal lines.
- **Defect found:** the first live report verification stopped because the seed registered 14 of 15 supported live report definitions; `delinquency_summary` was missing from the fixture catalog. The seed was repaired before rerunning verification.
- **Live staging result:** all 15 supported live-export processors executed after the repair. Trial balance debit/credit equality, balance-sheet equality, expected net income, every A/R aging bucket, partial-payment allocation, A/R-to-delinquency reconciliation, A/P 90+ aging, budget output, bank book balance, and cross-portfolio association rejection passed. Non-empty row counts were: trial balance 8, balance sheet 6, income statement 4, general ledger 6, A/R aging 5, delinquency summary 1, A/P aging 2, aged payables 2, aged-payables summary 2, budget variants 2 each, annual comparative 2, and bank reconciliation variants 1 each. Alpha A/R reconciled to $1,400 after a $100 partial payment, and the $999 Beta sentinel did not leak. Bank-reconciliation detail still returned zero rows and remains unverified until richer fixtures are added.
- **Regression note:** TypeScript and secret scanning passed. One full-suite run recorded 123/124 passing because the `LOCAL_PREVIEW_MODE` non-production module-load test exceeded its 5-second timeout under parallel load; the isolated file immediately passed 5/5 in 18 ms. This is recorded as a timing flake, not silently counted as a clean full-suite pass.
- **Role identity result:** nine staging identities now sign in through Supabase Auth and resolve through the real `me()` RPC: Platform Operator, Company Admin A/B, Manager A, Board A, Owner A/B, and Vendor A/B. Each tenant identity resolved its expected role linkage and portfolio and was denied a direct RLS read of the other marked portfolio. The platform operator resolved independently of a tenant and could read both marked portfolios, as required. This verifies authentication, primary role resolution, and one top-level isolation boundary; it does not yet certify every page/action permission.
- **Browser boundary:** an attempted local staging-backed browser server launch was rejected by the execution policy because the background process would inherit ephemeral service credentials. No credentials were persisted or exposed. Browser-visible route/action testing remains pending through a safely configured staging deployment or an approved credential-injection mechanism.
- **Check-run P0 repair:** the inherited database function allowed cross-portfolio bank/bill combinations for operators, accepted stale or reused starting numbers, did not reject duplicate IDs or already-paid bills, and the print page could include unrelated checks paid from the same bank on the same day. Migration `20260729010000_harden_check_runs.sql` was applied to staging and now validates the entire batch atomically, enforces bank portfolio/association, approved-unpaid state, positive amounts, exact next-number sequence, and unused check numbers, while removing anonymous execution. Print output is now loaded from the immutable check record and its database transaction grouping key, not mutable bill date/bank fields; voided and stopped historical copies are visibly watermarked. A real manager-authenticated staging test proved cross-tenant rejection with no partial mutation, duplicate rejection, check 5001 write, advancement to 5002, and replay rejection. The fixture was restored afterward.
- **Payable ledger repair:** migration `20260729020000_post_payable_bill_ledger.sql` was applied to staging. Bill approval now idempotently posts expense debit / Accounts Payable credit; check writing posts Accounts Payable debit / cash credit; voiding an unpaid approved bill posts an exact reversal. Source-type/source-ID uniqueness prevents duplicate lifecycle entries, and the UI actions call the atomic RPCs instead of directly changing status. A manager-authenticated staging run proved two posted entries and four lines for a $750 check, with each entry balancing $750 debit to $750 credit. Repeated approval returned the same accrual, and the unpaid void produced one reversal whose four combined lines netted to zero. Fixtures were restored after testing.
- **Immutable paid-check controls:** migrations `20260729030000_immutable_payable_checks.sql` and `20260729031000_secure_payable_check_void.sql` were applied to staging. Every issued check now has an immutable bank/check-number record, transaction grouping key, payment journal link, status, actor/timestamps, and void reason. Client roles receive read-only history; mutations go through an explicitly finance-authorized security-definer RPC. The bill page displays history and exposes reason-required Void Check and Stop Payment actions. A manager-authenticated staging test issued #5001, voided it with a balanced reversal, reopened the bill, reissued #5002, stopped it, and reissued #5003 while retaining all three statuses and consumed numbers. The deterministic fixture cleanup removed the test history and restored the baseline.
- **Check signing authorization:** migration `20260729032000_authorize_check_signing.sql` was applied to staging. The client-callable check RPC now requires explicit issuer acknowledgement and a configured bank signer label; its former four-argument implementation is no longer client-executable. Each immutable check snapshots the signer label and acknowledgement timestamp alongside `issued_by`. Existing bank accounts have an authorized-signer settings form, unconfigured accounts are disabled in the check-run selector, and printed checks show the signer reference while retaining a blank physical signature line. A real manager-authenticated staging run proved unacknowledged issuance is rejected and acknowledged issue/history/void/stop/reissue still pass; the fixture was restored afterward.
- **Check PDF and preview evidence:** a manager signed into the protected Vercel branch preview, selected one of two approved fixture bills, acknowledged authorization, issued check #5001, and reached the immutable one-check preview containing the expected payee, amount, amount-in-words, date, invoice, GL, signer label, and two voucher stubs. A new authenticated `Download PDF` route renders one US Letter page per immutable check. Its generated fixture artifact was inspected as both PDF metadata and a 144-DPI PNG: one 612x792-point page, three aligned panels, legible text, no clipping/overlap, and no broken glyphs. Two new PDF tests pass. The inherited fake MICR-like glyph line was removed; both preview and PDF now state that approved preprinted MICR stock is required.
- **Check lifecycle still open:** physical alignment against the customer's exact approved check stock and printer must still be calibrated before check printing is certified for production. An actual electronic-signature image is intentionally not auto-applied by this control.
- **Blocked:** the full requested role/workflow fixture matrix is not complete. Staging credentials were obtained ephemerally through the already-authenticated, staging-linked CLI and were neither displayed nor written to disk.
- **Remaining:** expand fixtures to the full role and workflow matrix (including the required second association per tenant), execute seed/cleanup against staging, verify cleanup leaves non-fixture data unchanged, then run real tenant-isolation and report tests.
