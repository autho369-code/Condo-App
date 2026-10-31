# 2026-10-31 Drift Report — roles and design system

Method: code read in `C:/Users/autho/Portier369` at `0839e747`; RLS, triggers and grants read from the migrations and cross-checked with read-only `pg_policies` / `pg_trigger` / `pg_proc` queries on project `termxngysvotnfbzbgrv`. Nothing was modified.

## docs/redesign/ROLE_ACCESS_MATRIX.md

- **[Major] Any platform operator, not just admins, can write `email_hold_associations`.**
  Rule: "Operators: read across companies. They write only with role `admin`." The doc also says the database enforces this with `operator_write_guard`.
  Evidence: `supabase/migrations/20261027010000_hold_resident_email_one_association.sql:39-42`: `for all to authenticated using ((select public.is_platform_operator())) with check (...)`. Live, the table has no `operator_write_guard` trigger and no `operator_writes_need_admin_*` restrictive policy.
  Why it matters: a `readonly` or `support` operator can add or remove email holds for any association straight through PostgREST. That decides whether owners and tenants get email. The server-action guard does not cover a direct API call.

- **[Major] Vendors can write much more than "a work order's status".**
  Rule: "They can change only a work order's status (`trg_work_order_000_vendor_guard`)."
  Evidence (live policies, still in force):
  - `inspections_vendor_rw` FOR ALL. `inspections_self_service_guard` (`20260930200000_self_service_column_guards.sql`) lets a vendor change `status`, `notes` and `completed_date` on the inspections assigned to them.
  - `inspection_items_vendor_rw` FOR ALL. Vendors can insert and update findings; only resolution fields are blocked.
  - `vendor_compliance_self_insert/update`. Nothing guards the fields, and `trg_vendor_compliance_sync` is disabled.
  - `vendors_self_update`, limited to contact fields by `vendors_self_service_guard`.
  - `wo_msg_vendor_insert` and `wo_updates_vendor_insert`.
  - Service-role writes in `lib/rpcs/vendor-submissions.ts` (`documents` insert, `document_requests` update, invoice RPC).
  Why it matters: the matrix understates what vendors can write. Changing inspection status is a write to manager-owned data that the doc says cannot happen.

- **[Major] Vendor message author can be forged.**
  Rule: "Vendors: their own vendor records (`current_vendor_ids()`)."
  Evidence: `supabase/migrations/20260715040000_production_schema_baseline.sql:23996` `wo_msg_vendor_insert` checks only `author_role = 'vendor'` and that the work order is the vendor's. There is no `author_id = auth.uid()` check, unlike the owner policy `wo_msg_resident_insert`, and no trigger sets `author_id` or `author_name`. Live trigger list: `operator_write_guard` only.
  Why it matters: a vendor can post on its own work orders with any `author_id` or `author_name`, for example a staff member's, by calling REST directly. `lib/rpcs/work-orders-messages.ts:72` sets the name server-side, but only on the action path.

- **[Major] The board description is out of date. The board has no write workflows, and 18 of its 26 pages are redirect stubs.**
  Rule: "Board: their associations ... Read-only except the workflows that already exist." The table also lists the board at 26 pages, "layout only 19".
  Evidence:
  - `supabase/migrations/20261005111000_board_read_only_scope.sql:53-65` sets `arch_msg_board_insert`, `wo_msg_board_insert` and `board_insert_comments` to `with check (false)`, and revokes `cast_board_approval` and `board_decide_architectural_request` from `authenticated`.
  - `app/board/{approvals,architectural-reviews,architectural-reviews/[id],assistant,calendar,capital-reserves,communications,compliance,delinquencies,insurance,owners,projects,vendors,violations,violations/[id],violations/analytics,violations/repeat-offenders,work-orders}/page.tsx` are all 7-line `redirect('/board')` stubs.
  Why it matters: the matrix implies board write workflows and 26 working board pages. In the code, the board is strictly read-only with 7 real pages plus `meetings/[id]`.

- **[Major] Owners can write tenant lease dates, which the matrix does not list.**
  Rule: "Owners: ... Writes are tied to the named record (`owner_record_matches`)."
  Evidence: `app/portal/lease/page.tsx:33-50` `updateTenantLease` calls RPC `owner_update_tenant_lease` with a `tenant_id` taken from formData. Ownership is re-checked only inside the RPC (I did not verify the RPC body). Live owner write policies also include `autopay_mandates` (ALL), `owners_self_update`, `insurance_policies`, `votes`, `approval_requests`, `amenity_reservations`, `architectural_requests`, `service_requests`, `violations` (anonymous report) and `survey_responses`.
  Why it matters: the owner write surface, including writes to `tenants` rows that managers own, is not documented. Whether the RPC's ownership check is correct is **unverified**.

- **[Nit] Signed-out owners and residents land on plain `/login`.**
  Rule: `requireOwner` "→ `/login?mode=owner`"; `requireTenant` "→ `/login?mode=resident…`".
  Evidence: `lib/auth/me.ts:364` and `:384` call `requireAuth()` first, which sends a signed-out user to plain `/login` (`:197`). Only a signed-in non-owner reaches `?mode=owner`. `requireVendor` (`:322`) does redirect to `?mode=vendor`.

- **[Nit] `requireOwner` and `requireVendor` validate only the first record.**
  Rule: "a login with an active (portal on, not archived) owner record".
  Evidence: `lib/auth/me.ts:371-378` and `:329-336` check only `me.owner_id` / `me.vendor_id`. `current_owner_ids()` already filters to active records, so the effect is small. Behavior when a record is deactivated during a session is **unverified**.

- **[Nit] The company-admin sidebar count is off by one.**
  Rule: Company admin "Sidebar entries 29".
  Evidence: `lib/navigation/role-modules.ts:51-82` has 30 entries.

- **[Nit] Some baseline policies the matrix relies on no longer exist under those names.**
  Evidence: `documents_board_read`, `budget_lines_board_read` and the baseline `insurance_resident_*` policies were dropped by a dynamic `drop policy` loop in `20260726040000_database_tenant_security_hardening.sql:900-920` and recreated under new names. This is not a behavior divergence, but anyone grepping the migrations for policy names will be misled. The source of truth should be the live `pg_policies`.

No divergence found in: the per-area layout guards (all seven match), page counts per area, `roleHome` order, `requirePlatformAdmin` / `requirePlatformOperator` redirects, middleware operator-write and MFA enforcement, `mgr_assoc_scope` coverage (every `association_id` table except `email_hold_associations`), or owner/vendor/board reads of manager notes. Note columns readable by these roles are either moved to `*_private` tables by triggers (all counts are 0 live) or hold non-manager data.

## docs/DESIGN_SYSTEM.md

About 60 pages sampled across all six areas.

- **[Nit] Raw `<table>` markup is widespread, including in the documented reference page.**
  Rule: "Anti-patterns (instant rejection) ... raw `<table>` markup".
  Evidence (page.tsx files containing `<table`):
  - `app/(app)`: 15, including `app/(app)/associations/[id]/units/page.tsx:166`, which CLAUDE.md names as the reference detail page; `app/(app)/reports/[slug]/page.tsx` alone has 26.
  - `app/board`: 3 (`budget:194`, `financials:373`, `meetings:63,111,146`).
  - `app/portal`: 3 (`vehicles:58`, `violations:96`, `work-orders:82`).
  - `app/vendor/payments/page.tsx:85`.
  - `app/company-admin`: 18 (for example `overview:231,325`, `compliance:149,183,219,257`, `financials:171,207,248`).
  - `app/platform-operator`: 11 (for example `security:99-245` ×5, `system:86-193` ×4).

- **[Nit] Several shadow values are not the token.**
  Rule: "new shadow values" are an anti-pattern; the card token is `0_1px_2px_rgba(16,24,40,0.04)`.
  Evidence:
  - `app/(app)/accounting/page.tsx:146`, `app/(app)/maintenance/templates/page.tsx:57` and `app/board/reports/page.tsx:80` use `shadow-[0_1px_3px_rgba(16,24,40,0.08),0_4px_12px_-4px_rgba(16,24,40,0.1)]`.
  - `app/(app)/owners/page.tsx:439` uses `shadow-[0_1px_3px_rgba(16,24,40,0.08)]`.

- **[Nit] Inline hex color in a manager page.**
  Rule: "inline hex colors" are an anti-pattern.
  Evidence: `app/(app)/signatures/[id]/certificate/page.tsx:23` `bg-[#f6f7f9]`.

- **[Nit] Some status pills use hand-picked colors.**
  Rule: "Status colors come ONLY from `Badge` ... or `StatusChip`. Never hand-pick status colors."
  Evidence:
  - `app/portal/pay/page.tsx:176` (`bg-emerald-100 text-emerald-700`).
  - `app/(app)/letters/[id]/edit/page.tsx:138`.
  - `app/(app)/owners/[id]/page.tsx:1199` (`bg-amber-50 text-amber-700` "hold").
  - `app/(app)/reminders/page.tsx:73` (`bg-amber-100 text-amber-800`).
  - `app/(app)/vendors/ach/page.tsx:276,291`.
  - Health-legend dots: `app/platform-operator/association-health/page.tsx:190-202` and `app/company-admin/overview/page.tsx:293-301`.

- **[Nit] Most role areas skip the page scaffolding and hand-write the header.**
  Rule: "Component kit — use these, nothing else". Standalone pages should use `PageShell` + `PageHeader`.
  Evidence: share of page.tsx files using `PageShell`/`PageHeader`/`DataWorkspace`/`Workspace`:
  - `app/portal` 1/35.
  - `app/board` 0/26.
  - `app/company-admin` 1/24.
  - `app/platform-operator` 2/21.
  The others hand-copy the `<h1>` (for example `app/portal/page.tsx:125`, `app/board/page.tsx:49`, `app/company-admin/overview/page.tsx:173`, `app/platform-operator/overview/page.tsx:379`).
  In `app/(app)`, 10 pages have no shell at all:
  - `bulk-statement-settings/new`, `letters/new`, `calendar/new`, `sms/templates/new`, `documents/templates/new`, `documents/templates/[id]/edit`, `letters/[id]/edit`, `letters/[id]/preview`, plus 2 print pages.
  - Two of these use a different h1 scale (`text-[22px] sm:text-[26px] font-semibold`) at `bulk-statement-settings/new/page.tsx:34` and `letters/new/page.tsx:77`. Shared headers use 26/30px bold.

- **[Nit] An undocumented component is in wide use.**
  Rule: "use these, nothing else".
  Evidence: `components/ui/card.tsx` (`Card`, `CardHeader`, `CardTitle`, `CardBody`, `Stat`) is not in the kit. It is used by 13 role pages, including `app/portal/pay`, `app/portal/architectural/*`, `app/portal/service-requests/*` and `app/platform-operator/companies/*`.

- **[Nit] The documented tokens no longer match the code.**
  Rule: "Ink / headings `text-gray-950`, tracking `-0.02em`" and "Font Inter".
  Evidence:
  - `components/ui/shell.tsx:43` (`PageHeader`) and `components/workspace/shell.tsx:52` use `font-display ... tracking-[-0.025em] text-ink`.
  - `--ink: #0e1116` (`app/globals.css:13`).
  - The display font is Schibsted Grotesk (`app/layout.tsx:16-21`), not Inter.
  - A per-workspace `--brand` accent (`#10b981` default, `app/globals.css:15`) exists that the doc does not mention.

- **[Major, unverified] Most company pages do not show `NoCompanyNotice` to an account with no company.**
  Rule: "`if (!me.portfolio?.id) return <NoCompanyNotice ... />`" on company pages.
  Evidence: 53 `app/(app)` page.tsx files read `me.portfolio?.id`; only 4 use `NoCompanyNotice`. For example, `app/(app)/charge-categories/page.tsx:20` runs `.eq('portfolio_id', me.portfolio?.id)` with an undefined value for an operator. `app/(app)/accounting-periods/page.tsx:50` redirects to `/dashboard` instead.
  Why it matters: a platform operator gets an empty or failing page instead of the documented notice. I did not check the runtime result in the browser.

- **Links: no drift found.** Every literal `href="/..."` in role-area pages, and every entry in `lib/navigation/role-modules.ts`, resolves to an existing `page.tsx` or route.
