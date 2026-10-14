# security-reviewer memory

## Confirmed rules (Mirsad)
- The board portal is read-only. Owners and vendors change only what their portal explicitly offers, on their own records (vendor work-order status, owner profile/payments/reservations/insurance). Nobody outside staff sees manager notes.

## False alarms to skip
- Webhooks and cron routes have no signed-in user: a verified signature or `requireCronSecret` is their auth. (Codex on PR #229.)
- A layout that swaps `children` for a notice (company-admin NoCompanyNotice) hides output only; page.tsx still runs its queries but nothing is serialized. Not a leak; just confirm each page/action still guards itself.

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
- Owner-facing "force fields for non-staff" triggers (service_request_intake, arch_msg_set_author) skip on global is_any_staff(): staff at A who own at B escape them at B. Skip only when the caller can_access_association(row's association) (fixed in both before the PR).

- Cross-RPC invariants (undo_bank_reconciliation vs set_accounting_period_status close, 20261015020000): A locks bank_accounts and checks periods, but B reads bank_accounts with no lock, so both pass. Both sides must lock one shared row (e.g. undo takes `for share` on the company's accounting_periods, which close holds `for update`). Also year-end finalize vs month reopen. (Fixed in 20261015020000: undo and finalize take accounting_periods FOR SHARE.)
- Codex P1 on #372 (missed here): a new "reopen/undo" state must keep every input needed to finish it editable, and every exit path open. Reopened reconciliations had a read-only statement balance and discard refused them, so they could never complete. Walk reopen -> edit -> complete/discard in the UI. (Fixed: updateStatementBalance in bank-accounts/reconcile/actions.ts.)
- DEFINER RPCs that `select ... for update` the parent (bank account) BEFORE the access helper: the house rule (guard comment) is check access first, then lock. (Fixed in undo_bank_reconciliation.)

- "Same rows" speed rewrites that drive from a parent (associations join instead of a definer lookup like association_local_date, which falls back on NULL): inner join drops child rows whose FK is nullable (payable_bills.association_id; company-level bills allowed, vendor_1099_totals 20261015030000). Check nullability; use left join. Also check the parent's RLS matches the child's for every role (vendors: associations_vendor_bill_read).

## Topic files
- [Helpers and schema notes](helpers.md) -- tenant headers, portfolios guards, branding writers, bind args, owners/units RLS, AppFolio import
- [Missed checks](missed-checks.md) -- domain-proof replay/relay, token minting, html_escape, storage cleanup, finance RPC scope triggers, hidden columns copied by DEFINER triggers (soft_delete_log), owner_visible_history writers
- [Tenant scoping, concurrency, Next.js](tenant-concurrency-nextjs.md) -- public pages scope by tenant, CAS guards, inline action captures
- [Owner/vendor logins](owner-vendor-logins.md) -- one association per owner/vendor, multi-record logins, invite linking
- [Finance imports and audits](finance-imports-audits.md) -- INVOKER vs service-only GL helpers, rerun date windows, operator_write_guard
- [Enforced nonce CSP](csp.md) -- blob print docs, prerendered pages, matcher-skipped paths
- [RLS once-per-query rewrite](rls-hoist.md) -- my_* helpers replace can_* in policy text (2026-10-11)

## Policy roles (2026-10-12, 20261012010000)
- Public pages/API routes all use the service client; only `tenant_branding` (DEFINER) is granted to anon; auth.users triggers + password hook are DEFINER. So moving {public}-role policies to authenticated breaks no signed-out path.

## Transaction-local flag guards (2026-10-13, 20261014150000)
- `set_config('app.x','on',true)` bypass flags (app.approval_decision, app.loan_ledger, app.inventory_movement) can't be forged via API: pg_catalog isn't exposed, no public exec/set_config wrapper, no db-pre-request. The real risk is every OTHER function patched to set the flag: check its own auth and state checks (tally_approval_vote ignores status='pending'; operator-only approval_votes_platform_all can reach it).

- Webhook "undo on terminal status" fixes (AutoPay setup, 2026-10-13): check every `failAttempt`/status flip on a RETRY after a partial earlier delivery also undoes (else the undo waits on one more Stripe retry), and that an undo helper does not early-return on "nothing left to cancel" before finishing its later steps (method retire).

- `if exists(...) raise` duplicate/"later schedule" guards in DEFINER RPCs (apply_assessment_update, adopt_budget, 20261014210000) race under READ COMMITTED: two calls both pass. Ask for a parent-row lock (`select ... from associations where id = .. for update`) first; form tokens only stop the same form twice.

- "Creator can read" exceptions on secret rows (`sent_by = auth.uid()` on email_queue auth links, 20261014220000): staff-triggered resets queue the target's recovery link with sent_by = the requester (owners/[id]/occupancy-actions.ts owner+tenant reset, settings/page.tsx staff reset), so the requester reads it at /communication-center/emails/[id]. Grep every writer's sentBy before accepting such an exception. (Fixed in 20261014220000 §6a: no signed-in user reads them.)
- `user_invitations.token` is SELECTable by every company staff login (user_invitations_staff_read); /invite?token= lets the holder set the new account's password before the invitee verifies. Any "hide invite links" fix must also cover this table. (Fixed in 20261014220000 §6e: token column ungranted.)
- Statement-level AFTER triggers (rate limits with transition tables) fire once per INSERT inside a plpgsql loop (enqueue_communication_message): O(n^2) counts on big sends. (Fixed in 20261014220000 §3: one set-based insert.)
- Rate limits that count by a client-writable column (email_queue `sent_by is not null`, 20261014220000) are bypassed by inserting that column null/forged; the guard must force it (`new.sent_by := auth.uid()`). (Fixed in 20261014220000 §8c.)
- Definer helpers granted to authenticated so an INVOKER trigger can call them (email_queue_sender_problem, *_company_recent_count) are also public RPCs: check them as oracles for other companies' names/support emails/owner ids; gate on can_access_portfolio or drop the grant by making the trigger DEFINER. (Fixed in 20261014220000 §8a/b.)
- Column-level revoke on user_invitations.token (20261014220000): user-client reads must name columns (no select('*'), no insert(...).select() returning token); v_pending_invitations is invoker but omits token.

- Codex on #366 (missed here): a `claimSubmission` duplicate is a success only when `resultId` is set; a duplicate with no resultId is still running (or about to fail) and must not be reported as done.

- Codex on #367 (missed here): the email hourly limit counted the client-set created_at (back-dated rows never counted) and ran without a lock (parallel sends each saw room). A limit counts only server-set values and locks its scope before counting (fixed in 20261014230000).

- SMS reply/START routing (2026-10-13, sms-sender-routing): `sms_messages.from_number` and `sms_conversations.our_phone_number` are staff-writable via REST (sms_*_staff_all) and seeded from company-editable `portfolios.phone_number`; matching on them lets company A claim B's sender. Routing proof must be a service-only column; one platform Messaging Service + sticky sender means the To number rarely identifies a company. Watch `.limit(n)` on match queries (truncation hides the second company).
- A "server-only" proof column on a staff-writable row is only as good as the row's other match keys: freezing provider_from_number alone let staff re-point to_number/conversation_id on their own sent message (sms_provider_sender guard, 2026-10-13). Freeze every column the routing query matches on. Also: "full page = ambiguous" caps let one company force ambiguity by creating N rows; count distinct companies instead.
- Freeze-after-send guards keyed on provider_message_id leave the claim->send->complete window open (claim_sms_messages sets locked_at, Twilio call up to 12s, then complete sets the SID): staff can re-point to_number mid-flight. Freeze from claim (locked_at) on, or have complete verify the sent values.

- Public endpoints hit by mail providers (RFC 8058 one-click POST from Gmail/Outlook servers) must not use per-IP `consumePublicRateLimit`: provider IPs are shared, so real unsubscribes get 429 and are lost. Rate-limit by token or not at all (256-bit tokens); fail open for unsubscribe (api/unsubscribe/[token], 2026-10-13). (Fixed in the unsubscribe PR: per-token consumeScopedRateLimit, allowed when the limiter is down.)
- Suppression lists that stop "all mail" (bounce/complaint) also stop auth links that carry portfolio_id (forgot-password, invitations): a complaint only the recipient can clear locks them out of password reset. Check holds_auth_link exemptions. (Fixed: a complaint stops optional mail only; a bounce still stops all.)
- Per-recipient failure written onto a shared parent (communication_messages for a whole mass email) marks the entire send failed; complete_email_delivery only flips it to sent when every row is sent. (Fixed: email_prepare_batch never fails the parent and marks it sent when the rest are sent; complete_email_delivery ignores suppressed rows.)

- Staff free text left on owner-readable rows after 20261004200000 (private side tables moved only `notes`-style columns): `payment_plans.cancel_reason` (owner reads via payment_plans_owner_read). When checking "owners never see manager notes", list every staff-written text column on tables with an owner/board/vendor SELECT policy, not just `notes` (collections deep check 2026-10-13). Collections RPCs themselves were all scoped (can_manage_association / can_view_association_row patches 20260930132000, 20261004130000, 20261007090000, 20261007100000). (Fixed in 20261015040000: cancel_reason moved to payment_plan_private by a DEFINER BEFORE trigger; payment_plans has SELECT-only policies, so only DEFINER RPCs write it; private table FK is deferrable so the insert path works.)

- `journal_entries.source_type/source_id` are client-writable (no insert guard; staff policies + GRANT ALL), so "find the posting for record X" lookups (`source_type='charge' and source_id=c.id`, remove_late_fee 20261015050000) must also pin `je.portfolio_id` to the record's company; otherwise another company's planted entry steers/blocks it. Safe there only because post_homeowner_credit re-checks the account's portfolio+association.
