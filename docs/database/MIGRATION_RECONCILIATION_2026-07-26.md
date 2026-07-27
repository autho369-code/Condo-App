# Supabase migration reconciliation - 2026-07-26

## Decision

The linked production database is the source of truth for current schema state.
Its migration ledger must be preserved. The existing repository migration
directory is evidence of past changes, but it is not currently a safe,
replayable deployment history.

Do **not** run the bulk command suggested by the CLI that marks all remote
versions reverted. Do **not** rename the skipped SQL files in place and push
them. Neither action reconciles the SQL with the schema that is already live.

This document is a runbook for a controlled reconciliation. It does not itself
authorize a production mutation.

## Verified repository inventory

At the time of this review:

- The legacy inventory contains 94 tracked SQL files. Additional correctly
  timestamped 2026-07-26 hardening migrations are being added after that legacy
  history; run the checker for the current total.
- 41 filenames do not meet the CLI migration naming convention and are skipped.
- Four skipped files use only an eight-digit date:
  - `20260608_budget_vs_actuals.sql`
  - `20260608_meeting_sign_in.sql`
  - `20260608_owner_payables.sql`
  - `20260622_saved_report_views.sql`
- The other 37 skipped files have no numeric version prefix. Run
  `npm run db:migrations:audit` for the authoritative list.
- Valid-looking files still have duplicate version prefixes:
  - `20260607020000` is shared by three files.
  - `20260608000000` is shared by two files.
- The eight-digit prefix `20260608` is also shared by three skipped files.
- The earlier CLI error reported 148 remote versions. A read-only production
  query later on 2026-07-26 found **159** ledger rows, all with stored SQL
  statements, from `0001` through `20260715032953`.
- Eleven current 14-digit local versions overlap production:
  `20260430180429` through `20260501055733`, plus `20260606000000`,
  `20260607000000`, `20260607010000`, and `20260607020000`. The last of those
  is shared by three different local files, so filename overlap does not prove
  content identity. The remaining current local versions are absent remotely.
- No repository migration creates the core `associations`, `portfolios`,
  `profiles`, `owners`, or `units` tables. Early files alter or reference those
  tables, so the directory cannot build the application database from empty.
- `supabase/config.toml` and `supabase/seed.sql` are absent.

Re-run the inventory at any time with:

```powershell
npm run db:migrations:audit
```

Strict mode intentionally fails until reconciliation is complete:

```powershell
npm run db:migrations:check
```

## Why the suggested bulk repair is unsafe

`migration repair --status reverted` deletes rows from
`supabase_migrations.schema_migrations`; it does not undo the SQL. Deleting all
159 rows would make the CLI forget the production lineage. A later
`db push --include-all` could then execute legacy SQL against a live schema.

That legacy SQL includes materially dangerous operations:

- `20260608_meeting_sign_in.sql` starts by dropping `meetings` with `CASCADE`.
- `remove_stripe_tables_and_columns.sql` drops Stripe tables,
  `payment_intents`, and Stripe-related columns.
- `seed_bills.sql` inserts randomized payable bills.
- Calendar backfills contain hard-coded portfolio and user UUIDs.

Some comments say files were applied manually, while other comments say the
files were not automatically applied. Filename or Git chronology therefore
cannot prove production state.

## Non-mutating discovery

### 1. Record the remote ledger

Run this in the Supabase SQL editor and save the result with the release
evidence. It is read-only.

```sql
select
  version,
  name,
  coalesce(cardinality(statements), 0) as statement_count
from supabase_migrations.schema_migrations
order by version;
```

Also record whether the ledger can reconstruct actual SQL:

```sql
select
  count(*) as total_versions,
  count(*) filter (
    where coalesce(cardinality(statements), 0) > 0
  ) as versions_with_statements,
  min(version) as first_version,
  max(version) as last_version
from supabase_migrations.schema_migrations;
```

### 2. Check ambiguous legacy features

These files contain comments suggesting they may not have been applied. Verify
objects instead of trusting the comments:

```sql
select
  to_regclass('public.maintenance_template_groups') is not null
    as maintenance_present,
  to_regclass('public.late_fee_assessments') is not null
    as late_fee_table_present,
  to_regprocedure('public.assess_late_fee(uuid)') is not null
    as late_fee_function_present,
  to_regclass('public.work_order_messages') is not null
    as work_order_messages_present,
  to_regclass('public.automation_flows') is not null
    as automation_flows_present,
  to_regclass('public.automation_flow_runs') is not null
    as automation_runs_present;
```

For association-owned Stripe Connect, verify the account columns and unique
index independently before enabling payments:

```sql
select
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'associations'
      and column_name = 'stripe_account_id'
  ) as stripe_account_column_present,
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'idx_associations_stripe_account'
  ) as stripe_account_unique_index_present;
```

### 3. Fetch history only into a clean scratch checkout

Do not run `migration fetch` over the current dirty working directory. Use a
clean branch or disposable clone with an empty `supabase/migrations` directory:

```powershell
npx supabase@2.109.1 migration fetch --linked
```

`migration fetch` reads files from the remote history table. Confirm it creates
exactly one local file per remote version, including the historic `0001`
version. Save a SHA-256 manifest of the fetched files.

## Preferred reconciliation: exact remote replay

Use this path only when fetched history contains actual statements and passes a
fresh replay.

1. Preserve the current repository files outside the active
   `supabase/migrations` directory. Do not delete them and do not rename them as
   new migrations.
2. Make the fetched remote files the candidate active history.
3. Generate and review `supabase/config.toml`; never hard-code secrets in it.
4. Start an isolated local Supabase stack.
5. Run `supabase db reset --local`.
6. Run database lint and pgTAP tests locally.
7. Compare the recreated schema with the linked schema.
8. Repeat the replay on a disposable hosted Supabase project.
9. Only after parity is proven, mark an individually verified migration that
   was manually executed as `applied` in the production ledger.

The 2026-07-26 Stripe hardening migration may be marked applied only after its
function, index, grants, and behavior have been verified on production. The
same rule applies independently to any later rate-limit migration.

Example for one already-executed and verified version:

```powershell
npx supabase@2.109.1 migration repair --linked --status applied 20260726000000
```

This is not permission to run the example blindly. First confirm that the
remote ledger does not already contain the version and that all SQL effects are
present.

## Fallback reconciliation: current-state baseline

Use this only if remote history is missing statements or cannot recreate the
database.

1. Preserve every remote ledger row unchanged (159 at the verified snapshot).
2. Preserve the fetched files and current legacy SQL as audit artifacts.
3. Create one no-op local history marker per existing remote version.
4. Produce a reviewed schema-only dump of the current production database.
5. Store deterministic reference data, storage bucket configuration, and other
   required DML separately; schema-only dumps omit those concerns.
6. Give the baseline a new version after the last remote version and before any
   later real migration that it already contains.
7. Prove the complete sequence on both a fresh local stack and a disposable
   hosted project.
8. Mark only that validated baseline version applied in production. Never
   execute the full baseline SQL against the already-populated production
   schema.

No marker files or baseline are added by the current safety change because a
real production dump and replay evidence are prerequisites.

## Required parity checks

A zero schema diff is necessary but not sufficient. Check all of the following:

- Public tables, columns, constraints, indexes, sequences, and enum types.
- Functions, trigger definitions, views, grants, and RLS policies.
- `security_invoker` view attributes.
- Extensions and custom schemas.
- Storage buckets, bucket configuration, and storage policies.
- Scheduled jobs, if any.
- Deterministic reference data required for a new environment.
- Generated TypeScript database types.
- Cross-tenant authorization and association-owned Stripe account tests.

## Commands prohibited during reconciliation

Do not run any of these against the linked project:

```text
supabase migration repair --status reverted <all remote versions>
supabase db reset --linked
supabase migration down --linked
supabase db push --include-all
supabase migration squash --linked
```

Do not run a non-dry-run `db push` until all acceptance criteria below pass.

## Acceptance criteria

Reconciliation is complete only when:

- `npm run db:migrations:check` exits zero without `--audit`.
- Every active migration filename is valid and every version is unique.
- A fresh local reset succeeds from empty.
- A disposable hosted project can be built from the same files.
- Schema and security parity with production are documented.
- Required reference data and storage configuration are reproducible.
- `supabase migration list --linked` has no unexplained one-sided history.
- `npm run db:migrations:dry-run` reports no unexpected SQL.
- A production backup and rollback/forward-fix plan are recorded.

## Official references

- [Supabase CLI reference](https://supabase.com/docs/reference/cli/supabase-projects-create)
- [Database migration troubleshooting](https://supabase.com/docs/guides/deployment/database-migrations)
- [Local development workflow](https://supabase.com/docs/guides/local-development/cli-workflows)
