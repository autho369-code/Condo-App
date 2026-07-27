# Financial system audit

The sampled production statements reconciled as recorded in `TRUE-APPLICATION-STATE.md`. This is a limited evidence sample, not an accounting certification.

Remediation in this audit branch:

- Trial balance and balance sheet now read posted journal lines through the reportâ€™s **as-of** date rather than only the selected activity period.
- Financial reports include shared/global accounts plus the selected associationâ€™s accounts, rather than accounts from every association.
- Account normal-balance and section classification is centralized and covered by unit tests.
- Export output is serialized by requested type (CSV, JSON, or actual PDF); unsupported database-configured labels are excluded from the UI and rejected server-side.
- A/R aging explains that it is calculated as of today, preventing a false arbitrary-period representation.

Required prelaunch reconciliation: create a disposable staging association with opening balances, invoice/receipt, vendor bill/payment, adjustment, late fee, and bank reconciliation. Verify every source transaction flows to journal entries once, trial balance balances, balance sheet balances, retained earnings/net income roll forward correctly, AR/AP aging ties to control accounts, and exported totals equal UI totals.
