# Portier369 — Actual Build Status
*Audit date: 2026-06-13. This file reflects what is REALLY on disk and in the
database, to correct the stale checkbox state in EXECUTION_PLAN.md.*

> ⚠️ EXECUTION_PLAN.md is an aspirational AppFolio-parity checklist whose boxes
> were never updated as work shipped. Do NOT read its unchecked `[ ]` boxes as
> "not built." Use THIS file for ground truth.

## Reality check (verified 2026-06-13)
- **217 page files** exist across all roles.
- **Zero broken navigation links** — every sidebar link in every role resolves.
- Phase 1–5 "pages": 23 of 25 built; the other two exist under different names
  (`receivables` → `/charges`, `/bills/owner-payable`; `payables` → `/bills`).

## Accounting engine — VERIFIED CORRECT
- All 63 journal entries balance (debits = credits); enforced at the DB level by
  the `validate_journal_entry_balance` trigger — books cannot be saved unbalanced.
- `guard_closed_period` trigger blocks edits to closed accounting periods.
- Accounting equation nets to $0.00 for every association.
- Payment integrity clean: 0 over-applied charges, 0 over-applied payments,
  0 negative charges/payments.

## Built & wired (manager workspace)
Associations, Owners, Vendors, Units, Buildings, Work Orders, Maintenance,
Recurring WOs, Inspections, Projects, Purchase Orders, Fixed Assets, Violations,
Bank Accounts (+ deposits, reconcile, adjustments), Journal Entries,
Bank Transfers, GL Accounts, Charges, Bills (+ owner-payable), Budget,
Budget vs Actuals, Calendar, Meetings, Reports, Scheduled Reports, Statements,
Letters, Documents, Diagnostics, SMS/Communications.

## Role portals — all six live
Platform Operator, Company Admin, Manager, Board, Owner, Vendor.

## Genuine pre-launch work (not "missing pages" — depth & proving)
1. **Pilot with one real management company** before paid ads — run a full month
   of real dues, work orders, and a board cycle to shake out edge cases.
2. **Visual design migration** of app page bodies to v2 design system (in
   progress via Claude Code; board portal dark-theme flip is the biggest item).
3. **Email deliverability** — confirm Resend domain auth so invitations land
   (process-email-queue v8 deployed; suppresses seed domains).
4. **Legal review** of /legal/* pages by counsel before first paying client.
5. **Replace seed data** with the first real client's data.

## Do NOT mistake for incomplete
AI features, calendar, BYO-AI, platform-operator cockpit, invitation chain,
RLS tenant isolation — these are built and exceed the original AppFolio spec.
