# Portier369 Production Readiness

## Final recommendation

# READY FOR CONTROLLED PILOT ONLY

Portier369 is not ready for unrestricted production rollout. It is ready for a controlled staging pilot using the deterministic test company, supervised users, non-production financial data, and disabled external payment/bank functionality.

**Evaluated branch:** `codex/portier369-stabilization`  
**Application commit:** `d541a9d`  
**Evidence/document commit:** `a5fb350`  
**Verified preview:** `https://condo-gstpub57n-aios2.vercel.app`  
**Staging database:** `zalfkrtjeswvfmucicea`  
**Production database:** `termxngysvotnfbzbgrv` — not modified

## Why a controlled pilot is justified

- The complete local gate passes: 203 automated tests, TypeScript, lint, route integrity, secret scan, migration validation, and production build.
- The latest Vercel preview is Ready.
- The staging fixture is repeatable and isolated across two portfolios.
- Tested role boundaries reject cross-company, cross-association, cross-unit, and cross-vendor access.
- Operator, company-admin, board, owner, vendor, and manager portal sweeps render without application errors.
- Fifteen financial exports, the monthly PDF, A/P approvals, check generation, check lifecycle, and accounting invariants pass.
- Real owner/vendor file uploads and database records were verified, not inferred from success messages.
- Communications workers, retries, scheduled delivery, and automation retry behavior pass staging tests.

## Why unrestricted production is not approved

- Production has not received the stabilization migrations or approved branch commit.
- Live Stripe and Plaid workflows lack end-to-end credentialed evidence.
- A separate tenant portal is not implemented.
- Several P1 mutation lifecycles remain only partially verified, especially assessment/payment posting, owner/unit lifecycle, manager violation completion, full work-order dispatch, and bank reconciliation reopen behavior.
- The report catalog/XLSX promise is not fully reconciled with supported exporters.
- Hosted cron delivery and real inbox/bounce evidence are incomplete.
- Physical check-stock alignment requires human approval.

## Role readiness

| Role | Current decision | Evidence boundary |
|---|---|---|
| Platform Operator | Pilot ready | All 17 navigation routes render; user-role lifecycle and audit trail pass. Company create/suspend/reactivate remains a supervised pilot workflow. |
| Company Admin | Pilot ready | All 22 navigation routes render Alpha-only; manager invitation/assignment and cross-tenant denials pass. Full onboarding/removal lifecycle remains supervised. |
| Property Manager | Pilot ready for tested modules | Financial reports/PDFs, A/P/checks, communications, units, documents, vendors, and diagnostics pass. Several operational creation/closure lifecycles remain partial. |
| Board Member | Pilot ready, read-only emphasis | All 19 navigation routes render Alpha-only; financial, budget, delinquency, documents, violations, reports, and edit denials pass. Full meetings/approvals/minutes lifecycle remains partial. |
| Owner | Pilot ready except live payments | Balance, ledger history, messages, service requests, hearing requests, insurance PDFs, documents, meetings, and calendar routes pass. Live payment and several profile/amenity mutations remain blocked or partial. |
| Vendor | Ready for controlled pilot | All nine routes plus status/message/compliance/invoice workflows and isolation tests pass. Vendors cannot approve or mark their own invoices paid. |
| Tenant | Not available | No independent tenant auth role or portal exists. |

## Release gate

Do not merge or deploy to production until all of the following are true:

- [ ] Owner accepts or resolves every item in `PORTIER369_REMAINING_BLOCKERS.md` designated as a release blocker.
- [ ] The exact migration manifest receives manual review and a production backup/rollback plan exists.
- [ ] Remaining P1 financial and operational mutation tests pass on staging.
- [ ] Active report definitions match supported export formats.
- [ ] Credentialed Stripe/Plaid tests pass, or those features are explicitly disabled for launch.
- [ ] Real email and hosted cron evidence is recorded.
- [ ] Physical check printing is approved, or check printing is disabled for launch.
- [ ] PR review and CI pass on the final commit.
- [ ] The approved commit is merged to `main` and deployed.
- [ ] Read-only production smoke tests pass immediately after deployment.

Until then, the release decision is **NO-GO for unrestricted production** and **GO for a supervised staging pilot**.

