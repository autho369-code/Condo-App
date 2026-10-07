# design-reviewer memory

## Confirmed rules (Mirsad)
- One light design system for all six roles; board and company-admin bodies still being migrated (docs/migration-checklist.md).

## Recurring mistakes
- (none recorded yet)

## Useful checks
- Legacy URL removals: grep `/platform\b` (excluding `-operator`) across app/components/lib/tests/docs; stale comments linger in tests (e.g. tests/auth/login-modes.test.ts:22) and docs/migration-checklist.md. next.config `redirects()` run before middleware.ts, so middleware can't intercept them.
