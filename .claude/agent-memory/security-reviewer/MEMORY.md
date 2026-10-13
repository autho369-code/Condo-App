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

- DEFINER RPC writes gated by `can_edit_association_mvp` (or any helper with a bare `is_platform_operator()` branch) skip the restrictive operator_writes_need_admin policies: add `operator_may_write()` (calculate_meeting_quorum, 20261014100000).
- Two-request "record then complete" flows (RPC, then status update) are not atomic; prefer a BEFORE UPDATE trigger on the status change (publishMeetingMinutes, 2026-10-13).
- Service-role exemptions in DEFINER triggers: `current_user = 'service_role'` never matches (current_user is the owner); `coalesce(auth.role(),'service_role')` fails open if claims are ever absent. Prefer `auth.role()='service_role' or session_user <> 'authenticator'` (app_is_repair_session, 20261014130000).

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
