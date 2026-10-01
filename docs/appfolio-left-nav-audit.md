# AppFolio left navigation — page-by-page audit (2026-10-01)

Every link in AppFolio's left navigation (stellarpropertygrp.appfolio.com,
walked read-only on 2026-10-01), what opens in the center, and the Portier369
equivalent. Structure only, no customer data.

Legend: ✅ in Portier · 🟡 partial · ❌ missing · ➖ out of scope (rental/leasing,
corporate books — skipped by Mirsad 2026-10-01)

## Navigation map

| AppFolio section → link | What opens in the center (AppFolio) | Right-panel tasks (AppFolio) | Portier | Status |
|---|---|---|---|---|
| Dashboard | KPI cards, portal adoption, upcoming activities | Calendar, New Property, Homeowner Receipt, Enter Bill, New Vendor, Dues Increase; report shortcuts | /dashboard, /command-center | ✅ |
| Calendar → Association Calendar | Month/Week/Day/Agenda calendar; filter by association and event type (Administrative, Announcements, Maintenance, Meetings, Social); Create Event | — | /calendar | ✅ |
| Calendar → Property Calendar | Rental property calendar | — | — | ➖ |
| Associations → Associations | List (name, address, units); hidden associations toggle | New Property, Corporate Entity, Meeting Sign-In, Violations Field Entry, Bulk Board Reports | /associations | ✅ |
| Associations → Corporate Entities | Management-company books | — | — | ➖ (skipped) |
| People → Homeowners | A–Z directory: name, association, unit, phone | Change Homeowner, Move In Homeowner, New Vendor, Email All Homeowners; reports Dues Roll, Delinquency, Directory, Ledger | /owners | ✅ |
| People → Owners | Rental owners (owner packets, ACH, management agreements) | — | — | ➖ |
| People → Vendors | Search by vendor and trade, more filters | New Vendor, Vendor ACH Setup, Request Documents, Request W-9; reports Directory, Ledger | /vendors | ✅ |
| Accounting → Receivables | Tabs Receipts · Charges · Bank Deposits · Homeowner Delinquencies · Chargeback Insights | Homeowner Receipt, Vendor Receipt, Other Receipt, Subsidy Receipts, Homeowner Charge, Bulk Charges and Credits, Bulk Recurring Charges, Homeowner Credit, Apply Credits, Common Charge, Charge Late Fees, New Bank Deposit, Lockbox, Debt Collections, eCheck Fee Settings | /charges (tabs), /receipts, /payments, /delinquencies, /lock-boxes | ✅ |
| Accounting → Payables | Tabs Bills · Payments · Recurring · Loans · Online Payables; bill status filter All/Pending Approval/Pending My Approval/On Hold/Approved | Enter Bill, Smart Bill Entry, Enter Credit, Pay Bills, Pay Management Fees, Homeowner Payable, Transfer Between Cash Accounts, Recurring Bill, Manually Post Bills, Upload Bulk Bills, Bulk Board Approval | /bills, /bills/check-run, /accounting/loans, /accounting/management-fees | ✅ (Online Payables needs payment provider) |
| Accounting → Financial Accounts | Tabs Bank Accounts · **Credit Card Accounts** · Banking with Column; bank list with last reconciliation, payments enabled, auto-reconciliation | New Bank Account, New Bank Deposit, Bank Feed, Reconcile, Close Accounting Period, Link With Bank | /bank-accounts, /accounting-periods, /credit-cards | ✅ (credit card accounts added) |
| Accounting → Journal Entries | Tabs History · Recurring · Batches; filter by association, GL, reference, dates | New JE, Recurring JE, Upload JE Batch, View Batches, Manually Post | /journal-entries | ✅ |
| Accounting → Bank Transfers | Incomplete / Completed transfers; transfer individually or as group | — | /bank-transfers | ✅ |
| Accounting → GL Accounts | Chart of accounts (account, type) | New GL Account, GL Account Map, Manage GL Account Permissions, Recalculate Balances | /gl-accounts | ✅ |
| Accounting → Diagnostics | 9 checks (see below) | — | /diagnostics | 🟡 compare checks |
| Maintenance → Work Orders | KPI strip (unassigned resident requests, unassigned internal, ready to bill), filters, bulk actions, saved filters | New Recurring WO, New PO; reports Association WO, Labor Summary, Billable Detail | /work-orders, /service-requests | ✅ |
| Maintenance → Recurring Work Orders | Vendor, properties, repeats, description | New Service Request, New Recurring WO | /recurring-work-orders | ✅ |
| Maintenance → Inspections | List with status, flags, bulk Mark Done | New Inspection, Inspection Template, Bulk Copy | /inspections | ✅ |
| Maintenance → Unit Turns | Rental make-ready | — | /unit-turns | ➖ |
| Maintenance → Projects | Name, property, total budget, actuals, start date, status | Add Project, Cost Categories | /projects | ✅ |
| Maintenance → Purchase Orders | Filters (association, vendor, GL, dates, approval, completed, submitted); status tabs | New PO, Recurring PO, Recurring PO Templates | /purchase-orders | ✅ |
| Maintenance → Inventory | Items (name, quantity, reorder, category, location) | Add Item, Bulk Add, Manage Locations, Manage Categories; reports Inventory Status, Inventory Usage | /inventory | 🟡 reports missing |
| Maintenance → Fixed Assets | Property/unit, asset ID, type, status, in service, warranty | Add Fixed Asset | /fixed-assets | ✅ |
| Maintenance → Maintenance Performer | AI maintenance triage | — | smart intake (#70) | ✅ |
| Reporting → Reports | Report catalog (see below) + Report Builder + saved reports | — | /reports, /reports/builder | 🟡 see report table |
| Reporting → Scheduled Reports | List + New Scheduled Report | — | /scheduled-reports | ✅ |
| Reporting → Metrics | Pricing (rental), Business Metrics, Data Diagnostic | — | /metrics | ✅ (pricing ➖) |
| Reporting → Surveys | Maintenance survey Responses / Analysis / Settings | — | /surveys | ✅ |
| Reporting → Compliance | Violations (filters, bulk follow-up, mark corrected, download) · Architectural Reviews | New Violation, Rules & Regulations, Bulk Create/Copy Rules | /violations, /architectural-reviews | ✅ |
| Communication → Letters | Letter templates by category (association, …) | 1099s, New Association Letter, New Vendor Letter, Owner Packets, Statements, Portal Activation letters | /letters, /statements | ✅ |
| Communication → Forms | PDF Form Templates · Resident Forms · Owner Forms | New PDF Form Template | /forms | ✅ |
| Communication → Inbox | Two-way text/email inbox, bulk message, text templates | My Texting Settings, Text Templates, Email Templates | /inbox | 🟡 SMS blocked on Twilio KYC |
| Communication → Mentions | Notes where you were @mentioned; My Notes | — | record notes (#59) | ✅ |

## Missing AppFolio functions (to build)

1. **Homeowner payment plans**: installment agreements for delinquent owners. AppFolio report: *Payment Plans*.
2. **Credit card accounts**: association credit cards as financial accounts, card expenses posted to the ledger. AppFolio report: *Credit Card Expense Detail*.

## Financial Diagnostics (AppFolio checks)

Security Deposit Funds Mismatch ➖ (rental) · Escrow Cash Account Balance Mismatch · Non-Zero Security Clearing Account Balances ➖ · Negative / Positive Balance on Additional Fee GL Accounts · Homeowners With Unused Prepayments / Open Charges / Open Credits · Prepayment Balance Mismatch · Bank Account Reconciliation Lapses Over 60 Days · Unused Prepayments for Past Owners.

## Reports: AppFolio catalog vs Portier

Run check, 2026-10-01: every active Portier report definition (145) was executed through `report_data_dispatch` against production.
- **111 ran.**
- **12 run on the live financial path** instead: balance sheet, income statement, GL, trial balance, A/R and A/P aging, delinquency summary, budget vs actual, annual budget comparative, aged payables summary, bank reconciliations.
- **1 needs a parameter:** Owner Ledger needs a unit.
- **The rest have no data source.** They're listed below.

| AppFolio report | Portier |
|---|---|
| Accounting: Account Totals, Balance Sheet (+Comparative, +Property Comparison), Bank Account Activity / Association / Directory, Cash Flow (+12 Month, +Comparison, +Detail), Chart of Accounts, Expense Distribution, General Ledger, Income Statement (+12 Month, +Comparative, +Comparison, +Date Range), Loans, Trial Balance (+by Property), Trust Account Balance / Detail | ✅ all |
| Association: Architectural Review Detail, Association Work Order, Board of Directors, Dues Roll (+Itemized), Fund Balance Sheet (+Active Funds), Fund Income Statement, Homeowner Delinquency (+As Of), Homeowner Directory, Homeowner Ledger, Homeowner Prepayment Balance, Homeowner Resale, Homeowner Vehicle Info, Renter Directory, Violation Detail | ✅ all |
| Diagnostic: Email Delivery Errors, Late Fee Policy Comparison, Resident eCheck Fee Coverage, User Roles and Permissions | ✅ |
| Diagnostic: Users | ❌ |
| Diagnostic: Import Variances | 🟡 definition exists (Import Validation), no data source |
| Maintenance: Inspection Detail, Project Budget Detail, Project Directory, Purchase Order, Recurring Work Order, Vendor Directory, Vendor Ledger, Work Order, Work Order Billable Detail, Work Order Labor Summary | ✅ |
| Owner: Owner Insurance, Owner Insurance Audit | ✅ |
| Property & Unit: Activities Summary, Additional Fees, Amenities, Annual Budget Comparative, Budget Comparative, Budget Detail, Fixed Assets, Keys Detail, Property Directory, Property Group Directory, Property Performance, Unit Directory, Unit Inspection | ✅ |
| Property & Unit: **Annual Budget Forecast**, **Budget Property Comparison**, **Inventory Status**, **Inventory Usage** | ❌ |
| Tax: Vendor 1099 Detail / Summary | ✅ (Owner 1099 ➖ rental) |
| Transaction: Aged Payables Summary, Aged Receivable Detail, Bill Detail, Charge Detail, Check Register (+Detail), Deposit Register, Expense Register, Income Register, Journal Entry Register, Unpaid Balances by Month | ✅ |
| Transaction: **Credit Card Expense Detail**, **Payment Plans**, **Receivables Activity**, **Resident Financial Activity** | ❌ |

Portier report definitions with no data source and **no AppFolio equivalent**, to be removed from the catalog:
- Application Settings
- Inspection Reasons
- Market Metrics / Pricing Metrics (rental)
- Unit Availability (rental)
- Owner Tax Detail / Summary (rental owner 1099)
- Board Packet (the board package has its own generator)
