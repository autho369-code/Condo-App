---
name: deep-checks-2026-10
description: Lessons from the October 2026 deep-check PRs (ledger/payments guards, triggers, approvals, email, portfolios, purchase orders)
metadata:
  type: feedback
---

## Ledger, payments, private text
- Staff free text left on owner-readable rows after 20261004200000 (private side tables moved only `notes`-style columns): `payment_plans.cancel_reason` (fixed 20261015040000 via payment_plan_private). When checking "owners never see manager notes", list every staff-written text column on tables with an owner/board/vendor SELECT policy, not just `notes`.
- `journal_entries.source_type/source_id` were client-writable, so "find the posting for record X" lookups must pin `je.portfolio_id` to the record's company. Since 20261015060000 journal_* have no insert/update/delete for authenticated/anon; every writer is DEFINER. Flag any new INVOKER writer or app `.from('journal_*').insert/update`. Revoke stops NEW plants only: lookups without a portfolio pin (reverse_homeowner_payment, 20261003080000:51) still trust old rows.
- Marker-value guards (payments.reference 'Late fee removed', 20261015130000): `current_user in ('authenticated','anon')` exempts every DEFINER RPC; sweep DEFINER payment writers for caller-supplied reference. `update of reference` triggers miss method/reversed_at changes (I called it low; wrong).
- Missed on #383 (Codex caught 5): a status derived from rows is only as safe as EVERY input row: freeze all columns it reads, guard INSERT/UPDATE/DELETE on child rows and the parent's DELETE (cascade), sweep DEFINER RPCs that rewrite those rows (reallocate_payment), and unapplied-amount paths.
- Row-freeze triggers (`to_jsonb(new) - 'notes' ...`, 20261015210000): every exempt column needs a reason. FK cascades run as owner and skip `current_user` guards.

## Triggers and guards
- INVOKER functions run helpers as the caller: `app_is_repair_session()` is revoked from authenticated (20261014130000), so an INVOKER guard calling it errors on every API write. Check EXECUTE on every helper an INVOKER function calls.
- "Decided records are final" guards (ARC 20261015090000): also check DELETE, service-role paths passing app_is_repair_session, and client-set attribution columns.
- DEFINER BEFORE INSERT triggers that upsert a private side row keyed on new.id: a REST upsert with ignore-duplicates overwrites another company's side row. Write side rows in an AFTER trigger.
- Depth>1 carve-outs in non-staff guards (service_request_guard_update, 20261015170000): safe only while every nested writer sets server-chosen values; recheck when a new trigger writes the table.
- Policy -> rls_private id-set rewrites: compare against the policy text AFTER the 20261009050000 `current_owner_ids()` sweep.
- approval_requests: approval_requests_decision_guard (BEFORE UPDATE OR DELETE, 20261015230000) freezes decided requests; approval_votes_no_signed_in_insert stops signed-in votes. Authenticated DEFINER writers: record_approval_decision, request_payable_bill_approval, submit/cancel_purchase_order. Lesson: UPDATE-only guards leave DELETE open.

## Company settings, owners
- "Only company-wide staff change X" checks are bypassable when X lives on `portfolios` (portfolios_admin_update, now my_admin_portfolio() since 20261016130000). Platform columns are guarded by portfolios_guard_platform_columns, guard_domain_verification, secure_ai_credentials. When portfolios gains a column, check it is guarded.
- Legacy baseline `"Owners read own ..."` policies match `owners.email = auth.email()` with no company pin. management_agreements closed in 20261016200000; check owner_form_submissions/owner_packets when touched.
- `document_requests` mgr_assoc_scope covers vendor rows only (20261009020000).
- Work-order status emails for a WO linked to a service request go to the request's submitter (accepted design, 20261015170000).
- PostgREST `.or()` with user search: safe when the term goes through `sanitizeSearchTerm` (lib/search/global.ts). Flag raw `q` in `.or()`.

## Email, reports, jobs
- Platform mail = `email_queue.platform_mail` (20261016180000), never from_name; only service-client senders set it. Flag inserters that copy rows or take the flag from input.
- Webhook deliverer (lib/webhooks/deliver.ts) pins IP, verifies TLS, no redirects: rebinding/redirect SSRF is not a finding.
- Reports claim switch (report_run_access_error / report_access_error_as, 20261016100000): safe while no helper reads request.headers or a cached GUC.
- Swapping signed URLs for an authed route revokes nothing already issued; ask for cleanup or an accepted window.
- Suspension pauses: null-portfolio rows get past; claim_automation_flow_run isn't paused.

## Purchase orders (20261016220000)
- purchase_orders / purchase_order_line_items / payable_bills: insert/update/delete revoked from authenticated (DEFINER RPCs only, after can_manage_finance), so BEFORE-trigger oracles (PO number uniqueness) aren't reachable cross-company. payable_bills_po_guard caps linked live bills at po_total. purchase_order_private's policy is EXISTS on purchase_orders, so it follows the parent's RLS (finance-only now).
- Post-RPC service-client notifiers (notifyVendorOfPurchaseOrderApproval): safe when every call site passes an id its own RPC/RLS read just accepted and the helper re-pins portfolio_id. Check each call site.
