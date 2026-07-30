
# Security findings

Production was inspected read-only. â€œFixed in branchâ€ means source and regression coverage exist; it does **not** mean the production database has been changed.

## SEC-001 â€” Critical â€” Public execution of elevated report functions

- Affected roles/boundary: anonymous, any authenticated user; company and association boundaries.
- Workflow: call a `report_data_*` SECURITY DEFINER function with a caller-chosen portfolio or unit ID.
- Evidence: 156 public-schema SECURITY DEFINER functions exist in production; 151 are executable by `anon` and 151 by `authenticated`. All nine report helpers were executable by PUBLIC, and the owner-ledger helper did not validate its portfolio argument.
- Reproduction: inspect `pg_proc.prosecdef`, function ACLs, and the production definitions; call-path review confirms caller-supplied scope.
- Impact: cross-company financial, owner, vendor, violation, or operations disclosure.
- Fix: service-role-only execution boundary plus explicit portfolio/association validation.
- Fix status: fixed in audit-branch migrations `20260726050000_security_definer_execution_boundary.sql`, `20260728090000_secure_report_queue_scope.sql`, and `20260728093000_restore_scoped_report_data_functions.sql`.
- Test status: static regression tests and CI pass; staging RLS execution is still required.

## SEC-002 â€” Critical â€” Audit-log spoofing and cross-company reads

- Affected roles/boundary: anonymous insert; all staff read; every company.
- Workflow: direct REST insert into `audit_logs`, or staff SELECT against logs belonging to another portfolio.
- Evidence: production policy `System insert audit logs` applies to PUBLIC with `WITH CHECK (true)`; `Staff read audit logs` permits any `is_staff()` user without a tenant predicate. The table lacks `portfolio_id`, while the company-admin page filters on that nonexistent column.
- Reproduction: query `pg_policies` and `information_schema.role_table_grants` for `audit_logs`.
- Impact: attackers can fabricate audit evidence; staff can read another company's activity; company administrators may see an empty/broken audit screen.
- Fix: add/backfill `portfolio_id`, derive it on service inserts, restrict tenant reads to the current portfolio, keep platform reads, and revoke client mutations.
- Fix status: fixed in branch migration `20260728094000_audit_log_and_owner_payable_scope.sql`.
- Test status: static regression test added; staging policy tests pending.

## SEC-003 â€” High â€” Owner-payable tenant relocation

- Affected roles/boundary: authenticated staff; company, association, owner, GL, and bank-account boundaries.
- Workflow: update a permitted payable while changing its tenant keys.
- Evidence: production `owner_payables_update` checks the old row in `USING` but has `WITH CHECK (true)`.
- Impact: cross-company payable movement and incorrect financial attribution.
- Fix: immutable portfolio key, association/owner/GL/bank validation trigger, and scoped `WITH CHECK`.
- Fix status: fixed in branch migration `20260728094000_audit_log_and_owner_payable_scope.sql`.
- Test status: static regression test added; staging forged-ID tests pending.

## SEC-004 â€” High â€” Disabled profiles retained usable authorization

- Affected roles/boundary: disabled staff, board, owner, tenant, or vendor identities.
- Workflow: reuse an existing session after a profile is disabled.
- Evidence: production `me()` and role helpers did not consider `profiles.disabled_at`; the operator UI previously changed only the profile row and did not ban the Auth identity.
- Impact: a disabled user could retain access until normal session expiry.
- Fix: Auth admin ban/unban, application sign-out guard, and database role helpers that fail closed for disabled identities.
- Fix status: fixed in app code and migration `20260728092000_disabled_identity_enforcement.sql`.
- Test status: unit/static tests pass in CI; live stale-session test pending staging users.

## SEC-005 â€” High â€” Queued report association IDOR

- Affected roles/boundary: staff; association boundary inside a company and potentially arbitrary queued parameters.
- Workflow: call `bulk_queue_reports` with association IDs not owned by the caller's portfolio.
- Evidence: production function did not validate every requested association and stored caller-controlled JSON parameters.
- Impact: unauthorized report jobs and cross-association disclosure through generated output.
- Fix: require staff authentication, validate every association and report definition, normalize parameters, and run data helpers only as service role.
- Fix status: fixed in branch migration `20260728090000_secure_report_queue_scope.sql`.
- Test status: static test coverage; end-to-end worker/export proof pending staging.

## SEC-006 â€” High â€” Migration history cannot reproduce production safely

- Affected boundary: entire platform and all data.
- Workflow: deploy or repair migrations from the current repository.
- Evidence: 41 invalid filenames, three duplicate-version groups, remote versions absent locally, and an empty staging project.
- Impact: skipped controls, out-of-order destructive SQL, schema drift, or failed recovery.
- Fix: recover exact applied history, preserve checksums/order, produce a reviewed forward-only baseline, and replay from empty staging.
- Fix status: open; no blind repair or production mutation performed.
- Test status: audit mode passes; strict migration validation fails as intended.

## SEC-007 â€” Medium â€” Broad permissive production policies remain until hardening is deployed

- Affected roles/boundary: anonymous/authenticated access to selected operational tables.
- Workflow: direct REST reads/inserts allowed by policies such as the current public `house_rules` read.
- Evidence: eight production policies contain unconditional `true`; some are intentional catalogs/intake, while `house_rules` and audit-log access require narrower handling.
- Impact: metadata enumeration and increased attack surface.
- Fix: the tenant-hardening migration rebuilds house-rule and other audited policies; public violation intake already uses a server-side service client and does not require anonymous table reads.
- Fix status: fixed in branch, not deployed.
- Test status: policy inventory complete; role regression pending staging.


## SEC-008 — Critical — Property manager could enter Company Admin

- Affected roles/boundary: full-access property managers; company-administration boundary.
- Workflow: an authenticated manager navigates directly to `/company-admin/overview`.
- Evidence: authenticated role testing rendered the Company Admin Executive Dashboard for `manager@portier369.com`; production profile inspection confirmed `hoa_role = 'manager'`. Application `requirePortfolioAdmin()` and database `can_admin_portfolio()` both treated full-access staff as company administrators.
- Impact: a property manager could reach company-level administration functions reserved for the explicit Company Admin role.
- Fix: require `hoa_role = 'company_admin'` (or platform operator), reject disabled identities, and remove the legacy President/full-access shortcuts at both application and database layers.
- Fix status: fixed in `lib/auth/me.ts` and migration `20260728095000_company_admin_role_boundary.sql`.
- Test status: unit and migration regression tests added; staging negative-role replay remains required.
