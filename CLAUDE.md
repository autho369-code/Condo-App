# CLAUDE.md — Portier369 (Condo-App)

HOA/community-association management SaaS replicating AppFolio Property Manager's
functionality with an original design. Next.js 15 (App Router) + Supabase
(project `termxngysvotnfbzbgrv`, ~190 tables) + Tailwind. Deployed on Vercel
(aios2/condo-app → portier369.com).

## Commands
- `npm run dev` — dev server
- `npm run typecheck` — **run before every commit; never push red**
- `npm run build` — full production build

## Non-negotiable rules
1. **Read `docs/DESIGN_SYSTEM.md` before touching any UI.** Every page must use
   the shared components — no ad-hoc Tailwind layouts, no new colors, no new
   shadows, no zebra-striped tables.
2. **Verify Supabase columns before writing queries.** Many past bugs came from
   querying tables/columns that don't exist (`bills`, `budgets`,
   `bank_accounts.balance`, `work_orders.owner_id`). Check
   `supabase/migrations/` or ask the user to confirm schema. Money flows through
   `journal_entries`/`journal_lines` (double-entry); payments→owner is via the
   `receivable_payments_ledger` view; work orders link to owners through
   `unit_owners` → `unit_id`.
3. **Server actions must fail loudly.** Never `return { error }` from a plain
   `<form action>` — redirect back with `?error=...` and render an `<Alert>`
   (see `lib/rpcs/calendar.ts` `failTo` pattern).
4. **Every link must resolve.** Before adding an href, confirm
   `app/(app)<href>/page.tsx` exists. Placeholder list:
   `docs/placeholder-inventory.md`.
5. **Mobile first-class.** Test every page mentally at 375px: headers stack,
   tables scroll horizontally, touch targets ≥40px. Shared components handle
   this if you use them.
6. RLS is enabled on all tables. New tables: enable RLS + portfolio-scoped
   policies using the helpers `can_access_portfolio(uuid)`,
   `can_manage_finance(uuid)`, `is_any_staff()`, `is_platform_operator()`.

## Architecture map
- `app/(app)/*` — manager workspace (dark left sidebar + content + right TasksRail)
- `app/board/*` — board portal · `app/portal/*` — owner portal
- `app/company-admin/*` — company admin · `app/platform-operator/*` + `app/platform/*`
  — platform operator (DUPLICATED — consolidation pending, ask before touching)
- **No vendor portal yet** (`/vendor` — to be built; `vendor_compliance`,
  work-order tables are ready)
- Shared UI: `components/ui/*` (primitives), `components/operations/*` (list-page
  kit), `components/workspace/shell.tsx` (detail-page kit),
  `components/workspace/tasks-rail.tsx` (right panel — add new routes to its
  PANELS map when creating sections)
- Auth: `lib/auth/me.ts` (`requireStaff`, `requireOwner`, …); roles flow
  Platform Operator → Company Admin → Manager → Board/Owner → Vendor;
  all accounts are invitation-based.

## Current mission
Migrate every page to the design system. Work through
`docs/migration-checklist.md` top to bottom, batch of ~10 pages per commit,
`npm run typecheck` between batches. Reference implementations:
- List page: `app/(app)/associations/page.tsx`
- Detail page w/ tabs: `app/(app)/associations/[id]/units/page.tsx`
- The login page `app/(auth)/login/page.tsx` is the aesthetic north star.

## Things NOT to do
- Don't redesign the login page, sidebar, or TasksRail — they're done.
- Don't invent new status colors — use `Badge`/`toneForStatus` or `StatusChip`.
- Don't copy AppFolio's interface text, icons, or visual layout verbatim
  (functionality parity yes, expression no).
- Don't touch `app/platform/*` vs `app/platform-operator/*` consolidation or
  delete any database table without explicit user approval.
