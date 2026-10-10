# Redesign baseline

- **Baseline commit:** `2fea8502f6e23d0f0febcc7aa84af908e0f9753f`, main after #276, 2026-10-10.
- **Branch:** `claude/redesign-six-roles`. All redesign work happens here; to roll back, revert the branch's commits or don't merge it.
- **Scope:** presentation only. No Supabase schema, migration, policy, RPC, Storage, Edge Function or integration changes. The parity test fails if a route's data source, action, field, link or guard disappears.

## Files

| File | What |
|---|---|
| `baseline-inventory.json` | Machine snapshot of 377 routes (6 role areas plus resident) and 346 navigation entries |
| `FUNCTION_PRESERVATION_MATRIX.csv` | One row per capability (about 9,600 rows), stable `id`, with `redesigned_location` and `verification` columns to fill in |
| `ROLE_ACCESS_MATRIX.md` | Guards, landing pages, data scope and the allow/deny checks |
| `../../scripts/redesign/inventory.mjs` | Builds the inventory from the code |
| `../../tests/redesign/parity.test.ts` | Fails when a baseline capability is gone |

## How capabilities are counted

A route's capabilities are collected from its page and everything it imports, transitively:
- links (`href`, `redirect`, `router.push`)
- form and server actions (`action=`, `formAction=`, `'use server'` exports)
- submitted field names
- data sources (`.from`, `.rpc`, `/api` fetches)
- guards
- button and confirmation labels

Moving markup into a shared component keeps a capability counted. Button and confirmation labels may be reworded; the test lists them for review instead of failing.

## Limits of the static check

- **Links built at run time** (`href={item.href}`) are covered through their data source (navigation definitions, Action Center), not per element.
- **Labels:** the check proves a capability is still in the route's code, not that it is visible. Visibility is checked in the browser where a login exists (see `ROLE_ACCESS_MATRIX.md`, access gaps).

## Baseline checks

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm test` (Windows checkout) | 959 pass, 8 fail |
| CI on GitHub (Linux) for `2fea8502` | **pass**. The 8 local failures come from CRLF line endings in this Windows checkout (the tests match `\n`). They are not code defects and not redesign regressions. |
| `npm run check:columns` | 0 problems |
| `npm run check:routes` | 0 placeholders |

The 8 failures that exist only on Windows:
- `tests/scripts-review-scope.test.ts` (1)
- `tests/database/owners-belong-to-association.test.ts` (1)
- `tests/database/query-columns.test.ts` (3)
- `tests/database/vendor-login-across-associations.test.ts` (1)
- `tests/database/vendors-belong-to-association.test.ts` (1)
- `app/(app)/owners/import/previous-system/gl-actions.test.ts` (1)

## Known defects at baseline (kept separate from the redesign)

- **Pages that don't use the shared kit:**

  | Area | Pages on the shared header | Total pages |
  |---|---|---|
  | Company admin | 1 | 24 |
  | Operator | 2 | 21 |
  | Owner | 1 | 35 |
  | Board | 0 | 26 |

  These areas have about 57 raw `<table>`s and about 245 uses of 9–11px text.
- **Content width differs by area:** 5xl, 6xl, 7xl and 1400px.
- **The board area has 19 pages with only the layout guard.** Allowed (the layout enforces `requireBoard`), but noted.

## Report catalog (live `report_definitions`, read 2026-10-10)

- **Size:** 162 system reports, 143 active.

  | Category | Reports |
  |---|---|
  | accounting | 78 |
  | association | 30 |
  | property and unit | 19 |
  | maintenance | 15 |
  | compliance | 13 |
  | communication | 5 |
  | people | 3 |

- **Where the catalog lives:** in the database, not in code. `/reports` lists every row it reads (`fetchAllRows`), and each report runs through `/reports/[slug]`. The redesign changes neither the table nor the query. The parity test keeps `table:report_definitions` and the runner's data sources and actions on those routes.
- **Report families named in the brief.** All are present by slug:

  | Family | Slugs |
  |---|---|
  | Account totals | `account_totals` |
  | Balance sheet | `balance_sheet` (+ `_comparative`, `_association_comparison`) |
  | Bank account | `bank_account_activity`, `_association`, `_directory` |
  | Cash flow | `cash_flow` (+ `_12_month`, `_association_comparison`, `_detail`) |
  | Chart of accounts | `chart_of_accounts` |
  | Expense distribution | `expense_distribution` |
  | General ledger | `general_ledger` |
  | Income statement | `income_statement` (+ `_12_month`, `_comparative`, `_association_comparison`, `_date_range`) |
  | Loans | `loan_statement` |
  | Trial balance | `trial_balance` (+ `_association`) |
  | Trust account | `trust_account_balance`, `trust_account_detail` |
  | Architectural review | `architectural_review` |
  | Association work orders | `board_work_orders`, `open_work_orders`, `work_order_report` |
  | Board directory | `board_directory` |
  | Dues roll | `dues_roll` (+ `_itemized`) |
  | Fund reports | `fund_balance_sheet` (+ `_active_funds`), `fund_income_statement` |
  | Delinquency | `delinquency`, `delinquency_as_of`, `delinquency_summary` |
  | Prepayments | `owner_prepaid` |
  | Resales | `homeowner_resale` |
  | Vehicles | `vehicle_info`, `owner_vehicle_info` |
  | Renter directory | `resident_directory` (active), `tenant_directory` (inactive) |
