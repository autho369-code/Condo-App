# Portier369 Remaining Blockers

**As of:** 2026-08-01  
**Release branch:** `codex/portier369-stabilization`

No tested workflow currently shows a known cross-tenant exposure or accounting imbalance. The following items still prevent an unconditional production release.

## Release blockers

### 1. Production migration and deployment approval

The stabilization migrations have been applied to staging only. Production was deliberately left unchanged. Before release:

1. Review the migration audit's nine flagged legacy/seed/delete statements.
2. Create a production backup and rollback point.
3. Apply only the approved migration manifest to production.
4. Merge the reviewed branch commit to `main`.
5. Deploy that exact commit and run read-only production smoke tests.

Owner decision required: approve the release window after the remaining functional gates below are accepted.

### 2. Payments and bank-provider integrations

Stripe and Plaid cannot be certified end-to-end without scoped sandbox/live configuration. Code-level guards, duplicate-payment invariants, webhook tests, and fail-closed provider behavior pass, but no claim is made that live online payments or bank feeds work.

Required:

- Configure Stripe Connect and webhook credentials in an isolated test environment.
- Run successful, failed, duplicate, refund, dispute, and reconciliation cases.
- Configure Plaid sandbox and test link, sync, webhook replay, disconnect, and reconnect.
- Keep the UI clearly unavailable when credentials are absent.

### 3. Tenant portal is not implemented

The data model supports tenant and lease contacts, but there is no independent tenant authentication role or dedicated tenant portal. Tenant access to owner financial data therefore cannot be certified.

Required owner decision: either remove tenant-portal claims from product/marketing scope or authorize a separately designed and secured tenant portal project. This is new-feature work and was intentionally not added during stabilization.

### 4. Remaining core mutation coverage

The role route sweeps and major repaired workflows pass, but the following complete browser/database lifecycles still need evidence before general availability:

- Association onboarding from creation through manager assignment and activation.
- Owner/unit creation, occupancy transfer, archive/reactivation, and duplicate handling.
- Assessment creation, offline payment posting/allocation/reversal, failed payment, refund, and chargeback reconciliation.
- Full bank-reconciliation create/toggle/complete/reopen lifecycle.
- Manager violation creation, notice, fine, hearing, decision, accounting impact, and closure.
- Work-order manager triage, dispatch, attachment, completion, and recurring generation.
- Amenity booking, calendar creation/recurrence, meeting attendance/minutes approval, and profile mutations.
- Insurance staff review, replacement/archive, and actual reminder delivery.

### 5. Report catalog mismatch

Fifteen accounting exporters and eight database-dispatch report families are implemented and tested. The active catalog still needs an exact enumeration against those supported families. Unsupported definitions fail honestly, but XLSX is advertised by seed/catalog data while the queue processor currently supports CSV, JSON, and PDF only.

Required: remove the XLSX claim or implement and verify XLSX, then execute every active report definition.

### 6. Hosted delivery evidence

Worker and retry logic pass staging verification, but external delivery still needs evidence for:

- Real Resend inbox delivery for each role/template.
- Bounce, complaint, suppression, and partial bulk-failure handling.
- Hosted cron invocation and durable downstream results for maintenance reminders, insurance reminders, payment reconciliation, AutoPay, late fees, and automation flows.

### 7. Physical check validation

The immutable check PDF is generated correctly and the accounting lifecycle passes. A human must still print on each supported check stock/printer combination and approve alignment, MICR placement, signature policy, and secure stock handling.

## Non-blocking but required before broad rollout

- Replace or explicitly justify the three raw-image lint warnings.
- Triage the remaining empty `catch` blocks where a user-visible or audit-critical failure could be hidden.
- Remove or delegate the dead duplicate `PUBLIC_PATHS` list in `lib/supabase/middleware.ts`.
- Add production observability/alert thresholds for failed workers, report runs, auth denials, and payment webhooks.
- Perform dependency remediation planning for the six vulnerabilities reported during Vercel installation; do not apply breaking `audit fix --force` changes without regression review.

