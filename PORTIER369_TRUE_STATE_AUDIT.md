# Portier369 True-State Audit

**Audit branch:** `codex/portier369-stabilization`  
**Revalidated commit:** `a12c8f3e3cd602bc272810f35ac24d80a27c6d49`  
**Revalidation date:** 2026-07-31  
**Production database:** `termxngysvotnfbzbgrv` (read-only verification only)  
**Staging database:** `zalfkrtjeswvfmucicea`  
**Current recommendation:** **READY FOR CONTROLLED PILOT ONLY**

## Scope and evidence standard

This document records what the current repository and deployed verification evidence actually prove. It replaces the stale 2026-07-29 inventory; route existence, a successful build, or a rendered page is not treated as a completed workflow.

Required classifications:

- **WORKING AND VERIFIED** — the complete stated workflow was exercised through the real application and service boundary, with an observable result.
- **PARTIALLY WORKING** — meaningful connected implementation exists, but the complete workflow or all required variants have not been exercised.
- **FRONTEND ONLY** — UI exists without a connected durable backend operation.
- **MOCK OR FAKE** — the product presents fabricated data or success as real.
- **BROKEN** — the implemented workflow fails its required behavior.
- **NOT IMPLEMENTED** — the promised workflow does not exist.
- **BLOCKED BY CREDENTIALS OR EXTERNAL SERVICE** — code exists but safe end-to-end proof depends on unavailable external configuration.

No major module is currently classified **MOCK OR FAKE**. Current scans found no hard-coded sample responses, fake-success markers, TODO/FIXME markers, or hash-only links in application source. That is not proof that every workflow works; unexercised areas remain partial or not implemented.

## Current repository inventory

| Surface | Current count | Evidence boundary |
|---|---:|---|
| Next.js pages | 305 | Route files exist; workflow completion is separate |
| API route handlers | 31 | Endpoints exist; auth and side effects require tests |
| Server action files | 17 | Mutation entry points exist |
| Shared component files | 55 | UI implementation exists |
| Library files | 108 | Domain and integration code exists |
| Supabase migrations | 194 | All names/versions valid and unique on 2026-07-31 |
| `CREATE POLICY` statements | 550 | Broad RLS intent; not an isolation test |
| `ENABLE ROW LEVEL SECURITY` statements | 229 | Broad RLS activation; not proof of policy correctness |
| Automated test files | 56 | 186 tests passed on the revalidated commit |
| Vercel cron declarations | 8 | Hosted schedules exist; each downstream effect still needs evidence |

Role-area page counts: platform operator 20, company admin 23, manager/staff application 162, board 25, owner portal 31, and vendor portal 10. There is no distinct tenant portal route group.

## Current automated evidence

Commands run from the audit branch on 2026-07-31:

| Gate | Result | Evidence |
|---|---|---|
| Unit/integration suite | PASS | 56 files, 186 tests |
| TypeScript | PASS | `tsc --noEmit --incremental false` |
| ESLint | PASS WITH WARNINGS | 0 errors, 5 warnings |
| Route/placeholder audit | PASS | 0 placeholder links, 0 missing local routes |
| Source secret scan | PASS | no high-confidence current-source secrets |
| Migration audit | PASS WITH REVIEW ITEMS | 194 valid unique versions; eight legacy/manual-review findings |

The five lint warnings are three uses of raw `<img>` and two missing `alt` attributes. The migration audit warnings are not failures, but destructive/baseline/seed-like SQL must continue to receive manual review before any database push.

## True state by major module

| Module | Classification | What is proven | What is not yet proven |
|---|---|---|---|
| Authentication and role routing | PARTIALLY WORKING | Real sign-in and role-home resolution were previously exercised for operator, company admin, manager, board, owner, and vendor; automated login, recovery, invitation, disabled-session, redirect, and production preview-kill-switch tests pass. | Fresh staging acceptance, expiry, revocation, password recovery, deactivation, multi-role precedence, and every negative browser path have not been rerun in this audit phase. |
| Platform Operator | PARTIALLY WORKING | Guarded operator routes, user lifecycle logic, tenant metrics, and automated role-boundary tests exist. | Company create/suspend/reactivate, admin invitation, subscription/door counts, support controls, and system-health workflows need complete staging/browser evidence. |
| Company Admin | PARTIALLY WORKING | Guarded routes, association oversight, manager provisioning/assignment code, financial visibility, and automated company-admin boundary/lifecycle tests exist. | Full association onboarding, staff removal/reactivation, association switching, settings persistence, and company-level reporting need a fresh role sweep. |
| Property Manager / staff | PARTIALLY WORKING | The largest connected application surface exists. Core reports, check-run lifecycle, communications, document storage, manager assignment, and many authorization invariants have automated or prior staging evidence. | The requested owner/unit, work order, maintenance, violation/hearing, calendar, vendor, banking, and every financial mutation path have not all been exercised against the expanded deterministic fixture. |
| Board Member | PARTIALLY WORKING | Guarded board routes and read-only financial/report surfaces exist; prior preview verification reached financial, budget, delinquency, document, violation, and report views. | A complete negative-edit sweep, packets, approvals, meetings/minutes, maintenance calendar, and cross-association isolation need current staging evidence. |
| Owner | PARTIALLY WORKING | Owner guard fails closed without an active tenant-local owner. Ledger, report/PDF, document, work-order, communications, payment entry, architectural, violation, insurance, lease, and calendar surfaces exist. | Live Stripe payment, every upload/mutation, hearing request, cross-unit negative tests, and a complete role sweep need the expanded fixture. |
| Tenant | NOT IMPLEMENTED | The data model has occupancies and lease-related surfaces. | There is no independent tenant auth role or dedicated tenant portal with an owner-financial-data boundary. Do not market or certify a tenant portal until product rules and enforcement are implemented. |
| Vendor | PARTIALLY WORKING | Vendor guard fails closed without an active tenant-local vendor; work-order, schedule, invoice/document, payment, message, compliance, and profile surfaces exist. | Full status-update/upload lifecycle and cross-vendor/cross-association negative tests need staging evidence. |
| General ledger | PARTIALLY WORKING | Trial balance, balance sheet, income statement, general ledger exports, financial-calculation tests, balanced seed entries, and prior real report/PDF execution exist. | Period close/reopen, posting/reversal, backdated entries, concurrent mutations, audit-trail completeness, and full subledger-to-GL reconciliation are not certified. |
| A/R, charges, assessments, payments | PARTIALLY WORKING | Deterministic aging-bucket fixtures exist; A/R aging and delinquency exports previously ran; payment isolation and Stripe invariants are tested. | Complete assessment creation, offline receipt/posting/allocation/reversal, late fee, failed-payment, refund/dispute, and owner-ledger reconciliation need current database evidence. |
| A/P, bills, approvals, checks | WORKING AND VERIFIED | Staging verification and automated tests cover approval thresholds, tenant scope, atomic check numbering, balanced bill/check/void entries, immutable history, signature authorization, void, stop payment, reissue, run-scoped reprint, and check PDF generation. | Bank submission is intentionally not claimed; printed checks still require human visual/alignment validation on supported stock/printers. |
| Bank reconciliation | PARTIALLY WORKING | Manual bank accounts, transactions, completed reconciliation fixtures, report exporters, scoping tests, and fail-closed provider availability logic exist. | Full create/toggle/complete/reopen lifecycle and reconciliation invariants need rerun against expanded staging data. |
| Plaid bank import | BLOCKED BY CREDENTIALS OR EXTERNAL SERVICE | Guarded API routes and safe-unavailable behavior exist. | Sandbox link/import/webhook/idempotency and disconnect/reconnect cannot be certified without scoped Plaid sandbox credentials. |
| Stripe payments and autopay | BLOCKED BY CREDENTIALS OR EXTERNAL SERVICE | Connected-account scoping, webhook signature/idempotency, livemode checks, payout matching, and fail-closed code/tests exist. | Real sandbox checkout, SetupIntent/autopay, failure/retry/refund/dispute, and payout reconciliation require valid scoped Stripe configuration. |
| Report catalog and PDF/CSV/JSON exports | PARTIALLY WORKING | Fifteen accounting live exporters and eight scoped database-dispatch report families are implemented. Serialization, private storage, PDF output, monthly package, scheduled delivery, and storage tests pass; multiple real financial PDFs were previously generated. | The active database catalog may contain definitions outside those 23 supported families. Every active definition must be enumerated and executed; unsupported definitions currently fail honestly rather than invent data. XLSX is advertised in the seed definition list but the queue processor accepts only CSV, JSON, and PDF. |
| Scheduled reports | PARTIALLY WORKING | Queue processor, hourly cron route, retry/delivery code, auth tests, and scheduled-delivery tests exist. | A hosted schedule-to-email run with recipient delivery, retry, and cross-tenant negative evidence must be recorded. |
| Email and notifications | PARTIALLY WORKING | Resend queue architecture, worker, retry behavior, producers, cron authentication, and a production cron HTTP 200 have evidence. | Inbox delivery for every template/role, suppression, bounce/complaint handling, and recipient-scoping coverage remain incomplete. |
| Documents and storage | PARTIALLY WORKING | Private storage-path and generated-PDF tests pass; guarded upload/download surfaces exist. | Every visibility class, signed URL expiry, replacement/archive/delete path, content constraints, and cross-tenant download denial need role-level staging tests. |
| Work orders and maintenance | PARTIALLY WORKING | Manager/owner/vendor routes, server mutations, recurring jobs, vendor dispatch/status, labor/quote/message surfaces, and focused RPC tests exist. | Complete create-dispatch-update-close lifecycle, recurring generation, attachments, notifications, and unrelated-vendor denial need expanded fixtures. |
| Violations and hearings | PARTIALLY WORKING | Manager, board, owner, and public violation surfaces exist with security-oriented tests and filtering logic. | Notice/fine/hearing/decision lifecycle, evidence access, notification delivery, accounting impact, and unauthorized-edit denials need end-to-end proof. |
| Communications | PARTIALLY WORKING | Owner/staff delivery tests, recipient scoping, email queue integration, announcements/messages/letters surfaces, and prior staging communication checks exist. | Board/vendor variants, bulk failure handling, delivery receipts, reply/thread behavior, and all document attachments need complete evidence. |
| Calendar, meetings, and minutes | PARTIALLY WORKING | Manager, board, and owner calendar/meeting routes exist. | Creation, RSVP/attendance, visibility, minutes approval/publication, recurrence, and notification paths have not been certified. |
| Insurance and leases | PARTIALLY WORKING | Manager and owner routes/RPCs exist, with reminder cron declarations. | Upload/review/expiration/reminder flows, lease permission rules, tenant visibility, and current staging data are incomplete. |
| Background jobs and automation | PARTIALLY WORKING | Eight schedules are declared: email worker, maintenance reminders, insurance reminders, payment reconciliation, autopay, scheduled reports, late fees, and automation flows. Cron-auth, retry, and selected worker tests pass. | Successful hosted execution plus durable downstream evidence is incomplete for seven of the eight jobs. |
| Piper marketing assistant | BLOCKED BY CREDENTIALS OR EXTERNAL SERVICE | The public route validates input, caps request size/turns, uses persistent rate limits, loads maintained knowledge, captures leads, and queues email. Public-abuse tests pass. | A real DeepSeek conversation/tool-call and delivered lead notification require a valid provider key and live service response. |
| Internal AI assistants/extraction | BLOCKED BY CREDENTIALS OR EXTERNAL SERVICE | Role guards, request-size/rate guards, credential encryption, and failure handling exist. | Provider-specific output quality, privacy, cost, malformed-output recovery, and every role boundary require configured test providers. |

## Financial and data-integrity observations

- The schema uses numeric database columns for money; JavaScript presentation code still converts values to `number` in places. New financial mutations must keep arithmetic in database `numeric` values or integer minor units and must not introduce floating-point posting logic.
- Stripe webhook handling binds events to connected account, livemode, intent, and idempotency records. Automated invariants pass, but real sandbox webhook replay is still required.
- The payable/check flow has the strongest complete evidence in the product and is the only major business module currently upgraded to **WORKING AND VERIFIED**.
- Report output is private and signed. A produced PDF proves rendering, not accounting correctness; expected totals must be asserted for every seeded report.
- The current seed contains balanced entries and non-empty A/R/AP aging data, but it is too narrow to certify all subledgers and operational modules.

## Security and authorization observations

- The active root `middleware.ts` imports the shared `PUBLIC_PATHS` list, refreshes Supabase sessions, and redirects unauthenticated protected requests.
- A second, shorter `PUBLIC_PATHS` list remains in `lib/supabase/middleware.ts`; no importer was found. It is dead duplicate security code and should be removed or made to delegate to the shared source to prevent future drift.
- Public cron and webhook routes rely on route-level verification. Automated cron, webhook, and public-abuse tests pass, but each public/service-client route must remain in the API-boundary inventory.
- The repository contains 550 policy declarations and 229 RLS-enable statements. Counts show intent only; multi-tenant positive and negative tests are the release evidence.
- Twenty-three empty `catch` blocks were found. Several intentionally ignore non-critical local-storage, stream-cancel, JSON-parse, or cleanup errors; others on documents, insurance, communications, audit logs, support, and portal pages can hide operational failures. They require individual triage and observable error handling where user or data outcomes are affected.
- `LOCAL_PREVIEW_MODE` has a production kill switch covered by tests.

## Placeholder, disconnected, and fake-function scan

Current source scan results:

| Pattern | Result |
|---|---:|
| `TODO` / `FIXME` | 0 application findings |
| Hash-only links (`href="#"`) | 0 |
| Route-audit placeholders | 0 |
| Missing local routes | 0 |
| Mock/fake/sample-success markers | 0 material application findings |
| “not implemented” | 1 intentional report-processor error detector |
| Empty catch blocks | 23 occurrences requiring triage |

The prior audit's claims about a “Help center coming soon,” bills placeholders, association hash actions, and 43 allowlisted links are obsolete and are not carried forward.

## Environment and external dependencies

The application references Supabase, Resend, Stripe, Plaid, DeepSeek/AI-provider credentials, rate limiting, cron authentication, and Vercel URL/environment settings. Secret values must never be written to this document or committed.

Current credential-dependent release blockers:

- production/sandbox Stripe credentials and connected-account configuration for real payment/autopay verification;
- Plaid sandbox credentials for link/import/webhook verification;
- configured AI provider credentials for assistant/extraction certification.

Missing credentials must keep these features visibly unavailable and fail closed. They must never be replaced with fake success responses.

## Temporary fixture true state

Existing `scripts/seed-staging-verification.mjs` and `scripts/cleanup-staging-verification.mjs` are staging-ref gated, deterministic, and use fixed `CODEX_TEST_PORTIER369_V1` identifiers. Cleanup checks ownership and deletes exact IDs child-first.

What exists now:

- two portfolios and one association per portfolio;
- buildings, units, owners, owner occupancies, vendors, bank accounts, GL accounts, balanced entries, budgets, payable bills, charges/payments, bank transactions, and reconciliations;
- operator, company-admin, manager, board, owner, and vendor identities;
- current, 1–30, 31–60, 61–90, and 90+ receivable fixtures;
- tenant-isolation sentinels.

Required gaps before Phase 3 certification:

- create the required public entrypoints `scripts/seed-codex-test-data.mjs` and `scripts/cleanup-codex-test-data.mjs`;
- add at least a second association in the primary portfolio so company-admin and association-switching boundaries are testable;
- decide whether tenant support is in scope; the current auth model has no independent tenant role;
- seed work orders, maintenance tasks, violations, hearing requests, documents, announcements/messages, calendar events/meetings, insurance records, and lease records;
- record expected financial totals in machine-readable fixture output;
- ensure cleanup covers every added row by exact deterministic ID and refuses production.

## Phase 1 release gates

| Gate | State |
|---|---|
| Current repository inventory | COMPLETE |
| Placeholder/fake/TODO scan | COMPLETE |
| Current automated test/type/lint/route/secret/migration gates | COMPLETE |
| API/auth/RLS design inventory | PARTIAL — policy counts and guarded-route sampling complete; exhaustive endpoint matrix remains |
| Deterministic full-domain staging fixture | INCOMPLETE |
| All roles exercised against current fixture | INCOMPLETE |
| All active reports executed with expected totals | INCOMPLETE |
| Stripe/Plaid real sandbox verification | BLOCKED BY CREDENTIALS OR EXTERNAL SERVICE |
| Production-wide workflow certification | INCOMPLETE |

## Decision

Portier369 has substantial connected implementation and a healthy automated baseline. It is not a fake shell, and the currently deployed production build has passed build/CI and narrow smoke evidence. It is also not yet honest to certify the entire product as **READY FOR PRODUCTION**: the deterministic fixture does not cover the promised operational modules, tenant support is not implemented as a separate role, several integrations lack credentials, and the complete role/report/financial matrix has not been rerun.

The defensible current state is **READY FOR CONTROLLED PILOT ONLY** while the remaining phases expand the reversible staging fixture, execute role-by-role and report-by-report evidence, repair confirmed failures in P0–P3 order, and publish the remaining delivery records.

