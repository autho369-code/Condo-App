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

- E2E harness (e2e/, playwright.config.ts, 2026-10-25): @next/env never overrides a process-env key that is defined, even as '' (verified in node_modules), so blanking keys in webServer.env works. Check `reuseExistingServer` (a stray :3100 server on .env.local = prod) and that the blank list covers every key in .env.local the app reads.

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
- [Deep checks 2026-10](deep-checks-2026-10.md) -- ledger/payment marker guards, row freezes, INVOKER helper EXECUTE, side-row upserts, approval guards, portfolios columns, platform_mail, reports claim switch, purchase orders
- [DEFINER triggers and concurrency](definer-triggers-concurrency.md) -- operator_may_write, service-role exemptions, revoke writes, INVOKER->DEFINER triggers, cross-RPC locks, reopen flows, parent joins, vendor nested writers, column guards

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
- Bank feed receive-as-payment (20261017010000): DEFINER RPC pins unit to app_bank_account_association_ids(bank) + can_view_association_row; payments.notes moves to payment_private by trigger, so sender/memo there is safe. Payee settings that redirect owner money (associations.zelle_recipient) have no audit trail: ask for one.
- "CREATE OR REPLACE of the live body" migrations: grep the repo for each block of the new body; blocks found in no earlier migration (validate_payment_accounts charge_id/credit checks, 20261017020000) mean prod drift or invented logic. Ask for pg_get_functiondef proof.
- Platform health (20261024010000 platform_health_summary): DEFINER, operator or `auth.role()='service_role'` (coalesce to '' = fails closed). cron.job_run_details.return_message can echo row data (constraint DETAIL): fine on the operator page, must never reach emails; alert mail uses counts + job names only.
- Dev-only CSP widening (csp.ts localSupabaseOrigin, 2026-10-25): safe because middleware passes dev = NODE_ENV==='development' (false in next build/start and on Vercel) and the host is exact-matched to 127.0.0.1/localhost over http. Recheck if a new caller passes dev from other input.
- Smoke workflow (.github/workflows/smoke.yml): deployment_status + contents: read + no secrets + GET-only script = not a fork/pwn-request risk. Flag only if it gains secrets or write permissions.
- Since 20261031153000 vendors read calendar_events only via DEFINER `vendor_calendar_events(p_until)` (vendor_read USING false; current_vendor_ids is pinned to the profile's company). New vendor calendar reads must use it.
- `record_approval_decision` (20261014150000) does the real gate: money requests (behind bill/PO) need can_manage_finance + can_view_association_row, others can_edit_association_mvp + operator_may_write. App-side bill/PO lookups before it are UX routing, not auth.
- New operator-only tables: write policies on `is_platform_operator()` let support/readonly operators write via REST, skipping the action's requirePlatformAdmin and its audit (platform_remittance payee account, 20261027020000). Need `is_platform_admin()` / `operator_may_write()` or revoke writes (service-client only); the operator_write_guard trigger exists only on pre-20261005 tables.
