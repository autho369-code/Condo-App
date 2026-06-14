# Portier369 — Master Project Status
*Single source of truth in the repo. Kept in sync with Claude's memory at*
*`C:\Users\autho\.claude\projects\C--Users-autho-Portier369\memory\project-state.md`.*
*The **CURRENT STATE** section below is authoritative; everything under HISTORICAL LOG is old and may be stale.*
*Last updated: 2026-06-14.*

---

## 🎯 The Goal
Build **Portier369** — a multi-tenant HOA/condo management SaaS for **Stellar Property Group** — to functional parity with **AppFolio Property Manager**, then beyond, with an original design. Live at **portier369.com** (Vercel auto-deploys `main`).

## ✅ Current State (2026-06-14)
- **Live & green.** Design-system migration 100% done; all "New X" create forms built; self-service account/security (password change) page shipped.
- **Clean test data:** the database now holds ONE realistic association — **Granville Courts** (Stellar portfolio) — with full accounting so every screen shows real numbers. All prior fake/seed data was backed up to `backups/seed-backup-*.json`, then hard-deleted.
- **7 personas** — all `@portier369.com`, password `Portier2026!`:
  - `hello@` — super-admin / platform operator
  - `admin@` — company admin
  - `manager@` — property manager
  - `owner1@` — Olivia: owner-occupant **and Board President** of Granville
  - `owner2@` — Liam: owner who rents unit 102 to a tenant
  - `vendor@` — Lakefront Maintenance LLC
  - Tenant (Tessa) is **data-only — NO login** — reachable by email/SMS only
- **Accounting (Granville):** $10,500 dues billed · $8,400 collected · **$2,100 A/R** · operating + reserve bank accounts · FY2026 budget · 2 vendor bills · 4 balanced journal entries. Books balance (DB-trigger enforced).
- **Verified in the running app:** manager dashboard, board portal (financials/budget/delinquencies), owner portal, vendor portal — all rendering real Granville data.

## 🔧 Fixed this session (committed + live)
- Board **Financials** showed $0 → added board read-only RLS on `journal_lines`/`journal_entries`/`bank_accounts` (association-scoped). Migration `board_read_financials_rls.sql`.
- Board **Delinquencies** blank owner/last-payment → roster RLS (`board_read_roster_rls.sql`) + page fix.
- **Owner portal** balance $0 → fixed queries hitting nonexistent columns (`occupancies.archived_at`, `work_orders.owner_id`); balance now = real A/R.
- **Budget vs Actual** expense actuals $0 → set bill `occurred_on`.
- **Tenants** reachable by SMS (+ accurate email recipient count); tenant login removed.

## 📋 Open items / next
- **SMS provider** deferred (recommend **Twilio** at launch; requires US 10DLC registration — don't pay until a real pilot). Email already delivers via Resend.
- **No tenant portal** — intentional; tenants are data-only contacts.
- Pre-launch: real-client pilot · confirm Resend domain auth (deliverability) · legal review of `/legal/*` · replace any remaining seed data.

## 🧠 How memory works (so nothing is hidden)
My durable memory is Markdown at `…\.claude\projects\C--Users-autho-Portier369\memory\` (Obsidian-compatible). **This file is the human-readable mirror inside your repo** — I update both together, and it's versioned in git so it travels with the project.

---
# HISTORICAL LOG
*Older session notes below — kept for history, likely out of date. Trust CURRENT STATE above.*

---

## Project Overview
Building an AppFolio clone for **Stellar Property Group** — a multi-tenant HOA/condo property management SaaS.

**Supabase project:** `termxngysvotnfbzbgrv`
**GitHub repo:** `https://github.com/authou369-code/Condo-App`
**GitHub token:** stored in git remote URL (already configured)
**Local project path:** `C:\Condo-App\condo-app-ui`
**App URL (dev):** `http://localhost:3000`
**Admin login:** `admin@hoa-os.local` / `Admin1234!`
**Your iCloud login:** `mirsadc1971@icloud.com`

---

## Key Decisions & Deviations from AppFolio

| AppFolio Term | Our Term | Notes |
|---|---|---|
| Homeowners | **Owners** | Unit owners / condo owners |
| Tenants | **Tenants** | Renters in owner-occupied units — separate table `tenancies` |
| Occupancy | `unit_owners` + `tenancies` | Split into two clean tables instead of one polymorphic occupancy |
| Realm-X AI | TBD | Future phase |
| Keycloak SSO | Supabase Auth | Simpler, built-in |

---

## Tech Stack
- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Backend:** Supabase (Postgres + Auth + RLS + Edge Functions)
- **Payments:** Stripe (payment_intents table wired)
- **Email:** Queue-based via `email_queue` table
- **SMS:** `sms_conversations` + `sms_messages` tables
- **Auth:** Supabase Auth + `profiles` table + `hoa_role` enum + `portfolio_id`

---

## Database — What's Built (110+ tables) ✅

### Core / Multi-Tenant
- `portfolios` — tenant root (Stellar Property Group = `a1000000-...`)
- `profiles` — links auth.users to portfolio + role
- `user_roles`, `user_sessions`, `user_invitations`
- `feature_entitlements`, `subscriptions`, `subscription_events`
- `api_keys`, `platform_operators`

### Property
- `associations` — HOAs (5 seeded: Lakeview, Riverview, Wicker Park, Lincoln Square, South Loop)
- `buildings` — 7 seeded
- `units` — 22 seeded
- `property_groups`, `association_amenities`, `unit_amenities`, `amenity_tags`
- `association_attachments`, `association_notes`, `association_keys`
- `association_additional_fees`

### People
- `owners` — 15 seeded (= AppFolio "Homeowners")
- `unit_owners` — links owners to units with share_pct
- `tenancies` — tenants in units (separate from owners)
- `occupancies` — legacy/additional occupancy tracking
- `board_members`
- `committees`, `committee_members`
- `vendors` — 8 seeded, has compliance, tax, payment, accounting fields
- `vendor_compliance`

### Accounting
- `gl_accounts` — 9 seeded, hierarchical with sub_account_of_id
- `gl_account_role_permissions`
- `bank_accounts`, `bank_account_owners`, `bank_transfers`
- `charges` — 7 seeded (assessment + late_fee types)
- `charge_categories`
- `payments` — 13 seeded
- `payment_intents`, `payment_methods`, `payment_applications`
- `payment_processor_configs`, `autopay_mandates`
- `payable_bills`, `payable_bill_line_items`, `recurring_bills`
- `journal_entries`, `journal_lines`, `journal_entry_batches`, `recurring_journal_entries`
- `assessment_periods` — 4 seeded
- `budget_lines`
- `management_fee_schedules`, `management_fee_policies`, `management_agreements`
- `accounting_periods`
- `lockbox_batches`, `lockbox_items`
- `dues_increases`, `dues_increase_lines`
- `unit_recurring_charges`
- `statements`

### Maintenance
- `work_orders` — 1 seeded (needs more)
- `work_order_updates`, `work_order_estimates`, `work_order_labor_entries`
- `recurring_work_orders`
- `service_requests`
- `purchase_orders`, `purchase_order_line_items`
- `inspections`, `inspection_items`
- `fixed_assets`, `depreciation_entries`

### Compliance / Violations
- `violations` — 0 seeded (enum: noise, parking, pets, exterior_modification, etc.)
- `violation_updates`, `violation_followup_steps`

### Communication
- `notices`, `notice_recipients`
- `sms_conversations`, `sms_messages`
- `email_queue`
- `document_templates`, `form_templates`
- `documents`
- `communication_triggers`

### Reporting & Analytics
- `report_definitions`, `report_runs`, `report_snapshots`
- `saved_reports`, `scheduled_reports`
- `surveys`, `survey_responses`
- `data_diagnostics`, `usage_metrics`

### Other
- `ballots`, `votes` — HOA voting
- `calendar_events`
- `tags`, `tag_assignments`
- `approval_requests`, `approval_votes`
- `activity`, `soft_delete_log`, `permission_audit_log`
- `login_attempts`, `data_export_requests`, `privacy_actions`
- `webhook_endpoints`, `webhook_deliveries`
- `income_recertifications`, `document_requests`
- `shares`, `workflows`, `agents` — ORPHANED, should delete

---

## Frontend — What's Built

### Pages Working ✅
| Route | Status | Notes |
|---|---|---|
| `/login` | ✅ | Auth working |
| `/dashboard` | ✅ | Events, payments, portal adoption, notifications, tasks sidebar |
| `/portal` | ✅ | Owner-facing portal (balance + units) |
| `/owners` | ✅ | List with alphabet filter |
| `/owners?view=tenants` | ✅ | Tenants list |
| `/vendors` | ✅ | Vendors tab |

### Left Nav Built ✅
Dashboard, Calendar, Associations, Units, Owners, Tenants, Vendors, Receivables, Payables, Bank Accounts, Journal Entries, Bank Transfers, GL Accounts, Diagnostics, Charge Categories, Work Orders (+ more in Maintenance, Reporting, Communication, Settings)

### Pages NOT YET Built ❌
| Route | Priority |
|---|---|
| `/associations` — list + detail | HIGH |
| `/associations/:id` — tabs (units, owners, board, budget) | HIGH |
| `/units` — list + detail | HIGH |
| `/work-orders` — list, create, detail | HIGH |
| `/violations` — list, create, detail | HIGH |
| `/owners/:id` — owner detail | HIGH |
| `/bills` — payables list | MEDIUM |
| `/receivables` — charges list | MEDIUM |
| `/calendar` | MEDIUM |
| `/reports/*` — all reports | MEDIUM |
| `/settings` — company, accounting, users | MEDIUM |
| `/vendors/:id` — vendor detail | MEDIUM |
| `/board-members` | LOW |
| `/inspections` | LOW |
| `/ballots` | LOW |
| `/notices` | LOW |
| `/sms` | LOW |

---

## Gap Analysis — AppFolio vs Our Build

### Schema Gaps (in AppFolio, missing in our DB) ❌
- `pets[]` on owners table — AppFolio tracks owner pets
- Vendor portal activation fields (portal_activated exists but no portal login system)
- Unit `home_warranty_company` / `home_warranty_expires` fields
- Maintenance `projects` (scoped multi-WO projects with budget)
- Inventory management tables
- Unit turns tracking
- Maintenance Performer entity (internal tech profiles)

### Frontend Gaps vs AppFolio ❌
- No association detail page with tabs (units, owners, board, approvals, budget, committees)
- No board of directors management UI
- No work order full lifecycle (create → assign → vendor → bill → close)
- No violation enforcement workflow (notice → hearing → fine → cure)
- No full accounting UI (GL accounts, journal entries, bank reconciliation)
- No reports engine (AppFolio has 110+ reports — we have 0 rendered)
- No SMS inbox
- No document template merge fields
- No ballot/voting UI
- No inspection workflow
- No settings pages

---

## Follow-Up Items (Deferred)

### Folder: `/follow-up/`

#### `follow-up/schema-gaps.md`
- Add `pets` jsonb column to `owners`
- Add `home_warranty_company`, `home_warranty_expires` to `units`
- Add `maintenance_projects` table (project_name, budget, association_id, status)
- Add `inventory_items` table
- Add `unit_turns` table
- Delete orphaned tables: `shares`, `workflows`, `agents`
- Add `maintenance_performer_id` FK to `work_orders` (internal tech)

#### `follow-up/frontend-pages.md`
Priority order for pages to build next:
1. `/associations` list + `/associations/:id` detail with tabs
2. `/units` list + `/units/:id` detail
3. `/work-orders` full CRUD
4. `/violations` enforcement workflow
5. `/owners/:id` detail with charges, payments, history
6. `/reports/delinquency` + `/reports/income_statement`
7. `/bills` + `/receivables`
8. `/settings`

#### `follow-up/integrations.md`
- Stripe webhook handler for payment_intents (Edge Function)
- Email sending via Resend/Postmark (Edge Function) triggered by email_queue
- SMS via Twilio (Edge Function) for sms_messages
- QuickBooks sync (accounting export)
- AppFolio Stack equivalent marketplace

#### `follow-up/rls-audit.md`
- Verify all tables have correct RLS policies (not just enabled — actually filtering by portfolio_id)
- Test cross-tenant data isolation with two separate portfolios
- Add INSERT/UPDATE/DELETE policies (currently mostly SELECT only)

---

## Seed Data Summary

| Table | Count | Notes |
|---|---|---|
| portfolios | 2 | Stellar Property Group (a1000...) + 1 other |
| associations | 7 | 5 ours + 2 from Cowork |
| buildings | 9 | 7 ours + 2 from Cowork |
| units | 30 | 22 ours + 8 from Cowork |
| owners | 23 | 15 ours + 8 from Cowork |
| vendors | 8 | Windy City Plumbing, Chicago Electric, Lakefront HVAC, etc. |
| work_orders | 1 | Needs more seeding |
| charges | 22 | April 2026 assessments |
| payments | 13 | From Cowork |
| violations | 0 | Need to seed |
| gl_accounts | 9 | |
| user_roles | 6 | |

---

## Session Log

### 2026-06-10 (Claude-assisted)
- **Security:** Enabled RLS on all 19 previously exposed tables + schema_migrations (zero tables without RLS). Policies added for maintenance_template_groups (portfolio), maintenance_templates (system/global + group portfolio), inventory_items (staff-only — needs portfolio_id column later), bank_adjustments (finance via bank account portfolio). 15 unused tables locked to service_role pending keep/drop decision.
- **Fixed broken queries (frontend↔DB mismatches):**
  - board/financials: was querying nonexistent `bills`, `budgets`, `bank_accounts.balance`, `journal_entries.amount` — rewritten on posted journal_lines (income/expense by GL account_type), bank/reserve balances rolled up from journal lines per bank GL account, budget variance from budget_lines.annual_total pro-rated vs YTD actuals
  - portal/insurance: now uses `insurance_policies` (was nonexistent `insurance_certificates` + phantom owner columns); upload inserts a policy row; added history list
  - portal/timeline: payments via `receivable_payments_ledger` view (payments has no owner_id); work orders resolved through unit_owners → unit_ids
- **Calendar fixed:** create-event action now redirects with visible error banner instead of silent `return {error}`; guards missing portfolio with clear message. CalendarGrid: fixed collapsed height (h-[calc(100vh-330px)] min-h-560px) and enabled prev/next/today + title toolbar (was headerToolbar={false} → no month navigation).
- **Data/auth fixes:** mirsad@stellarpropertygroup.com profile → Stellar portfolio + manager/admin (was owner + null portfolio → silent insert failures); hello@portier369.com → Stellar portfolio; confirmed mirsad@ email in auth.users (no email provider wired yet — confirmation emails go nowhere; wire Resend soon, email_queue has 34 pending).
- **Known follow-ups:** sweep remaining server actions returning silent `{error}`; consolidate /platform vs /platform-operator; build Vendor portal; design-system migration (1/214 pages compliant); see /mnt outputs doc "portier369-finish-line-plan".

### 2026-06-09
- Computer was reset — recovered project from scratch on fresh machine
- Cloned repo to new local path: `C:\Users\autho\Portier369`
- Recreated `.env.local` (Supabase anon + service_role keys verified, HTTP 200)
- Skipping Stripe for now (keys not configured — checkout flows inert)
- `npm install` clean (626 packages), dev server verified at http://localhost:3000
- Database intact: 7 associations confirmed via REST API
- Git credentials + identity reconfigured (autho369-code)

### 2026-04-21
- Fixed admin profile (no profile row = left nav disappeared)
- Git connected to https://github.com/authou369-code/Condo-App
- Confirmed 110+ table schema built by Cowork
- Dashboard working, owner/tenant pages working
- All other pages redirect to /portal (not built yet)
- Created this master tracking document

---

## Rules for Every Session
1. READ this file first
2. Check Supabase counts before doing anything
3. Screenshot the app before making changes
4. Push to GitHub after every significant change:
   `git add . && git commit -m "description" && git push`
5. UPDATE this file at end of session
