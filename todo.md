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
- [x] Save checkpoint
- [x] Push to GitHub

## Phase 12: Continued Improvements
- [ ] Promote first logged-in user to super_admin automatically via DB trigger
- [x] Seed GL accounts (294 codes) into database
- [ ] Fix right pane — live 24h activity feed with real data
- [ ] Add create/edit dialogs to Associations page
- [ ] Add create/edit dialogs to Vendors page
- [ ] Add create/edit dialogs to Owners page
- [ ] Add create bill / create receipt forms to Accounting module
- [ ] Add create journal entry form
- [ ] Fix navigation active states in sidebar
- [x] Fix db.ts column name mismatches (vendors, owners, gl_accounts, companies)
- [x] Ensure Manager dashboard stat cards show real counts from DB

## Phase 13: UI Consistency Rebuild
- [ ] Single design system — navy/slate dark theme, same sidebar, same 3-panel layout on every page
- [ ] Landing page — hero, features, role overview, login CTA
- [ ] Super Admin dashboard — consistent UI, all properties, user management, invitations
- [ ] Portfolio Manager dashboard — same UI, scoped properties
- [ ] Property Manager dashboard — same UI, assigned properties
- [ ] Board Member dashboard — same UI, view-only
- [ ] Owner portal — same UI, single account view
- [ ] Role-based auto-redirect after login
- [ ] Super Admin invitation flow — controls all access

## Phase 14: Reports Module Fix
- [x] Diagnose reports module — runReport() was just a toast with no real data
- [x] Add reports.run tRPC procedure that queries real Supabase data per report type
- [x] Build report result viewer (table + summary) shown in a modal/panel
- [x] Implement key reports: Balance Sheet, Income Statement, General Ledger, Trial Balance, Chart of Accounts, Delinquency, Transaction Detail, Vendor Directory
- [x] Fix old MySQL/Drizzle queries still running in server (server restart required)
- [x] Push fixes to GitHub

## Phase 15: Report Association Filter
- [ ] Add association/property selector dropdown to ReportsPage (required before running any report)
- [ ] Pass selected propertyId to reports.run — all queries must filter by association
- [ ] Add reports.associations query to return accessible associations for the dropdown
- [ ] Balance Sheet, Income Statement, GL, Trial Balance — filter GL accounts and transactions by propertyId
- [ ] Vendor reports — filter vendors by association (via transactions or direct property link)
- [ ] Owner reports — filter owners by propertyId
- [ ] Transaction reports — filter by propertyId
- [ ] "All Properties" option for super_admin/portfolio_manager roles
