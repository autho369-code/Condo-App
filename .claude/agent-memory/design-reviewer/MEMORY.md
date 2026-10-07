# design-reviewer memory

## Confirmed rules (Mirsad)
- One light design system for all six roles; board and company-admin bodies still being migrated (docs/migration-checklist.md).

## Recurring mistakes
- Save actions that only `revalidatePath` on success leave a stale `?error=` Alert on screen after a later good save. Fix: redirect to `?saved=<kind>` + success Alert. Fixed in settings/branding (:54) and /settings (all four actions + lib/rpcs/portfolio.ts:54, SAVED_MESSAGES map). Check every action on a page, incl. ones imported from lib/rpcs.
- Replacing `if (x) { ... }` with an early `redirect` tends to leave an orphan `{ }` block (settings/page.tsx:169) — flag as cleanup.
- Pre-existing debt, don't re-flag as new: /settings team table uses hand-rolled h-8 (32px) select/buttons instead of `Select`/`Button`, below the 40px touch target.

## Useful checks
- Legacy URL removals: grep `/platform\b` (excluding `-operator`) across app/components/lib/tests/docs; stale comments linger in tests (e.g. tests/auth/login-modes.test.ts:22) and docs/migration-checklist.md. next.config `redirects()` run before middleware.ts, so middleware can't intercept them.
