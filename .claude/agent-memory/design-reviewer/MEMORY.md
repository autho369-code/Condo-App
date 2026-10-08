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
- Checkbox labels: `min-h-10` on the wrapping `<label>` satisfies the 40px target (whole label clicks the box).

## Useful checks
- Legacy URL removals: grep `/platform\b` (excluding `-operator`) across app/components/lib/tests/docs; stale comments linger in tests (e.g. tests/auth/login-modes.test.ts:22) and docs/migration-checklist.md. next.config `redirects()` run before middleware.ts, so middleware can't intercept them.
- PendingSubmit (components/ui/pending-submit.tsx) wraps Button, so size="sm" stays h-10 and className merges via cn; `confirm` = window.confirm. Row-action precedent: platform-operator/companies/[id]/page.tsx:411-421. Since the validate-first change, `confirm` runs form.checkValidity()/reportValidity() first (skipped if form.noValidate), so the fix for confirm-before-empty-field is `required` on the field (settings :371). checkValidity ignores hidden/disabled inputs, same as native submit, so it never blocks something the browser would send. PendingSubmit has no formNoValidate prop; if one is added, the handler must also honour event.currentTarget.formNoValidate. Confirm users (5): settings, documents/notices/[id], platform-operator companies, companies/[id], announcements.
- Role-bounce check: companyAdminModules feeds BOTH app/company-admin/layout.tsx (unfiltered) and app/(app)/layout.tsx (filtered by NAV_ACCESS for company-admin-only users). A new entry must pass the target page's guard for company admins AND operators (requireWorkspaceStaff and requirePortfolioAdmin both do). tasks-rail.tsx no longer has a PANELS map; route panels live in lib/navigation/action-center.ts.
- Pattern (settings/ai, 2026-10): page guard widened to requireWorkspaceStaff + read-only branch for non-admins so AI links from manager surfaces (bills/new, drafters) don't bounce; action keeps requirePortfolioAdmin. Breadcrumb must differ per branch (non-admins can't open /settings).
- Alert (components/ui/shell.tsx) always sets role="alert"; persistent status banners ("AI is on") get announced on every load - nit, not a blocker.

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
