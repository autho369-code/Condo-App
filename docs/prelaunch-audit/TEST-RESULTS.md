
# Test results

Environment date: 2026-07-28  
Branch: `audit/portier369-prelaunch-verification`  
Commit: `007aea54e7ec8a994257c0a6892399d0eb56e594`  
Databases: production `termxngysvotnfbzbgrv` read-only; staging `zalfkrtjeswvfmucicea` inspected read-only and found empty.

| Check | Result | Evidence |
| --- | --- | --- |
| GitHub CI run 30343321381 | Pass | Completed successfully for the commit above. |
| Vercel deployment | Pass | Deployment status succeeded for the commit above. |
| `npm ci` | Pass in CI | Clean dependency installation. |
| `npm run typecheck` / `tsc --noEmit` | Pass | Local and CI. |
| `npm run lint` | Pass with 8 warnings | Pre-existing hooks/image/accessibility debt. |
| `npm test` | Pass in CI | Includes report accounting, security migration, disabled-profile access, Stripe, and route tests. |
| `npm run build` | Pass in CI | Production Next.js build. |
| `npm audit --omit=dev` | Pass in CI | Production dependency gate. |
| Migration audit | Audit pass; strict fail | 41 invalid filenames, three duplicate-version groups, and remote/local drift remain. |
| Authenticated manager navigation | 50/50 rendered | 24 top-level and 26 submodule pages; three transient blank pages passed on retry. |
| Authenticated report-link sweep | 120/120 rendered | No persistent 404/server error; Trial Balance needed one retry after a transient blank render. |
| Manager-to-Company-Admin boundary | Defect found; fixed in branch | Direct manager access rendered Company Admin before the application/DB role-boundary fix. |
| Core accounting file exports | 4 implemented in branch | Trial Balance, Balance Sheet, Income Statement, and General Ledger use portfolio/association-validated worker paths. |
| Advertised report implementations | Fail | 95 of 119 catalog definitions have no live implementation or supported dispatcher case. |
| Production receivable tie-out | Pass (limited) | $10,650 charges - $8,400 applications = $2,250 open A/R. |
| Production journal balance | Pass (limited) | Four source batches; every batch had equal debits and credits. |
| Payment-to-journal traceability | Fail | 24 payments are represented by one aggregate journal; no `source_id` matches an individual payment. |
| Stripe association onboarding | Not operational | 0 of 2 active associations have a connected account. |
| Plaid/reconciliation execution | Not tested | 0 Plaid items, bank transactions, or reconciliations. |
| Production mutations | Not run | Prohibited by the audit safety rules. |

## Manual workflows exercised

- Authenticated manager dashboard and navigation.
- Full report catalog link sweep.
- Trial Balance, Balance Sheet, Income Statement, and A/R Aging aggregate checks.
- Report-run failure history and unsupported report behavior.
- Association/unit directory rendering.
- Read-only production catalog queries for migration state, function grants, auth triggers, role/profile state, provider state, receivables, payments, applications, and journals.

## Commands and gates executed

`npm ci`, `npm audit --omit=dev`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run check:routes`, `npm run db:migrations:audit`, and `npm run db:migrations:check` (expected strict failure until history is reconciled).

Local Vitest could not start from the disposable workspace because its `node_modules` junction points outside the writable sandbox. GitHub CI ran the same suite successfully and is authoritative.

## Still required

Role-by-role browser/API/RLS tests, clean migration replay, seeded staging financial workflows, provider test-mode webhooks, file-storage isolation, mobile traces, failure injection, and backup/rollback rehearsal remain incomplete.
