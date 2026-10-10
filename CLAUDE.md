# CLAUDE.md — Portier369 (Condo-App)

**Second brain: `docs/brain/` (an Obsidian vault — Home, How Mirsad Works,
Product Rules, PR Rules, Status, Decisions, Agents) is loaded into every
session automatically (`scripts/brain/session-start.mjs`). Run the `overseer`
agent at the start of every task and before every PR. Record what shipped, new
rules and the next gap there and commit it with the work (Stop hook
`scripts/brain/stop-guard.mjs` reminds).**

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
   `unit_owners` → `unit_id`. `npm test` checks every static `.select()`
   against `supabase/schema-columns.json` and `schema-foreign-keys.json`
   (snapshots of the live columns and foreign keys);
   refresh it after a migration adds columns (SQL in
   `scripts/lib/query-columns.mjs`).
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
   policies whose helpers run ONCE PER QUERY, never once per row:
   `COALESCE(portfolio_id = (select public.my_access_portfolio()), false)`
   `or ((select public.is_platform_operator()) and portfolio_id is not null)`
   (finance: `my_finance_portfolio()`), `association_id in (select
   public.my_accessible_association_ids())`, `(select public.is_any_staff())`,
   `(select public.is_platform_operator())`. Don't call
   `can_access_portfolio(portfolio_id)` / `can_manage_finance(..)` in a
   policy (they run per row); they stay for functions and RPCs. See
   Product Rules → Speed and migration 20261011010000.
   New functions are NOT executable by `anon` by default (and new trigger
   functions by nobody) — an RPC for signed-out callers needs an explicit
   `grant execute ... to anon` (migration default_function_privileges).

## Architecture map
- `app/(app)/*` — manager workspace (dark left sidebar + content + right TasksRail)
- `app/board/*` — board portal · `app/portal/*` — owner portal
- `app/company-admin/*` — company admin · `app/platform-operator/*` — platform
  operator (old `/platform/*` URLs redirect there via `next.config.mjs`)
- `app/vendor/*` — vendor portal (dashboard, work orders + status updates,
  compliance, profile) — built on the unified shell
- Shared UI: `components/ui/*` (primitives), `components/operations/*` (list-page
  kit), `components/workspace/shell.tsx` (detail-page kit),
  `components/workspace/tasks-rail.tsx` (right panel — add new routes to its
  PANELS map when creating sections)
- Auth: `lib/auth/me.ts` (`requireStaff`, `requireOwner`, …); roles flow
  Platform Operator → Company Admin → Manager → Board/Owner → Vendor;
  all accounts are invitation-based.

## Review agents (`.claude/agents/`)
Run `overseer` at the start of every task and before every PR. Before opening
a PR, run the reviewers that match the change (they report,
and write only to their own memory): `design-reviewer` (pages/components),
`security-reviewer` (actions, API routes, data access), `schema-checker`
(queries), `migration-reviewer` (`supabase/migrations/`),
`white-label-checker` (user-facing text, emails, links). Fix what they find
before pushing. `/portier-review` runs the matching ones, fixes and verifies.
They learn: each keeps notes in `.claude/agent-memory/<name>/MEMORY.md`
(committed). When Codex, CI or Mirsad catches something a reviewer missed,
or a reviewer finding was wrong, tell that reviewer so it records the lesson,
and commit the memory change with the PR.

## Theme decision (FINAL, from Mirsad)
ONE design system for ALL six roles: dark `#060709` sidebar (shared
`components/nav/sidebar.tsx` with role `modules` from
`lib/navigation/role-modules.ts`) + light `#f6f7f9` content. Owner portal,
vendor portal, and platform-operator already use it. **Board and
company-admin pages still have dark-themed page bodies** — migrate each
page's body to the light design system FIRST (group by group), then flip
that section's `layout.tsx` to the unified Sidebar as the LAST step of the
group, so nothing ships half-readable.

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
- Don't delete any database table without explicit user approval.
- Every Server Action must re-check authorization INSIDE the action body
  (actions are callable endpoints; page-level guards are not enough) and
  verify formData-supplied IDs belong to the caller's own scope.
