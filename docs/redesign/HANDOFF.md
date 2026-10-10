# Redesign handoff

Branch `claude/redesign-six-roles`, [PR #279](https://github.com/autho369-code/Condo-App/pull/279), baseline `2fea8502` (main, 2026-10-10).
The preview deploys from the PR at `condo-app-git-claude-redesign-six-roles-aios2.vercel.app` (Vercel team sign-in required).

## 1. The new design, by role

All six roles (and the resident portal) share one look. Each keeps its own menu, data scope and permitted actions.

| Shared element | What it looks like |
|---|---|
| Frame | `components/nav/role-shell.tsx` (manager layout: same tokens): dark rail, light canvas, a 3px line in the company's own color across the top |
| Sidebar | 14px items with readable contrast (group labels were 9px dark gray on black). The current page is marked in the company's color, which also fills the company initial. Wider rail, so names truncate less. |
| Type | Inter for text. Schibsted Grotesk (OFL, bundled from npm like Inter) for page titles, section titles and key figures. One title scale: page 26/30px, detail 24/28px. |
| Readability | No 9–11px text outside print views and PDFs (now 11.5–12.5px). Labels are sentence case instead of tiny uppercase. Tables use 14px cells and taller rows. Badges show a dot beside the word, so status never depends on color alone. |
| Tokens | `app/globals.css` / `tailwind.config.ts`: `canvas`, `line`, `ink`, `accent` (the company's color), and `accent-ink`, which picks black or white by contrast in `lib/ui/brand.ts`. Status colors never come from the company color. |
| Headers | Page and detail headers let their actions wrap under the title instead of squeezing it. |

Changes for each role:

| Role | Changes |
|---|---|
| **Property manager** | Dashboard leads with **Needs attention**: overdue and upcoming activities, bills pending approval, PO drafts, POs awaiting the board. Each card opens the list it opened before; a failed count shows "—", never 0. The notifications feed sits beside **Quick actions**, the same create pages the command palette offers. Online payments and portal adoption move to compact sections with every figure and link kept. The Action Center is readable, and every page is restyled. |
| **Reports** (manager) | All 143 active reports are listed (see Baseline defects), with full names and descriptions, category chips, search with a match count, and Schedule plus the favorite star on every row. Report pages use the shared header, sections and figure tiles. |
| **Company admin** | 24 pages moved onto the shared design (header, sections, cards, figures, tables, small text). |
| **Operator** | 21 pages moved onto the shared design. Inline hex borders replaced by the line token. |
| **Owner / homeowner** | 35 pages moved onto the shared design. Form fields match the shared input (40px, same border and focus ring). Home quick actions have readable labels with the company's color on their icons. The "Pay Assessments" primary button is unchanged. |
| **Board** | The 8 real pages moved onto the shared design. The other 18 are redirect stubs from sections removed from the read-only board portal, and are unchanged. The portal stays read-only. |
| **Vendor** | Already used the shared headers. It now has the shared frame and tokens. |

## 2. Function-preservation matrix

`FUNCTION_PRESERVATION_MATRIX.csv` has one row per capability, about 9,600 rows with stable ids: route, nav entry, link, form or server action, field, data source, guard, button and confirmation. `tests/redesign/parity.test.ts` rebuilds the inventory from the code and fails if any route, nav entry, link, action, field, data source or guard from the baseline is gone. Current result: **0 missing**. Reworded labels: 0 flagged.

All routes are unchanged, so `redesigned_location` is "unchanged route" for every row. The only moves are on the dashboard (sections rearranged on the same page) and in Reports, where the "Run report" and "Schedule" links moved from a disclosure onto each row; same targets.

## 3. Role access matrix

See `ROLE_ACCESS_MATRIX.md`. Guards, layouts, `roleHome`, middleware, RLS and grants are all unchanged; the six layouts keep their own guard calls. The allow/deny checks are listed there, and none has been run in a browser for roles without a login (see 7).

## 4. Changed files

356 files compared with the baseline:

| Kind | Files | What |
|---|---|---|
| **Class-only `.tsx`** | 325 | Only className values or Tailwind class strings changed. Verified by `classify.py`, which compares each file with class strings blanked. |
| **Other `.tsx`** | 18 | `app/layout.tsx` (font variable); the six role layouts plus `app/(app)/layout.tsx` (`RoleShell`, brand variables); `components/nav/role-shell.tsx` (new); `components/nav/sidebar.tsx` (active marker, `title` on truncated names, `aria-expanded` on the menu button); `components/ui/shell.tsx`, `components/workspace/shell.tsx`, `components/operations/data-workspace.tsx` (DataWorkspace renders PageHeader), `components/operations/status-chip.tsx` and `components/ui/card.tsx` (badge dot, wrapping headers); `components/reports/workspace.tsx`; `app/(app)/dashboard/page.tsx` and `app/(app)/reports/page.tsx` (layout redesign on the same data). |
| **Not `.tsx`** | 13 | `app/globals.css`, `tailwind.config.ts` and `lib/ui/brand.ts` (tokens); `package.json` and `package-lock.json` (one dependency, `@fontsource-variable/schibsted-grotesk`); `scripts/redesign/*`, `tests/redesign/parity.test.ts` and `docs/redesign/*`. |

**Data access:** one query changed. `/reports` now also reads `name` and `category` from `report_definitions` (same table, same filters). Nothing else touches data.

## 5. Preservation confirmed by the diff

Against `2fea8502`, nothing under these paths changed:
- `supabase/` (schema, migrations, policies, functions)
- `middleware.ts`
- `lib/auth/`, `lib/supabase/`, `lib/rpcs/`
- `app/api/`
- any `actions.ts`

Integrations, payment code, cron and email are untouched. No route was added or removed.

## 6. Screenshots

Taken in Chrome as a manager on real data (desktop): dashboard, Work Orders, Command Center, homeowner detail, Reports with search, A/P Aging, Balance Sheet (live, balanced). The "before" state is the baseline commit; the design mockup is at https://claude.ai/artifact/GSfh1ULGVEWn98kzEiKBV5. There are no screenshots for the other roles (see 7).

## 7. Test and build results

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm test` (local, Windows) | 962 pass, 8 fail. The same 8 failures as the baseline (CRLF-only, see `BASELINE.md`), so no new failures. |
| `npm run check:routes` | 0 placeholders. The first CI run caught `#…` category links; fixed. |
| `npm run check:columns` | 0 problems |
| `npm run check:dashboard-text` | clean |
| CI "Verify application" / CodeQL | Rerunning after the fixes. CodeQL had flagged two existing patterns in files the redesign touched; those edits were reverted and the findings logged in `PROGRESS.md`. |
| Vercel preview | deploys |

**Not verified:**
- **Phone and tablet widths in a signed-in browser.** The Chrome window could not be resized; the layouts use the shared responsive rules.
- **Company admin, operator, owner, board and vendor screens.** These need logins:
  - Production has no owner or board logins and one vendor login.
  - The `admin@` and `operator@portier369.com` passwords need a reset.
- **Allow/deny checks with ordinary accounts for those roles.**
- **Write flows.** Nothing was submitted, by design.

## 8. Review

Open the PR preview (signed in to Vercel), or run the branch locally with `npm run dev` and sign in.

## 9. Rollback

The redesign is a single branch, so either:
- don't merge PR #279, or
- after a merge, revert its merge commit.

No migration or data change needs undoing.
