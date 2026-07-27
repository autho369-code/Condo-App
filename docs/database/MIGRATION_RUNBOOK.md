# Database migration runbook

## Purpose

This is the required workflow for every Portier369 database change after the
2026-07-26 reconciliation. It protects production data, preserves a reproducible
history, and keeps local, preview, staging, and production environments aligned.

The one-time legacy repair is documented in
`MIGRATION_RECONCILIATION_2026-07-26.md`.

## Non-negotiable rules

1. Every schema change starts as a new migration created by the Supabase CLI.
2. Never edit or rename a migration after it is applied to any shared database.
3. Every active migration has one unique version and a filename of the form
   `YYYYMMDDHHMMSS_lowercase_name.sql`.
4. The historic remote version `0001` is the only allowed short-version
   exception during reconciliation.
5. Use explicit `--local` and `--linked` flags. Never rely on command defaults.
6. Test against an empty local database and a disposable hosted project before
   production.
7. Use forward-fix migrations. Do not use linked `migration down` as a normal
   rollback mechanism.
8. Do not put production fixtures, random data, tenant UUIDs, API keys, or other
   secrets in migrations.
9. Production DDL through the Dashboard or an ad hoc SQL editor is prohibited
   except for a documented emergency procedure.
10. `db push --include-all`, `db reset --linked`, and bulk history repair are
    prohibited.

## Current temporary exception

Until legacy reconciliation is complete, strict checking is expected to fail:

```powershell
npm run db:migrations:check
```

Use audit mode only to inventory the known legacy state:

```powershell
npm run db:migrations:audit
```

Audit mode returning zero does **not** mean the migration history is safe. Once
reconciliation is complete, CI must use strict mode and audit mode must not be a
release gate.

## Create a migration

From the repository root:

```powershell
npx supabase migration new descriptive_lowercase_name
```

Review the generated filename before writing SQL. Keep one coherent change per
migration. Prefer operations that are safe on retries where PostgreSQL supports
them, but do not use idempotence as a substitute for correct migration history.

For data changes:

- Make updates deterministic.
- Scope every update/delete with an explicit predicate.
- Use stable natural or application keys rather than environment-specific UUIDs.
- Make backfills restartable and record expected row counts.
- Keep sample/test data in a local seed path, not a production migration.

For destructive changes:

- Split expand and contract work into separate releases.
- Stop application reads/writes to the old object before dropping it.
- Record a backup and recovery query.
- Require explicit human review of affected row counts and dependencies.

## Local validation

The repository must first contain a reviewed `supabase/config.toml`. The file is
safe to commit only when secrets are referenced through environment variables.

Run:

```powershell
npm run db:migrations:check
npx supabase start
npx supabase db reset --local
npx supabase db lint --local --level error
npx supabase test db --local
```

Then run application tests, type checking, lint, route checks, and a production
build. Regenerate `lib/types/database.ts` whenever the public schema changes.

`db reset --local` is destructive only to the local development database. Read
the command and flag before execution; `--linked` is never interchangeable.

## Pull request requirements

Every database pull request includes:

- The new migration and any pgTAP coverage.
- A concise statement of forward behavior and rollback/forward-fix behavior.
- Expected affected row counts for data migrations.
- RLS and grant review for every new table, view, or function.
- Tenant-isolation tests when association or portfolio scope is involved.
- Generated database type changes when applicable.
- Evidence that a clean local reset passed.
- Evidence that the migration passed on a disposable hosted project.

Applied migration files are immutable. CI should compare their hashes with the
canonical manifest and reject modifications.

## Staging and production preflight

Before a linked deployment:

1. Confirm the CLI version is pinned and matches the version validated in CI.
2. Confirm the target project reference.
3. Confirm a recoverable backup/PITR point exists.
4. Check for blocking or long-running database work.
5. List migration state read-only:

```powershell
npm run db:migrations:list
```

6. Preview the exact deployment without applying it:

```powershell
npm run db:migrations:dry-run
```

7. Review the dry-run output against the pull request. Any unexpected historic
   migration is a stop condition.
8. Apply only through the protected deployment workflow.
9. Verify objects, grants, RLS behavior, row counts, application health, and
   provider webhooks immediately after deployment.

The repository intentionally provides no convenience script for a real linked
`db push`; production application must remain deliberate and protected.

## Emergency Dashboard SQL procedure

Use only when waiting for the normal deployment path would cause greater harm.

1. Capture a production backup/recovery point.
2. Create a correctly timestamped migration containing the exact reviewed SQL.
3. Run the SQL in a transaction when PostgreSQL permits it.
4. Verify every intended effect and affected row count.
5. Verify there were no partial effects.
6. Mark only that exact version applied in migration history.
7. Commit the migration and evidence immediately.
8. Run migration list and linked dry-run; both must be clean.

`migration repair --status applied` records history only. It is valid only when
the exact SQL effects are already present. `--status reverted` is not a schema
rollback and must never be used to conceal a mismatch.

## Failure and rollback policy

- Stop on the first unexpected result.
- Do not retry a partially understood migration.
- Prefer a new forward-fix migration.
- Restore from backup only under the incident plan and with known data-loss
  bounds.
- Record the failed version, SQLSTATE/error, completed statements, transaction
  status, and object/row-count checks.
- Never delete migration-history rows merely to make the CLI output green.

## Multi-tenant and Stripe requirements

Portier369 is association-scoped. Every database change must preserve the
portfolio and association boundary in foreign keys, policies, functions, and
indexes.

Each association owns its Stripe connected account. Payment migrations must
therefore prove:

- One unique `stripe_account_id` per association.
- Charges are created in the intended connected-account context.
- Webhook events are resolved to the same association before any ledger write.
- A connected account cannot post to another association's payment intent,
  unit, charge, payment, or ledger.
- Retries and concurrent duplicate events produce one payment and one ledger
  result.
- Security-definer functions expose execute privilege only to the intended role.

Payment or tenant-isolation failures are release blockers, not warnings.

## Command risk reference

| Command | Normal use | Production rule |
| --- | --- | --- |
| `migration list --linked` | Read history | Allowed |
| `db push --linked --dry-run` | Preview pending SQL | Allowed and required |
| `migration fetch --linked` | Copy ledger SQL locally | Scratch checkout only |
| `migration repair --status applied VERSION` | Record proven manual application | One verified version only |
| `migration repair --status reverted VERSION` | Delete a ledger record | Incident-only; normally prohibited |
| `db push --linked` | Apply pending SQL | Protected deployment only |
| `db push --include-all` | Apply old missing versions | Prohibited |
| `db reset --local` | Recreate local database | Allowed; local only |
| `db reset --linked` | Reset linked database | Prohibited |
| `migration down --linked` | Run linked down migration | Prohibited |
| `migration squash --linked` | Rewrite/squash history | Prohibited during reconciliation |

## Release evidence to retain

- Migration-check output.
- Remote migration-list output.
- Dry-run output.
- Local and disposable-hosted reset/test output.
- Schema/security parity results.
- Backup or PITR identifier.
- Applied version and deployment actor.
- Post-deployment smoke-test and row-count results.

