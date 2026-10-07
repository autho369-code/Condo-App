# migration-reviewer memory

## Confirmed rules (Mirsad)
- DELETE/DROP SQL goes to Mirsad for the SQL editor; additive migrations Claude applies after merge.
- Only project `termxngysvotnfbzbgrv`; never staging or stellar-ops without asking.

## Checks that caught real bugs
- Migrations must pass `node scripts/check-supabase-migrations.mjs`.

## False alarms to skip
- The checker prints ~40 warnings on old, already-merged migrations even when it PASSES. Only warnings on in-scope files count. (Codex on PR #229.)
