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
