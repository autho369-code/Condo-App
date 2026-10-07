# design-reviewer memory

## Confirmed rules (Mirsad)
- One light design system for all six roles; board and company-admin bodies still being migrated (docs/migration-checklist.md).

## Recurring mistakes
- Save actions that only `revalidatePath` on success leave a stale `?error=` Alert on screen after a later good save. Fix: redirect to `?saved=<kind>` + success Alert. Fixed in settings/branding (:54) and /settings (all four actions + lib/rpcs/portfolio.ts:54, SAVED_MESSAGES map). Check every action on a page, incl. ones imported from lib/rpcs.
- Replacing `if (x) { ... }` with an early `redirect` tends to leave an orphan `{ }` block (settings/page.tsx:169) — flag as cleanup.
- Hand-rolled h-8 controls in table action cells: the fix is `Select` (fieldBase h-10 w-full; a width class overrides via twMerge `cn`) + `Button size="sm"` (sm is h-10, not smaller). Closed in /settings team table (settings/page.tsx:368-386).
- Destructive inline row action precedent: `variant="secondary"|"ghost"` + `text-red-600 hover:bg-red-50` (settings/page.tsx Remove, letters/[id]/edit:191); `variant="danger"` is filled red, reserved for primary destructive actions on detail pages. Not a new color.
- Checkbox labels: `min-h-10` on the wrapping `<label>` satisfies the 40px target (whole label clicks the box).

## Useful checks
- Legacy URL removals: grep `/platform\b` (excluding `-operator`) across app/components/lib/tests/docs; stale comments linger in tests (e.g. tests/auth/login-modes.test.ts:22) and docs/migration-checklist.md. next.config `redirects()` run before middleware.ts, so middleware can't intercept them.
- PendingSubmit (components/ui/pending-submit.tsx) wraps Button, so size="sm" stays h-10 and className merges via cn; `confirm` = window.confirm. Row-action precedent: platform-operator/companies/[id]/page.tsx:411-421. Since the validate-first change, `confirm` runs form.checkValidity()/reportValidity() first (skipped if form.noValidate), so the fix for confirm-before-empty-field is `required` on the field (settings :371). checkValidity ignores hidden/disabled inputs, same as native submit, so it never blocks something the browser would send. PendingSubmit has no formNoValidate prop; if one is added, the handler must also honour event.currentTarget.formNoValidate. Confirm users (5): settings, documents/notices/[id], platform-operator companies, companies/[id], announcements.
