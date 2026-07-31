# True application state

Evidence date: 2026-07-31. Branch: `codex/portier369-stabilization`. Staging contains reversible two-association `CODEX_TEST` fixtures. Production remained frozen. `VERIFIED WORKING` means the listed scope was executed; it is not a blanket claim about every edge case.

| Module | Verified state | Evidence | Remaining production gate |
| --- | --- | --- | --- |
| Release | VERIFIED WORKING | 168 tests / 51 files, TypeScript, lint without errors, route/dashboard audits, migration validation, secret scan, build, GitHub CI, and Vercel pass. | Keep checks required on the approved release commit. |
| Database migrations | VERIFIED WORKING locally/staging | 188 valid unique versions; empty local reset replayed all migrations; linked staging is current. | Restore a production backup into a disposable environment and rehearse rollback. |
| Authentication/routing | VERIFIED for six personas | Six role sessions and stale-token revocation pass; manager invite applied exact scope once; replay/mismatch denied; invitation/reset limits and failed-email rollback are implemented. | Verify recovery/invitation controls in deployed browser/provider and decide any tenant persona. |
| Tenant isolation | VERIFIED for tested reads/routes/mutations | Two-portfolio RLS, route/direct-ID, service-only RPC ACL, and forbidden Manager/Admin/Board/Owner/Vendor mutation verifiers pass. | Complete remaining invitation/reset and per-workflow signed-capability attacks. |
| Platform Operator | PARTIALLY VERIFIED | Correct operator home and cross-portfolio verifier pass. | Execute create/disable/impersonation workflows and audit evidence. |
| Company Admin | PARTIALLY VERIFIED | Correct home, portfolio-A-only data, working manager assignment form, tenant-B route/API mutations denied, stale token revoked. | Execute invite/disable/reassign lifecycle and invitation/reset abuse. |
| Property Manager | PARTIALLY VERIFIED | Scoped dashboard, bills, reports, help, Balance Sheet/export, tenant-B direct-ID/API denial, service-RPC denial, and stale-token revocation pass. | Complete association onboarding, remaining writes, and signed-capability isolation. |
| Board | PARTIALLY VERIFIED | Dashboard, financials, $1,400 delinquency, manager-surface denial, association-mutation denial, and stale-token revocation pass. | Exercise approvals/signatures in browser and cross-entity signature capability attacks. |
| Owner | PARTIALLY VERIFIED | Dashboard, $1,400 balance, ledger, communications, charge-mutation denial, role/run boundaries, and stale-token revocation pass. | Exercise payments, requests, uploads, multi-unit scope, and reset abuse. |
| Tenant | NOT VERIFIED / SUPPORT DECISION REQUIRED | Occupancy schema contains tenant concepts, but no distinct tested tenant portal persona is established. | Define whether Tenant is a launch role; implement and test or explicitly remove from launch scope. |
| Vendor | PARTIALLY VERIFIED | Scoped dashboard, two approved unpaid bills totaling $1,175, work orders, payable-mutation denial, role/run boundaries, and stale-token revocation pass. | Exercise assigned-work updates, signed uploads, Vendor B capability denial, and reset abuse. |
| Financial statements | VERIFIED for staged core statements | Balance Sheet rendered and tied at $17,400 = $17,400; Trial Balance, Income Statement, A/R and A/P aging logic/export tests pass. | Reconcile every supported period/scope/export to controlled journals and control accounts. |
| Report PDF storage | VERIFIED for Balance Sheet | Private `reports` bucket migrated; queued run succeeded; 12,113-byte `%PDF-` downloaded by signed URL; public-bucket URL returned 400; lower roles could not open run page. | Test retention, expiry, scheduled-recipient authorization, and every supported format/report. |
| Report catalog | PARTIALLY WORKING | Catalog routes render and unsupported queued data sources fail honestly; core exports are implemented. | Implement/reconcile catalog-only reports or keep them visibly unavailable. |
| Bills/approvals/checks | VERIFIED in staged workflow | Manager-to-board approval lifecycle, signing, balanced accrual, check authorization/immutability, and generated check PDF pass. | Provider/bank operational approval and production configuration remain external gates. |
| Stripe | CONFIGURATION REQUIRED | Association-scope, atomic ledger posting, idempotency, and autopay isolation tests pass. | Two-association Stripe test-mode onboarding, signed webhooks, duplicates/order, failures, refunds/disputes, payouts, and GL tie-outs. |
| Plaid/reconciliation | CONFIGURATION REQUIRED | Protected implementation and bank export/reconciliation code exist. | Plaid sandbox sync, exact/partial/unmatched/duplicate/failure cases, and journal/bank tie-out. |
| Documents | PARTIALLY VERIFIED | Migration-managed private bucket; signed PDF upload/download, cross-association token denial, expiry, public/unsigned/MIME denial, and two-path cleanup pass. | Complete remaining workflow-specific capability issuance and report retention tests. |
| Communications | VERIFIED in staging; provider gate open | Owner/staff message persistence, queueing, retry state, and generated-document tests pass. | Confirm Resend test-domain delivery and failure/complaint behavior; choose/test SMS provider or mark unsupported. |
| Background jobs | VERIFIED in staging; operations gate open | Email worker, scheduled report recovery, automation retries, concurrency recovery, and cron-auth tests pass. | Validate deployed schedules, alert delivery, rate limits, provider failures, and notification suppression. |
| Placeholder removal | VERIFIED WORKING | Route audit reports zero placeholders; linked help topics contain real guidance; unsupported help slugs return 404. | Continue truthful UI review as workflows are added. |
| Audit/recovery | PARTIALLY WORKING | Audit migrations/tests exist and clean migration replay passes. | Prove audit tamper resistance, production backup restoration, rollback, and monitoring. |
| Production configuration | NOT VERIFIED | Preview is staging-backed and passes; production values/data were intentionally untouched. | Validate presence, environment separation, modes, ownership, cron, and monitoring without printing secrets. |

## Architecture and tenancy map

`Browser/UI → Supabase session guards → server components/actions and API routes → RLS-scoped Supabase queries → PostgreSQL/storage`.

Elevated paths use server-only service credentials for cron jobs, provider webhooks, AI configuration, report processing, and selected platform operations. Those paths must derive and validate tenant scope before elevation.

Tenancy hierarchy: `Platform Operator → Management Company/Portfolio → Company Administrator/Property Manager → Association → Building → Unit → Owner/Tenant`. Board membership is association-scoped; vendor access is assignment-scoped; Stripe Connect is association-scoped.
