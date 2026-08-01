# Portier369 True-State Audit

**Audit branch:** `codex/portier369-stabilization`  
**Revalidated commit:** `d541a9d`  
**Latest completed phase commit:** `d541a9d`  
**Revalidation date:** 2026-08-01  
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
| Library files | 110 | Domain and integration code exists |
| Supabase migrations | 199 | All names/versions valid and unique on 2026-08-01 |
| `CREATE POLICY` statements | 550 | Broad RLS intent; not an isolation test |
| `ENABLE ROW LEVEL SECURITY` statements | 229 | Broad RLS activation; not proof of policy correctness |
| Automated test files | 61 | 203 tests passed after the latest owner-workflow repair |
| Vercel cron declarations | 8 | Hosted schedules exist; each downstream effect still needs evidence |

Role-area page counts: platform operator 20, company admin 23, manager/staff application 162, board 25, owner portal 31, and vendor portal 10. There is no distinct tenant portal route group.

## Current automated evidence

Commands run from the audit branch on 2026-08-01:

| Gate | Result | Evidence |
|---|---|---|
| Unit/integration suite | PASS | 61 files, 203 tests |
| TypeScript | PASS | `tsc --noEmit --incremental false` |
| ESLint | PASS WITH WARNINGS | 0 errors, 3 warnings |
| Route/placeholder audit | PASS | 0 placeholder links, 0 missing local routes |
| Source secret scan | PASS | no high-confidence current-source secrets |
| Migration audit | PASS WITH REVIEW ITEMS | 199 valid unique versions; legacy/manual-review findings require release review |

The three lint warnings are deliberate raw `<img>` uses for tenant-configured logos and signed violation evidence whose remote origins are not fixed at build time. The migration audit warnings are not failures, but destructive/baseline/seed-like SQL must continue to receive manual review before any database push.

## True state by major module

| Module | Classification | What is proven | What is not yet proven |
|---|---|---|---|
| Authentication and role routing | PARTIALLY WORKING | Fresh staging sign-in and role-home resolution were exercised for operator, company admin, manager, board, owner, and vendor. Login, recovery, invitation ownership/replay, disabled-session revocation, redirects, production preview kill switch, and tenant isolation tests pass. | Password-recovery email delivery, invitation expiry, every multi-role precedence variant, and every negative browser path have not all been rerun. |
| Platform Operator | PARTIALLY WORKING | All 17 operator navigation routes render on the current preview. Admin-only role lifecycle, enum rejection, canonical role mapping, scope cleanup, audit trail, platform metrics, and role boundaries pass staging verification. | Complete company create/suspend/reactivate, subscription mutation, support resolution, and system-health control workflows need supervised browser/database evidence. |
| Company Admin | PARTIALLY WORKING | All 22 company-admin navigation routes render Alpha-only. Manager invitation, email ownership, atomic association scope, duplicate normalization, tenant denial, role denial, restoration, financial visibility, and cross-tenant API denials pass staging verification. | Full association onboarding, staff removal/reactivation, association switching, settings mutation, and company-level report execution need complete browser/database evidence. |
| Property Manager / staff | PARTIALLY WORKING | The manager preview sweep now covers accounting/report routes, bills/checks, communications, documents, calendar, vendors, units, diagnostics, and supporting operations. Fifteen live reports, the monthly financial PDF, approval/check lifecycles, and tenant-local unit balances have current staging evidence. | Every create/update/delete path for owners, maintenance, violations/hearings, calendar, inventory, amenities, and association onboarding has not yet been exercised through the browser. |
| Board Member | PARTIALLY WORKING | All 19 board navigation routes render Alpha-only on the current preview. Financial, budget, delinquency, homeowner, violation, maintenance, document, insurance, report, and calendar views load; manager-route access redirects to `/board`; a direct Beta violation is not accessible; API mutation denials pass. | Complete approval/signature, meeting attendance/minutes publication, packet, and every negative-edit variant still need browser/database evidence. |
| Owner | PARTIALLY WORKING | All 21 owner routes render against the current fixture with correct $1,400 balance/$100 payment evidence and no Beta tenant sentinel. Direct manager and Beta-unit URLs redirect to the owner home. Owner messaging authentication, validation, idempotency, throttling, history, queue traceability, and tenant isolation pass live staging verification. A deployed owner hearing request persisted the reason/timestamp and moved the violation to `hearing_pending`; a deployed service request persisted its unit, owner, priority, access permission/notes, and owner cancellation. A real HO6 PDF upload persisted the policy, private storage object, and association-record document row, with exact cleanup after verification. | Live Stripe payment remains credential-blocked; amenity booking and every profile mutation still need browser/database evidence. |
| Tenant | NOT IMPLEMENTED | The data model has occupancies and lease-related surfaces. | There is no independent tenant auth role or dedicated tenant portal with an owner-financial-data boundary. Do not market or certify a tenant portal until product rules and enforcement are implemented. |
| Vendor | WORKING AND VERIFIED | All nine vendor navigation routes render with only Vendor A's assigned Alpha property/work order. Manager-route access redirects and a direct Vendor B work-order request returns 404 without data. Deployed UI tests completed real private compliance/invoice PDF uploads; Supabase confirmed exact amount, pending-approval enforcement, document traceability, and cleanup. A vendor message and status update created the expected rows and owner notification, then the exact test rows were removed and the fixture status restored. The adversarial verifier also proves unauthorized owner rejection, cross-vendor work-order rejection, duplicate prevention, and Vendor B read isolation. | External payment timing remains controlled by management; no vendor action can approve or mark its own invoice paid. AI assistant quality remains credential-blocked. |
| General ledger | PARTIALLY WORKING | Trial balance, balance sheet, income statement, general ledger exports, financial-calculation tests, balanced seed entries, and prior real report/PDF execution exist. | Period close/reopen, posting/reversal, backdated entries, concurrent mutations, audit-trail completeness, and full subledger-to-GL reconciliation are not certified. |
| A/R, charges, assessments, payments | PARTIALLY WORKING | Deterministic aging-bucket fixtures exist; A/R aging and delinquency exports previously ran; payment isolation and Stripe invariants are tested. | Complete assessment creation, offline receipt/posting/allocation/reversal, late fee, failed-payment, refund/dispute, and owner-ledger reconciliation need current database evidence. |
| A/P, bills, approvals, checks | WORKING AND VERIFIED | Staging verification and automated tests cover approval thresholds, tenant scope, atomic check numbering, balanced bill/check/void entries, immutable history, signature authorization, void, stop payment, reissue, run-scoped reprint, and check PDF generation. | Bank submission is intentionally not claimed; printed checks still require human visual/alignment validation on supported stock/printers. |
| Bank reconciliation | PARTIALLY WORKING | Manual bank accounts, transactions, completed reconciliation fixtures, report exporters, scoping tests, and fail-closed provider availability logic exist. | Full create/toggle/complete/reopen lifecycle and reconciliation invariants need rerun against expanded staging data. |
| Plaid bank import | BLOCKED BY CREDENTIALS OR EXTERNAL SERVICE | Guarded API routes and safe-unavailable behavior exist. | Sandbox link/import/webhook/idempotency and disconnect/reconnect cannot be certified without scoped Plaid sandbox credentials. |
| Stripe payments and autopay | BLOCKED BY CREDENTIALS OR EXTERNAL SERVICE | Connected-account scoping, webhook signature/idempotency, livemode checks, payout matching, and fail-closed code/tests exist. | Real sandbox checkout, SetupIntent/autopay, failure/retry/refund/dispute, and payout reconciliation require valid scoped Stripe configuration. |
| Report catalog and PDF/CSV/JSON exports | PARTIALLY WORKING | Fifteen accounting live exporters and eight scoped database-dispatch report families are implemented. Serialization, private storage, PDF output, monthly package, scheduled delivery, and storage tests pass; multiple real financial PDFs were previously generated. | The active database catalog may contain definitions outside those 23 supported families. Every active definition must be enumerated and executed; unsupported definitions currently fail honestly rather than invent data. XLSX is advertised in the seed definition list but the queue processor accepts only CSV, JSON, and PDF. |
| Scheduled reports | PARTIALLY WORKING | Queue processor, hourly cron route, retry/delivery code, auth tests, and scheduled-delivery tests exist. | A hosted schedule-to-email run with recipient delivery, retry, and cross-tenant negative evidence must be recorded. |
| Email and notifications | PARTIALLY WORKING | Resend queue architecture, worker, retry behavior, producers, cron authentication, and a production cron HTTP 200 have evidence. | Inbox delivery for every template/role, suppression, bounce/complaint handling, and recipient-scoping coverage remain incomplete. |
| Documents and storage | PARTIALLY WORKING | Private storage-path and generated-PDF tests pass; guarded upload/download surfaces exist. Real vendor compliance, vendor invoice, and owner HO6 PDFs were uploaded through deployed signed-upload workflows and verified in private storage plus their exact database records. | Every visibility class, signed URL expiry, replacement/archive/delete path, content constraints, and cross-tenant download denial need role-level staging tests. |
| Work orders and maintenance | PARTIALLY WORKING | Manager/owner/vendor routes, server mutations, recurring jobs, vendor dispatch/status, labor/quote/message surfaces, and focused RPC tests exist. A deployed owner service request persisted and cancelled correctly, while the vendor status/message workflow created the expected activity and owner notification with unrelated-vendor denial. | Complete manager triage/dispatch-to-close lifecycle, recurring generation, attachments, and notification delivery need expanded evidence. |
| Violations and hearings | PARTIALLY WORKING | Manager, board, owner, and public violation surfaces exist with security-oriented tests and filtering logic. A deployed owner request persisted its reason/timestamp, entered the hearing queue, rejected unrelated owners/vendors, and prevented replay. | Notice/fine/decision lifecycle, evidence access, notification delivery, accounting impact, and unauthorized staff/board edit denials need end-to-end proof. |
| Communications | PARTIALLY WORKING | Live staging checks now pass for owner and staff authentication, validation, tenant derivation, idempotency, throttling, atomic queueing, traceability, honest delivery state, worker claims, retry backoff, completion reconciliation, and terminal failure. | Board/vendor variants, real Resend inbox delivery, bounce/complaint handling, bulk partial failures, and attachment delivery remain incomplete. |
| Calendar, meetings, and minutes | PARTIALLY WORKING | Manager, board, and owner calendar/meeting routes exist. | Creation, RSVP/attendance, visibility, minutes approval/publication, recurrence, and notification paths have not been certified. |
| Insurance and leases | PARTIALLY WORKING | A deployed owner HO6 workflow now uploads a real PDF directly to private storage and atomically files the policy plus supported `ho6` association-document record. The previously silent document constraint failure was repaired, regression-tested, re-deployed, and re-verified against staging. Manager/owner routes and reminder cron declarations exist. | Staff review, expiry/reminder delivery, replacement/archive paths, lease permission rules, and tenant visibility remain incomplete. |
| Background jobs and automation | PARTIALLY WORKING | Eight schedules are declared. Live staging verifies email-worker authorization/atomic claims/retries/completion, automation concurrency cooldown/partial retry/outcome preservation/attempt ceiling, and scheduled-report recovery/recipient normalization/replay idempotency/portfolio queue scope. | Hosted cron execution and durable downstream evidence remain incomplete for maintenance reminders, insurance reminders, payment reconciliation, autopay, late fees, and automation-flow scheduling. |
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
- Twenty-three empty `catch` blocks were originally found. The owner-insurance document-filing suppression has been removed and now compensates by deleting the policy row and uploaded object on failure. Several remaining blocks intentionally ignore non-critical local-storage, stream-cancel, JSON-parse, or cleanup errors; others on documents, communications, audit logs, support, and portal pages still require individual triage and observable error handling where user or data outcomes are affected.
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

Canonical `scripts/seed-codex-test-data.mjs` and `scripts/cleanup-codex-test-data.mjs` delegate to the staging-ref-gated deterministic harness. It uses fixed `CODEX_TEST_PORTIER369_V1` identifiers. Cleanup checks fixture ownership and deletes exact IDs child-first; derivative audit and email rows are removed only when tied to the exact fixture users or portfolios.

What exists now:

- two portfolios, with two associations in the primary portfolio and one cross-company isolation association;
- buildings, units, owners, owner occupancies, vendors, bank accounts, GL accounts, balanced entries, budgets, payable bills, charges/payments, bank transactions, and reconciliations;
- operator, company-admin, manager, board, owner, and vendor identities;
- a manager-side tenant/lease/insurance contact without an unsupported tenant auth identity;
- work orders, maintenance tasks, hearing-pending violations, private documents, announcements, calendar events, meetings/minutes, and insurance policies in both isolation scopes;
- current, 1–30, 31–60, 61–90, and 90+ receivable fixtures;
- tenant-isolation sentinels and machine-readable expected accounting totals.

Phase 2 live evidence:

- production-ref seed and cleanup guards were executed and refused before any network request;
- the seed ran twice unchanged against staging and returned identical counts;
- the fixture verifier confirmed two portfolios, three associations, ten supported-role auth users, one tenant/lease contact, twenty-five operational sentinel rows, two configured/reconciled bank accounts, and two private document rows backed by a real PDF object;
- cleanup initially exposed and then repaired three root causes: the `board_approval_settings` key is `association_id`, fixture profiles must be removed before auth users, and verification-created audit/email rows must be removed by exact fixture identity/portfolio scope;
- the repaired cleanup completed, and a separate absence check confirmed zero fixture portfolios, auth users, or document objects;
- the fixture was reseeded and verified successfully for Phase 3;
- 61 test files / 203 tests, TypeScript, route audit, secret scan, and migration audit pass; lint has three existing image-optimization warnings and zero errors.

Remaining fixture limitation: an independent tenant portal identity is intentionally absent because `getMe()` has no `tenant_id`, tenant guard, or tenant home route. Tenant contact and lease management can be tested by staff; tenant portal access cannot be certified.

## Phase 1 release gates

| Gate | State |
|---|---|
| Current repository inventory | COMPLETE |
| Placeholder/fake/TODO scan | COMPLETE |
| Current automated test/type/lint/route/secret/migration gates | COMPLETE |
| API/auth/RLS design inventory | PARTIAL — policy counts and guarded-route sampling complete; exhaustive endpoint matrix remains |
| Deterministic full-domain staging fixture | COMPLETE for supported roles; tenant contact seeded, tenant portal auth not implemented |
| All roles exercised against current fixture | INCOMPLETE |
| All active reports executed with expected totals | INCOMPLETE |
| Stripe/Plaid real sandbox verification | BLOCKED BY CREDENTIALS OR EXTERNAL SERVICE |
| Production-wide workflow certification | INCOMPLETE |

## Decision

Portier369 has substantial connected implementation and a healthy automated baseline. It is not a fake shell: the reversible fixture covers the supported roles and core accounting/operational sentinels, all role-navigation sweeps have current evidence, fifteen financial exports and the monthly PDF pass, and the strongest owner/vendor/payable workflows were verified through deployed UI and durable staging records. Production remains on its prior code and database state.

It is still not honest to certify unrestricted production release: tenant portal access is not implemented, several paid integrations lack credentialed evidence, multiple P1 mutation lifecycles remain partial, hosted delivery evidence is incomplete, and the stabilization migrations have not received production approval. The defensible current state is **READY FOR CONTROLLED PILOT ONLY**, subject to the explicit blockers and release checklist in the companion delivery records.
