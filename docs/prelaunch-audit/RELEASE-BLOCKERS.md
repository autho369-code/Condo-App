# Release blockers

Current decision: **NO-GO for broad production release.**

1. **Reconcile migration history.** Strict validation fails with 41 invalid filenames and three duplicate-version groups. Inventory linked production history, preserve applied SQL, create a reviewed forward-only baseline, and require explicit database-owner review before any `migration repair`. Do not rename or reorder applied migrations casually.
2. **Make staging reproducible.** The staging project `zalfkrtjeswvfmucicea` is linked but empty. A dry run cannot authenticate in the current audit environment because no reusable Supabase token/database password is available. No migration was applied.
3. **Restore report implementation reproducibility.** The deployed catalog exposes 119 reports. Eighteen slugs have live page implementations, but queued reports depend on `report_data_dispatch`, which appears in generated types and runtime calls but not in local migration SQL. Import its authoritative definition and establish an implementation/permission test for every catalog slug.
4. **Complete authenticated report execution.** Trial Balance live display and export code are corrected and CI/deployment-clean, but the new preview hostname lacks a manager login session. Execute CSV, JSON, and PDF exports in staging and reconcile each file to the on-screen figures and underlying posted ledger.
5. **Apply and validate payment hardening in staging.** Deploy atomic ledger posting, connected-account scope, autopay isolation, AI credential, tenant hardening, and execution-boundary migrations in an approved order. Replay duplicate, reordered, and concurrent Stripe test-mode webhooks for two associations with distinct connected accounts.
6. **Prove role and tenant isolation.** Run Platform Operator, Company Admin, Manager, Board, Owner, and Vendor workflows against two associations. Include forged IDs, direct URLs, cross-association storage paths, server actions, and service-role boundaries.
7. **Validate external provider and operations gates.** Confirm Preview uses staging Supabase and Stripe test mode, then verify Plaid, Resend, scheduled jobs, backups/restores, alerts, and all required environment variables without exposing secrets.

Already closed on commit `c800cd3`: clean install, production dependency audit, secret scan, unit tests, TypeScript, lint, dashboard text audit, route audit, generated inventory check, production build, and Vercel deployment.
