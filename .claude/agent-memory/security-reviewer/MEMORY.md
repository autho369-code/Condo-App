# security-reviewer memory

## Confirmed rules (Mirsad)
- The board portal is read-only. Owners and vendors change only what their portal explicitly offers, on their own records (vendor work-order status, owner profile/payments/reservations/insurance). Nobody outside staff sees manager notes.

## False alarms to skip
- Webhooks and cron routes have no signed-in user: a verified signature or `requireCronSecret` is their auth. (Codex on PR #229.)
- A layout that swaps `children` for a notice (company-admin NoCompanyNotice) hides output only; page.tsx still runs its queries but nothing is serialized. Not a leak; just confirm each page/action still guards itself.
- Owner tenure helpers (`app/portal/_lib/tenure.ts`) fail closed: on a read error the cutoff map is empty, so `withinTenure` is false and `tenureFilter` is null (nothing shown). An "error" field added to them is not a fail-open leak; still check new callers don't bypass them (e.g. ledger balance sums all unit charges, only paid ones are hidden; owner-portal fixes 2026-10-14).

## Recurring mistakes
- `communications_log` RLS only checks `portfolio_id`: writes into another association pass RLS unless `managesAssociation` is checked (see `lib/rpcs/notifications.ts`).
- Service-client undo/cleanup must be pinned to the exact row id plus `portfolio_id`.
- "Shared row" read branches keyed on a staff-writable flag (`is_system` in `mt_read`, `report_defs_authenticated_read`) let one company publish rows to every signed-in user; the write policy must forbid the flag for non-operators (2026-10-12). Fixed in 20261012010000 on the read side: mt_read needs is_system and group_id is null; report_defs read drops is_system (shared = no company); writes still allow the flag, harmlessly.
- Restrictive mgr_assoc_scope treats a NULL association as visible (units: coalesce(..., true) when the building is hidden by buildings RLS). Safe only because the permissive policy (units_staff_all EXISTS buildings) also needs a visible parent; recheck if a permissive policy stops joining through the parent (20261012020000).

- The baseline migration is NOT proof a policy exists in prod (budget_lines mgr_assoc_scope, wrong on #329). Unit/portfolio-keyed tables (charges, payments, unit_owners...) escape mgr_assoc_scope; see missed-checks.md.
- rls_private set helpers (20261011050000+): API can't call them only while no migration grants USAGE on schema rls_private; EXECUTE to authenticated is required for policies and fine. Per-row -> set rewrites keep manager scoping via the separate restrictive mgr_assoc_scope; confirm it still exists on the table.

- Manager scope: `can_access_association` also requires can_view_association_row since 20261013010000 (its RLS twin does not); `can_manage_association`/`can_view_association_row` honour association_managers. DEFINER RPCs gated only by portfolio helpers (`can_manage_signatures` in rotate_signature_signer_token / void_signature_request) skip scoping even when the table has mgr_assoc_scope (audit 2026-10-12).
- Multi-association rows (journal_entries spanning associations): a restrictive guard added for DELETE alone leaves UPDATE open (draft can be posted/re-dated via REST; guard_posted only blocks old.posted). Check both (20261012130000).
- Global `me.is_staff` + RLS read is not a staff proof: one login can be staff at A and owner at B (`lib/rpcs/violations.ts:166` verifyViolationAttachmentAccess -> svc update). Use can_manage_association like maintenance-attachments `staffCanManage`.

- Changing a can_* helper body (e.g. can_access_association gains can_view_association_row, 20261013010000) does NOT change its policy twin (rls_private.my_accessible_association_ids / my_accessible_unit_ids have their own SQL). Check the twin in the same migration.
- Sweep script for DEFINER RPCs with only company checks: parse latest create-or-replace per function, flag bodies with can_access_portfolio/can_manage_finance/current_portfolio_id but no association-scope helper; then grep later DO-block patches (20261007090000 finance_rpcs_association_scope, 20261013010000). Company-wide tables (accounting_periods, gl_account_map, inspection_templates) are out of scope by design.

- Moving a JS status filter into PostgREST (`.in`/`not.in`) on an enum column: every literal must be an enum value or the whole query errors 22P02 (vendor work-orders OPEN_STATUSES had 'open', not in work_order_status, 2026-10-13). Check the enum in the baseline + `add value` migrations.

- DEFINER RPC writes gated by `can_edit_association_mvp` (or any helper with a bare `is_platform_operator()` branch) skip the restrictive operator_writes_need_admin policies: add `operator_may_write()` (calculate_meeting_quorum, 20261014100000). But first check the written tables: the statement-level `operator_write_guard` trigger (20261005072000, every RLS table existing then, e.g. payments/audit_logs) blocks non-admin operators even inside DEFINER RPCs; tables created later have it only if a migration added it.
- Two-request "record then complete" flows (RPC, then status update) are not atomic; prefer a BEFORE UPDATE trigger on the status change (publishMeetingMinutes, 2026-10-13).
- Service-role exemptions in DEFINER triggers: `current_user = 'service_role'` never matches (current_user is the owner); `coalesce(auth.role(),'service_role')` fails open if claims are ever absent. Prefer `auth.role()='service_role' or session_user <> 'authenticator'` (app_is_repair_session, 20261014130000).

- `revoke insert/update/delete ... from authenticated` (recurring_bills, 20261014160000): confirm no app `.insert/.update` on the table and every writer function is DEFINER (grep migrations for `update public.<t>`); FK actions run as owner. DO-block "already applied" guards keyed on a generic substring (`count(*) filter`) can silently skip; check the old body lacks it.

- Turning a trigger INVOKER -> DEFINER (app_guard_bank_reconciliation, update_bank_account_reconciliation_date, 20261014170000): BEFORE triggers run before RLS WITH CHECK, and child rows carry a client-set portfolio_id. Check the trigger pins portfolio_id to the parent's (bank account) and that its cross-table reads/writes are scoped; otherwise company A can point at B's bank_account_id.
- Definer aggregates vs scoped managers: a NULL-association parent (company-wide bank account) is visible to scoped managers, so a definer sum over its lines leaks other associations' totals and mismatches the RLS-limited client sum.

- Flipping an rls_private id-set helper INVOKER -> DEFINER widens every policy that uses it: it stops inheriting the inner table's RLS (resident_payment_ids, 20261014190000: buyer reads the applications on their unit's charges; kept on purpose for correct balances, notes column unused, applied_by a staff id; payments.notes is private via payment_private). List the columns of each table whose policy uses the helper.
- Owner-facing "force fields for non-staff" triggers (service_request_intake, arch_msg_set_author) skip on global is_any_staff(): staff at A who own at B escape them at B. Skip only when the caller can_access_association(row's association) (fixed in both before the PR). Same for any new guard keyed on `is_self_service_caller()` (global staff test): amenity insert guard, inspection_items vendor guard, insurance notes move (20261015080000).

- Cross-RPC invariants (undo_bank_reconciliation vs set_accounting_period_status close, 20261015020000): A locks bank_accounts and checks periods, but B reads bank_accounts with no lock, so both pass. Both sides must lock one shared row (e.g. undo takes `for share` on the company's accounting_periods, which close holds `for update`). Also year-end finalize vs month reopen. (Fixed in 20261015020000: undo and finalize take accounting_periods FOR SHARE.)
- Codex P1 on #372 (missed here): a new "reopen/undo" state must keep every input needed to finish it editable, and every exit path open. Reopened reconciliations had a read-only statement balance and discard refused them, so they could never complete. Walk reopen -> edit -> complete/discard in the UI. (Fixed: updateStatementBalance in bank-accounts/reconcile/actions.ts.)
- DEFINER RPCs that `select ... for update` the parent (bank account) BEFORE the access helper: the house rule (guard comment) is check access first, then lock. (Fixed in undo_bank_reconciliation.)

- "Same rows" speed rewrites that drive from a parent (associations join instead of a definer lookup like association_local_date, which falls back on NULL): inner join drops child rows whose FK is nullable (payable_bills.association_id; company-level bills allowed, vendor_1099_totals 20261015030000). Check nullability; use left join. Also check the parent's RLS matches the child's for every role (vendors: associations_vendor_bill_read).

- Email-match -> linked-login backfills (board seats, 20261015110000): safe when the linked branch re-checks the same runtime conditions (role, company, disabled) so linking grants nothing new; INVOKER search RPCs (inspection_search) inherit RLS on every subquery, so staff-only side tables stay hidden.
- Security patches that "skip with a notice while data depends on it" (board email-seat branch, 20261015100000): check the skip count uses the exact predicate of the branch being removed (active, board profile, same portfolio); a broader count silently leaves the hole open in prod. Prefer relinking first, then removing.
- Vendor nested writers (depth>1 under a vendor caller) as of 20261015100000: only invitation accept (auth_user_id=used_by, portal_activated) and vfd flag sync (finance-staff-only table). RPC writes run at depth 1 and get the contact-only guard. A login with any staff role is never self-service (global is_any_staff).

- `receivable_payments_ledger.owner_id` is ONE owner per payment (primary unit_owners row on the date, else occupancy): `.eq('owner_id', x)` hides co-owners' payments. Completeness bug, not a leak (owners/[id] page, 20261016010000).
- Occupancy-end DEFINER trigger (end_owner_unit_items_when_occupancy_ends) is safe because occupancies_owner_same_association pins owner/unit/association and occupancies_self_update is `false`. Recheck if owners can update occupancies again.

- associations column guards keyed on `current_user` (stripe/allocation, 20261016164100): the only authenticated DEFINER writer is update_association_settings, whose allowlist excludes stripe/bank/allocation columns; Stripe writes go through the service client. Recheck if the allowlist grows.
- Since 20261016164100 residents read parking only via DEFINER `portal_parking_assignments()` (resident_read policies USING false); new portal parking reads must use it, not the tables.

## Topic files
- [Helpers and schema notes](helpers.md) -- tenant headers, portfolios guards, branding writers, bind args, owners/units RLS, AppFolio import
- [Missed checks](missed-checks.md) -- domain-proof replay/relay, token minting, html_escape, storage cleanup, finance RPC scope triggers, hidden columns copied by DEFINER triggers (soft_delete_log), owner_visible_history writers
- [Tenant scoping, concurrency, Next.js](tenant-concurrency-nextjs.md) -- public pages scope by tenant, CAS guards, inline action captures
- [Owner/vendor logins](owner-vendor-logins.md) -- one association per owner/vendor, multi-record logins, invite linking
- [Finance imports and audits](finance-imports-audits.md) -- INVOKER vs service-only GL helpers, rerun date windows, operator_write_guard
- [Enforced nonce CSP](csp.md) -- blob print docs, prerendered pages, matcher-skipped paths
- [RLS once-per-query rewrite](rls-hoist.md) -- my_* helpers replace can_* in policy text (2026-10-11)
- [Messaging, email, SMS, flags](messaging-email-sms.md) -- email_queue/invite secrets, rate limits, SMS routing proofs, unsubscribe, set_config flags, race guards
- [Finance guards](finance-guards.md) -- staff text on owner rows (cancel_reason), journal source pins, marker/row-freeze triggers, derived-status inputs (Codex #383), approval_requests guard

## Policy roles (2026-10-12, 20261012010000)
- Public pages/API routes all use the service client; only `tenant_branding` (DEFINER) is granted to anon; auth.users triggers + password hook are DEFINER. So moving {public}-role policies to authenticated breaks no signed-out path.




- INVOKER triggers/functions run helpers as the caller: `app_is_repair_session()` is revoked from authenticated (20261014130000), so an INVOKER guard calling it errors on every API write (architectural_requests_final_guard, 20261015090000). For any function made/created INVOKER, check EXECUTE on every helper it calls.
- "Decided records are final" guards (ARC 20261015090000): also check DELETE (staff FOR ALL policy + cascade wipes the thread), service-role paths that pass app_is_repair_session (arc_remove_attachment p_require_open=false for staff), and client-set attribution columns (decided_by/decided_at, messages.created_at).
- DEFINER BEFORE INSERT triggers that upsert a private side row keyed on new.id (move_owner_form_submission_notes): a REST upsert with ignore-duplicates passes WITH CHECK on the proposed row, the trigger overwrites the existing (other company's) side row, then the parent insert is skipped. Write side rows in an AFTER trigger.
- "Only company-wide staff change X" checks in RPCs (set_management_fee_schedule, run_management_fees defaults, 20261016200000) are bypassable when X lives on `portfolios`: policy `portfolios_admin_update` lets any is_full_access_staff (scoped managers too) PATCH every column not in portfolios_guard_platform_columns. Check where the setting is stored.
- Legacy baseline `"Owners read own ..."` policies match `owners.email = auth.email()` with no company pin (cross-company + staff notes). management_agreements closed in 20261016200000; owner_form_submissions/owner_packets used the same pattern, so check theirs when touched.
- `document_requests` mgr_assoc_scope covers vendor rows only (20261009020000); owner-linked rows are company-wide for scoped managers.

- PostgREST `.or()` with user search: safe when the term goes through `sanitizeSearchTerm` (lib/search/global.ts strips `,()*%_\"'`) before interpolation (service-requests page, 2026-10-14). Flag raw `q` in `.or()`.
- Depth>1 carve-outs in non-staff guards (service_request_guard_update keeps has_open_work_order/resolved_at, 20261015170000): safe only while every nested writer sets server-chosen values. List the triggers that write the table (here only work_order_sync_request_triage + refresh_service_request_open_work_order: now()/null) and recheck when a new trigger writes it.
- Policy -> rls_private id-set rewrites (service_requests_resident_read, payment_plans_owner_read): compare against the policy text AFTER the 20261009050000 `= current_owner_id()` -> `in current_owner_ids()` sweep, not the original migration; the helper's join on resident_unit_tenure() replaces the old `unit_id in current_resident_unit_ids()` clause.


- Platform mail = `email_queue.platform_mail` (20261016180000), never from_name: forced false on signed-in insert / kept on update by invoker guard email_queue_guard_worker_columns; only service-client senders set it (operator companies actions, announcements, no-company password reset). New DB inserters use explicit column lists; flag any that copy rows (`select *`) or take the flag from input.
- Webhook deliverer (lib/webhooks/deliver.ts) pins the resolved IP, verifies TLS against the hostname and follows no redirects: DNS rebinding/redirect SSRF is not a finding; only isPublicWebhookIp coverage matters.
- Reports claim switch (report_run_access_error, report_access_error_as, 20261016100000): local set_config of request.jwt.claims/claim.sub, then restore. Safe because no helper reads request.headers or a cached GUC (grep both when a new helper lands). An authenticated-executable wrapper (report_recipients_error) is an access oracle on other staff of the caller's company: low.
- Swapping stored/emailed Supabase signed URLs for an authed download route revokes nothing already issued (token valid until expiry for that path): old output_url values and sent emails keep working. Ask for cleanup of recent objects or an accepted window.
- portfolios is company-admin-writable via REST since 20261016130000 (portfolios_admin_update -> my_admin_portfolio()). Platform columns are guarded by portfolios_guard_platform_columns, guard_domain_verification (custom_domain_verified_at) and secure_ai_credentials (ai_endpoint). When portfolios gains a column, check it is guarded or really the admin's.
- Suspension pauses (claim_* skip suspended portfolios): rows with a null portfolio_id get past the pause; claim_automation_flow_run is not paused.
- Widening staff-only RLS to company admins: `my_access_portfolio()` = (is_any_staff OR is_company_admin) -> current_portfolio_id() (null for operators and suspended companies), so swapping `is_any_staff() and portfolio_id = current_portfolio_id()` for it adds same-company admins only (inventory, 20261016230000). `can_manage_association` already admits company admins.
