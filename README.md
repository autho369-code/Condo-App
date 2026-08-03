# Portier369 (condo-app)

HOA/community-association management SaaS. Next.js 15 (App Router) + Supabase + Tailwind, deployed on Vercel at **portier369.com**.

Connects to the Supabase project `termxngysvotnfbzbgrv` (~190 tables). Every page flows the user's Supabase session through to RLS — the database, not the frontend, decides what data is visible. See `CLAUDE.md` for the non-negotiable engineering rules and `docs/DESIGN_SYSTEM.md` before touching any UI.

## Application map

Six role-scoped surfaces share one design system (dark sidebar + light content) and one auth chain (invitation-only, top-down):

```
app/
├── (marketing)/          ← public site: home, /features/*, /pricing, /company,
│                            /compare, /local, /hoa-laws, /demo (lead form), /legal/*
├── (auth)/               ← login (role tabs), signup, forgot/reset password, accept-invitation
├── (app)/                ← MANAGER workspace: dashboard, associations, units, owners,
│                            accounting (GL, charges, bills, banking, budgets, 1099),
│                            119 reports + builder, work orders, violations, ARC,
│                            maintenance, inventory, communications, SMS, documents,
│                            command-center (payments/reconciliation), settings
├── company-admin/        ← COMPANY ADMIN executive suite: overview, financials,
│                            manager performance, compliance, AI insights, billing
├── board/                ← BOARD portal: financials, budget vs actual, delinquencies,
│                            approvals (e-voting), homeowners, compliance, AI assistant
├── portal/               ← OWNER portal: balance, pay online/AutoPay, My Home,
│                            requests, ARC, amenities, vehicles, insurance, AI assistant
├── vendor/               ← VENDOR portal: work orders, schedule, properties,
│                            payments status, compliance, performance, AI assistant
├── platform-operator/    ← PLATFORM OPERATOR: companies, users, billing, revenue,
│                            platform intelligence, system monitor, security center
├── platform/             ← legacy → redirects to /platform-operator
└── api/                  ← auth callback, AI assistants (per role), Stripe webhook,
                             Plaid, cron routes (reconcile, autopay, reminders, reports)

lib/
├── supabase/{server,client,middleware}.ts  ← cookie / browser / service-role clients
├── auth/me.ts            ← me() RPC wrapper, roleHome(), route guards (requireStaff, …)
├── payments/             ← Stripe (per-association Connect accounts), reconciliation
├── plaid/                ← bank feed sync + GL auto-match
├── reports/              ← report catalog + execution engine
├── ai/                   ← per-role data snapshots for the AI assistants (BYO key)
├── navigation/           ← role-scoped sidebar module lists
└── server/cron-auth.ts   ← fail-closed CRON_SECRET guard for scheduled endpoints
```

## Setup

```bash
npm install
cp .env.local.example .env.local
# Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#           SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_PORTAL_URL
# Optional (feature-gated): RESEND_API_KEY, PLAID_*, STRIPE_SECRET_KEY,
#           STRIPE_WEBHOOK_SECRET, CRON_SECRET
npm run types      # regenerate lib/types/database.ts from the live schema
npm run dev
```

Checks to run before every push: `npm run typecheck`, `npm test`, `npm run build`. Never push red.

## Auth & authorization model

1. `/login` (role tabs: Manager / Owner / Vendor, plus Company Admin & Operator entries in the footer) → `loginWithPassword` Server Action → destination resolved by the account's ACTUAL role via `roleHome()`.
2. `middleware.ts` refreshes the session cookie and bounces logged-out users to `/login`; `PUBLIC_PATHS` / `MARKETING_PATHS` list everything reachable without a session. Public `/api/*` entries are each independently protected in their route handler (cron secret or Stripe signature).
3. Every layout guards its surface (`requireStaff`, `requireOwner`, `requireBoard`, `requireVendor`, `requirePortfolioAdmin`, `requirePlatformOperator`) and **every Server Action re-checks authorization inside the action** — actions are callable endpoints, page-level guards are not enough.
4. RLS is enabled on all tables with portfolio-scoped policies (`can_access_portfolio`, `can_manage_finance`, `is_any_staff`, board/resident/vendor read policies). The service-role client (`createServiceClient`) is server-only and used only where RLS intentionally blocks the acting role (e.g. cron jobs, owner-initiated log rows) — always behind a role guard.
5. Invitations flow operator → company admin → managers → owners/board/vendors. All accounts are invitation-based; self-serve password reset via `/forgot-password` (Resend email pipeline).
6. `LOCAL_PREVIEW_MODE=true` fabricates an operator identity for local demos. It refuses to run in production (module-level assertion) — never set it in Vercel.

## Payments architecture (Stripe + Plaid)

Truth hierarchy: **Portier ledger → Stripe → bank**. Each association has its OWN Stripe account (Connect Standard, direct charges) settling to its own bank — no commingling. Owner payments post to the double-entry ledger on success; payouts are batch-matched to online payments and reconciled against the Plaid bank feed every 15 minutes (`/api/payments/reconcile`), with ambiguity routed to the Command Center exception queue. Dormant until `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (Connect webhook) are configured; offline payment recording works regardless.

## Scheduled jobs (vercel.json crons)

All cron endpoints require `Authorization: Bearer ${CRON_SECRET}` (fail-closed; Vercel sends it automatically once the env var exists):

| Route | Schedule | Job |
|---|---|---|
| `/api/maintenance/send-reminders` | daily 13:00 UTC | vendor maintenance reminders |
| `/api/payments/reconcile` | every 15 min | payout ↔ bank-feed matching |
| `/api/payments/autopay-run` | daily 14:00 UTC | owner AutoPay collection |
| `/api/reports/run-scheduled` | hourly :05 | scheduled report execution + email delivery |

## Tests

`npm test` (Vitest). Coverage focuses on authorization primitives and pure logic: `roleHome()` precedence, login-mode routing, the fail-closed cron guard, the `LOCAL_PREVIEW_MODE` production kill-switch, navigation module integrity, report catalog, and operations components.

## Conventions

- **Server Components by default**; fetch as the logged-in user, let RLS filter.
- **Mutations**: guard inside the action → validate input → verify the target is in the caller's scope → mutate → `revalidatePath` → redirect with `?error=`/success params (fail loudly — see `lib/rpcs/calendar.ts` `failTo` pattern).
- **Verify Supabase columns before writing queries** — check `supabase/migrations/` or the live schema; many past bugs were queries against columns that don't exist.
- **Every link must resolve** — confirm the target `page.tsx` exists before adding an href.
- **Design system**: shared components only (`components/ui`, `components/operations`, `components/workspace`); no ad-hoc layouts, no new colors. Mobile-first at 375px.
- **Secrets never in URLs** — one-time values travel via short-lived HttpOnly cookies (see the staff password reset flow).

## Known deferrals / next iterations

- Generated-types adoption: high-traffic paths still use `any` casts; migrate incrementally starting with `MeResult.profile/portfolio` (type-only refactor).
- Central `lib/env.ts` validation for required env vars (currently non-null assertions).
- Typed domain layer (`lib/domain/*`) to consolidate repeated Supabase queries.
- GL engine expansion: chart-of-accounts management, budgeting workflow, year-end close, financial statement generation (CPA to verify mappings afterward).
- Manager/company-admin Vendor Performance Scorecards are live and derive transparent 12-month service records from scheduled completions, current backlog, and compliance evidence. Board officer action-permission tiers (President/Treasurer/Secretary) remain a separate authorization design item.
- `app/platform/*` is a legacy redirect shim to `/platform-operator`; delete after external links age out.
