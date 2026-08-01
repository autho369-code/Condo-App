# Codex + Claude release handoff

Last updated: 2026-07-31 19:00 Pacific

This file is the shared operational checkpoint for the Portier369 release. Do
not rely on older chat summaries or the historical section of
`docs/PROJECT_STATUS.md`.

## Shared starting point

- Base commit: `c077d07c5ebea516a5456a8bc42cb87b01239b0f`
- Codex branch: `codex/portier369-stabilization`
- Draft PR: <https://github.com/autho369-code/Condo-App/pull/24>
- Exact preview: <https://condo-2um9axw74-aios2.vercel.app>
- GitHub CI, production build, TypeScript, lint, route checks, security scans,
  and 182 automated tests are green at the base commit.
- Staging project: `zalfkrtjeswvfmucicea`
- Production project: `termxngysvotnfbzbgrv`

## Ownership while both engineers are active

### Codex

- Production migration safety review and controlled application.
- Production deployment/merge decision and post-deploy read-only smoke tests.
- Provider readiness and release evidence.

### Claude

- Work only from `C:\Users\autho\Portier369-Claude` on branch
  `claude/portier369-verification`.
- Run the full six-role browser regression against the exact preview.
- Repair application defects found during that regression, with focused commits.
- Do not apply production migrations, merge PR 24, or deploy production.
- Do not modify files in `C:\Users\autho\Portier369`; use the separate worktree.

Claude should push focused commits to `claude/portier369-verification` and record
each commit and verification result in this file. Codex will cherry-pick reviewed
commits into PR 24.

## Database release checkpoint

- Production physical backups are completing daily; the latest verified backup
  was completed on 2026-07-31. PITR is not enabled.
- The schema-only production baseline `20260715040000` was compared with a fresh
  production schema dump and then marked applied in the migration ledger. Its SQL
  was not executed and no customer data was changed.
- A production dry run shows 31 forward migrations pending, from
  `20260726000000` through `20260731011000`.
- Staging has already applied the full migration set successfully.
- Production preflight on 2026-07-31 found:
  - 0 portfolios with plaintext AI API keys.
  - 0 portfolios with custom AI endpoints.
  - 0 portfolios with unsupported AI providers.
  - 0 payment methods linked to AutoPay mandates across multiple associations.
- `AI_CREDENTIALS_ENCRYPTION_KEY` exists in the Vercel Production environment.
  Its value must never be copied into this repository or logged.

## Release sequence

1. Codex completes review and applies the 31 forward migrations in controlled
   groups, verifying the ledger and critical data invariants after each group.
2. Claude completes six-role regression and pushes any focused fixes.
3. Codex reviews/cherry-picks fixes, reruns all automated gates, and updates PR 24.
4. Merge PR 24 only when both database and application gates are green.
5. Deploy the approved commit to production and run read-only production smoke
   tests before declaring GO.

## Claude verification log

Add dated entries here. Include route, role, expected result, actual result, and
the commit SHA for every repair.

