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
6. **One association, one Stripe account.** Every association must own a
   unique Stripe Connect Standard account. All payments are direct charges in
   that connected-account context; shared merchant accounts, destination
   charges, pooled balances, and platform custody of association funds are
   prohibited.

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

Completed in the staged release branch:

- Durable application throttles and live Vercel firewall limits protect public
  AI, demo, violation-report, and assistant endpoints.
- Supported dependency overrides resolve Next.js to patched PostCSS and Sharp
  versions; the clean production dependency audit reports zero vulnerabilities.
- Stripe operations fail closed on association, connected-account, mode,
  amount, currency, and idempotency mismatches. Atomic ledger posting and
  refund/dispute/payout reconciliation are staged.
- Current plaintext/default credential paths are retired; owner activation now
  uses private verified-email invitations and owner-selected passwords.
- Tenant RLS, SECURITY DEFINER execution boundaries, storage paths, redirects,
  rich text, AI credentials, and service-role actions were hardened.

Still blocking production release:

- The six 20260726 Supabase migrations are staged but **not applied**. Remote
  history has 159 versions while local history has invalid names and duplicate
  versions. Follow the reconciliation runbook and disposable replay; never run
  the CLI's suggested bulk `repair --status reverted` command.
- The public Git history contains two credible historical Supabase
  service-role credentials. Treat them as compromised until legacy keys are
  rotated/revoked, sessions and affected accounts are reset, database jobs are
  checked, logs are reviewed, and all old refs/tags are scrubbed.
- Production has two associations and zero connected Stripe accounts. Each
  association must separately complete Standard onboarding and prove
  details_submitted, charges_enabled, and payouts_enabled before Pay Online or
  AutoPay is enabled.
- Real production `STRIPE_SECRET_KEY` and Connect
  `STRIPE_WEBHOOK_SECRET` values must be configured and verified without
  exposing them. Plaid remains gated on its real credentials if bank feeds are
  enabled.
- Telnyx is not wired. SMS remains queued-only until a real gateway and
  authenticated delivery webhooks exist.

## Known non-code launch gates (owner's list, not Codex's)

Pilot with one real management company; legal counsel review of /legal/*;
replace remaining seed data with the first client's data; platform remittance
decision (how companies pay Portier369); native mobile apps (future project).
