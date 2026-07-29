-- =============================================================================
-- Final hardening: index the high-traffic FKs that were missing coverage.
-- Skipping audit columns (created_by, sent_by, approved_by, uploaded_by,
-- triggered_by, decision_by, generated_by) — those are rarely predicates.
-- =============================================================================

-- Portfolio-scoped tenant queries (most-hit filter in any multi-tenant query)
create index if not exists idx_payable_bills_portfolio on public.payable_bills(portfolio_id);
create index if not exists idx_purchase_orders_portfolio on public.purchase_orders(portfolio_id);
create index if not exists idx_service_requests_portfolio on public.service_requests(portfolio_id);
create index if not exists idx_recurring_work_orders_portfolio on public.recurring_work_orders(portfolio_id);
create index if not exists idx_bank_transfers_portfolio on public.bank_transfers(portfolio_id);
create index if not exists idx_inspections_portfolio on public.inspections(portfolio_id);

-- Cross-entity joins
create index if not exists idx_payable_bills_work_order on public.payable_bills(work_order_id) where work_order_id is not null;
create index if not exists idx_payable_bills_gl on public.payable_bills(gl_account_id);
create index if not exists idx_payable_bills_bank on public.payable_bills(bank_account_id);
create index if not exists idx_bank_transfers_journal on public.bank_transfers(journal_entry_id);
create index if not exists idx_bill_line_items_association on public.payable_bill_line_items(association_id);

-- Communication / approvals side
create index if not exists idx_comm_triggers_association on public.communication_triggers(association_id);
create index if not exists idx_sms_conversations_association on public.sms_conversations(association_id);
create index if not exists idx_approval_requests_portfolio on public.approval_requests(portfolio_id);
create index if not exists idx_approval_requests_vendor on public.approval_requests(vendor_id);

-- Fixed assets / inspections cross-refs
create index if not exists idx_fixed_assets_unit on public.fixed_assets(unit_id);
create index if not exists idx_inspections_inspector_user on public.inspections(inspector_user_id);
create index if not exists idx_inspections_inspector_vendor on public.inspections(inspector_vendor_id);

-- Service request additional paths
create index if not exists idx_service_requests_owner on public.service_requests(owner_id);

-- Recurring WO cross-refs
create index if not exists idx_recurring_wo_unit on public.recurring_work_orders(unit_id);
create index if not exists idx_recurring_wo_gl on public.recurring_work_orders(gl_account_id);

-- Vendor default GL lookup
create index if not exists idx_vendors_default_gl on public.vendors(default_gl_account_id) where default_gl_account_id is not null;

-- Associations' placeholder FKs (low-volume but cheap to index)
create index if not exists idx_associations_primary_bank on public.associations(primary_bank_account_id);
create index if not exists idx_associations_mgmt_fee on public.associations(management_fee_schedule_id);

-- Scheduled reports cross-ref
create index if not exists idx_scheduled_reports_saved on public.scheduled_reports(saved_report_id);

-- Charges back-ref from payment_intents
create index if not exists idx_payment_intents_charge on public.payment_intents(charge_id);

-- Votes unit link
create index if not exists idx_votes_unit on public.votes(unit_id);
;
