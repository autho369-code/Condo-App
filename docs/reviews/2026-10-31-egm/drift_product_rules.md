# 2026-10-31 DRIFT REPORT

## docs/brain/Product Rules.md

- **[Major] Bill board routing is fixed when the draft is created and never re-read at submit.**
  Rule: "board routing is decided at submit from the association's current settings".
  Evidence: `supabase/migrations/20260730000000_secure_payable_bill_approval_workflow.sql:207-230` computes `requires_board` from `board_approval_settings` (sends_bills_to_board / bills_threshold) at INSERT and stores it in `payable_bills.approval_required`. The submit RPC `request_payable_bill_approval`, latest in `supabase/migrations/20261016220000_po_decisions.sql:140-185`, branches on the stored `bill_row.approval_required` and never re-reads `sends_bills_to_board` / `bills_threshold`. Only voters and the voting scheme are re-read. POs do re-read their settings (`20261015233000_purchase_orders_resubmit.sql:30-35`); bills do not.
  Why: if the board tightens its bill threshold after a draft is saved, that draft is approved without the board. That is the stale-draft case the rule forbids.

- **[Major] Any finance-staff manager can create and change the chart of accounts, and accounts can belong to one association.**
  Rule: "Chart of accounts: one per company, entered and changed by the company admin".
  Evidence:
  - `app/(app)/gl-accounts/new/page.tsx:8,20,32` (`requireFinanceStaff`) inserts with a form-supplied `association_id` (lines 43, 54-66).
  - `app/(app)/gl-accounts/[id]/page.tsx:56` updates the account.
  - `app/(app)/owners/import/previous-system/gl-actions.ts:18,36` (`requireFinanceStaff`) bulk-inserts accounts.
  - The DB policy `gl_accounts_finance_all` (`20260715040000_production_schema_baseline.sql:22077`, `can_manage_finance`) is the only write gate.
  - `is_finance_staff` admits managers whose role is President, Property Manager or Accountant, or who have no role (baseline :5396-5408).
  Why: the code allows managers, not only company admins, to write the chart. Accounts tied to one association also mean the chart is not one per company.

- **[Major] The owner ledger reads all rows with no cap and adds up the balance in the app from a list the API stops at 1,000 rows.**
  Rule: "Count and sum in the database ... never over a capped list".
  Evidence: `app/portal/ledger/page.tsx:23-27` (`v_charge_balances` with no `.limit` and no `fetchAllRows`) and `:48-54` (payments with no limit). `:97-98` sums `balance_due` over the returned list to get `totalBalance`.
  Why: an owner with many units or many years of charges gets a wrong balance and missing rows. The API returns no error when it stops at 1,000 rows.

- **[Major] Vendors read `calendar_events` directly, including its staff-only columns.**
  Rule: "a policy can't hide columns, so when a table holds staff-only fields ...".
  Evidence: `calendar_events_vendor_read` (`baseline.sql:21818`, `vendor_id = current_vendor_id()`) was never switched off. The resident and board read policies were set to `using (false)` (`20261014190000_owner_portal_fixes.sql:218-219`, `20261005111000_board_read_only_scope.sql:45`). Per `supabase/schema-columns.json`, the table still holds `notification_recipients`, `attendees`, `maintenance_instructions`, `owner_id`, `resident_id`, `sms_notify_error` and `reminder_rules`. `internal_notes` itself is moved out by a trigger.
  Why: the "safe RPC" approach was applied to owners and tenants only. A vendor can still read recipient lists and resident ids through the API on any event that names them. The rule's reasoning (a policy can't hide columns) applies to vendors just as much.

- **[Nit] An RLS helper written after the rule is still `LANGUAGE sql`.**
  Rule: "A new or replaced helper must be `language plpgsql`".
  Evidence: `rls_private.resident_visible_payment_ids()` is `language sql ... security definer` (`20261014190000_owner_portal_fixes.sql:55-66`). It is used by the payments resident policy (:115) and was not redefined later. Its siblings `resident_unit_tenure` and `resident_visible_work_order_ids` were converted in `20261015170000`; this one was missed.

- **[Nit] Policies written after 2026-10-13 still use inline subqueries over tables that have RLS.**
  Rule: "No inline subqueries over RLS tables inside policies".
  Evidence:
  - `20261016220000_po_decisions.sql:540-549`: `po_line_items_staff_all` runs `EXISTS (SELECT … FROM public.purchase_orders …)`.
  - `20261015090000_arc_documents_fixes.sql:433`: `mgr_assoc_scope` on `document_requests` runs `exists (select … from public.vendors …)`.
  - `20261014190000_owner_portal_fixes.sql:296-299`: `arch_msg_resident_insert` runs `exists (… architectural_requests …)`.
  - `20261014090000_work_order_fixes.sql:82`: `wo_updates_vendor_insert` runs `work_order_id in (select wo.id from public.work_orders wo …)`.
  Why: each of these makes Postgres expand the inner table's policies inside the outer plan, which is what the rule was written to stop. The first two run on read paths.

- **[Nit] Staff can insert an approval request that already looks decided, as long as it is not "approved".**
  Rule: "Signed-in users can't change an approval request's status, votes ... database functions decide it."
  Evidence: `approval_requests_insert_guard` (`20261004171000_review_followups.sql:6-19`) lets any `can_access_portfolio` row through with any status, votes, `decision_by` or `decision_at`. `approval_requests_approve_guard` (`20261014150000_payables_fixes.sql:27-48`) blocks only `status = 'approved'`. `approval_requests_decision_guard` (`20261015234500_approval_request_decided_context.sql`) fires only on UPDATE and DELETE.
  Why: a direct API insert can create a "rejected" request with made-up vote counts and decision fields. Database functions are supposed to be the only path to a decided request.

- **[Nit] The AutoPay claim uses the UTC date, not the association's date.**
  Rule: "a database rule about 'today' ... uses association_local_date(association), never current_date".
  Evidence: `claim_stripe_autopay_run` checks `p_scheduled_for > current_date` (`20261016130000_admin_operator_fixes.sql:313`). The route checks the association's local day (`app/api/payments/autopay-run/route.ts:144-150`), and the function is callable by `service_role` only (`20260726020000_stripe_autopay_isolation.sql:249-250`).
  Why: in the database a run dated tomorrow-local is accepted during a US evening. Only the API check stops it, which goes against "Rules the API enforces belong in the database too".

- **[Nit] The cleanup when an owner's occupancy ends does not cover every writer.**
  Rule: "a trigger, so every writer is covered".
  Evidence: `trg_occupancies_end_owner_unit_items` runs only `after update of status` (`20261016010000_ownership_fixes.sql:281-283`), and only for the change from current to past (:227-229).
  Why: deleting a current owner occupancy, or inserting one that is already past (for example from an import), leaves that owner's parking, linked parking charge and pets active.
  Unverified: I did not check whether signed-in users or imports can delete occupancies or insert past ones.

- **[Nit] The doc names the wrong sample association.**
  Rule: "don't migrate or backfill the sample (Granville) data".
  Evidence: the sample hold now points at association `62344573-…` (Randolph Station) in `20261027010000_hold_resident_email_one_association.sql:25,44`.
  Why: the doc is out of date. A reader would protect the wrong association.

- **[Nit] The migration folder has a file that is not named by a timestamp.**
  Rule: "Migration versions must be real UTC times".
  Evidence: `supabase/migrations/0001_all.sql` is a 3-line placeholder (`select 1;`). Every other file has a valid 14-digit version.

- **[Nit] Imported records written before the rename may still say "AppFolio".**
  Rule: "text an import stores (charge descriptions, notes) — says 'AppFolio'".
  Evidence: the code still matches the old prefixes `'AppFolio:'` (`app/(app)/owners/import/previous-system/receivables-actions.ts:51,176`) and `'AppFolio WO #'` (`work-order-actions.ts:45-46,177`). That means rows carrying those prefixes are expected to exist.
  Unverified: I found no migration that rewrites those stored memos and descriptions, so owners and managers may still see "AppFolio" in charge memos and work-order descriptions.
