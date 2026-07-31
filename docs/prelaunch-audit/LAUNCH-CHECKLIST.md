# Launch checklist

- [x] Normalize local migration names/versions and bring linked staging current.
- [x] Seed reversible two-association `CODEX_TEST` staging fixtures.
- [x] Verify staging RLS/scope for Operator, Company Admin, Manager, Board, Owner, and Vendor.
- [x] Verify role-home routing and representative role workflows in isolated browser sessions.
- [x] Generate and download a real private Balance Sheet PDF from staging.
- [x] Pass the local code gate: 164 tests, TypeScript, lint, route/dashboard audits, migration validation, secret scan, and production build.
- [ ] Replay all 187 migrations into an empty disposable database.
- [ ] Restore a production backup to staging and rehearse rollback.
- [ ] Complete direct-ID/API/storage/stale-session attack tests for every supported role.
- [ ] Reconcile every supported financial report/export to fixture journals and control accounts.
- [ ] Keep catalog-only reports visibly unavailable until their data source and export are audited.
- [ ] Run Stripe webhook ordering/duplicate/refund/dispute/payout/autopay isolation tests in test mode.
- [ ] Complete per-association Stripe Connect test onboarding before accepting any charge.
- [ ] Run Plaid sync/match/failure/reconciliation tests and tie results to journals and bank balances.
- [ ] Verify scheduled-report authorization, retention, signed-download expiry, and failure recovery.
- [ ] Validate Resend/SMS/cron/monitoring/rate-limit configuration in Preview and Production without exposing secrets.
- [ ] Obtain owner approval for the exact commit and production migration plan.
- [ ] Merge, deploy that approved commit, and run read-only production smoke tests.
