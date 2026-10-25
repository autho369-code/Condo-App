# design-reviewer memory

## Confirmed rules (Mirsad)
- One light design system for all six roles; board and company-admin bodies still being migrated (docs/migration-checklist.md).

## Recurring mistakes
- Save actions that only `revalidatePath` on success leave a stale `?error=` Alert on screen after a later good save. Fix: redirect to `?saved=<kind>` + success Alert. Fixed in settings/branding (:54) and /settings (all four actions + lib/rpcs/portfolio.ts:54, SAVED_MESSAGES map). Check every action on a page, incl. ones imported from lib/rpcs.
- Replacing `if (x) { ... }` with an early `redirect` tends to leave an orphan `{ }` block (settings/page.tsx:169) — flag as cleanup.
- Hand-rolled h-8 controls in table action cells: the fix is `Select` (fieldBase h-10 w-full; a width class overrides via twMerge `cn`) + `Button size="sm"` (sm is h-10, not smaller). Closed in /settings team table (settings/page.tsx:368-386).
- Destructive inline row action precedent: `variant="secondary"|"ghost"` + `text-red-600 hover:bg-red-50` (settings/page.tsx Remove, letters/[id]/edit:191); `variant="danger"` is filled red, reserved for primary destructive actions on detail pages. Not a new color.
- Text-link -> `Button size="sm"` swaps in mixed rows (36d850ba): siblings left as text-xs links / px-2 py-1 pills give mixed 26px/40px heights (maintenance/page.tsx:367 `flex gap-1` stretches the Edit <a>); and plain ghost drops the red destructive cue the old link had. Convert the whole row, keep `text-red-600 hover:bg-red-50`.
- Confirm sweeps: grep the touched files for leftover one-click `End`/`Cancel` submits (owners/[id] End seat :504, End :749, End tenancy :891; platform-operator companies Cancel invitation :522 were missed in 36d850ba).
- `flex-1` on an Input inside `flex flex-col sm:flex-row` collapses it to ~19px at 375px (basis 0 in a column); fix `sm:flex-1` (Input is already w-full). Grep for it (reports/page.tsx:151, company-admin/managers:145 fixed 2026-10-10). In the same pass check sibling "Clear filters" text links (CalendarGrid.tsx:131 left ~16px).
- `Select className="w-auto"` in a flex-wrap toolbar sizes to its longest option; a long name can overflow 375px. Suggest `w-auto max-w-full` (CalendarGrid.tsx:122, 2026-10-11).
- Reopen/undo flows (missed on #372, Codex caught it): a reopened record left its key input (bank reconciliation statement balance) read-only, so the user couldn't fix what they reopened it for. On any undo/reopen/"back to draft" change, ask: can the user now edit and finish it on the page?
- Field `hint` renders below the Input, so `sm:items-end` beside a button bottom-aligns the button with the hint, not the input (reconcile/page.tsx:381). Use `sm:items-start` + `sm:mt-[label offset]` or put the hint elsewhere. (Fixed on the reconcile balance form: hint moved under the row.)
- `?error=...#section` redirects: the hash scrolls past the page-top error Alert (units/[id] removeLateFee, credits.ts:57, 2026-10-13). Render the Alert inside the target section, or drop the hash on errors.
- `Table` has its own border+shadow wrapper: inside `CardBody className="p-0"` it draws a box flush against the card edge; siblings keep the padded CardBody (units/[id] Late fees card).
- Checkbox labels: `min-h-10` on the wrapping `<label>` satisfies the 40px target (whole label clicks the box).

## Useful checks
- Client-side search moved to DB `.or(ilike)` (service-requests, 2026-10-14): old filter matched joined strings (tenant `first last`); per-column ilike drops full-name hits. Check combined-field matches survive.
- Legacy URL removals: grep `/platform\b` (excluding `-operator`) across app/components/lib/tests/docs; stale comments linger in tests (e.g. tests/auth/login-modes.test.ts:22) and docs/migration-checklist.md. next.config `redirects()` run before middleware.ts, so middleware can't intercept them.
- PendingSubmit (components/ui/pending-submit.tsx) wraps Button, so size="sm" stays h-10 and className merges via cn; `confirm` = window.confirm. Row-action precedent: platform-operator/companies/[id]/page.tsx:411-421. Since the validate-first change, `confirm` runs form.checkValidity()/reportValidity() first (skipped if form.noValidate), so the fix for confirm-before-empty-field is `required` on the field (settings :371). checkValidity ignores hidden/disabled inputs, same as native submit, so it never blocks something the browser would send. PendingSubmit has no formNoValidate prop; if one is added, the handler must also honour event.currentTarget.formNoValidate. Confirm users (5): settings, documents/notices/[id], platform-operator companies, companies/[id], announcements.
- Role-bounce check: companyAdminModules feeds BOTH app/company-admin/layout.tsx (unfiltered) and app/(app)/layout.tsx (filtered by NAV_ACCESS for company-admin-only users). A new entry must pass the target page's guard for company admins AND operators (requireWorkspaceStaff and requirePortfolioAdmin both do). tasks-rail.tsx no longer has a PANELS map; route panels live in lib/navigation/action-center.ts.
- Widening a page to company admins (inventory, 2026-10-14): `/reports/[slug]` has NO page guard (renders for them), but its Run (queueReport), favorite, breadcrumb `/reports` and `/reports/runs/[id]` are requireStaff -> silent bounce to /company-admin/overview. Treat report links as staff-only. Also rail links are filtered by COMPANY_ADMIN_SHARED_ROUTES (action-center.ts:36); a newly shared route not listed there gets an empty rail.
- Verify "role X can't open page Y" before accepting a hidden link: `/work-orders/[id]` uses getMe only (no requireStaff), grants company admins chargeback, and company-admin/work-orders:214 links to it. Hiding it for admins (inventory/[id], 2026-10-14) was a regression. Check the target's guard + existing links from that role.
- Pattern (settings/ai, 2026-10): page guard widened to requireWorkspaceStaff + read-only branch for non-admins so AI links from manager surfaces (bills/new, drafters) don't bounce; action keeps requirePortfolioAdmin. Breadcrumb must differ per branch (non-admins can't open /settings).
- Link-as-button: `buttonClass(variant,size,cls)` (components/ui/button.tsx) on the Link/a; never `<Link><Button>`. Watch flex-col parents: the link now stretches full width where the old nested button kept intrinsic width (violations/rules:106, 2026-10-11 codemod).
- Field (components/ui/input.tsx, 2026-10-11): single Input/Select/Textarea child + no htmlFor is wrapped in `<label class="block">`; else htmlFor -> Label, none -> `<p>`. Reviewed clean: no Field className uses space-y/gap internally, no global label/p CSS. Custom children (VendorSelect etc.) still need htmlFor+id to be named.
- No-company guards (NoCompanyNotice, components/workspace/no-company-notice.tsx, 2026-10-11): when a page gets the notice, check its siblings that only got an action-side `?error=` guard (settings/ai still rendered the full form for operators). The notice takes the page `title` and renders its PageHeader (h1); put a page's no-company check before any role-based early return (settings/ai). Inside RoleShell (company-admin/layout.tsx) render it bare: RoleShell's <main> already pads, PageShell would double it.
- Capped-list Alerts ("Showing the newest N of {count}"): check the count is toLocaleString'd and the Alert sits in the same spot on sibling pages (company-admin violations vs work-orders, 2026-10-12).
- Render caps (missed on PR #321, Codex caught it): when a page renders fewer rows than it loads/exports (owners, units 500-row cap), check every way the list leaves the page: print, CSV, PDF, email. ExportActions' Print used window.print() and printed only rendered rows; pass `printFromTables` (prints the export tables in their own window) on any capped page.
- toneForStatus edits: grep `'<status>'` across app/components/lib for other Badge callers whose tone shifts. Hand-pill -> `<Badge status>` swaps can change tone (charge `outstanding` was red, Badge makes it blue 'open'; accepted on units/[id], 2026-10-14, Balance column stays red).
- CopyButton (components/ui/copy-button.tsx) hard-codes "link" in its failed/sr-only text; non-link uses (portal/pay Zelle address, 2026-10-14) read wrong. Flag reuse for non-URLs.
- Shared `sp.error` Alert titled for one feature (associations/[id]/payments "Stripe error") gets reused by new forms on the page; check the title still fits.
- Load-error fallthrough: `data ?? []` after a failed query renders the "No X yet" empty row under an error note (platform-operator/system job failures, 2026-10-24). Check the empty branch also checks `error`.
- Alert (components/ui/shell.tsx) always sets role="alert"; persistent status banners ("AI is on") get announced on every load - nit, not a blocker.

## Owner-facing state cards (portal/violations/[id], 2026-10-13)
- Chained `a ? .. : b ? ..` status branches: a new state added lower (Hearing held :170) is shadowed by an earlier one (hearing_requested_at :164). Check branch order.
- Owner timelines read `owner_visible_history` written by log_violation_event(..., true): read the SQL note text for staff-only instructions leaking to owners.

## ?error= sweeps (zero-row `.select()` checks, 2026-10)
- For every action redirect, open the TARGET page and check every render branch, not just one: vendors/ach has 3 returns and only the two focus views render sp.error (list view at :371 drops it, so `Vendor not found.` is silent).
- Redirect-only routes swallow query strings: app/(app)/associations/[id]/page.tsx redirects to /units without `?error=` (lib/rpcs/entities.ts:130,173 target it; dead today). Check that `page.tsx` isn't a bare redirect.
- Grep callers before reviewing lib/rpcs changes: updateAssociation, archiveAssociation, updateUnit had no callers (dead code); acknowledgeReminder and resendMaintenanceNotification were removed.
- Target pages still using hand-rolled red boxes: sms/opt-ins/page.tsx:130 (open as of 2026-10-07). associations/[id]/profile renders sp.error twice (:319 and :374); `saved=1` from Site Manager shows "Payment instructions updated."
- Client edit pages (letters/[id]/edit, documents/templates/[id]/edit) put the error Alert at the top and Save at the bottom: on a long form at 375px the error is off-screen. Suggest scrollIntoView or an Alert next to Save.

## Area notes
- [area-notes.md](area-notes.md) — public token/auth pages, copy links, import pages, GET/dependent pickers, vendor+owner multi-record portals, payables, pagers. Grep it for the area under review.

## Query -> RPC swaps (portal parking, 2026-10-14)
- When a page swaps `.from().select()` for an RPC "same rendering": check the RPC's `returns table` covers every field rendered, the reshaped embeds (parking_spaces/units) match, and the old `.order()` moved into the SQL. Clean on portal/vehicles + home.

## Server-paged lists (insurance, inspections, 2026-10-14)
- `.range()` paging: check `?page=` past the end (stale link, or bulk action return_to keeping page after rows leave the filter). Insurance shows "No insurance policies yet / Add first policy" when total>0; pager text reads "201-150 of 150". Fix: redirect to the last page when page > pageCount and count > 0.
- Radio "method" + optional detail field (amenity reserve_method=email defaultChecked, email optional): blank detail saves a method the portal can't use. Action must failTo when the chosen method's field is empty.
## Upload limits and gated content (arc-documents-fixes, 2026-10-14)
- Upload-size changes: grep every hint/guide for the old number AND for sibling flows with their own limit (ARC is 25 MB direct-to-storage, but architectural-reviews/new:123 and guides/content.ts:127 said 10 MB). Server-action uploads die at Vercel's ~4.5 MB with a 413 before the action's `?error=` check runs.
- New "content not available" branches on token pages: check every state that hits them (sign/[token] showed "no longer available" to a signer still waiting their turn).
## Board/vendor portals (2026-10-14, board-vendor-fixes)
- app/board/meetings/page.tsx is still hand-rolled (`card` const w/ own shadow, raw <table>, stat tiles); new sections copy it (Cancelled). Flag as migration debt, not blocker.
- Shape-key changes in JSON lists (vendor emails `address` -> `email`): old saves wrote the other key, so rows edited earlier may read stale. Ask for a read fallback.
## Overnight ranges, partial migrations (portal/amenities, 2026-10-14)
- When end can fall on the next day (late-night amenity hours), check every range display shows the end date (portal/amenities fixed via fmtRange, 2026-10-14).
- Partial migrations leave heading-level drift: outer hand-rolled 13px `<h2>` wrapping a 17px SectionTitle `<h2>` (portal/amenities "My reservations" > "Upcoming"). Check heading sizes/levels nest.
## Owner portal fixes (claude/owner-portal-fixes, 2026-10-14)
- StatusChip is `whitespace-nowrap capitalize`: sentence-length chip text ("Paused – online payments are off for this account", autopay/page.tsx:341) overflows a p-5 card at 375px and comes out Title Case. Keep chips to 1-3 words; put the explanation in a line of text.
- Status-specific result pages (pay/success): check every value of the CHECK constraint, not just the ones the change names (payment_intents also has returned/refunded/chargeback).
- Half-swapped forms: when one field moves to a shared control (communications Textarea), the sibling raw input + hand-rolled submit stay; flag the rest of the form.
## Reports (claude/reports-deep-check, 2026-10-14)
- reports/[slug] tile rows: most are still `grid-cols-3/4` with no mobile breakpoint (precedent :986 `grid-cols-2 sm:grid-cols-4`); flag when a row is touched. Tile (components/reports/workspace.tsx) is 24px text in a ~165px column at 375px: 5-digit money can overflow; suggest `min-w-0` + `break-words` or smaller mobile text.
- Download routes that `back(?error=)` to a detail page: if the page does `if (!run) notFound()`, a "not found / no access" error becomes a bare 404 (reports/runs/[id]/download). Send not-visible cases to the list/index page, which renders sp.error.
## Card-grid column bumps (projects/[id], po-decisions, 2026-10-14)
- 5th hand-rolled stat card + `lg:grid-cols-5`: content at xl is ~672px (1280 - w-60 sidebar - 304 TasksRail - lg:px-8), ~90px per card for text-xl money, no wrap; grid min-width:auto pushes the page sideways. Fix: operations `MetricStrip` ([overflow-wrap:anywhere]) or cap at 3 cols.
- Shared create/edit forms: a "leave blank" hint must hold on edit too (PO number trigger keeps the old number when cleared on edit).
