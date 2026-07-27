# Test results

| Check | Result | Notes |
| --- | --- | --- |
| `tsc --noEmit` | Pass | Completed before this documentation update. |
| `npm run build` | Pass | 159 static pages; seven pre-existing lint warnings. |
| Report accounting sample | Pass (limited) | See true-state and financial audit documents. |
| Report helper unit tests | Blocked | Vitest/esbuild could not read the repository parent/config in this Codex filesystem sandbox. |
| Route audit | Blocked | The script attempts to overwrite `docs/placeholder-inventory.md`; sandbox denied that write. Build route manifest provides alternate route evidence. |
| Migration audit | Fail | 41 invalid filenames; duplicate timestamp groups; manual destructive/seed review flags. |
| Production mutations | Not run | Deliberately prohibited by audit scope. |

Before release, run `npm ci`, `npm test`, `npm run typecheck`, `npm run build`, `npm run check:routes`, `npm run db:migrations:check`, Stripe test-mode replay tests, and staging RLS tests in a normal CI/staging environment.
