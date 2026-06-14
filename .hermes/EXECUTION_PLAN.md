# Portier369 Execution Railway

## Reference Documents (load first)
- `C:\Users\ailab\Downloads\AppFolio Accounting & Reporting System Architecture.md` — GL structure, transactions, reports, diagnostics
- `C:\Users\ailab\Downloads\AppFolio_System_Schematic__1_.md` — entity model (vendors §3.7, work orders §3.10, bank accounts §3.9, etc.)
- `C:\Users\ailab\Downloads\StellarOps_Platform_Guide.docx.md` — original Portier369 spec
- `C:\Users\ailab\OneDrive\Desktop\Portier369 layout..md` — page-by-page spec with LEFT pane nav + RIGHT TASK panel
- `C:\Users\ailab\OneDrive\Desktop\screen shots.md` — 194 AppFolio screenshots for UI parity

## Rules
- "Association" never "Property"
- "Owner" never "Homeowner"
- People = Owners + Vendors only
- Always match TASK panel items from layout doc
- Center panel content must match screenshots
- No demo data — real production data only
- Don't touch items we already built that exceed AppFolio (AI features, calendar integration, etc.)

## ⟹ STATUS RECONCILIATION (2026-06-14) — READ THIS FIRST
*The `[ ]` boxes below were never ticked as work shipped. Reality, reconciled against the 233 page files actually on disk:*

**Legend:** ✅ verified working with real data · 🔧 built, not yet verified · ❌ genuine gap

- **Phase 1 (Nav & Task Panels):** 🔧 — associations/owners/vendors + sub-pages all exist; TASK panels present. Needs item-by-item check vs the layout doc.
- **Phase 2 (Accounting):** 🔧 mostly — receivables (charges/bulk/recurring), payables (bills/check-run/owner-payable/recurring), bank-accounts (+feeds/reconcile/deposits/adjustments/activity), journal-entries, bank-transfers, gl-accounts, diagnostics all built. ✅ verified: GL chart, balanced journal entries, AR. Needs: reconcile flow, diagnostics correctness.
- **Phase 3 (Maintenance):** 🔧 — work-orders, recurring-work-orders, inspections, projects, purchase-orders, fixed-assets, inventory, unit-turns all exist. Unverified against data.
- **Phase 4 (Reports module):** 🔧 — reports, statements (send/bulk), letters, scheduled-reports, metrics, surveys, violations all exist.
- **Phase 5 (Reports engine):** 🔧 — 5 core statements render LIVE (trial_balance, balance_sheet, income_statement, cash_flow, general_ledger); 128 report_definitions seeded. Needs: confirm numbers are correct + per-role access.

**✅ Verified working this session (real Granville data):** manager dashboard, board portal financials/budget/delinquencies, owner portal, vendor portal, all persona logins.
**🔧 Bugs found & FIXED this session:** board financials RLS ($0→real), board delinquency owner names, owner-portal balance ($0→real A/R), budget expense actuals, tenant comms (SMS + email).
**❌ Genuine remaining gaps:** (1) per-page correctness verification across all modules (the bug class above recurs); (2) financial-report numbers not yet proven end-to-end; (3) visual parity vs the 194 AppFolio screenshots — **blocked: those files live at `C:\Users\ailab\…`, not on this machine**; (4) SMS provider not wired (Twilio at launch).

**Bottom line:** ~85% built structurally across all 5 phases. "Finishing" = verify + harden module-by-module against clean data, prove the reports, then visual parity — NOT a rebuild. Grind order: financial core → correctness sweep → Phase 1 panels → maintenance → visual parity.

---

## Phase 1: Navigation & Task Panels
- [ ] P1.1 Audit current sidebar vs layout doc — fix naming, missing links, dropdowns
- [ ] P1.2 Dashboard TASK panel — match layout doc items: Setup, Reports
- [ ] P1.3 Calendar TASK panel — match layout doc: Create event, etc.
- [ ] P1.4 Associations TASK panel — New Association, Meeting Sign-In, Violations Field Entry, Bulk Update Board Reports, Reports (Owner Directory, Unit Directory, Renter Directory, Dues Roll, General Ledger)
- [ ] P1.5 Owners TASK panel — Change Owner, Move In Owner, Email All Owners, Reports (Dues Roll, Owner Delinquency, Owner Directory, Owner Ledger)
- [ ] P1.6 Vendors TASK panel — New Vendor, Vendor ACH Setup, Request Documents, Request W-9, Reports (Vendor Directory, Vendor Ledger, Vendor Ledger Enhanced)

## Phase 2: Accounting Module (layout doc §6-12)
- [ ] P2.1 Receivables page — Receipts, Charges, Bank Deposits, Owner Delinquency, Chargeback Insights tabs. TASK panel: Owner Receipt, Vendor Receipt, Other Receipt, Owner Charge, Owner Credit, Bulk Charges, Apply Credits, Charge Late Fees, New Bank Deposit
- [ ] P2.2 Payables page — Bills, Payments, Recurring, Loans, Online Payables. TASK: Enter Bill, Smart Bill Entry, Pay Bills, New Recurring Bill, Bulk Board Approval, Reports (Aged Payables, Check Register, Bill Detail)
- [ ] P2.3 Bank Accounts page — New Bank Account, Bank Feed, Reconciliation, Close Period
- [ ] P2.4 Journal Entries — History, Recurring, Batches. TASK: New JE, Post GPR, New Recurring JE, Upload Batch
- [ ] P2.5 Bank Transfers — Incomplete Individual/Group, Completed, Activity
- [ ] P2.6 GL Accounts — Chart of accounts, Create new, Excel import
- [ ] P2.7 Diagnostics — Per AppFolio spec: Security Deposit mismatch, Escrow balance, Non-zero clearing, Bank reconciliation lapses

## Phase 3: Maintenance Module (layout doc §12)
- [ ] P3.1 Work Orders page — Match AppFolio WO layout. TASK: New Recurring WO, New Purchase Order. Reports: Association WO, Work Order, Labor Summary, Billable Detail
- [ ] P3.2 Recurring Work Orders — Per schematic §3.10
- [ ] P3.3 Inspections — New Inspection, Inspection Templates, Bulk Copy, Reports (Inspection Detail, Unit Inspection)
- [ ] P3.4 Unit Turns
- [ ] P3.5 Projects
- [ ] P3.6 Purchase Orders — Per schematic §3.11: line items, status workflow
- [ ] P3.7 Inventory
- [ ] P3.8 Fixed Assets

## Phase 4: Reports Module (layout doc §13)
- [ ] P4.1 Reports landing page — 1099s, Bulk Property→Association Reports, Management Fee History
- [ ] P4.2 Statements — Send Statements, Share Board Member, Packets, Bulk Update Statement Settings
- [ ] P4.3 Letters — Owner Portal Activation, Online Portal Activation
- [ ] P4.4 Scheduled Reports — Per AppFolio spec §4.2
- [ ] P4.5 Metrics + Surveys
- [ ] P4.6 Violations — New Violation, case management

## Phase 5: Reports Engine (AppFolio spec §4)
- [ ] P5.1 Accounting reports: Balance Sheet, Cash Flow, General Ledger, Income Statement, Trial Balance, Trust Account Balance
- [ ] P5.2 Association reports: Board of Directors, Dues Roll, Fund Balance Sheet, Owner Prepayment Balance, Violation Detail
- [ ] P5.3 Maintenance reports: Inspection Detail, Purchase Order, Work Order Billable Detail
- [ ] P5.4 Tax reports: Owner 1099 Detail, Vendor 1099 Detail
- [ ] P5.5 Transaction reports: Aged Payables, Check Register, Expense Register, Journal Entry Register
