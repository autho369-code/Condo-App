# Browser tests (end to end)

Real browser, real app, real database schema. Each test signs in through the
login page, clicks the same buttons a manager or owner would, and then checks
the database: balances, the general ledger (every journal entry balances) and
who can see what.

| File | Workflow |
|---|---|
| `tests/01-receivables.spec.ts` | Overdue assessment → late fee run (charged once, a second run charges nothing) → check payment → owner's ledger; owner can't open the manager page |
| `tests/02-violations.spec.ts` | Open a violation under a house rule → courtesy notice → formal notice with hearing → fine blocked until the board decides → board upholds → $50 fine on the unit, in the GL and on the owner's ledger |
| `tests/03-payables.spec.ts` | Vendor bill → approval (accrues to A/P) → check run (check #1001 from operating cash, A/P cleared) → the bill can't be paid twice |
| `tests/04-isolation.spec.ts` | A manager at another company sees none of our units, violations, bills, owners or vendors, and a forged charge to our unit is refused by the server |

## Where it runs

Never production. The tests use a **local Supabase in Docker** (`e2e/supabase`,
port 55321) built from production's schema (structure only, no data):

- `migrations/00000000000000_production_schema.sql` — `supabase db dump` of production
- `migrations/00000000000001_auth_storage.sql` — production's sign-up triggers, file buckets and file policies
- `migrations/00000000000002_reference_data.sql` — global reference rows (report catalog, entitlements, collection-law profiles)

The seed (`scripts/e2e/seed.mjs`) creates one test company from scratch on every
run: a company admin, a manager, an owner with a portal login, an association
with unit 101, a vendor, a small chart of accounts, and the app's own defaults
(standard charge categories, starter house rules and violation schedule). It
refuses any database except the local one. Passwords are generated per run and
kept only in the git-ignored `.env.e2e.local`.

The app is started on port 3100 with the local database's settings passed in its
environment, which take priority over `.env.local` (that file points at
production). Outside services (email, Stripe, texting, mail, AI) are switched off.

## Run it

Needs Docker Desktop running.

```bash
npm run e2e:db
```

```bash
npm run e2e
```

`npm run e2e:db:stop` stops the local database. GitHub runs the same tests on
every pull request (`.github/workflows/e2e.yml`).

## After a production schema change

Refresh the local schema so the tests cover it (read-only exports, from a CLI
folder linked to production — this checkout stays linked to staging), then
commit the regenerated files:

```bash
node scripts/e2e/build-db.mjs prod-schema.sql prod-reference.json
```

See the comments at the top of `scripts/e2e/build-db.mjs` for the two export
commands. Then `npx supabase db reset --workdir e2e` and run the tests.
