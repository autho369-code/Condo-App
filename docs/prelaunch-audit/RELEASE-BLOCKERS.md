# Release blockers

1. **Resolve migration history.** Inventory remote migration versions, preserve applied SQL exactly, create a clean forward-only migration baseline/plan, and have a Supabase owner approve every `migration repair` action. Do not rename/reorder applied migrations casually.
2. **Apply and validate payment ledger hardening.** Deploy atomic ledger posting, account scope, autopay isolation, AI credential, tenant-hardening, and execution-boundary migrations in an approved staging-to-production sequence. Replay duplicate and concurrent Stripe webhooks in test mode.
3. **Run CI outside this sandbox.** Current build/typecheck pass, but unit test and route-audit execution were blocked by filesystem limits.
4. **Prove role isolation and provider config.** Complete a two-association, six-role RLS regression matrix and validate every production environment variable and webhook signature.
5. **Resolve dependency audit.** Re-run the production dependency audit with registry access immediately before deployment and address any high severity findings.
