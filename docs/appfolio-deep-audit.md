# AppFolio deep module audit (in progress)

Read-only walk-through of the authenticated Stellar Property Group AppFolio
workspace, started 2026-09-29. Records **structure only** (sections, fields,
actions) — no customer data. Rental/leasing/screening/FolioGuard/affordable
housing are out of scope. Each item is compared against Portier369 and
tagged: ✅ have · 🟡 partial · ❌ missing · ➖ out of scope.

## 1. Associations

### Association list
Tasks panel: New Property, New Corporate Entity, New Association, Meeting
Sign-In, Violations Field Entry, Bulk Update Board Reports. Reports shortcuts:
Homeowner Directory, Unit Directory, Renter Directory, Dues Roll, General
Ledger. Statements: Bulk Update Statement Settings.

### Association record — tabs
Association · Units · Unit Groups · Board of Directors · Approvals ·
Committees · Architectural Reviews · Budget · Amenities

### Association record — sections (Association tab)
Header (type, address, county) · Upcoming Activities (+Add Activity) ·
Association Information (description, site manager, year built, auto-payment
frequency w/ homeowner override, management start/end date + end reason, NSF
fee, hide calendar in portal, disable contact-info editing in portal, disable
renter-info editing, resident eCheck fee coverage, amenities) · Units (unit,
homeowner, renter occupied, ownership %, dues, owner-occupied %) ·
Association Financials (1099 payer, fiscal year end, reserve funds) ·
Insurance Information (master policy) · Management Fees (policies with
effective ranges) · Additional Fees (GL, %, suppress) · Late Fee Policy
(effective date, flat/percent, eligible charges, daily amount / monthly max,
grace days, grace balance) · Budgets (variance threshold $ and/or %) ·
Interest Information (interest after N days, posts on day N, grace balance,
annual rate, interest income GL) · Keys · Violation Follow-up Schedule +
Communication Settings (sender name/email) · Maintenance Information
(maintenance limit, insurance expiration, home warranty, disable online
requests, notes, request instructions) · Fixed Assets · Property Groups ·
Statement Settings · Bank Accounts · Terms & Conditions for Electronic
Document Delivery · Photos · Notes · Audit Log · Attachments (folders:
Budget, Governing Documents, Insurance, Meeting Minutes; bulk
share/unshare with homeowners, add to folder, download, delete)

### Unit Groups
Named unit groups (New Unit Group; name, units, actions).

### Board of Directors
Board Members (name, role, start/end, signature?, phone, email) · Past
Board Members · Board Approvals settings · **Board Reports** (NEW: configure
which reports the board receives) · Attachments.

### Budget
Fiscal-year selector + description · GL filter + activity filters
(budgeted last year / had actuals last year) · show prior-year actuals ·
bulk actions: Fill, Update, Calculate (NEW), Clear rows, Undo/Redo ·
calculation method per row · customize columns · CSV import/export ·
full-screen · Overview / Variances tabs · audit log. Task: **Update
Assessments** (budget → unit dues). Reports: annual budget comparative /
forecast, budget detail, budget comparative, property comparison.

**Portier status (2026-09-29):** worksheet on the association Budget tab
(whole year in one grid, fiscal-year month order, fill from prior budget or
prior GL actuals, % adjust by income/expense/all, type-annual-to-spread, CSV
export/import, only-budgeted filter, prior-year actual column, notes);
draft → adopted lock with audited reopen; **Update Assessments** allocates an
adopted income line by ownership %, equal shares or sq ft into monthly /
quarterly / annual recurring charges from an effective date, ends the old
charges, syncs owners' dues and keeps a history. Budget vs actual now uses
posted GL by fiscal month. Not built: undo/redo, per-row calculation methods,
full-screen, owner notice letters on assessment change.

### Amenities
Amenity Settings list + Create Amenity.

### Unit record
Upcoming Activities · Unit Information · **Tags** · Non-revenue status ·
Unit Summary · Amenities · Current Homeowners (name, type, purchase date,
phone, email) · Keys · Maintenance Information · Fixed Assets · Photos ·
Notes (with **@mentions**, download notes) · Audit Log · Attachments.
Actions: Print, Add Activity, Add Key, Add Asset, create work order for unit,
charge unit.

## 2. People

### Homeowner record
Summary · co-homeowners (role, start/end, status) · Tags · Contact (multiple
phones, emails, addresses) · Renter status + renters · Homeowner status ·
Board member status · Portal status (send reset-password email, send portal
link) · Electronic cash payments · Emergency contact · Violations (+New) ·
Upcoming activities · Notes · **Two-way texts thread** (templates, attach
image, download) · Emails log · Letters log · Recurring charges · Financials
(ledger) · **Per-homeowner late fee policy override** · Insurance policies
(policyholder, expiration) · Animals · Vehicles · Audit log · Attachments.

### Association attachments — Portier status (2026-09-29)
Documents tab: folders (standard + custom), per-file visibility
(management only / board / board and owners; new uploads private by
default), descriptions, audited folder/sharing changes and deletes, board
portal "Association documents" section. Fixed: every association document —
including letters generated for one owner — was readable by all owners.

### Board Reports — Portier status (2026-09-29)
Association → Board tab → Board reports: choose statements (trial balance,
balance sheet, income statement, budget vs actual, receivables aging,
delinquency, payables aging, bank reconciliation), visibility (board /
board and owners), automatic monthly publishing on a chosen day (daily cron
with catch-up), email to active board members (once per period), manual
publish/republish for any period. Packages land in the board portal
(Reports + Documents) as association documents in a "Board reports" folder.


### Homeowner record — Portier status (2026-09-30)
AppFolio homeowner page (audited live): Summary (recurring charges, balance,
last receipt) · status block (delinquency notes, in foreclosure, in
collections, certified funds only, allow online payments, require online
payments in full) · tags · contact · renter status · homeowner status
(purchase/sale date, send dues reminders) · board status · portal status ·
electronic cash payments (PaySlip) · emergency contact · violations ·
activities · insurance policies · notes · two-way texts · emails log (78
entries w/ opened status) · letters log · recurring charges · financials
(NSF fee, eligible for dues increase) · late fee override · animals ·
vehicles · audit log · attachments (share with homeowner).
Portier already had most of this. Added: collections/payment-rule flags
(enforced — certified funds blocks check/cash/other receipts via trigger,
online payments off blocks portal checkout + autopay, pay-in-full enforced at
checkout) and per-unit delinquency notes. Still missing: tags, emails log with
open tracking, letters log on the owner page, PaySlip, dues reminders,
two-way texts. Vendor trades: AppFolio has 14 more (alarm/security,
appliances, capital improvements, carpet, cleaning, deck, doors/windows,
drywall, elevator, fences/gates, fire/water damage, redevelopment,
smoke/CO detectors) than the vendor_trade enum.
### Vendor record — Portier status (2026-09-29)
AppFolio vendor page (audited live): contact, portal activation, federal tax
(+ Request W-9), accounting (check consolidation/stub, hold payments, eCheck
receipt, terms, default memo/GL, work order adjustment), payment type + bank,
compliance (6 expirations + Request Compliance Documents), notes with
@mentions, two-way texts, emails log, audit log, attachments.
Portier now: full Edit page for every field above (bank details restricted to
accounting staff, account number never echoed, blank = keep), portal status +
invitation from the record, notes, audit log of changes (bank/tax values
redacted). Fixed: New Vendor offered vendor types/payment types that are not
in the database enums (insurance/legal/accounting/utility, wire/credit_card)
so those choices failed on save. Not built: two-way vendor texts (Twilio
KYC), emails log, attachments, @mentions.

## 3. Accounting (audited live 2026-09-30)

AppFolio structure: Receivables (Receipts · Charges · Bank Deposits ·
Homeowner Delinquencies · Chargeback Insights) · Payables (Bills · Payments ·
Recurring · Loans · Online Payables) · Financial Accounts · Journal Entries
(history · recurring · batches) · Bank Transfers · GL Accounts · Diagnostics.
Receivables tasks: homeowner / vendor / other / subsidy receipts, homeowner
charge, bulk charges & credits, bulk recurring charges, homeowner credit,
apply credits, common charge, charge late fees, new bank deposit, lockbox,
eCheck fee settings. Payables tasks: enter bill, smart bill entry, enter
credit, pay bills, pay management fees, homeowner payable, transfer funds,
new recurring bill, manually post bills, upload bulk bills, bulk board
approval. Financial accounts: new bank account, deposit, bank feed,
reconcile, close accounting period, link with bank. Journal entries: new,
recurring, upload batch, manually post. GL: new account, GL account map,
permissions, recalculate balances. Diagnostics: 10 balance checks.

| Area | Portier | Notes |
|---|---|---|
| Charges, bulk & recurring charges, late fees, interest | ✅ | |
| Homeowner receipts (office) + receipt print | ✅ | GL-posted since #55 |
| Receipts list (all receipts, search) | ❌ | only per unit |
| Vendor / other receipts (non-owner income) | ❌ | |
| Homeowner credits + apply credits | ❌ | |
| Bills, approval, check run, owner payables | ✅ | |
| Recurring bills | ✅ | /bills/recurring (2026-09-30) |
| Recurring journal entries | ✅ | /journal-entries/recurring/new |
| Pay management fees | ❌ | policies UI only |
| Smart bill entry (invoice → bill) | ✅ | AI invoice extraction on New bill |
| Upload bulk bills / JE batch CSV | ❌ | batches table exists |
| Bulk board approval of bills | ❌ | |
| Lockbox import | ❌ | tables exist |
| Bank accounts, deposits, reconcile, feeds, transfers | ✅ | |
| Close accounting period | ✅ | /accounting-periods |
| GL accounts + permissions | ✅ | GL account map ➖ |
| Diagnostics | ✅ | compare checks list |
| Loans | 🟡 | association_loans on profile |
| Online payables, chargeback insights, subsidy, GPR | ➖ | AppFolio services / rental |
