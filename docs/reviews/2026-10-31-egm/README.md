# Elephant-Goldfish review, 2026-10-31

Google's Elephant-Goldfish Model plugin (github.com/google/elephant-goldfish-model).
Nothing below was checked or fixed yet. Findings are the reviewers' words, not Claude's.

## 1. Independent: Codex (OpenAI GPT-5.4)
`codex_independent_drift_report.md` — Codex ran the plugin's drift report on all
53 files in `docs/` with one instruction ("Use the egm-drift-report skill on the docs
directory"). It found 9 documents out of date with the code; no code defects reported.
Its sandbox could not write the full report file, so only its summary exists.

## 2. Fresh-context Claude reviewers (same model family as the builder — not independent)
Each got the plugin's drift-report skill and reviewer persona, one document set, and
the code. No conversation history.

| File | Checked | Major findings |
|---|---|---|
| `drift_product_rules.md` | docs/brain/Product Rules.md | bills skip board re-check at submit; managers can edit chart of accounts; owner ledger total wrong past 1,000 rows; vendors read staff-only calendar fields |
| `drift_decisions.md` | docs/brain/Decisions.md | general board approval requests can never be decided |
| `drift_shipped_1.md` | Shipped.md lines 1–310 | buyer can read seller's payment applications |
| `drift_shipped_2.md` | Shipped.md lines 311–end | cross-company pet rows via direct API; vendor logins still linked by email |
| `drift_roles_design.md` | ROLE_ACCESS_MATRIX + DESIGN_SYSTEM | any operator can change email holds; vendor can forge work-order message author; vendors write more than status; 18 of 26 board pages are redirects; owners' lease writes undocumented; NoCompanyNotice missing on most pages |
| `drift_parity.md` | appfolio-gap-analysis + IMPLEMENTATION_SPEC | no board elections/online voting; owner statements email-only (no mail/coupons); tenants can't be texted; both docs stale |

## 3. Zoom-out (egm-zoom-out persona) on Status.md, Product Rules.md, TODO.md
Verdict FAIL. Blockers: no work toward a paying customer (pilot open since early
October while ~140 PRs merged); production used as the test bed while docs disagree
whether Randolph Station is real. Major: over-built for zero customers; every rule
becomes a multi-migration database fight; repo migrations can't rebuild production;
no point-in-time recovery; online dues never run end to end; AI needs each company's
own OpenAI key; no insurance/contract/support plan; TODO and Status are duplicated
and stale.
