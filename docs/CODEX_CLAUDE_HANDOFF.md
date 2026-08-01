# Codex + Claude release handoff

Last updated: 2026-07-31 19:16 Pacific

This file is the shared operational checkpoint for the Portier369 release. Do
not rely on older chat summaries or the historical section of
`docs/PROJECT_STATUS.md`.

## Shared starting point

- Base commit: `c077d07c5ebea516a5456a8bc42cb87b01239b0f`
- Codex branch: `codex/portier369-stabilization`
- Draft PR: <https://github.com/autho369-code/Condo-App/pull/24>
- Exact preview: <https://condo-2um9axw74-aios2.vercel.app>
- GitHub CI, production build, TypeScript, lint, route checks, security scans,
  and 182 automated tests are green at the base commit.
- Staging project: `zalfkrtjeswvfmucicea`
- Production project: `termxngysvotnfbzbgrv`

## Ownership while both engineers are active

### Codex

- Production migration safety review and controlled application.
- Production deployment/merge decision and post-deploy read-only smoke tests.
- Provider readiness and release evidence.

### Claude

- Independently review architecture, product-history decisions, and the final
  release candidate through the bidirectional Claude MCP workflow.
- Return prioritized findings with exact evidence; do not mutate production,
  merge PR 24, or deploy.
- Codex must address or explicitly resolve every Claude finding and record the
  result in this handoff before merge.

## Database release checkpoint

- Production physical backups are completing daily; the latest verified backup
  was completed on 2026-07-31. PITR is not enabled.
- The schema-only production baseline `20260715040000` was compared with a fresh
  production schema dump and then marked applied in the migration ledger. Its SQL
  was not executed and no customer data was changed.
- The 31 reviewed forward migrations from `20260726000000` through
  `20260731011000` are applied in both staging and production.
- Production preflight found 0 plaintext AI keys, 0 custom AI endpoints,
  0 unsupported AI providers, and 0 cross-association AutoPay conflicts.
- Post-migration verification exposed legacy role-catalog drift. Migration
  `20260731012000` normalized the catalog, and Claude's independent review found
  that two roles were deliberately inactive rather than stale. Corrective
  migration `20260731013000` restored the documented condo-only boundary.
- Final role invariant is verified in staging and production: President,
  Accountant, Property Manager, and On-Site Manager are active system roles;
  Leasing Agent and Accounts Payable remain inactive.
- Both databases report no pending migrations. Production database lint passes
  at error level, and the CLI is relinked to staging.
- `AI_CREDENTIALS_ENCRYPTION_KEY` exists in the Vercel Production environment.
  Its value was not copied into this repository or logged.

## Release sequence

1. Commit and push the two role-catalog migrations, regression test, and this
   release evidence; confirm GitHub CI and the exact Vercel preview are green.
2. Complete the six-role browser regression against that exact preview.
3. Merge PR 24 only when database, application, and browser gates are green.
4. Deploy the approved commit to production and run read-only production smoke
   tests before declaring GO.

## Claude verification log

- 2026-07-31: Claude Fable independently reviewed the post-migration role fix.
  It confirmed the upsert was mechanically safe but found that activating
  Leasing Agent and Accounts Payable reversed a deliberate product decision in
  `supabase/legacy-migrations/rbac_fixes.sql`. Codex accepted the finding,
  added forward correction `20260731013000`, and verified the corrected 4-active
  / 2-inactive invariant in staging and production.
- Six-role browser regression against the next exact preview remains the final
  application release gate.

