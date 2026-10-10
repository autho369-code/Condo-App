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
| Readable text | 9-11px text raised to 11.5-12.5px in 103 files (print views, PDFs, certificates, marketing and sign-in left as they are) | typecheck, parity |
| Phase 4a | Company admin: `scripts/redesign/restyle-handbuilt.mjs` maps the old kit's exact class lists to the shared design, 468 class lists in 24 files | typecheck, parity; **no browser check** (needs a company-admin login) |
| Phase 4b | Operator, homeowner portal, board: same script plus portal-era patterns (form fields, padded cards, captions); section-title styling applies only to real headings; 671 class lists in 59 files | typecheck, parity; **no browser check** (needs logins for these roles) |
| Phase 3b | Reports: every active report listed (see below), full names with descriptions, category chips, search with match count, star and schedule on every row | Chrome, signed in as a manager (desktop): 143 reports, search "1099" finds 4 |

## Baseline defects found and fixed

- **42 active reports were missing from `/reports`.** The page showed only the reports in `lib/reports/appfolio-catalog.ts`, which lists 101. The other 42 are active and runnable: 38 through `report_data_dispatch`, and `ap_aging`, `delinquency_summary`, `bank_reconciliation` and `bank_account_reconciliation` through the live export. They were reachable only by direct URL or the Action Center. They now appear under the section that matches their own category. Same table and query; the only addition is that the page also reads `name` and `category`.

## Notes

- **CodeQL flags two existing patterns, kept out of this redesign.** These files are left unchanged so the redesign does not touch them; each needs its own review:
  - `components/marketing/piper-widget.tsx:45`: chat session id from `Math.random()` (insecure randomness). Marketing widget, outside the redesign's scope.
  - `components/violations/open-violation-form.tsx:65`: the association id goes into a link href ("DOM text reinterpreted as HTML"). It is a UUID from a select and React escapes it, so this is likely a false positive.

- **18 of the 26 board pages are redirect stubs.** Sections deliberately removed from the read-only board portal, such as `/board/work-orders` and `/board/owners`, only redirect to `/board`. They have nothing to style and their behavior is unchanged.

## Not yet verified

- **Phone widths in a signed-in browser.** The Chrome window could not be resized.
- **Owner, board and vendor screens.** There are no logins for these roles in production.
- **Company admin and operator screens.** Their passwords are unknown and need a reset by Mirsad.
