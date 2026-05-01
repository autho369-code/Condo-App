# Command Center, Reports, and Violations Redesign

Date: 2026-05-01
Project: Condo-App UI
Branch: codex/operations-redesign

## Summary

Redesign the authenticated property-management app into a modern operations platform centered on a command-center dashboard, a first-class reporting workspace, and a comprehensive violations/compliance workflow. The product should preserve the business coverage seen in AppFolio-style property management systems while deliberately avoiding AppFolio's cramped visual language, small link-directory pages, and fragmented task surfaces.

The approved design direction is a premium, dense, modern operations UI inspired by products like Vercel and Linear: fast, structured, calm, and built for daily professional use. Reports are the core of the business and should become interactive workspaces rather than a long list of links. Violations should be elevated to a complete lifecycle module with reporting, notices, hearing/fine/cure tracking, and dashboard risk surfacing.

## Goals

- Replace the current AppFolio-like visual direction with a distinct modern app shell.
- Make reports a core workflow for managers, accountants, boards, and executives.
- Support 100% of the active report catalog available in Supabase, not only a small featured subset.
- Build a comprehensive violations center for enforcement, compliance, and reporting.
- Convert the dashboard into an action-oriented command center.
- Use existing Supabase schema and seeded product structure where possible.
- Keep the first implementation slice focused enough to ship and verify.

## Non-Goals

- Do not clone AppFolio's UI, spacing, colors, page structure, or report directory presentation.
- Do not attempt to implement every property-management module in the first slice.
- Do not introduce a new backend platform; continue using Next.js, Supabase Auth, Postgres, RLS, and Tailwind CSS.
- Do not add broad schema migrations unless a necessary field is missing for the first slice.
- Do not build external integrations such as Twilio, Postmark, QuickBooks, or full Stripe expansion in this slice.

## Current Context

The app is a Next.js 15 App Router project with Supabase Auth, RLS-scoped data fetching, Tailwind CSS, and a large existing Supabase schema. The local project includes many authenticated routes under `app/(app)`, shared workspace components under `components/workspace`, navigation components under `components/nav`, and report helpers under `components/reports` and `lib/rpcs/reports.ts`.

Supabase project `termxngysvotnfbzbgrv` already contains report and compliance data primitives:

- `report_definitions`: 47 rows across accounting, association, property/unit, maintenance, people, communication, and compliance categories.
- `report_definitions.parameter_schema` and `report_definitions.default_filters`: available to define report inputs such as association, owner, unit, date range, status, and output format.
- `report_runs.parameters`, `saved_reports.parameters`, and `scheduled_reports.parameters`: available to persist the exact scope used when running, saving, or scheduling a report.
- `violations`: 6 rows.
- `violation_updates` and `violation_followup_steps`: available for lifecycle detail.
- `notices`, `notice_recipients`, `documents`, `email_queue`: available for future notice generation and communication audit trails.
- `work_orders`, `approval_requests`, `payable_bills`, `charges`, `payments`, `bank_accounts`, `data_diagnostics`, and related tables: available for command-center and report context.

Recent local history indicates prior work leaned toward an AppFolio replica. This spec supersedes that visual direction.

## Product Principles

### Command Before Catalog

Every main surface should answer "what needs attention now?" before it presents a catalog of records. The app should help staff move from signal to report to action.

### Reports Are Workspaces

Reports should not be static links. A report opens into a workspace with filters, summary metrics, preview rows, saved views, export actions, scheduling, and board-packet actions.

### Scope Is Explicit

Every report run must clearly state what it is scoped to. At minimum the reporting engine should support portfolio-wide, association-specific, owner-specific, and unit-specific report scopes. The selected scope should travel through filters, preview data, saved reports, scheduled reports, exports, and board packets.

### Compliance Is A Lifecycle

Violations are not just records. Each violation has status, evidence, owner/unit context, due dates, notices, hearing/fine/cure steps, follow-up actions, and audit history.

### Dense But Calm

The UI should support high-volume property operations without becoming visually noisy. Use tight information architecture, restrained color, clear type hierarchy, predictable actions, and compact tables.

## Visual Direction

Use a light, professional base with strong contrast and selective accent color. The interface should feel modern, precise, and operational. Avoid AppFolio-like tiny blue links, pale nested boxes, large blank side gutters, and long undifferentiated report lists.

Primary traits:

- Compact dark or neutral left rail for top-level modules.
- Top command/search bar with portfolio, association, owner, unit, vendor, and report search.
- Main content with clear page title, module context, and primary actions.
- Right-side contextual focus panel only when it adds actionable value.
- Tables with strong scanning support: sticky headers where useful, status chips, numeric alignment, and compact row actions.
- Cards only for repeated objects, summary metrics, modals, and framed tools. Avoid cards inside cards.
- Color used for meaning: risk, success, warning, neutral, and information.

## App Shell Design

The authenticated app should use a redesigned workspace shell with these zones:

- Left rail: high-level modules such as Command, Associations, Accounting, Reports, Violations, Maintenance, Communications, Settings.
- Secondary navigation: module-specific pages or saved views when needed.
- Global command search: route to reports, owners, units, associations, vendors, bills, violations, and work orders.
- Main workspace: page content optimized for the current workflow.
- Focus panel: task queue, recent activity, selected record summary, or report output actions.

The shell should preserve role-aware navigation from the existing `getMe()`/RLS model. Platform operators, staff, finance users, boards, residents, and vendors should only see appropriate modules.

## Command Center

The dashboard should become an operations command center, not a stack of disconnected widgets.

Core sections:

- Portfolio health: collection rate, outstanding AR, cash position, open AP, work-order SLA, compliance risk.
- Focus queue: prioritized tasks from reports, violations, bills, approvals, work orders, data diagnostics, and scheduled report runs.
- Reports due: scheduled reports, monthly board packets, failed report runs, and export deadlines.
- Violations and compliance: open violations, overdue notices, upcoming hearings, fines pending, cured/closed trend.
- Maintenance: emergency/high-priority work orders, recurring work orders due, vendor compliance issues.
- Financial exceptions: delinquency movement, unreconciled bank accounts, aged payables, unpaid balances by month.

The command center should link directly into filtered report workspaces or violation detail workflows.

## Reports Workspace

Reports are the core of the business. The reports module should replace long report link directories with a modern workspace.

### Full Report Coverage

The reports module must expose every active report in `report_definitions`. This means the app should provide 100% report catalog coverage from Supabase while using an original, modern UI. The goal is functional report parity and complete business coverage, not copying AppFolio's visual presentation.

The active Supabase catalog currently contains 47 reports:

Accounting reports:

- A/P Aging
- A/R Aging
- Aged Payables Summary
- Bank Reconciliation
- Bill Detail
- Charge Detail
- Check Register
- Deposit Register
- Expense Register
- General Ledger
- Income Register
- Journal Entry Register
- Owner 1099 Detail
- Owner 1099 Summary
- Trial Balance
- Vendor 1099 Detail
- Vendor 1099 Summary

Association reports:

- Annual Budget Comparative
- Assessment Roll
- Balance Sheet
- Budget vs Actual
- Cash Flow Statement
- Delinquency Report
- Dues Roll
- Fund Balance Sheet
- Income Statement
- Owner Ledger
- Owner Vehicle Info
- Reserve Fund Analysis
- Unpaid Balances by Month

Property and unit reports:

- Property Directory
- Unit Availability
- Unit Turn Report

Maintenance reports:

- Maintenance History
- Open Work Orders
- Project Directory
- Purchase Order Detail
- Vendor Performance
- Work Order Report

People reports:

- Owner Directory
- Vendor Directory

Communication reports:

- Letter History
- Survey Results

Compliance reports:

- Data Diagnostics Summary
- Email Delivery Errors
- User Roles and Permissions
- Violation Log

Every report in this catalog must have a library entry, category placement, searchable metadata, scope handling, supported output formats, and a detail workspace route. Reports whose calculations are not fully implemented yet should still have a visible workspace with a clear implementation state, expected inputs, and blocked-output messaging rather than disappearing from the product.

### Report Library

The report library should show report categories from `report_definitions`, including:

- Accounting: A/R Aging, A/P Aging, General Ledger, Trial Balance, Bank Reconciliation, Check Register, Deposit Register, Vendor 1099, Owner 1099, Charge Detail, Bill Detail, and related registers.
- Association: Assessment Roll, Delinquency Report, Dues Roll, Income Statement, Balance Sheet, Cash Flow Statement, Budget vs Actual, Owner Ledger, Fund Balance Sheet, Reserve Fund Analysis, Unpaid Balances by Month.
- Maintenance: Open Work Orders, Work Order Report, Maintenance History, Project Directory, Vendor Performance, Purchase Order Detail.
- Compliance: Violation Log, Data Diagnostics Summary, Email Delivery Errors, User Roles and Permissions.
- Property and Unit: Property Directory, Unit Availability, Unit Turn Report.
- People and Communication: Owner Directory, Vendor Directory, Letter History, Survey Results.

Library UX:

- Search by report name, description, category, or output column.
- Category tabs or segmented filters.
- Scope picker for portfolio, association, owner, and unit before or during report launch.
- Favorite reports.
- Recently run reports.
- Saved views.
- Scheduled reports.
- Report builder entry point for admins or power users.
- Coverage indicator showing active report count and any report workspaces not yet fully wired to calculations.

### Report Detail Workspace

When a report opens, it should provide:

- Report title, category, description, and last-run status.
- Filter bar for association, property, unit, owner, date range, status, category, vendor, and report-specific inputs.
- KPI strip for report-specific totals.
- Preview table with sortable columns.
- Output actions: export CSV, export PDF, save view, schedule, add to board packet.
- Run history and generated artifacts.
- Empty, loading, error, and permission states.

Reports should remain server-driven where possible, with client interactivity only for filter controls, local table interactions, and output actions.

### Association And Owner Report Runs

Running reports by association and by owner is part of the core product, not a follow-up enhancement.

Required scoped report behavior:

- Association selector should search `associations` by name, city, status, and portfolio.
- Owner selector should search `owners` by name, email, phone, and linked units.
- Unit selector should search `units` by unit number and association context.
- Selecting an association should constrain owner and unit choices to that association where the report supports it.
- Selecting an owner should show their linked units through `unit_owners` and allow owner-ledger-style reports to run for all owned units or one selected unit.
- Report run parameters should persist the selected scope in `report_runs.parameters`.
- Saved report parameters should persist reusable association/owner scopes in `saved_reports.parameters`.
- Scheduled report parameters should persist recurring association/owner scopes in `scheduled_reports.parameters`.
- Exports and board packets should display the selected scope in the header so a PDF or CSV can be traced back to the correct association or owner.

First-slice report scopes:

- Association-level: A/R Aging, Delinquency Report, Dues Roll, Income Statement, Balance Sheet, Budget vs Actual, Open Work Orders, Violation Log.
- Owner-level: Owner Ledger, Owner Violation History, Unpaid Balances, Charge Detail, Payment History if available from existing payment tables.
- Portfolio-level: report library, scheduled report overview, saved reports, diagnostic summaries.

The first slice should create the generic routing, library, metadata display, filtering shell, and workspace frame for all 47 active reports. It should fully wire data previews for the highest-value reports listed above first, while all remaining active reports remain visible and identifiable as report workspaces with their Supabase metadata and supported output formats.

## Board Packet Workflow

Board packets should be treated as an output layer on top of reports, not a separate reporting system.

Initial packet actions:

- Add report to packet.
- Save packet draft by association and meeting date.
- Reorder packet sections.
- Export packet PDF.
- Schedule recurring monthly packet.

The first slice can include the UI structure and data model assumptions without full PDF generation if no existing PDF pipeline is available.

## Violations And Compliance Center

The violations center should be comprehensive and visible in the main navigation.

### Violations List

The list should support:

- Filters: association, unit, owner, violation type, status, priority, due date, hearing date, fine status.
- Saved views: Open, Notice Due, Hearing Pending, Fined, Cured, Closed, Overdue.
- KPI strip: open violations, overdue notices, pending hearings, fines outstanding, cured this month.
- Table columns: violation, association, unit, owner, rule/type, status, due date, fine, last action, next step.
- Bulk actions where appropriate: generate notices, assign follow-up, export report.

### Violation Detail

Detail pages should include:

- Summary header with status, unit, owner, association, rule/type, priority, due date, and fine amount.
- Evidence panel for photos, documents, and notes.
- Lifecycle timeline: opened, notice sent, hearing pending, fined, cured, closed.
- Follow-up steps with assignee and due dates.
- Owner communication log.
- Related reports and exports.
- Actions: send notice draft, record hearing, assess fine, mark cured, close, reopen.

### Violation Reporting

Violation reporting should be integrated with the report workspace:

- Violation Log report.
- Overdue Violations report.
- Fines Assessed report.
- Cure Rate report.
- Violations by Association report.
- Owner Violation History report.

If these are not all present in `report_definitions`, add them as report-definition seeds in a separate schema/data task before wiring those report views.

## Data Flow

All authenticated app pages should continue using Supabase server-side data fetching under RLS. The frontend should query as the logged-in user unless a server-only admin action is explicitly required.

Recommended flow:

1. Page or layout calls `requireStaff()`, `requirePlatformOperator()`, or the appropriate guard.
2. Server component fetches initial report, dashboard, or violation data.
3. Client components handle local filter selection and form state.
4. Server actions or route handlers execute mutations such as saved views, scheduled reports, violation updates, or notice drafts.
5. Mutations call `revalidatePath` for affected pages.
6. Supabase RLS enforces tenant and role boundaries.

Report run flow:

1. User opens a report from the library or a command-center link.
2. UI reads the report definition and renders filter controls from `parameter_schema`.
3. User selects portfolio, association, owner, unit, date range, status, and report-specific filters.
4. Server validates that the requested association, owner, or unit is visible to the logged-in user under RLS.
5. Server fetches preview data and summary metrics for the selected scope.
6. If the user runs, saves, schedules, exports, or adds to a board packet, the selected scope is stored in the relevant `parameters` jsonb field.
7. The report output header always includes report name, selected scope, date range, run timestamp, and user-visible portfolio/association/owner labels.

## Error Handling

Use explicit states rather than silent failures:

- Loading: skeleton rows or compact loading panels.
- Empty: useful next action, such as "Create violation" or "Run report".
- Permission denied: explain the missing access without leaking restricted data.
- Report run failure: show status, timestamp, and retry action.
- Mutation failure: inline error near the action plus preserved form state.
- Missing configuration: show setup action for scheduled reports, notices, exports, or board packets.

## Accessibility And Responsiveness

The app should remain usable on laptop and desktop first, with responsive tablet behavior for key pages. Reports and dense operations tables can prioritize desktop ergonomics.

Requirements:

- Keyboard-accessible navigation and controls.
- Visible focus states.
- Buttons and icon actions with accessible labels.
- Tables that do not rely on color alone for status.
- No overlapping text or unstable control sizes at common desktop widths.
- Mobile and narrow widths should collapse navigation and preserve essential workflows.

## First Implementation Slice

The first implementation slice should include:

1. Redesigned app shell and navigation foundation.
2. Command center dashboard structure and summary panels.
3. Reports library and one reusable report workspace pattern with association and owner scoped runs.
4. Violations list and violation detail redesign.
5. Shared UI primitives needed for dense operations pages: metric strip, status chip, action toolbar, filter bar, workspace table, empty state, and focus panel.

This slice should not attempt to finish every report calculation or every violation action. It should establish the product architecture and polished UX pattern, then wire the highest-value existing data.

## Testing Strategy

Use focused verification for the first slice:

- TypeScript and Next.js build should pass.
- Navigation renders by role without crashing.
- Reports page shows category/library data from existing report definitions.
- Reports page shows all active report definitions from Supabase.
- Report catalog count in the UI matches the active `report_definitions` count.
- Reports can be filtered and run for a selected association.
- Owner-scoped reports only show units linked to the selected owner.
- Saved and scheduled report payloads preserve association and owner parameters.
- Report workspace handles loading, empty, and populated states.
- Violations list shows existing violation rows and status filters.
- Violation detail renders a valid record and handles missing/not-found state.
- Command center links route to the correct filtered reports and violation views.
- Visual verification in the browser at desktop and narrower widths.

## Open Decisions For Implementation Plan

- Whether to rename the product brand in-app to ManageOps, Stellar OS, or another final name.
- Whether report saved views should use an existing table or require a small new table.
- Whether board packet drafts need persistence in the first slice or can start as UI-only output planning.
- Whether violation notice generation should draft records in `notices` immediately or wait for communication integration.
