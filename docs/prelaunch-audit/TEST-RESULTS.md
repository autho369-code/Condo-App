# Test results

Environment date: 2026-07-31

Branch: `codex/portier369-stabilization`

Commit under verification: `b71b765a35ed5a67068e718235ec3ab1a039f3dc`

Databases: staging `zalfkrtjeswvfmucicea` was mutated only with reversible `CODEX_TEST` fixtures and forward migrations; production `termxngysvotnfbzbgrv` remained frozen.

| Check | Result | Evidence |
| --- | --- | --- |
| Local release gate | Pass | 49 Vitest files / 164 tests, TypeScript, route/dashboard audits, migration validation, secret scan, and production build passed. |
| Lint | Pass with 6 warnings | Existing image/accessibility/hook warnings; no lint errors. |
| Migration inventory | Pass | 187 SQL files, 187 valid unique versions; linked staging reports up to date. |
| Staging role/RLS verifier | Pass | Platform Operator, Company Admin A/B, Manager A, Board A, Owner A/B, and Vendor A/B scope checks passed. |
| Authenticated role routing | Pass | Platform Operator, Company Admin, Manager, Board, Owner, and Vendor landed on their intended role homes in isolated browser sessions. |
| Negative role routing | Pass | Owner, Vendor, Board, Manager, and Company Admin attempts to open higher-privilege homes redirected to their own role home. |
| Manager Balance Sheet | Pass | Staging rendered Assets $17,400, Liabilities $0, Equity $17,400. |
| Balance Sheet PDF | Pass | A queued run completed after provisioning private report storage; downloaded output was 12,113 bytes and began with `%PDF-`. |
| Board financials | Pass | YTD income $7,200, expenses $1,800, and net operating income rendered with Print/CSV/PDF controls and no browser errors. |
| Board delinquencies | Pass | One delinquent staging account totaling $1,400 rendered with Print/CSV/PDF controls and no browser errors. |
| Owner ledger and communications | Pass | Staging charges/payments and the management-message form rendered in the association-scoped owner portal with no browser errors. |
| Vendor payments and work orders | Pass | Two approved unpaid bills totaling $1,175 and the scoped work-order surface rendered with no browser errors. |
| Bills / approvals / checks | Pass in staging verification | Payable approval and check-run verification scripts pass; generated check-PDF tests pass. |
| Communications / documents | Pass in staging verification | Owner/staff communication delivery and generated-PDF tests pass. |
| Background jobs | Pass in staging verification | Email worker, automation retry, scheduled delivery, and replay-safety tests pass. |
| Placeholder route audit | Pass | Zero documented placeholder routes; unsupported help slugs return 404 and linked help topics contain real guidance. |
| Production mutations | Not run | Production remained frozen by design. |

## Browser workflows exercised

- Manager dashboard, reports catalog, Balance Sheet data, queued PDF generation, and private signed download.
- Platform Operator and Company Admin home routing; Company Admin manager-assignment form.
- Board dashboard, financials, and delinquencies.
- Owner dashboard, account ledger, and communications.
- Vendor dashboard, payments, and work orders.
- Five direct-URL privilege-boundary redirects.
- Browser error logs were empty on the six role workflow pages recorded above.

## Still required before production

- Clean migration replay into a disposable empty database plus backup/restore and rollback rehearsal.
- Provider test-mode execution for Stripe/Plaid, including signed webhooks, refunds/disputes, payouts, duplicate ordering, reconciliation, and GL tie-outs.
- Full direct-ID/API/storage tampering matrix, including retention/expiry checks for signed report output.
- Every catalog-only report must be implemented and reconciled or remain visibly unavailable; every supported export requires fixture-based accounting tie-out.
- Production environment/cron/monitoring validation without exposing secrets, followed by owner approval and read-only post-deploy smoke tests.
