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
- Legacy URL removals: grep `/platform\b` (excluding `-operator`) across app/components/lib/tests/docs; stale comments linger in tests (e.g. tests/auth/login-modes.test.ts:22) and docs/migration-checklist.md. next.config `redirects()` run before middleware.ts, so middleware can't intercept them.
- PendingSubmit (components/ui/pending-submit.tsx) wraps Button, so size="sm" stays h-10 and className merges via cn; `confirm` = window.confirm. Row-action precedent: platform-operator/companies/[id]/page.tsx:411-421. Since the validate-first change, `confirm` runs form.checkValidity()/reportValidity() first (skipped if form.noValidate), so the fix for confirm-before-empty-field is `required` on the field (settings :371). checkValidity ignores hidden/disabled inputs, same as native submit, so it never blocks something the browser would send. PendingSubmit has no formNoValidate prop; if one is added, the handler must also honour event.currentTarget.formNoValidate. Confirm users (5): settings, documents/notices/[id], platform-operator companies, companies/[id], announcements.
- Role-bounce check: companyAdminModules feeds BOTH app/company-admin/layout.tsx (unfiltered) and app/(app)/layout.tsx (filtered by NAV_ACCESS for company-admin-only users). A new entry must pass the target page's guard for company admins AND operators (requireWorkspaceStaff and requirePortfolioAdmin both do). tasks-rail.tsx no longer has a PANELS map; route panels live in lib/navigation/action-center.ts.
- Pattern (settings/ai, 2026-10): page guard widened to requireWorkspaceStaff + read-only branch for non-admins so AI links from manager surfaces (bills/new, drafters) don't bounce; action keeps requirePortfolioAdmin. Breadcrumb must differ per branch (non-admins can't open /settings).
- Link-as-button: `buttonClass(variant,size,cls)` (components/ui/button.tsx) on the Link/a; never `<Link><Button>`. Watch flex-col parents: the link now stretches full width where the old nested button kept intrinsic width (violations/rules:106, 2026-10-11 codemod).
- Field (components/ui/input.tsx, 2026-10-11): single Input/Select/Textarea child + no htmlFor is wrapped in `<label class="block">`; else htmlFor -> Label, none -> `<p>`. Reviewed clean: no Field className uses space-y/gap internally, no global label/p CSS. Custom children (VendorSelect etc.) still need htmlFor+id to be named.
- No-company guards (NoCompanyNotice, components/workspace/no-company-notice.tsx, 2026-10-11): when a page gets the notice, check its siblings that only got an action-side `?error=` guard (settings/ai still rendered the full form for operators). The notice takes the page `title` and renders its PageHeader (h1); put a page's no-company check before any role-based early return (settings/ai). Inside RoleShell (company-admin/layout.tsx) render it bare: RoleShell's <main> already pads, PageShell would double it.
- Capped-list Alerts ("Showing the newest N of {count}"): check the count is toLocaleString'd and the Alert sits in the same spot on sibling pages (company-admin violations vs work-orders, 2026-10-12).
- Render caps (missed on PR #321, Codex caught it): when a page renders fewer rows than it loads/exports (owners, units 500-row cap), check every way the list leaves the page: print, CSV, PDF, email. ExportActions' Print used window.print() and printed only rendered rows; pass `printFromTables` (prints the export tables in their own window) on any capped page.
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

## Public token pages (app/(public), 2026-10)
- Layout already wraps children in `<main>`; pages must not render their own `<main>` (report-violation/page.tsx UnavailableReport nests one). Flag on touch.
- Error Alert wrappers must match the form's container (`mx-auto max-w-3xl px-4`) so the banner aligns at 375px; report-violation now does.
- report-violation-form.tsx is still ad-hoc (dashed blue upload box, emoji icons, hand-picked SEVERITY_LABELS colors :201) - open migration debt, not yet in any diff.
- Tenant-scoped actions that `redirect('/x')` without `?error=` are fine only if the page's no-tenant branch itself renders an Alert (it does for report-violation).

## Copy/share links (2026-10)
- components/ui/copy-button.tsx (CopyButton, Button secondary h-10) is the shared copy control; violation-letter-drafter.tsx:46 still hand-rolls the same copy(). Check new copies reuse it and that clipboard failure is visible (catch was silent at first review).
- Public tenant links must use companyUrl(portfolio, path) (needs slug, custom_domain, custom_domain_verified_at); with no valid slug it falls back to the platform origin, where /report-violation renders "unavailable".

## Auth pages (app/(auth), 2026-10)
- accept-invitation: state cards follow the `Card max-w-sm` + secondary "Go to sign in" (/login) pattern; acceptInvitation `back()` errors whose cause is a non-pending/foreign-address invite land on the invalid-state Card, which drops `?error=` (acceptable: same meaning). `<Link><Button>` (a>button nesting) is a pre-existing repo-wide pattern; Button has no asChild - nit only.

## Multi-section client pages (owners/import/appfolio, 2026-10)
- Sibling sections drift: check every section uses `SectionTitle` (not hand-rolled h2 with differing tracking/description colour), `<Input type="file" className="h-auto py-2">` (gl-section.tsx:118 used a raw input + filled-black file button), the same wrapper width/spacing, and `Field required` for markers.
- `truncate` inside a TD needs `max-w-*` on the inner div; `max-w` on the td is ignored by auto table layout (work-order-section.tsx:108).
- Badge has `capitalize`: free-text count badges ("with email", "AppFolio basis: cash") come out Title Case. Nit only.
- Tie-out table (previous-system/gl-section.tsx ~:450): 4 nowrap money columns squeeze the Account TD to min-content at 375px, so long gray subtitles wrap word-by-word. Suggest `min-w-48` on that TD when subtitles grow (2026-10-10, retained-earnings accounts subtitle).
- Links inside an Alert: precedent is `font-medium underline` inheriting the Alert's text colour (vendors/forms:38, journal-entries:264); `text-blue-700` in a success Alert drifts (gl-section.tsx:583, 2026-10-10).
- Client-state choices (e.g. retainedNumber Select in gl-section) that survive a new compare/file: if the new option list lacks the stale value, the controlled Select shows the placeholder while the action posts the hidden value. Check resets in run()/onFile.
- Import-result "Download all N messages" (receivables-section.tsx:240, 2026-10): secondary Button md (h-10) inside Alert matches the "Import anyway" precedent (:224). Naming AppFolio as the import source on owners/import/appfolio is expected copy, not a white-label leak; only flag Portier369/platform names.

## Two-step GET pickers (owners/change, 2026-10-09)
- New step forms copy the old card's hand-rolled `rounded-2xl ... shadow-[0_1px_2px...]` + raw `<select className={inputCls}>`; fix is `Surface` + `Select`/`Field required` (Surface's shadow has a 2nd layer, so the copy also drifts). Text-link Cancel/"Choose another unit" are ~20px tall: `inline-flex min-h-10 items-center`.
- Step 1 that shows a "not found" warning for a stale `?unit=` also gets the action's `?error=` for the same cause: check for doubled Alerts and for the warning firing when the list itself failed to load.

## Dependent pickers (VendorSelect, 2026-10-09)
- components/vendors/vendor-select.tsx reads the form's `association_id` after mount. Check field ORDER: vendor placed above association (bills/credits:81, recurring-bill-form:52, new-bill-form:230) shows "Choose the association first" above the field it needs - reorder. Also edit pages: before hydration the saved vendor has no <option>, so an early submit clears it.
- components/forms/unit-select.tsx (UnitSelect, 2026-10-12) follows `association_id` like VendorSelect but shows ALL units while none is chosen: check labels carry the association name (calendar/new used bare `Unit 101`, duplicates across associations). Saved unit survives hydration (all units render pre-mount).
- Swapping a control for a shared one can carry over old sizing via className (work-orders/[id]:200,214 `className="h-9"` overrides Select's h-10 through twMerge). Grep for h-8/h-9 passed to Select/Input. Tap-target sweeps miss these too (platform-operator billing:160-168, companies/[id]:219,631-639 kept `Input className="h-9"` beside a select raised to h-10, 2026-10-11).

## Multi-record vendor login (vendor portal, 2026-10-09)
- Per-record pages (compliance `?record=`): check every incoming link that points at ONE record carries `record=` (dashboard expiry Alert app/vendor/page.tsx:95 linked bare). Pill switcher precedent app/vendor/work-orders/page.tsx:51 is itself h-8 (<40px) with a hand-rolled shadow; no shared segmented control exists.

## Multi-record owner login (owner portal, 2026-10-09)
- Segmented pills: components/ui/segmented.tsx (SegmentedLinks/SegmentedButtons, 40px); RecordSwitcher renders SegmentedLinks. Grep `rounded-xl border border-gray-200/80 bg-white p-1` for hand-built copies (vendor/compliance:126 missed in the 2026-10-11 sweep).
- Dashboard tiles: components/ui/stat-tile.tsx (StatTile, tone/icon/href) is a 3rd tile next to shell `Metric` and operations `MetricStrip`; new tiles must reuse one of them, and check DESIGN_SYSTEM.md lists new primitives. Check per-record actions carry `record=` back on every redirect (insurance `return_query`, profile `back()`).
- components/owners/owner-select.tsx (OwnerSelect) follows the form's association field like VendorSelect: same field-ORDER check (management-agreements/new:77 put owner above association). Pass `associationNames` where duplicate names are possible (calendar/new:118 omits it).
- Per-record pages that derive the association name/address from the record's current occupancies (portal/account:27 `units[0]?.associations`) show '—'/'Not set' when the record has no current unit; fall back to the record's own association (`records` label or owners->associations embed).
- Home/emergency-contact style lists (portal/home:33) drop the `.in('id', ownerIds)` error silently; check new per-record queries surface errors. loadOwnerRecords' error already starts "Could not load your associations:", so an Alert title with the same prefix doubles it (nit; profile:58, insurance:113 do it too).

## Payables (bills/[id], 2026-10-13)
- bills/[id]/page.tsx:72 still renders sp.error in a hand-rolled red div (not Alert) and has no ?saved= branch; new forms there (expense account, Record decision) redirect clean on success. Irreversible board-decision submits want PendingSubmit `confirm`.
- Option-list queries for new Selects (gl_accounts expense list) often skip the error check and the empty-list state: a required Select with only a disabled placeholder is a dead end.

## Owner/resident portal data scoping (2026-10-13, owner-portal-fixes)
- Lesson: check that a page's existing error box is an <Alert> when new ?error= messages land there (portal/pay hand-rolled red div; fixed in 20261014190000's PR).
- Lesson: when filters/RPCs are added to a page, check it captures their errors; a failed scoping RPC must not render the "not linked"/empty state (resident pages fixed in the same PR).
- Lesson: sibling feeds must apply the same rules (association-feed meetings now exclude executive_session, like resident/meetings; fixed in the same PR).

## Newer/Older pagers (inbox, 2026-10-13)
- Precedent: communication-center/page.tsx:215 renders the count+pager line OUTSIDE the empty branch. Copies that put it inside the non-empty branch leave a stale `?page=N` past the end on an EmptyState with no way back (inbox:115). Also check the page's 2nd query (sms) surfaces its error. Pager text links were ~20px tall (shared debt). (All fixed in the comms-followups PR: pager outside the empty branch, redirect past the end, sms Alert, min-h-10 links in inbox and Communication Center.)

## Public token pages, cont. (unsubscribe, 2026-10-13)
- app/(public) token pages copy vendor-upload's hand-rolled `card` const (rounded-2xl + own shadow) instead of `Surface`; flag as nit on each new copy (unsubscribe/[token]/page.tsx:20). Also `?done=` echoed verbatim into a success Alert lets anyone craft a message on the company's domain: prefer a key -> message map. (Fixed on unsubscribe: Surface + fixed wording by ?done/?error code. vendor-upload still has both.)
- New "kind/class" facts on detail pages: check the column default/backfill for old rows (email_queue.mail_class defaults 'required', backfill only pending/failed, so old optional sent mail reads "Required notice"). (Fixed: the 20261015010000 backfill covers every status.)

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
