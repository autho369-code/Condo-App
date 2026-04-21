# condo-app UI scaffold

Next.js 15 (App Router) + Supabase Auth + Tailwind CSS.

Connects to the Supabase project `termxngysvotnfbzbgrv` (condo-app). Every page flows the user's Supabase session through to RLS — the database, not the frontend, decides what data is visible.

## File map

```
app/
├── (auth)/               ← public pages (login, signup, accept-invitation)
├── (app)/                ← staff-facing authenticated app
│   ├── dashboard/        ← v_dashboard_summary widgets
│   ├── associations/     ← HOA list + detail with board + units
│   ├── units/            ← v_unit_account_summary (all units)
│   ├── owners/ vendors/  ← directories
│   ├── charges/          ← aged_receivables (open charges)
│   ├── bills/            ← v_check_writing_queue (weekly check run)
│   ├── work-orders/      ← open WOs with vendor + priority
│   └── settings/         ← invite staff, team directory, pending invitations
├── portal/               ← owner / board / vendor portal
│   ├── page              ← balance + credit overview
│   └── ledger/           ← v_charge_balances + payments history
├── platform/             ← super-admin (you)
│   ├── portfolios/       ← v_portfolio_health + provision_portfolio form
│   └── operators/        ← list of platform operators
└── api/auth/callback/    ← OAuth / magic-link code exchange

lib/
├── supabase/{server,client,middleware}.ts  ← 3 clients (cookies/browser/service)
├── auth/me.ts            ← me() RPC wrapper + route guards (requireStaff, etc.)
└── auth/actions.ts       ← login / signup / logout / acceptInvitation Server Actions

components/
├── ui/{button,card,input,table}.tsx   ← primitive UI
└── nav/sidebar.tsx                    ← tier-aware nav (reads me())

middleware.ts             ← Supabase session refresh on every request
```

## Setup

```bash
cd condo-app-ui
npm install
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_PORTAL_URL
npm run types   # generates lib/types/database.ts from your schema
npm run dev
```

Open http://localhost:3000 → it redirects to `/login`.

## Auth flow

1. `/login` calls `loginWithPassword` Server Action → `supabase.auth.signInWithPassword`.
2. Middleware (`middleware.ts` → `lib/supabase/middleware.ts`) refreshes the session cookie on every request.
3. Protected routes call `requireAuth()` / `requireStaff()` / `requirePlatformOperator()` from `lib/auth/me.ts` in their page or layout — these throw `redirect()` if the user doesn't qualify.
4. `/accept-invitation?token=<x>` calls the `accept_invitation(token)` Postgres RPC — validates the token, applies portfolio_id + role_id + hoa_role to the profile.
5. Logout button in the sidebar is a Server Action that clears the session and redirects to `/login`.

## How each page gets data

All queries run as the logged-in user. RLS does the filtering.

| Page | Source | Notes |
|---|---|---|
| `/dashboard` | `v_dashboard_summary` + `v_unit_account_summary` | One row from summary view + top-10 outstanding |
| `/associations` | `associations` table | RLS scopes to user's portfolio |
| `/associations/[id]` | `associations` + `v_unit_account_summary` + `board_members` | Full HOA detail |
| `/units` | `v_unit_account_summary` | Charged / paid / balance / credit per unit |
| `/owners`, `/vendors` | tables | Simple lists |
| `/charges` | `aged_receivables` | Open-charge buckets by age |
| `/bills` | `v_check_writing_queue` | Weekly check run |
| `/work-orders` | `work_orders` + joins | Open WOs only |
| `/settings` | `profiles` + `v_pending_invitations` | Team + pending invites |
| `/portal` | `v_unit_account_summary` | Resident's own units |
| `/portal/ledger` | `v_charge_balances` + `payments` | RLS-scoped to their unit |
| `/platform/portfolios` | `v_portfolio_health` | Platform-operator-only |
| `/platform/operators` | `platform_operators` | Platform-operator-only |

## Server Actions

| Action | Calls | Used by |
|---|---|---|
| `loginWithPassword` | `auth.signInWithPassword` | /login |
| `signupWithPassword` | `auth.signUp` | /signup |
| `logout` | `auth.signOut` | Sidebar |
| `acceptInvitation(token)` | `public.accept_invitation(p_token)` | /accept-invitation |
| `provisionPortfolio` | `public.provision_portfolio(...)` | /platform/portfolios |
| `inviteStaff` | `public.invite_staff(...)` | /settings |

Add more by wrapping the Postgres RPCs we built (e.g. `invite_owner`, `invite_vendor`, `assign_role`, `suspend_portfolio`, `post_ad_hoc_charge`, `record_check_run`, `enroll_autopay`, `queue_report_run`, `request_data_export`).

## Sidebar renders based on user tier

`components/nav/sidebar.tsx` calls `getMe()` once and renders sections conditionally:

- Platform operator → Platform (Portfolios, Operators)
- Any staff → Manage, Operations
- Finance staff → + Accounting (Charges, Bills)
- Full-access staff → + Admin (Settings)
- Residents / Board → My Portal (Overview, Ledger, Pay, Requests)

So a logged-in Accountant never sees the "Settings" item. An owner only sees the portal. A platform operator sees everything.

## Generate TypeScript types

```bash
npm run types
```
runs:
```bash
supabase gen types typescript --project-id termxngysvotnfbzbgrv --schema public > lib/types/database.ts
```

After that, all `supabase.from('table')` calls become strongly typed.

## What's missing (next iterations)

- **Stripe Checkout integration** — `/portal/pay` page should embed Stripe Checkout. We have the `payment_processor_configs` + `calculate_convenience_fee` already; wire Checkout on top.
- **Board portal views** — `/portal` works for residents; a board-specific view could read `v_portfolio_health` filtered to their association and show approval voting UI.
- **Vendor portal** — separate `/vendor/*` routes showing their WOs, bills, document-request uploads.
- **Reports UI** — `/reports` page that lists `report_definitions`, lets you kick off `queue_report_run`, polls `report_runs.status`, then presents the CSV download.
- **Real-time updates** — Supabase realtime on `charges`, `payments`, `work_orders` so the dashboard updates live.
- **Design polish** — this scaffold uses minimal Tailwind primitives. Drop in shadcn/ui or your design system for production styling.
- **Charge category management UI** — table with inline-edit on the 13 seeded categories so staff can adjust default amounts / GL mappings.
- **Unit recurring charges UI** — per-unit panel with subscribe / unsubscribe.
- **Admin RPCs not yet wired in UI**: `suspend_portfolio`, `rotate_api_key`, `resend_invitation`, `unapply_payment`, `post_ad_hoc_charge`, `record_check_run`.

Each of those is a page that follows the same pattern: `requireXxx()` guard → Server Component query → Table/Card layout → Server Action for mutations → `revalidatePath` on success.

## Tips

- **Server Components by default** — do all data fetching server-side. Only drop to `'use client'` for genuinely interactive pieces (forms with local state, charts, etc.).
- **Pass `me()` as a prop** — don't call it multiple times in one render. Fetch once in the layout, pass to children.
- **Use `revalidatePath` after mutations** — Server Actions must invalidate the page they return to, or you'll see stale data.
- **Respect the middleware matcher** — it excludes static assets. If you add new auth-required paths, no change needed.
- **Service-role client is server-only** — `createServiceClient()` in `lib/supabase/server.ts` should only be called from Server Components / Route Handlers / Server Actions. Never expose it to the browser.

## What this scaffold actually proves

It's a working Next.js 15 app with end-to-end flow: login → session cookie → RLS-scoped queries → tier-aware navigation → Server Action mutations → auto-revalidation. Drop it onto Vercel, point it at your Supabase project, and you have a functional admin panel.

From here, the work is UI polish + filling in pages for RPCs that aren't yet wired up. The hard architectural decisions — where the auth lives, how RLS drives the view, how mutations flow — are already made.
