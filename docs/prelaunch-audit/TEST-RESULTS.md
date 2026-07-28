# Test results

Evidence date: 2026-07-28. Production remained read-only.

| Check | Result | Evidence |
| --- | --- | --- |
| Clean dependency install | Pass | GitHub Actions CI run 30340344091, job 90214295249. |
| Production dependency audit | Pass | CI completed `npm audit --omit=dev --audit-level=high`. |
| Secret scanner self-test and source scan | Pass | CI step completed successfully. |
| Unit tests | Pass | Full Vitest suite passed in CI. Local execution was sandbox-blocked and is not counted as a pass. |
| TypeScript | Pass | `npm run typecheck` passed locally and in CI. |
| Lint | Pass with warnings | CI passed. Local run showed eight non-blocking React hook, image optimization, and missing-alt warnings. |
| Dashboard text audit | Pass | Local and CI checks passed. |
| Route audit and generated inventory | Pass | Both CI steps passed and the generated inventory was unchanged. |
| Production build | Pass | CI and Vercel commit c800cd3 passed. |
| Vercel preview deployment | Pass | Deployment 8qgkteUgRFyHHhS8pLu7nEXpWGJJ is Ready. |
| Strict migration validation | Fail | 41 invalid filenames and three duplicate-version groups. |
| Linked staging database dry run | Blocked | Project ref is linked, but this execution environment has no reusable Supabase access token or database password. Nothing was applied. |
| Report catalog inventory | Partial | 119 definitions are visible. Eighteen slugs have live page implementations; queued coverage cannot be reproduced because `report_data_dispatch` is absent from local migrations. |
| Trial Balance export code path | Pass (static/CI) | Scoped live export source, CSV/JSON/PDF serialization, UI wiring, tests, build, and deployment pass. |
| Trial Balance export authenticated preview run | Blocked | The new preview hostname has no signed-in manager session and no credentials are stored or auto-filled. |
| Production accounting sample | Pass (limited) | Sampled Trial Balance, Balance Sheet, Income Statement, and A/R cross-checks are documented in the financial audit. |
| Production mutations | Not run | Prohibited by audit safety rules. |

A release pass still requires a reproducible staging database, staging audit personas, authenticated role workflows, Stripe test-mode replay, report-by-report execution evidence, and strict migration validation.
