# Migration reconciliation evidence — 2026-07-29

## Outcome

The pre-reconciliation repository history and the exact production ledger are
both non-replayable from an empty database. A current-state baseline is therefore
required.

The candidate active history now contains:

- 159 no-op markers matching every production ledger version from `0001`
  through `20260715032953`.
- `20260715040000_production_schema_baseline.sql`, a schema-only dump fetched
  read-only from production.
- The twelve reviewed hardening migrations dated 2026-07-26 and 2026-07-28.
- `20260729000000_fix_invalid_legacy_functions.sql`, a forward fix for invalid
  production function bodies and obsolete RPC overloads.

## Evidence

- Production ledger fetch: 159 files with stored SQL.
- Exact-ledger replay failure: `20260419155646` references missing relation
  `public.schema_migrations`.
- Pre-reconciliation repository replay failure: `20260430180429` references
  missing relation `public.approval_requests`.
- Candidate strict check: 173 valid files, 173 unique versions, zero invalid
  filenames, zero duplicate versions.
- Candidate empty reset: passed in local Supabase using CLI 2.109.1.
- Post-reset database lint at error level: zero findings after the forward fix.
- Production schema baseline SHA-256:
  `a4dad7c113c5b7b9965520e21881fa6746218e4bd79f306cad01c34c2c0777e4`.

## Preservation

- Original repository SQL: `supabase/legacy-migrations/`.
- Exact fetched production SQL: `supabase/fetched-production-migrations/`.
- Fetched-file hashes:
  `docs/database/production-migration-manifest-20260729.sha256`.

## Deployment rule

The baseline is executed only on an empty disposable or staging database. It
must never execute against populated production. After staging parity and role
verification pass, production may record the single baseline version as applied
only after an owner-reviewed schema comparison proves that its effects already
exist. Later forward migrations remain independently reviewable and deployable.

## Staging execution result

On 2026-07-29 the guarded deployment was applied to staging project
`zalfkrtjeswvfmucicea`. All 173 active migration versions matched locally and
remotely afterward, a second dry-run reported that the remote database was up
to date, and remote schema lint returned zero errors.

The deterministic `portier369-staging-v1` fixture was then loaded. It contains
two isolated portfolios and balanced accounting data. All 14 supported live
export slugs executed against the fixture; trial balance, balance sheet, net
income, payable aging, budget, bank reconciliation, and cross-tenant rejection
assertions passed. Production project `termxngysvotnfbzbgrv` was not mutated.
