# Fetched production migration evidence

These 159 SQL files were fetched read-only from production project
`termxngysvotnfbzbgrv` on 2026-07-29 with Supabase CLI 2.109.1.

They are immutable audit evidence, not the active replay history. The exact
ledger cannot rebuild an empty database because its second migration expects
`public.schema_migrations`, which neither the platform bootstrap nor
`0001_all.sql` creates.

SHA-256 hashes are recorded in
`docs/database/production-migration-manifest-20260729.sha256`.
