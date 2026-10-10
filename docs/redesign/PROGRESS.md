# Redesign progress

Branch `claude/redesign-six-roles`, baseline `2fea8502`. Presentation only:
no Supabase schema, policy, RPC or integration change; the parity test
(`tests/redesign/parity.test.ts`) passes after every step.

## Done

| Step | What changed | Verified |
|---|---|---|
| Phase 1 | Inventory, function-preservation matrix, role access matrix, parity test, baseline results | CI green at baseline |
| Phase 2 | Design tokens; heading face (Schibsted Grotesk, bundled); one `RoleShell` for company admin, operator, owner, board, vendor and resident; refreshed shared primitives; readable sidebar with the company's color | typecheck, parity |
| Phase 3a | Manager dashboard: "Needs attention" cards first, feed and quick actions, compact payments and portal adoption sections; page headers wrap actions; Action Center labels readable | Chrome, signed in as a manager (desktop) |
| Phase 3b | Reports: every active report listed (see below), full names with descriptions, category chips, search with match count, star and schedule on every row | Chrome, signed in as a manager (desktop): 143 reports, search "1099" finds 4 |

## Baseline defects found and fixed

- **42 active reports were missing from `/reports`.** The page showed only the reports in `lib/reports/appfolio-catalog.ts`, which lists 101. The other 42 are active and runnable: 38 through `report_data_dispatch`, and `ap_aging`, `delinquency_summary`, `bank_reconciliation` and `bank_account_reconciliation` through the live export. They were reachable only by direct URL or the Action Center. They now appear under the section that matches their own category. Same table and query; the only addition is that the page also reads `name` and `category`.

## Not yet verified

- **Phone widths in a signed-in browser.** The Chrome window could not be resized.
- **Owner, board and vendor screens.** There are no logins for these roles in production.
- **Company admin and operator screens.** Their passwords are unknown and need a reset by Mirsad.
