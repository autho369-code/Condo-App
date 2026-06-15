# Portier369 — Implementation Spec

*Authoritative engineering reference for portier369.com. Describes the system as
built and the contracts new work must respect. Companion to `CLAUDE.md`
(working rules), `docs/DESIGN_SYSTEM.md` (UI), and `.hermes/STATUS.md` (live
status). Last updated: 2026-06-14.*

> This is a spec, not a build order. Most of what follows is already shipped and
> live; the spec exists so future changes stay consistent with the contracts
> below. Items not yet done are isolated in **§13 Remaining to launch**.

---

## 1. Product summary

Portier369 is a multi-tenant SaaS for HOA / condominium community-association
management. It targets **functional parity with AppFolio Property Manager** —
accounting, work orders, owners, vendors, board governance, owner self-service —
behind an **original modern UI** (Vercel/Linear aesthetic), not an AppFolio
visual clone.

- **Customer:** property-management companies (first client: Stellar Property
  Group). Each company is a *portfolio* containing many *associations*
  (individual HOAs/condos), each with buildings, units, owners, and tenants.
- **Business model:** the management company is the paying customer. Per-company
  branded subdomains are included; per-association branded sites are a **future
  paid add-on** (not built — do not build now).
- **Live:** portier369.com, Vercel auto-deploys `main`.

### Goals
1. One double-entry accounting engine that always balances, shared by every role
   with read access scoped by RLS.
2. Six role portals on **one** design system and **one** shared shell.
3. Invitation-only onboarding for every human account, top to bottom.
4. White-glove (offline) owner payments — no online card collection.

### Non-goals (explicit)
- No online owner payments / card collection (see §10).
- No per-association subdomains/websites yet (paid add-on later).
- No tenant login (tenants are data-only contacts; reachable by email/SMS).
- Do not copy AppFolio's interface text, icons, or layout verbatim.

---

## 2. Tech stack & infrastructure

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router), TypeScript | Server Components + server actions |
| Styling | Tailwind CSS | Shared design system only — no ad-hoc layouts |
| Backend | Supabase (Postgres + Auth + RLS + Edge Functions) | Project `termxngysvotnfbzbgrv`, ~190 tables |
| Auth | Supabase Auth + `profiles` + `hoa_role` enum + `portfolio_id` | Invitation-based |
| Email | Resend (key in Supabase Vault `resend_api_key`) | Queue + cron dispatcher |
| SMS | Records only today; **Twilio** recommended at launch (US 10DLC) | No live gateway wired yet |
| Bank feeds | Plaid — **reconciliation only** | Sandbox-gated until prod creds |
| Hosting | Vercel (`aios2/condo-app` → portier369.com) | Auto-deploy on `main` |

### Commands
- `npm run dev` — dev server
- `npm run typecheck` — **run before every commit; never push red**
- `npm run build` — full production build

### Deploy contract
- Push to `main` → Vercel auto-deploys. Confirm green via
  `gh api repos/autho369-code/Condo-App/commits/main/status`.
- Production shares the same Supabase project as dev — schema/data changes are
  immediately live. Dry-run inserts in a rolled-back transaction; verify schema
  with the Supabase MCP before writing queries.

---

## 3. Roles & access model

Six roles, one downward invitation chain:

```
Platform Operator → Company Admin → Manager → Board / Owner → Vendor
                                          └── Tenant (data-only, no login)
```

| Role | `hoa_role` | Lands on | Scope |
|---|---|---|---|
| Platform Operator | `platform_operator` | `/platform-operator` | All companies (the SaaS vendor) |
| Company Admin | `company_admin` | `/company-admin/overview` | One portfolio (their company) |
| Manager | `manager` | `/dashboard` | Portfolio, optionally scoped to assigned associations |
| Board member | `board` | `/board` | One association, governance + read financials |
| Owner | `owner` | `/portal` | Their unit(s) |
| Vendor | *(none)* | `/vendor` | Resolved by `vendors.auth_user_id`; work assigned to them |

- **Login routing** is by *resolved* role via the `me` RPC, in this precedence:
  vendor (`vendor_id`) → owner (`owner_id`) → profile `hoa_role`. A user can be
  both owner and board (e.g. an owner-occupant who is Board President).
- **Tenants** have no auth user by design. They exist as data rows with
  email/phone and are reachable through Send Email and SMS.
- Auth helpers live in `lib/auth/me.ts` (`requireStaff`, `requireOwner`, …).

---

## 4. Architecture / route map

```
app/
  (app)/*            Manager workspace — dark sidebar + content + right TasksRail
  board/*            Board portal (one association)
  portal/*           Owner portal
  vendor/*           Vendor portal
  company-admin/*    Company admin
  platform-operator/* + platform/*   Platform operator (DUPLICATED — see below)
  (auth)/*           Login, /invite, /accept-invitation
  (marketing)/*, (public)/*   Public site, report-card tool, legal
  invite/, account/, help/, api/
```

### Manager workspace modules (`app/(app)/*`)
associations, owners, vendors, units, buildings, work-orders, maintenance,
recurring-work-orders, inspections, projects, purchase-orders, fixed-assets,
violations, compliance, insurance, parking, inventory, lock-boxes,
bank-accounts, bank-transfers, journal-entries, gl-accounts, charges,
charge-categories, bills, budget, budget-vs-actuals, accounting, statements,
bulk-statement-settings, letters, documents, forms, surveys, meetings,
calendar, reports, scheduled-reports, metrics, diagnostics, reminders,
communication-center, send-email, sms, inbox, automation-center, settings,
onboard, unit-turns.

### Shared UI kit (use these — no ad-hoc Tailwind)
- `components/ui/*` — primitives (Badge, Alert, StatusChip, …)
- `components/operations/*` — list-page kit
- `components/workspace/shell.tsx` — detail-page kit
- `components/workspace/tasks-rail.tsx` — right panel; **register new routes in
  its PANELS map** when adding sections
- `components/nav/sidebar.tsx` — shared dark sidebar; role menus from
  `lib/navigation/role-modules.ts`

### Known structural debt
- `app/platform/*` vs `app/platform-operator/*` are duplicated. Consolidation is
  pending and requires explicit approval before touching.

### Reference implementations
- List page: `app/(app)/associations/page.tsx`
- Detail w/ tabs: `app/(app)/associations/[id]/units/page.tsx`
- Aesthetic north star: `app/(auth)/login/page.tsx`

---

## 5. Data model

~190 tables. The contracts that matter most (past bugs came from violating
these — verify columns before querying):

### Hierarchy
`portfolios` (company) → `associations` (HOA) → `buildings` → `units`.
Owners link to units via `unit_owners` → `unit_id`; tenants via `tenancies` /
`tenants`. Associations carry a short unique `slug` (e.g. `granville-courts`)
used in URLs instead of the UUID.

### Money — double-entry, single source of truth
- All money lives in `journal_entries` / `journal_lines` (debits = credits,
  enforced by the `validate_journal_entry_balance` trigger — books cannot save
  unbalanced). `guard_closed_period` blocks edits to closed periods.
- Owner-facing balances flow through the `receivable_payments_ledger` view; A/R
  per unit via `unit_balances`.
- Manager records a payment → posts to ledger → `trg_auto_apply_payment`
  applies it to outstanding charges (over-application is prevented).
- The 294-account GL chart is portfolio-level (`association_id` null) and shared.

### Things that do NOT exist (don't query them)
`bills` table balance shortcuts, `budgets` table, `bank_accounts.balance`,
`work_orders.owner_id`, `occupancies.archived_at`. Work orders resolve to owners
through `unit_owners` → `unit_id`, never a direct owner column.

### Association payment instructions (white-glove remittance)
`associations.remit_payee`, `remit_address`, `payment_instructions` — manager-
entered, per association. Surfaced read-only to owners on `/portal/pay`.

### Schema-change rules
- New tables: **enable RLS** + portfolio-scoped policies using helpers
  `can_access_portfolio(uuid)`, `can_manage_finance(uuid)`, `is_any_staff()`,
  `is_platform_operator()`.
- Migrations live in `supabase/migrations/`; apply via the Supabase MCP and
  record the migration filename.

---

## 6. Authentication & the invitation chain

Every account is invitation-based. Invites write `public.user_invitations`
(`hoa_role` NOT NULL default `manager`, `status` default `pending`).

### How acceptance works (do not re-derive)
Triggers on `auth.users` INSERT do the real work:
- `handle_new_auth_user` — creates the profile (default `hoa_role` `owner`).
- `apply_pending_invitation` — matches a pending invite by email, upserts
  profile portfolio + `hoa_role`, and creates `association_managers` rows from
  `association_ids` **only if** the role is manager/assistant_manager.
- `auto_link_portal_user` — links owners/vendors/board by email; also sets
  `owners.portal_activated` / `vendors.portal_activated` true on link.

The `accept_invitation` RPC is now redundant (triggers already apply).

### The accept page
`/invite` is the **working** accept flow: validate token → set password →
`createUser` + `signIn` → role applied by triggers → routed by resolved role.
`/accept-invitation` only handles already-logged-in users and **redirects
logged-out visitors to `/invite`**. All queued invitation emails link to
`/invite`.

### UI invite entry points (the live ones)
- Operator → admin: `provision_portfolio` / `inviteAdmin`.
- Company admin & manager → staff: `invite_staff(p_portfolio_id, p_email,
  p_role_name, p_message)` (the correct overload; has an association picker —
  none checked = full-portfolio access).
- Manager → owner: portal-activation form creates a `user_invitations` row
  (`hoa_role` `owner`).
- Manager → vendor: `inviteVendorToPortal` in `app/(app)/vendors/actions.ts`
  (creates an invite from the vendor email; login routes them to `/vendor`).

> **Legacy/dead — do not call:** `invite_company_admin`,
> `invite_property_manager`, `invite_owner`, the
> `invite_staff(email,name,role)` overload, `invite_vendor(name,email,trade)`.
> They set `status='sent'`, which acceptance never matches.

---

## 7. Security & RLS model

- RLS is enabled on every table. Policies are portfolio-scoped via the helpers
  in §5.
- **Manager per-association scoping** is a RESTRICTIVE policy `mgr_assoc_scope`
  on every association-scoped table, gated by `can_view_association_row(assoc)`.
  It returns TRUE for everyone except a *scoped* manager
  (`manager_is_scoped()` = staff with ≥1 `association_managers` row) viewing an
  unassigned association. Restrictive = AND-ed, can only remove access → zero
  regression for other roles and for managers with no assignments (who still see
  the whole portfolio). Edit a manager's access on their detail page
  (`updateManagerAssociations`).
- **Board read access** to financials/roster is granted by dedicated read-only
  policies (`*_board_read`) on `journal_lines`, `journal_entries`,
  `bank_accounts`, `owners`, `unit_owners`, `occupancies`, `tenants`,
  association-scoped. `journal_entries` is scoped by the board association's
  **portfolio** (it has no `association_id`) and must NOT subquery
  `journal_lines` or it recurses with the finance policy.
- Server actions must **fail loudly**: never `return { error }` from a plain
  `<form action>` — redirect back with `?error=...` and render an `<Alert>`
  (the `failTo` pattern in `lib/rpcs/calendar.ts`).
- `can_view_association_row` runs per-row (STABLE SECDEF) — fine at pilot scale;
  revisit if a portfolio gets very large.

---

## 8. Module specifications (behavior contracts)

### Accounting
Double-entry only (§5). Charges (`/charges`), owner-payable and vendor-payable
bills (`/bills`, `/bills/owner-payable`), budgets (`/budget`,
`/budget-vs-actuals`), GL accounts (`/gl-accounts`), journal entries, bank
accounts + deposits/reconcile/adjustments, bank transfers, statements,
fixed assets. `get_budget_vs_actuals` sums payable bills by `occurred_on`.

### Work / maintenance
Work orders (+ status updates surfaced to vendors), maintenance, recurring work
orders, inspections, projects, purchase orders, unit-turns
(`/projects/new` and `/unit-turns/new` redirect to `/work-orders/new`). Work
orders link to owners only through unit → `unit_owners`.

### Community / governance
Associations, buildings, units, owners, tenants/leases/pets/emergency contacts,
parking (deposits, vehicle/insurance, auto-billing to unit), violations,
compliance, insurance, architectural reviews, meetings, surveys, documents,
letters, forms (forms write to `document_requests` / management agreements /
portal comms — never to nonexistent columns).

### Board portal (`/board`)
Read-scoped to one association: financials, budget, delinquencies, work orders,
violations, projects, vendors, meetings, architectural reviews, communications,
documents, reports.

### Owner portal (`/portal`)
Ledger, "How to Pay" (`/portal/pay`, read-only remittance), service requests,
work orders, violations, hearings, documents, lease/insurance, calendar,
communications, timeline, profile, account (billing/occupancy info).
`/portal/account` is billing info; the security/password page is `/account`.

### Vendor portal (`/vendor`)
Dashboard, work orders + status updates, compliance, profile.

### Company admin (`/company-admin`)
Overview, associations, managers (invite + property-access editor), owners,
vendors, work orders, violations, architectural reviews, billing, revenue,
portfolio-health, audit-logs, platform-requests, communications, settings.

### Platform operator (`/platform-operator`)
Companies (create/suspend/archive/plan/limits/transfer), overview, revenue,
billing, users, operators, association-health, door-usage, invitations,
support, supabase-admin, audit-logs, communications.

---

## 9. Email & SMS

- **Email:** centralized on Resend (key in Vault `resend_api_key`, vault-first
  lookup). A cron → pg_net dispatcher drains the queue at 5/sec. All send paths
  and the Communication Center "Approve & send" use it. `process-email-queue`
  (deployed v10) suppresses seed domains; `send-email` (v7) defaults from
  `hello@portier369.com`. Senders: `hello@`/`noreply@portier369.com`. Send Email
  resolves owners/tenants/both from the `tenants` table. Deliverability runbook:
  `docs/email-deliverability-setup.md`.
- **SMS:** `sms_conversations` / `sms_messages` record status only — **no live
  gateway**. The SMS form supports Owner and Tenant recipients. Recommended:
  Twilio at launch (requires US 10DLC registration; don't pay until a real
  pilot).

---

## 10. Payment model (decision — final)

- **No online owner payments.** Owners pay the management company offline.
- A **manager records** the payment → ledger → `trg_auto_apply_payment` applies
  it to charges. (Already works.)
- **Plaid is reconciliation only** — **closed (prior session).** The company
  links its bank, `transactions/sync` + auto-match. Reconciliation-only; do
  **not** build Plaid Transfer or any online collection.
- **Stripe fully removed** from the codebase (commit 7bedce0 + follow-up). No
  Stripe dependency, env vars, columns, or code remain; the product uses
  offline/manual remittance only.
- **White-glove remittance** per association (§5): each manager enters where
  owners pay; the owner portal shows it read-only with "put your unit # as the
  memo," falling back to "contact your management company" if unset. Do not
  hardcode a company-wide remittance address.

---

## 11. Design system

- **One** design system for all six roles: dark `#060709` sidebar + light
  `#f6f7f9` content. Read `docs/DESIGN_SYSTEM.md` before touching any UI.
- Use shared components only — no ad-hoc Tailwind, no new colors/shadows, no
  zebra-striped tables. Status colors come from `Badge`/`toneForStatus` or
  `StatusChip` — never invent new ones.
- Mobile first-class: every page must work at 375px (headers stack, tables
  scroll horizontally, touch targets ≥40px). Shared components handle this.
- Every `href` must resolve to an existing `app/(app)<href>/page.tsx` (inventory
  in `docs/placeholder-inventory.md` — currently "Missing Local Routes: None").
- **Done — do not redesign:** login page, sidebar, TasksRail. Migration is 100%
  complete.

---

## 12. Subdomains & multi-tenancy

- Wildcard subdomain resolves to the **management company** name
  (`stellar.portier369.com` → `portfolios.slug`, per-company branded login).
  This is correct — do not change.
- Per-association subdomains/sites are a **future paid add-on** — not built.
- Association URLs use the short `slug`; `lib/associations/resolve.ts`
  `resolveAssociation(param)` accepts slug **or** legacy UUID, so old links keep
  working.

---

## 13. Remaining to launch

Not "missing pages" — 217 pages exist, zero broken nav links, accounting engine
verified balanced. The real items are depth/ops, not features:

1. 🟡 **Legal — DRAFTED, needs sign-off.** `/legal/*` now have full clauses
   (commit 9961434). Remaining: fill the bracketed corporate facts
   (`[LEGAL ENTITY NAME]/[STATE]/[GOVERNING-LAW STATE]/[VENUE]` in terms) and
   get final counsel sign-off before the first paying client.
2. **Resend domain auth** — SPF/DKIM/DMARC for portier369.com so invites land
   in real inboxes (deliverability).
3. **Replace seed data** (Granville sample) with the first real client's data.
4. **Per-role verification + light security pass** on the money paths.
5. **Pilot** with one real management company — a full month of dues, work
   orders, and a board cycle to shake out edge cases.
6. ⏳ **SMS provider — placeholder.** Twilio + US 10DLC once a pilot needs
   texting. Don't pay until then.
7. *(Optional)* `app/platform` vs `app/platform-operator` consolidation —
   requires explicit approval.

> ✅ **Plaid** is closed (reconciliation, prior session) — no longer a launch
> blocker. See §10.

---

## 14. Test data & personas (current baseline)

One portfolio **Stellar Property Management**
(`aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`), one association **Granville Courts**
(`b1111111-1111-1111-1111-111111111111`): 1 building, 5 units (101–105),
5 owners, 1 tenant, 1 vendor. Accounting: $10,500 dues billed · $8,400
collected · **$2,100 A/R** · operating + reserve banks · FY2026 budget ·
2 vendor bills · 4 balanced journal entries.

Logins — all `@portier369.com`, password `Portier2026!`:

| Persona | Email | Role |
|---|---|---|
| Super-admin / operator | `hello@` | platform operator |
| Company admin | `admin@` | company admin |
| Manager | `manager@` | property manager |
| Olivia | `owner1@` | owner-occupant **and** Board President |
| Liam | `owner2@` | owner who rents unit 102 |
| Vendor | `vendor@` | Lakefront Maintenance LLC |
| Tessa | *(no login)* | tenant — data-only, email/SMS only |

Seed backup: `backups/seed-backup-*.json` (dump via
`scripts/backup-seed-data.js`); personas via `scripts/setup-personas.js`.

---

## 15. Engineering conventions

- `npm run typecheck` + `npm run build` before every commit; never push red.
- Verify Supabase columns before writing queries (§5).
- Commit messages via a temp file (`git commit -F`) — PowerShell here-strings
  choke on apostrophes.
- Keep `.hermes/STATUS.md`, `docs/PROJECT_STATUS.md`, and Claude memory in sync;
  treat `.hermes/STATUS.md` as ground truth over `EXECUTION_PLAN.md` (stale).
