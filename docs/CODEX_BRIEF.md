# Portier369 — Current-State Review & Work Brief (2026-07-26)

This document REPLACES `Portier369_vs_AppFolio_Benchmark_Report.pdf` (dated
~July 5, stale). Everything below was verified against the live site, the live
database, and the codebase on **2026-07-26**. Work only from this brief.

## Current state — verified facts (do not rebuild any of this)

**Platform (app.portier369.com):**
- 217 pages across 6 role portals (Platform Operator, Company Admin, Manager,
  Board, Owner, Vendor). Zero broken sidebar links.
- Accounting engine verified balanced at the DB level (journal-balance +
  closed-period triggers); AR/AP, GL, budgets, bank accounts, reconciliation.
- **Payments exist**: `app/api/payments`, Stripe webhook, Plaid link/exchange/
  `transactions/sync` (bank feeds), `app/api/bank-reconciliation`, owner and
  vendor ACH pages.
- 119-report catalog + Report Builder (whitelist catalog, saved views, CSV) +
  scheduled reports.
- AI: violation-letter drafter, communications copilot, conversational
  Portfolio Assistant (RLS-grounded, BYO-key via /settings/ai) + Automation
  Center. Not a "basic chatbot."
- Amenity reservations, board approval queue with digital sign-off,
  architectural reviews with messaging, CSV import (owners/units/balances),
  two-way SMS (no real SMS gateway yet — records only), email via Resend
  (SPF/DKIM/DMARC verified).
- Dashboard trend charts (cash flow, billed vs collected, work orders) —
  `components/dashboard/trend-charts.tsx`.
- Board and company-admin layouts already use the unified light-content shell
  with the shared dark sidebar. The design migration checklist is complete.

**Marketing site (portier369.com):** all key routes return 200 — `/`,
`/pricing` (full door-based tier page: Foundation $157 / Growth $382 /
Portfolio $642 / Enterprise custom; source of truth `lib/billing/plans.ts`),
`/company`, `/features`, `/legal/*`, `/report-card`, `/demo`, `/contact`.
The PDF's "broken Company link" does not exist.

## Hard scope rules

1. **Condo/HOA associations ONLY.** Never build leasing, vacancy, ILS
   syndication, rental marketing, tenant screening, rent collection, or rent
   rolls — deliberate, documented product decision.
2. New marketing routes MUST be added to `MARKETING_PATHS` in the middleware
   AND the sitemap, or they redirect to /login.
3. Match the existing v2 design system; function-parity with AppFolio only,
   never copy its visuals/text.
4. When renaming DB enums, grep DB functions for old literal values (a past
   tier rename silently broke charge creation).
5. No fabricated content: testimonials, case studies, and metrics must come
   from the owner.

## Approved build work

- **A. Marketing feature deep-dive pages** — Accounting, Maintenance & Work
  Orders, Communications, and Portals already exist. Audit and deepen those
  pages; add the missing Reporting page and split Board/Owner pages only if the
  owner wants separate positioning. (Scope rule 2 applies.)
- **B. Empty-state templates** — seed Documents/Letters with standard
  association templates (violation notices, welcome letters, meeting notices,
  arch-request forms) + operator onboarding checklist.
- **C. App sidebar icons** — the left nav is flat text; add consistent
  iconography per the design system.
- **D. SMS gateway** — wire a real provider (Telnyx account exists from the
  Stellar receptionist) behind the existing sms_messages recording.

## Release-readiness gates found 2026-07-26

- Apply `20260726000000_atomic_stripe_ledger_posting.sql` before the matching
  application deploy, then concurrency-test duplicate Stripe deliveries before
  accepting real payments.
- Public AI/chat/demo/report endpoints need durable provider-edge rate limiting
  and bot protection before a broad public launch.
- Telnyx is not wired. SMS records are queued rather than falsely marked sent;
  delivery status must come from authenticated provider webhooks.
- Confirm every variable documented in `.env.local.example` is configured for
  the appropriate Vercel environments, especially `CRON_SECRET`, Stripe webhook,
  Plaid, Resend, and AI-provider variables.
- Production dependency audit still reports high-severity vulnerabilities in
  the supported Next.js dependency chain. Recheck for a patched stable release
  immediately before deployment.

## Known non-code launch gates (owner's list, not Codex's)

Pilot with one real management company; legal counsel review of /legal/*;
replace remaining seed data with the first client's data; platform remittance
decision (how companies pay Portier369); native mobile apps (future project).
