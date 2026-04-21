# Frontend Pages — Build Order

## Priority 1 — Core Management (Build These First)

### `/associations`
- List of all HOAs for the portfolio
- Columns: name, city, units, occupancy %, open WOs, balance due
- Filter by status (active/inactive)
- Click → detail page

### `/associations/:id`
Tabs matching AppFolio:
- **Overview** — address, stats, bank account, fund accounts
- **Units** — unit list with owner, balance, status
- **Owners** — all owners in this association
- **Board** — board members with roles + terms
- **Budget** — budget lines vs actual by GL account
- **Approvals** — pending approval requests
- **Committees** — committee list
- **Documents** — association-level docs

### `/units` + `/units/:id`
- List: unit number, building, owner, sqft, beds, balance
- Detail tabs: owner info, charges/payments, work orders, documents, notes

### `/work-orders`
Full lifecycle:
- List with status filter (new/assigned/in_progress/done/closed)
- Priority badges (emergency = red, high = orange)
- Create form: association, unit, category, description, vendor, priority
- Detail: updates timeline, estimates, labor entries, bills

### `/violations`
Enforcement workflow:
- List: association, unit, owner, type, status, fine
- Create violation
- Status flow: open → notice_sent → hearing_pending → fined → cured/closed
- Each step sends notice to owner

### `/owners/:id`
- Owner info (contact, units owned)
- Balance summary
- Charge/payment history
- Active violations
- Work orders for their units
- Documents

---

## Priority 2 — Accounting

### `/receivables`
- Charges list with filter (outstanding/paid/partial/waived)
- Post charge to unit
- Record payment

### `/bills` (Payables)
- Bill list with approval status
- Create bill from vendor
- Approval workflow (if amount > threshold)

### `/gl-accounts`
- Chart of accounts tree
- Account detail with journal line history

### `/bank-accounts`
- Account list with balance
- Reconciliation interface

---

## Priority 3 — Reporting

### `/reports/delinquency`
- Units with outstanding balance
- Days overdue, amount owed

### `/reports/income_statement`
- Income vs expenses by GL account for date range

### `/reports/dues_roll`
- All units with monthly assessment amounts

### `/reports/cash_flow`
- Cash in/out by month

### `/reports/balance_sheet`
- Assets / liabilities / equity snapshot

---

## Priority 4 — Communication & Settings

### `/calendar`
- Monthly/weekly view
- Event types: Administrative, Announcements, Maintenance, Meetings, Social

### `/notices`
- Create/send notices to all owners or specific association
- Status: draft → sent

### `/settings`
- Company info
- Accounting settings (fiscal year, basis, late fees)
- Users & roles
- Communication settings

---

## Done ✅
- `/login`
- `/dashboard`
- `/portal` (owner portal)
- `/owners` list
- `/owners?view=tenants`
- `/vendors` list
