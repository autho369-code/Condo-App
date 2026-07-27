# Verification data guide

Use a **staging-only**, fictional association named `AUDIT â€“ Fictional HOA â€“ DELETE ME`, with fictional owners and units. Every record must carry an `audit_run_id`/clearly unique marker and be created by an idempotent script: upsert stable fixture IDs, never random unnamed production-like records.

Suggested fixtures: two associations, three units per association, opening cash/AR/AP/equity, one charge and payment, one bill and payment, one late fee, one adjustment, one cleared and one uncleared bank transaction, one work order, and one report run per permitted format.

Cleanup must delete only records bearing that exact marker, in dependency order, and must be run only after export/reconciliation evidence is retained. Never point the script at production; require an explicit environment guard that rejects the production project reference.

No fixture script was run in this audit because the only confirmed connected database was production.
