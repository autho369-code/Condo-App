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

## Owner/resident portal data scoping (2026-10-13)
- New ?error= landing spots must be <Alert>; new filters/RPCs must surface errors (not fall to the "not linked"/empty state); sibling feeds apply the same rules.

## Newer/Older pagers (2026-10-13)
- Count+pager line must sit OUTSIDE the empty branch (communication-center:215); redirect `?page=` past the end; pager links min-h-10.

## Public token pages, cont. (unsubscribe, 2026-10-13)
- app/(public) token pages copy vendor-upload's hand-rolled `card` const (rounded-2xl + own shadow) instead of `Surface`; flag as nit on each new copy (unsubscribe/[token]/page.tsx:20). Also `?done=` echoed verbatim into a success Alert lets anyone craft a message on the company's domain: prefer a key -> message map. (Fixed on unsubscribe: Surface + fixed wording by ?done/?error code. vendor-upload still has both.)
- New "kind/class" facts on detail pages: check the column default/backfill for old rows (email_queue.mail_class defaults 'required', backfill only pending/failed, so old optional sent mail reads "Required notice"). (Fixed: the 20261015010000 backfill covers every status.)

