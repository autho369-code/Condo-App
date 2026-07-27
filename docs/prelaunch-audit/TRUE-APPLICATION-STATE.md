# True application state

The codebase is a multi-tenant HOA/condominium management application with Platform Operator, Company Admin, Manager, Board, Owner, and Vendor portals. Accounting covers GL, journal entries, AR/AP, budgets, bank accounts, reconciliation, Stripe payments, Plaid feeds, and report generation.

Verified on 2026-07-26/27:

- Production report sample: trial-balance debits and credits both equaled $23,950; balance-sheet assets and liabilities/equity both equaled $13,500; income statement net income was $11,450; sampled A/R was $2,250 and another association showed $0.
- The app build produced 159 static pages and includes dynamic help and new-record routes. The older placeholder inventory is stale and must not be treated as current broken-link evidence.
- CSV, JSON, and PDF are the only supported queued-report formats after this audit branch change. PDF output is generated as PDF bytes, not CSV with a PDF filename.

Not yet proven: a full end-to-end run for every report, payment provider delivery/retry, Plaid live synchronization, Telnyx delivery, all role/RLS permutations, backup restore, or deployment-environment variable completeness.
