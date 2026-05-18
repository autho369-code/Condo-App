# Stellar PM — Project TODO

## Phase 1: Database Schema
- [x] Extend users table with role enum (7 tiers), company_id, assigned_property_ids
- [x] Create companies table
- [x] Create properties/associations table
- [x] Create invitations table (token, role, property_ids, invited_by, expires_at)
- [x] Create gl_accounts table (370+ chart of accounts)
- [x] Create transactions table (unified ledger: RECEIPT, BILL, JOURNAL_ENTRY)
- [x] Create journal_entry_lines table
- [x] Create vendors table
- [x] Create owners table
- [x] Create bank_accounts table
- [x] Create scheduled_reports table
- [x] Create diagnostic_flags table

## Phase 2: Backend / tRPC
- [x] RBAC middleware (roleProcedure factory per role)
- [x] Property-scope enforcement helper (getAccessiblePropertyIds)
- [x] Auth router (me, logout)
- [x] Invitations router (create, accept, list, revoke)
- [x] Companies router (CRUD — super admin only)
- [x] Properties router (list scoped, get, create, update)
- [x] Users router (list, update role, remove — scoped)
- [x] Accounting router (receivables, payables, bank accounts, journal entries, GL accounts, diagnostics)
- [x] Reports router (list categories, run report, schedule report)
- [x] Vendors router (CRUD)
- [x] Owners router (CRUD)

## Phase 3: Theme & Routing
- [x] Dark professional theme in index.css (navy/slate palette)
- [x] Role-based redirect logic in App.tsx
- [x] Protected route wrapper per role
- [x] ThreePanelLayout component (AppFolio 3-panel style)

## Phase 4: Public Homepage
- [x] Hero section with login CTA
- [x] Feature highlights section
- [x] Redirect authenticated users to their dashboard

## Phase 5: Super Admin Dashboard
- [x] All-properties overview with stat cards
- [x] Company management table (create, edit, deactivate)
- [x] User management table (all users, role badges, remove)
- [x] Invitation management (send, revoke, track status)
- [x] System-wide diagnostics panel

## Phase 6: Portfolio Manager Dashboard
- [x] Scoped property overview cards
- [x] Invite Manager with property ID assignment
- [x] Portfolio-level stat summary

## Phase 7: Manager / Accountant / Assistant Dashboard
- [x] Stat cards: Associations, Vendors, Owners, Open Bills
- [x] Recent activity feed
- [x] Payables approval queue
- [x] Quick-access report links
- [x] Right pane: last 24h projects/activity

## Phase 8: Board Member Dashboard
- [x] View-only financials panel
- [x] Fund balance display
- [x] Income statement view
- [x] Association reports list (no export, no edit)

## Phase 9: Accounting Module
- [x] Receivables: Receipts, Charges, Bank Deposits, Delinquencies
- [x] Payables: Bills, Payments, Recurring, Loans
- [x] Bank Accounts list and reconciliation status
- [x] Journal Entries with multi-line support
- [x] GL Accounts (Chart of Accounts, 370+ codes)
- [x] Diagnostics (6 check types)

## Phase 10: Reporting Module
- [x] Report categories: Accounting, Association, Diagnostic, Maintenance, Property/Unit, Tax, Transaction
- [x] 120+ report list with search and favorites
- [x] Scheduled Reports management
- [x] Report Builder placeholder
- [x] Metrics and Compliance tabs

## Phase 11: Tests & Deployment
- [x] Vitest tests passing (auth.logout)
- [x] TypeScript check — 0 errors
- [x] Vitest tests for RBAC middleware
- [x] Vitest tests for property-scope enforcement
- [x] Vitest tests for invitation flow
- [ ] Save checkpoint
- [ ] Push to GitHub
