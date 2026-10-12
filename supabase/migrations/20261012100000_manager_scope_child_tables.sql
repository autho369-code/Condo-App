-- Manager scope on child tables (Codex P1s on #330).
--
-- 20261012090000 scoped tables with an association_id and the unit/bank
-- keyed ones. Codex found more that a manager assigned to some associations
-- could still read or change company-wide: owner-linked records (financial
-- details incl. taxpayer and bank fields, vehicles, packets, form
-- submissions, portal invites and logins, ACH status), unit_pets, and
-- parking_assignments with no unit. A catalogue sweep found 72 more tables
-- that reference an already-scoped parent and lacked the policy.
--
-- Each gets the restrictive mgr_assoc_scope policy through its parent: a
-- scoped manager passes only for rows whose parent row they can see (the
-- subquery runs under the caller's row-level security; parents carry
-- mgr_assoc_scope). Unscoped callers pass the first branch. The link is the
-- table's required (NOT NULL) reference to a scoped parent; the two tables
-- with only an optional link (bank_adjustments, privacy_actions) keep rows
-- without one visible.
-- parking_assignments now resolves through its required parking space, not
-- the optional unit.
--
-- Rolled-back dry run on production: role x table counts (manager, company
-- admin, operator, board, owner, vendor) unchanged; no policy recursion. No
-- manager was scoped on production yet.

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('agenda_items', 'meeting_id', 'meetings', true),
      ('approval_decisions', 'approval_request_id', 'approval_requests', true),
      ('approval_votes', 'approval_request_id', 'approval_requests', true),
      ('architectural_request_messages', 'request_id', 'architectural_requests', true),
      ('automation_flow_runs', 'flow_id', 'automation_flows', true),
      ('bank_account_owners', 'bank_account_id', 'bank_accounts', true),
      ('bank_adjustments', 'bank_account_id', 'bank_accounts', false),
      ('bank_reconciliation_items', 'reconciliation_id', 'bank_reconciliations', true),
      ('building_private', 'building_id', 'buildings', true),
      ('calendar_event_private', 'calendar_event_id', 'calendar_events', true),
      ('capital_project_budget_lines', 'project_id', 'capital_projects', true),
      ('capital_project_milestones', 'project_id', 'capital_projects', true),
      ('capital_project_work_orders', 'work_order_id', 'work_orders', true),
      ('committee_members', 'committee_id', 'committees', true),
      ('delinquency_case_events', 'case_id', 'delinquency_cases', true),
      ('delinquency_steps', 'policy_id', 'delinquency_policies', true),
      ('depreciation_entries', 'fixed_asset_id', 'fixed_assets', true),
      ('dues_increase_lines', 'unit_id', 'units', true),
      ('email_events', 'email_id', 'email_queue', true),
      ('inspection_checklist_items', 'inspection_id', 'inspections', true),
      ('inspection_finding_events', 'inspection_item_id', 'inspection_items', true),
      ('inspection_items', 'inspection_id', 'inspections', true),
      ('lock_box_assignments', 'lock_box_id', 'lock_boxes', true),
      ('maintenance_task_history', 'task_id', 'maintenance_tasks', true),
      ('maintenance_task_private', 'maintenance_task_id', 'maintenance_tasks', true),
      ('meeting_action_items', 'meeting_id', 'meetings', true),
      ('meeting_attendees', 'meeting_id', 'meetings', true),
      ('meeting_documents', 'meeting_id', 'meetings', true),
      ('meeting_private', 'meeting_id', 'meetings', true),
      ('message_thread_messages', 'thread_id', 'message_threads', true),
      ('notice_recipients', 'notice_id', 'notices', true),
      ('occupancy_delinquency_notes', 'occupancy_id', 'occupancies', true),
      ('occupancy_private', 'occupancy_id', 'occupancies', true),
      ('other_receipt_lines', 'receipt_id', 'other_receipts', true),
      ('owner_ach_status', 'owner_id', 'owners', true),
      ('owner_financial_details', 'owner_id', 'owners', true),
      ('owner_form_submissions', 'owner_id', 'owners', true),
      ('owner_packet_settings', 'owner_id', 'owners', true),
      ('owner_packets', 'owner_id', 'owners', true),
      ('owner_portal_invites', 'owner_id', 'owners', true),
      ('owner_portal_logins', 'owner_id', 'owners', true),
      ('owner_vehicles', 'owner_id', 'owners', true),
      ('payment_applications', 'charge_id', 'charges', true),
      ('payment_events', 'payment_intent_id', 'payment_intents', true),
      ('payment_plan_installments', 'plan_id', 'payment_plans', true),
      ('payment_plan_private', 'payment_plan_id', 'payment_plans', true),
      ('payment_private', 'payment_id', 'payments', true),
      ('privacy_actions', 'subject_owner_id', 'owners', false),
      ('purchase_order_line_items', 'purchase_order_id', 'purchase_orders', true),
      ('purchase_order_private', 'purchase_order_id', 'purchase_orders', true),
      ('signature_events', 'request_id', 'signature_requests', true),
      ('signature_signers', 'request_id', 'signature_requests', true),
      ('sms_messages', 'conversation_id', 'sms_conversations', true),
      ('survey_responses', 'survey_id', 'surveys', true),
      ('tenant_private', 'tenant_id', 'tenants', true),
      ('unit_amenities', 'unit_id', 'units', true),
      ('unit_group_members', 'unit_id', 'units', true),
      ('unit_pets', 'unit_id', 'units', true),
      ('unit_private', 'unit_id', 'units', true),
      ('unit_recurring_charges', 'unit_id', 'units', true),
      ('vendor_credit_applications', 'bill_id', 'payable_bills', true),
      ('vendor_portal_logins', 'vendor_id', 'vendors', true),
      ('violation_fines', 'violation_id', 'violations', true),
      ('violation_updates', 'violation_id', 'violations', true),
      ('votes', 'unit_id', 'units', true),
      ('work_order_estimates', 'work_order_id', 'work_orders', true),
      ('work_order_labor_entries', 'work_order_id', 'work_orders', true),
      ('work_order_messages', 'work_order_id', 'work_orders', true),
      ('work_order_private', 'work_order_id', 'work_orders', true),
      ('work_order_ratings', 'work_order_id', 'work_orders', true),
      ('work_order_updates', 'work_order_id', 'work_orders', true),
      ('work_order_vendor_private', 'work_order_id', 'work_orders', true)
    ) v(child, col, parent, required)
  loop
    if not exists (
      select 1 from pg_policies
       where schemaname = 'public' and tablename = r.child and policyname = 'mgr_assoc_scope'
    ) then
      execute format(
        'create policy mgr_assoc_scope on public.%I as restrictive for all to authenticated '
        || 'using (((select public.manager_is_scoped()) is not true) or %s%I in (select p.id from public.%I p))',
        r.child,
        case when r.required then '' else format('%I is null or ', r.col) end,
        r.col, r.parent);
    end if;
  end loop;
end
$$;

-- parking_assignments: through the required parking space (every space has
-- an association), not the optional unit.
alter policy mgr_assoc_scope on public.parking_assignments
  using (((select public.manager_is_scoped()) is not true)
         or parking_space_id in (select ps.id from public.parking_spaces ps));
