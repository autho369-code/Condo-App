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
- `payment_methods`, `autopay_mandates`, and `payment_processor_configs`: available for tokenized owner ACH and autopay setup.
- `owners.portal_activated`, `owners.portal_login_last_at`, `user_invitations`, and `profiles`: available for portal activation tracking and invitation workflows.
- `document_templates`, `documents`, `email_queue`, and `management_agreements`: available for owner packets, agreement documents, outbound drafts, and agreement records.
- `vendors`, `vendor_compliance`, `form_templates`, `documents`, and `payable_bills`: available for vendor directory, vendor onboarding, compliance tracking, vendor forms, and payables context.

Recent local history indicates prior work leaned toward an AppFolio replica. This spec supersedes that visual direction.

Additional user-provided reference screens define important product bones:

- Violations list: association filter, escalation filter, bulk actions, follow-up completion, collection marking, downloadable violation list, inspection date, association, unit, rule, state, recent activity, escalation, next follow-up, pagination, task links, and compliance navigation.
- New association/property setup: property identity, address, description, manager details, rental information, lease settings, owner/trustee rows, accounting setup, management fees, additional fees, late-fee policy, budget variance thresholds, maintenance information, property groups, bank accounts, photos, notes, and attachments.
- Homeowner directory: people tabs, alphabet filtering, name/association/unit/phone columns, pagination, task links for changing homeowner, moving in homeowner, adding vendors, emailing homeowners, and homeowner-specific reports such as dues roll, delinquency, directory, and ledger.
- New owner setup: owner identity, contact methods, mailing address, federal tax fields, accounting defaults, bank account details, owner statement options, owner packet preferences, and maintenance/contact instructions.
- Owner ACH setup: owner, routing suffix, account suffix, and account type listing for ACH-capable owners.
- Owner portal activation: lease/form/info tabs, activation state, last activation link timestamp, and bulk actions such as send activation link.
- Send owner packets: date range, recipient scope, subject, body, attachment/report inclusion, portal delivery, and email delivery.
- New management agreement: step-based agreement flow for owner/association/property choice, agreement signature, and template/addendum selection.
- Send owner form: choose owner/association/property, choose template, choose recipients, include optional property detail, preview form, and continue to template/signature step.
- Vendor directory: vendor filter, trade filter, name/address/trade/phone/email columns, pagination, task links, and vendor reports.
- New vendor setup: vendor identity, vendor type/trade, contact methods, address, request vendor-portal information, federal tax, accounting defaults, payment type, bank details, compliance expirations, notes, and attachments.

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

## Associations And Onboarding

Association setup is one of the product's foundational data-entry workflows. The redesigned app should avoid a long, brittle form while preserving the full business coverage of the reference flow.

### New Association Flow

Use a modern multi-section setup workspace with save progress, validation, and section status. The flow should support:

- Property identity: property type, property name, address lines, city, state, ZIP, county, status, description, property group, and amenities.
- Property information: manager assignment, site manager details, year built, unit count, maintenance contacts, and owner/portal-facing instructions.
- Rental and lease settings: payment frequency, lease templates, additional templates, lease and renewal fee rules, and association-specific rental policies.
- Owners/trustees or board contacts where applicable: row-based entry with percent allocation, contact details, and role metadata.
- Accounting setup: payment type, reserve requirements, vendor 1099 payer, owner payout basis, bank account mapping, operating account, reserve account, and lockbox information.
- Management fees: start month/year, fee type, management fee percentage/amount, minimum and maximum management fee.
- Additional fees: lease fee, renewal fee, and additional association-level fee rows.
- Late-fee policy: fee type, fixed amount or percentage, eligible charges, grace period, recurring assessment timing, and optional schedule settings.
- Budget controls: variance threshold by amount and/or percentage.
- Maintenance information: maintenance limits, insurance expiration, preauthorized entry rules, maintenance instructions, emergency contact details, and online request settings.
- Assets and supporting data: photos, notes, and attachments.

The implementation should group these into progressive sections instead of a single scrolling page: Basics, Contacts, Accounting, Fees, Policies, Maintenance, and Files. Each section should be independently understandable, saveable, and validated.

### Association Detail

Association detail should connect setup data to daily work:

- Overview with profile, location, contacts, managers, financial setup, and active warnings.
- Units and owners attached to the association.
- Board/committee contacts.
- Budget and financial reports.
- Violations and architectural reviews.
- Work orders and maintenance settings.
- Bank accounts, fees, policies, documents, notes, and attachments.

Association detail should link directly into association-scoped report runs.

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
- Escalation filter for rows that need escalation or follow-up.
- Saved views: Open, Notice Due, Hearing Pending, Fined, Cured, Closed, Overdue.
- KPI strip: open violations, overdue notices, pending hearings, fines outstanding, cured this month.
- Table columns: inspection date, association, unit, rule/type, state/status, most recent activity, escalation flag, next follow-up, owner, fine, last action, next step.
- Bulk actions where appropriate: generate notices, complete follow-up, mark collected, assign follow-up, export/download violation list, and add selected rows to a violation report.
- Pagination and row-density controls for large violation sets.
- Compliance subnavigation for violations, architectural reviews, and related compliance views.

### Violation Detail

Detail pages should include:

- Summary header with status, unit, owner, association, rule/type, priority, due date, and fine amount.
- Evidence panel for photos, documents, and notes.
- Lifecycle timeline: opened, notice sent, hearing pending, fined, cured, closed.
- Follow-up steps with assignee and due dates.
- Owner communication log.
- Related reports and exports.
- Actions: send notice draft, record hearing, assess fine, mark cured, close, reopen.

### New Violation Flow

The new violation workflow should support:

- Association, unit, and owner selection with scoped search.
- Rule/type selection.
- Inspection date, due date, follow-up date, escalation flag, and priority.
- Status/state selection with sensible defaults.
- Evidence upload for photos and attachments.
- Notes and owner-facing message draft.
- Optional fine amount and collection settings.
- Save as draft, create violation, and create-and-send-notice actions.

Sending or emailing notices to owners is an external communication action and should remain a draft/review step unless the user explicitly confirms sending.

### Violation Reporting

Violation reporting should be integrated with the report workspace:

- Violation Log report.
- Overdue Violations report.
- Fines Assessed report.
- Cure Rate report.
- Violations by Association report.
- Owner Violation History report.

If these are not all present in `report_definitions`, add them as report-definition seeds in a separate schema/data task before wiring those report views.

## People And Homeowners

The people module should treat homeowners, owners, vendors, and related contacts as operational directories with report and task entry points.

### Homeowner Directory

The homeowner directory should support:

- Tabs or segmented views for Homeowners, Owners, Vendors, and related people groups where appropriate.
- Alphabet filtering, search, association filter, unit filter, and status filter.
- Table columns for homeowner/owner name, association, unit, phone, email, portal status, and balance or risk summary where available.
- Pagination for large owner lists.
- Right-side contextual tasks such as change homeowner, move in homeowner, create homeowner, create vendor, email homeowners, and open homeowner reports.
- Direct report links for dues roll, homeowner delinquency, homeowner directory, and homeowner ledger.

### New Homeowner Flow

The new homeowner flow should support:

- Person identity: first name, last name, display name, phone numbers, emails, preferred communication, electronic consent, and portal activation state.
- Address: mailing address plus association/unit context.
- Ownership links: association, unit, primary owner flag, share percentage, start date, and optional end date.
- Notes, documents, and communication preferences.
- Post-create actions: open owner ledger, send portal invite draft, create recurring charges, or run owner-scoped reports.

Owner and homeowner pages should link directly to owner-scoped report runs, especially Owner Ledger, Homeowner Directory, Delinquency, Dues Roll, Charge Detail, and violation history.

### New Owner Flow

The owner setup workflow should preserve the full reference coverage while presenting it as a modern sectioned workspace:

- Owner information: salutation, first name, last name, company name, tax name, tags, and duplicate-owner detection.
- Contact: multiple phone numbers, multiple emails, mailing address, alternate address, and personal address toggle.
- Federal tax: taxpayer ID name, taxpayer ID, 1099 eligibility, owner consolidation options, and 1099 mailing preference.
- Accounting information: contribution/check handling, default distribution method, hold-payment flag, default bank account linkage, and custom owner account number.
- Bank account information: owner ACH eligibility, bank routing number, bank account number, account type, verification state, and default payment method.
- Owner statement information: show transaction detail, show unpaid bills detail, show transaction notes, show invoices, generate management fee from statements, consolidated owner statement controls, and owner-facing memo text.
- Owner packet: send email toggle, include ACH/vendor options, include owner/account documents, GL account selection, included reports, and additional report rows.
- Maintenance information: owner-specific maintenance instructions and contact preferences.

Sensitive payment fields such as bank routing and account numbers should only be handled through a tokenization flow. The app should store processor tokens, last four digits, bank name, account type, verification status, and mandate metadata, not raw bank account numbers.

### Owner ACH And Autopay

Owner ACH setup should use `payment_methods` and `autopay_mandates` as the core model.

Required owner ACH behavior:

- List owners with masked routing/account identifiers, account type, verification state, and autopay status.
- Filter by association, owner, ACH status, verification status, and account type.
- Add ACH method through a tokenized processor flow.
- Display last four digits, bank name, account type, default method flag, and verification status.
- Create or update autopay mandates with owner, association, unit, payment method, maximum authorized amount, frequency, day of month, start date, end date, mandate signature timestamp, and status.
- Show failure count, last failure reason, pause/cancel state, next run date, and last run date.

Typing bank details into a processor form, transmitting ACH setup, or authorizing an autopay mandate is sensitive financial data transmission and requires explicit confirmation at action time.

### Owner Portal Activation

Owner portal activation should be an operational queue, not a tiny utility page.

Required behavior:

- Segment by lease, form, and info views where relevant to the owner portal activation workflow.
- Show owner, email, association/unit context, activation state, and last activation link timestamp.
- Support search, association filter, activation-state filter, and bulk selection.
- Actions: bulk activate draft, send activation link draft, resend link draft, mark activation issue, and open owner record.
- Use `owners.portal_activated`, `owners.portal_login_last_at`, `user_invitations`, and `profiles` where possible.

Sending portal activation links is an outbound communication and should require explicit confirmation before the send/enqueue step.

### Owner Packets

Owner packet sending should become a polished communication workflow backed by report outputs and document templates.

Required behavior:

- Select date range, association/owner/unit scope, and recipient group.
- Compose subject and body.
- Include owner-facing reports such as owner ledger, unpaid balances, statements, dues roll, and other selected report outputs.
- Include documents and attachments from `documents` or generated report artifacts.
- Choose delivery mode: owner portal only, email only, or both where supported.
- Preview packet contents before sending.
- Save packet draft for review.
- Track sent packet rows through `email_queue`, document records, or a future packet-specific table if needed.

Sending owner packets by email or portal notification is an outbound communication and should require explicit confirmation before the send/enqueue step.

### Owner Forms

Sending owner forms should be a step-based workflow backed by `form_templates`, `document_templates`, `documents`, and `email_queue`.

Required behavior:

- Step 1: choose owner, association, property, or unit context.
- Step 2: choose form template.
- Step 3: preview generated form and recipient details.
- Support optional property-detail inclusion when a form requires association or unit context.
- Save a form draft before delivery.
- Track generated documents through `documents` where a persistent file is created.
- Use `email_queue` only after the user explicitly confirms sending.

Sending an owner form is an outbound owner communication and should require explicit confirmation before the send/enqueue step.

### Management Agreements

New management agreement should be a step-based workflow:

- Step 1: choose owner, association, or property context.
- Step 2: choose agreement template and signature requirements.
- Step 3: choose template/addenda and review terms.
- Agreement fields should map to `management_agreements`: portfolio, association, owner, name, status, start date, end date, auto-renewal, renewal term, fee schedule, termination notice days, terms, document URL, signed timestamp, signed owner, signed manager, notes, and archived state.
- Link agreement records to association/owner detail pages and reports.
- Support draft, active, signed, expired, terminated, and archived states where the existing enum allows.

Sending a management agreement for signature is a legal/contractual communication and should require explicit confirmation before sending.

## Vendors

Vendors should be treated as a core people/payables/compliance workflow alongside owners.

### Vendor Directory

The vendor directory should support:

- Search by vendor name, contact, address, trade, and email.
- Trade filter and status/compliance filters.
- Table columns for name, address, trade, phone, email, portal activation, compliance status, and payables state where available.
- Pagination and row-density controls.
- Right-side contextual tasks such as new vendor, send vendor form, vendor ACH/payment setup, vendor ledger/report, vendor 1099 detail, and vendor 1099 summary.
- Direct links to vendor-scoped reports such as Vendor Directory, Vendor Ledger if available, Vendor 1099 Detail, Vendor 1099 Summary, Vendor Performance, Purchase Order Detail, and Bill Detail.

### New Vendor Flow

The new vendor setup workflow should preserve the reference coverage while using a modern sectioned workspace:

- Details: salutation, first name, last name, company name, vendor type, vendor trade, tags, duplicate-vendor detection, and eligibility for work orders.
- Contact: multiple phone numbers, multiple emails, address, and tax/mailing address toggle.
- Vendor portal request: whether to ask the vendor to provide missing profile data, business details, W-9/tax information, insurance, licenses, and related documents.
- Federal tax: taxpayer name, taxpayer ID, send 1099 flag, and 1099 reporting preferences.
- Accounting information: check consolidation, check stub breakdown, hold payments, email e-check receipt, payment terms, default check memo, default GL account, work-order adjustment, and adjustment type.
- Payment type: printable check, e-check, ACH, or other supported modes.
- Bank account information: routing number, account number, account type, savings/checking flag, and autopay/payment metadata where supported.
- Compliance: workers compensation, liability insurance, EPA certification, auto insurance, state license, and contract expiration dates.
- Notes and attachments.

Vendor bank details are sensitive financial data. They should be tokenized or masked where possible, and the UI should never display full account/routing numbers after entry.

### Vendor Forms

Vendor forms should mirror owner forms with vendor-specific recipients and templates:

- Choose vendor and form template.
- Include requested vendor profile fields or compliance documents.
- Preview message and attachments.
- Save as draft.
- Send only after explicit confirmation.

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

Association and homeowner onboarding flow:

1. User opens New Association or New Homeowner from command search, task links, or module actions.
2. UI renders a sectioned setup workspace with required fields and progress status.
3. Server validates required relationships such as portfolio, association, unit, owner, and bank account visibility under RLS.
4. Server actions create or update the record and revalidate the relevant directory/detail pages.
5. After save, the UI offers next actions such as open detail page, run scoped report, add units, add owner, configure fees, or upload documents.

Owner financial and communication flow:

1. User opens owner ACH, portal activation, owner packet, or management agreement from People, Tasks, command search, or owner detail.
2. UI loads the owner, association, unit, payment, document, and template context under RLS.
3. UI supports draft creation and preview without transmitting sensitive data or sending communications.
4. Server actions persist non-sensitive drafts or metadata using existing tables where possible.
5. The final send, enqueue, portal invitation, ACH transmission, or autopay authorization step asks for explicit action-time confirmation.

Vendor and form flow:

1. User opens vendor directory, new vendor, owner form, or vendor form from People, Tasks, command search, or a related owner/vendor detail page.
2. UI loads vendor, owner, association, form-template, document, compliance, and payables context under RLS.
3. UI supports form/template selection, preview, and draft creation without sending.
4. Server actions persist vendor records, compliance metadata, non-sensitive payment metadata, notes, and attachments.
5. The final form send, vendor portal request, ACH/payment transmission, or email enqueue step asks for explicit action-time confirmation.

## Error Handling

Use explicit states rather than silent failures:

- Loading: skeleton rows or compact loading panels.
- Empty: useful next action, such as "Create violation" or "Run report".
- Permission denied: explain the missing access without leaking restricted data.
- Report run failure: show status, timestamp, and retry action.
- Mutation failure: inline error near the action plus preserved form state.
- Missing configuration: show setup action for scheduled reports, notices, exports, or board packets.
- Sensitive financial setup: show tokenization/processor state and never echo full bank account or routing data after entry.
- Outbound owner communications: show draft, recipients, delivery method, and final confirmation state.
- Vendor compliance gaps: show missing insurance/license/tax requirements as actionable warnings rather than blocking the whole vendor record.
- Owner/vendor forms: show template availability, required merge fields, missing recipient data, and preview errors before send.

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
5. Association setup and homeowner directory/onboarding design foundations, with routes and sectioned UI patterns aligned to existing Supabase tables.
6. Owner ACH setup, owner portal activation, owner packet, and management agreement design foundations with safe draft/preview states.
7. Vendor directory, new vendor setup, owner form, and vendor form design foundations with safe draft/preview states.
8. Shared UI primitives needed for dense operations pages: metric strip, status chip, action toolbar, filter bar, workspace table, empty state, focus panel, sectioned setup workspace, file/evidence panel, tokenized-payment panel, communication preview panel, compliance panel, and stepper.

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
- New association UI preserves the required setup sections from the reference workflow.
- Homeowner directory supports alphabet filtering, association/unit context, and owner-scoped report links.
- New owner UI preserves owner identity, contact, tax, accounting, ACH, statement, packet, and maintenance sections.
- Owner ACH UI masks payment details and does not store raw bank account data.
- Portal activation and owner packet flows stop at draft/preview before sending unless explicitly confirmed.
- Management agreement workflow creates or previews agreement records without sending for signature unless explicitly confirmed.
- Vendor directory supports search, trade filtering, pagination, and vendor-scoped report/task links.
- New vendor UI preserves details, contact, portal request, tax, accounting, payment, compliance, notes, and attachments sections.
- Owner form and vendor form flows stop at preview/draft before sending unless explicitly confirmed.
- Command center links route to the correct filtered reports and violation views.
- Visual verification in the browser at desktop and narrower widths.

## Open Decisions For Implementation Plan

- Whether to rename the product brand in-app to ManageOps, Stellar OS, or another final name.
- Whether report saved views should use an existing table or require a small new table.
- Whether board packet drafts need persistence in the first slice or can start as UI-only output planning.
- Whether violation notice generation should draft records in `notices` immediately or wait for communication integration.
