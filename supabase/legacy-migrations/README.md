# Legacy repository migrations

These files are the pre-reconciliation repository migration inventory. They are
retained as audit evidence and are **not** an executable migration history.

Do not move, rename, or replay these files into `supabase/migrations`. The
inventory contains invalid filenames, duplicate versions, environment-specific
backfills, destructive SQL, and migrations that assume core tables already
exist.

The executable history is in `supabase/migrations`. See
`docs/database/RECONCILIATION_EVIDENCE_2026-07-29.md`.
