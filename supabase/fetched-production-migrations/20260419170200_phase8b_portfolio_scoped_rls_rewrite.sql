-- =============================================================================
-- Phase 8b — Portfolio-scoped RLS (SaaS tenant isolation)
-- Every staff policy now checks both tier (full/finance/any) AND portfolio match.
-- Platform operators bypass portfolio isolation.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TIER A — Full access admin (per-portfolio + platform operator bypass)
-- -----------------------------------------------------------------------------

drop policy if exists portfolios_full_all on public.portfolios;
drop policy if exists portfolios_staff_read on public.portfolios;
create policy portfolios_platform_all on public.portfolios
  for all to authenticated using (public.is_platform_operator()) with check (public.is_platform_operator());
create policy portfolios_admin_own on public.portfolios
  for all to authenticated
  using (public.is_full_access_staff() and id = public.current_portfolio_id())
  with check (public.is_full_access_staff() and id = public.current_portfolio_id());
create policy portfolios_staff_read on public.portfolios
  for select to authenticated
  using (public.is_any_staff() and id = public.current_portfolio_id());

drop policy if exists property_groups_full_all on public.property_groups;
drop policy if exists property_groups_staff_read on public.property_groups;
create policy property_groups_admin_all on public.property_groups
  for all to authenticated
  using (public.can_admin_portfolio(portfolio_id)) with check (public.can_admin_portfolio(portfolio_id));
create policy property_groups_staff_read on public.property_groups
  for select to authenticated using (public.can_access_portfolio(portfolio_id));

drop policy if exists user_roles_full_all on public.user_roles;
-- user_roles_authenticated_read stays (everyone reads role definitions for the UI picker)
create policy user_roles_admin_all on public.user_roles
  for all to authenticated
  using (public.is_platform_operator() or (public.is_full_access_staff() and portfolio_id = public.current_portfolio_id()))
  with check (public.is_platform_operator() or (public.is_full_access_staff() and portfolio_id = public.current_portfolio_id()));

drop policy if exists comm_triggers_full_all on public.communication_triggers;
drop policy if exists comm_triggers_staff_read on public.communication_triggers;
create policy comm_triggers_admin_all on public.communication_triggers
  for all to authenticated
  using (public.can_admin_portfolio(portfolio_id)) with check (public.can_admin_portfolio(portfolio_id));
create policy comm_triggers_staff_read on public.communication_triggers
  for select to authenticated using (public.can_access_portfolio(portfolio_id));

drop policy if exists mgmt_fee_full_all on public.management_fee_schedules;
drop policy if exists mgmt_fee_finance_read on public.management_fee_schedules;
create policy mgmt_fee_admin_all on public.management_fee_schedules
  for all to authenticated
  using (public.can_admin_portfolio(portfolio_id)) with check (public.can_admin_portfolio(portfolio_id));
create policy mgmt_fee_finance_read on public.management_fee_schedules
  for select to authenticated using (public.can_manage_finance(portfolio_id));

-- -----------------------------------------------------------------------------
-- TIER B — Finance (per-portfolio + platform operator bypass)
-- -----------------------------------------------------------------------------

drop policy if exists gl_accounts_finance_all on public.gl_accounts;
create policy gl_accounts_finance_all on public.gl_accounts
  for all to authenticated
  using (public.can_manage_finance(portfolio_id)) with check (public.can_manage_finance(portfolio_id));

drop policy if exists gl_role_perms_full_all on public.gl_account_role_permissions;
drop policy if exists gl_role_perms_staff_read on public.gl_account_role_permissions;
create policy gl_role_perms_admin_all on public.gl_account_role_permissions
  for all to authenticated
  using (exists (select 1 from public.gl_accounts g
                 where g.id = gl_account_id and public.can_admin_portfolio(g.portfolio_id)))
  with check (exists (select 1 from public.gl_accounts g
                 where g.id = gl_account_id and public.can_admin_portfolio(g.portfolio_id)));
create policy gl_role_perms_staff_read on public.gl_account_role_permissions
  for select to authenticated
  using (exists (select 1 from public.gl_accounts g
                 where g.id = gl_account_id and public.can_access_portfolio(g.portfolio_id)));

drop policy if exists bank_accounts_finance_all on public.bank_accounts;
create policy bank_accounts_finance_all on public.bank_accounts
  for all to authenticated
  using (public.can_manage_finance(portfolio_id)) with check (public.can_manage_finance(portfolio_id));

drop policy if exists bank_owners_finance_all on public.bank_account_owners;
create policy bank_owners_finance_all on public.bank_account_owners
  for all to authenticated
  using (exists (select 1 from public.bank_accounts b
                 where b.id = bank_account_id and public.can_manage_finance(b.portfolio_id)))
  with check (exists (select 1 from public.bank_accounts b
                 where b.id = bank_account_id and public.can_manage_finance(b.portfolio_id)));

drop policy if exists bank_transfers_finance_all on public.bank_transfers;
create policy bank_transfers_finance_all on public.bank_transfers
  for all to authenticated
  using (public.can_manage_finance(portfolio_id)) with check (public.can_manage_finance(portfolio_id));

drop policy if exists journal_entries_finance_all on public.journal_entries;
create policy journal_entries_finance_all on public.journal_entries
  for all to authenticated
  using (public.can_manage_finance(portfolio_id)) with check (public.can_manage_finance(portfolio_id));

drop policy if exists journal_lines_finance_all on public.journal_lines;
create policy journal_lines_finance_all on public.journal_lines
  for all to authenticated
  using (exists (select 1 from public.journal_entries je
                 where je.id = entry_id and public.can_manage_finance(je.portfolio_id)))
  with check (exists (select 1 from public.journal_entries je
                 where je.id = entry_id and public.can_manage_finance(je.portfolio_id)));

drop policy if exists budget_lines_finance_all on public.budget_lines;
create policy budget_lines_finance_all on public.budget_lines
  for all to authenticated
  using (public.can_access_association(association_id) and public.is_finance_staff() or public.is_platform_operator())
  with check (public.can_access_association(association_id) and public.is_finance_staff() or public.is_platform_operator());

drop policy if exists payable_bills_finance_all on public.payable_bills;
create policy payable_bills_finance_all on public.payable_bills
  for all to authenticated
  using (public.can_manage_finance(portfolio_id)) with check (public.can_manage_finance(portfolio_id));

drop policy if exists bill_line_items_finance_all on public.payable_bill_line_items;
create policy bill_line_items_finance_all on public.payable_bill_line_items
  for all to authenticated
  using (exists (select 1 from public.payable_bills b
                 where b.id = bill_id and public.can_manage_finance(b.portfolio_id)))
  with check (exists (select 1 from public.payable_bills b
                 where b.id = bill_id and public.can_manage_finance(b.portfolio_id)));

drop policy if exists fixed_assets_finance_all on public.fixed_assets;
create policy fixed_assets_finance_all on public.fixed_assets
  for all to authenticated
  using (public.can_manage_finance(portfolio_id)) with check (public.can_manage_finance(portfolio_id));

drop policy if exists depr_entries_finance_all on public.depreciation_entries;
create policy depr_entries_finance_all on public.depreciation_entries
  for all to authenticated
  using (exists (select 1 from public.fixed_assets a
                 where a.id = fixed_asset_id and public.can_manage_finance(a.portfolio_id)))
  with check (exists (select 1 from public.fixed_assets a
                 where a.id = fixed_asset_id and public.can_manage_finance(a.portfolio_id)));

-- AR (finance staff scope)
drop policy if exists charges_finance_all on public.charges;
create policy charges_finance_all on public.charges
  for all to authenticated
  using (public.is_platform_operator() or (public.is_finance_staff() and public.can_access_unit(unit_id)))
  with check (public.is_platform_operator() or (public.is_finance_staff() and public.can_access_unit(unit_id)));

drop policy if exists payments_finance_all on public.payments;
create policy payments_finance_all on public.payments
  for all to authenticated
  using (public.is_platform_operator() or (public.is_finance_staff() and public.can_access_unit(unit_id)))
  with check (public.is_platform_operator() or (public.is_finance_staff() and public.can_access_unit(unit_id)));

drop policy if exists payment_intents_finance_all on public.payment_intents;
create policy payment_intents_finance_all on public.payment_intents
  for all to authenticated
  using (public.is_platform_operator() or (public.is_finance_staff() and public.can_access_unit(unit_id)))
  with check (public.is_platform_operator() or (public.is_finance_staff() and public.can_access_unit(unit_id)));

drop policy if exists statements_finance_all on public.statements;
create policy statements_finance_all on public.statements
  for all to authenticated
  using (public.is_platform_operator() or (public.is_finance_staff() and public.can_access_association(association_id)))
  with check (public.is_platform_operator() or (public.is_finance_staff() and public.can_access_association(association_id)));

drop policy if exists assessment_periods_finance_all on public.assessment_periods;
create policy assessment_periods_finance_all on public.assessment_periods
  for all to authenticated
  using (public.is_platform_operator() or (public.is_finance_staff() and public.can_access_association(association_id)))
  with check (public.is_platform_operator() or (public.is_finance_staff() and public.can_access_association(association_id)));

-- -----------------------------------------------------------------------------
-- TIER C — Any staff (per-portfolio + platform operator bypass)
-- -----------------------------------------------------------------------------

-- Vendors
drop policy if exists vendors_staff_all on public.vendors;
create policy vendors_staff_all on public.vendors
  for all to authenticated
  using (public.can_access_portfolio(portfolio_id)) with check (public.can_access_portfolio(portfolio_id));

drop policy if exists vendor_compliance_staff_all on public.vendor_compliance;
create policy vendor_compliance_staff_all on public.vendor_compliance
  for all to authenticated
  using (exists (select 1 from public.vendors v where v.id = vendor_id and public.can_access_portfolio(v.portfolio_id)))
  with check (exists (select 1 from public.vendors v where v.id = vendor_id and public.can_access_portfolio(v.portfolio_id)));

-- People
drop policy if exists associations_staff_all on public.associations;
create policy associations_staff_all on public.associations
  for all to authenticated
  using (public.can_access_portfolio(portfolio_id)) with check (public.can_access_portfolio(portfolio_id));

drop policy if exists buildings_staff_all on public.buildings;
create policy buildings_staff_all on public.buildings
  for all to authenticated
  using (public.can_access_association(association_id)) with check (public.can_access_association(association_id));

drop policy if exists units_staff_all on public.units;
create policy units_staff_all on public.units
  for all to authenticated
  using (exists (select 1 from public.buildings b where b.id = building_id and public.can_access_association(b.association_id)))
  with check (exists (select 1 from public.buildings b where b.id = building_id and public.can_access_association(b.association_id)));

drop policy if exists owners_staff_all on public.owners;
create policy owners_staff_all on public.owners
  for all to authenticated
  using (public.is_platform_operator() or (public.is_any_staff() and (portfolio_id is null or portfolio_id = public.current_portfolio_id())))
  with check (public.is_platform_operator() or (public.is_any_staff() and (portfolio_id is null or portfolio_id = public.current_portfolio_id())));

drop policy if exists occupancies_staff_all on public.occupancies;
create policy occupancies_staff_all on public.occupancies
  for all to authenticated
  using (public.can_access_association(association_id)) with check (public.can_access_association(association_id));

drop policy if exists unit_owners_staff_all on public.unit_owners;
create policy unit_owners_staff_all on public.unit_owners
  for all to authenticated
  using (public.can_access_unit(unit_id)) with check (public.can_access_unit(unit_id));

drop policy if exists tenancies_staff_all on public.tenancies;
create policy tenancies_staff_all on public.tenancies
  for all to authenticated
  using (public.can_access_unit(unit_id)) with check (public.can_access_unit(unit_id));

drop policy if exists board_members_staff_all on public.board_members;
create policy board_members_staff_all on public.board_members
  for all to authenticated
  using (public.can_access_association(association_id)) with check (public.can_access_association(association_id));

drop policy if exists committees_staff_all on public.committees;
create policy committees_staff_all on public.committees
  for all to authenticated
  using (public.can_access_association(association_id)) with check (public.can_access_association(association_id));

drop policy if exists committee_members_staff_all on public.committee_members;
create policy committee_members_staff_all on public.committee_members
  for all to authenticated
  using (exists (select 1 from public.committees c where c.id = committee_id and public.can_access_association(c.association_id)))
  with check (exists (select 1 from public.committees c where c.id = committee_id and public.can_access_association(c.association_id)));

-- Operations
drop policy if exists work_orders_staff_all on public.work_orders;
create policy work_orders_staff_all on public.work_orders
  for all to authenticated
  using (public.can_access_association(association_id)) with check (public.can_access_association(association_id));

drop policy if exists wo_updates_staff_all on public.work_order_updates;
create policy wo_updates_staff_all on public.work_order_updates
  for all to authenticated
  using (exists (select 1 from public.work_orders w where w.id = work_order_id and public.can_access_association(w.association_id)))
  with check (exists (select 1 from public.work_orders w where w.id = work_order_id and public.can_access_association(w.association_id)));

drop policy if exists service_requests_staff_all on public.service_requests;
create policy service_requests_staff_all on public.service_requests
  for all to authenticated
  using (public.can_access_portfolio(portfolio_id)) with check (public.can_access_portfolio(portfolio_id));

drop policy if exists purchase_orders_staff_all on public.purchase_orders;
create policy purchase_orders_staff_all on public.purchase_orders
  for all to authenticated
  using (public.can_access_portfolio(portfolio_id)) with check (public.can_access_portfolio(portfolio_id));

drop policy if exists po_line_items_staff_all on public.purchase_order_line_items;
create policy po_line_items_staff_all on public.purchase_order_line_items
  for all to authenticated
  using (exists (select 1 from public.purchase_orders p where p.id = purchase_order_id and public.can_access_portfolio(p.portfolio_id)))
  with check (exists (select 1 from public.purchase_orders p where p.id = purchase_order_id and public.can_access_portfolio(p.portfolio_id)));

drop policy if exists recurring_wo_staff_all on public.recurring_work_orders;
create policy recurring_wo_staff_all on public.recurring_work_orders
  for all to authenticated
  using (public.can_access_portfolio(portfolio_id)) with check (public.can_access_portfolio(portfolio_id));

drop policy if exists labor_entries_staff_all on public.work_order_labor_entries;
create policy labor_entries_staff_all on public.work_order_labor_entries
  for all to authenticated
  using (exists (select 1 from public.work_orders w where w.id = work_order_id and public.can_access_association(w.association_id)))
  with check (exists (select 1 from public.work_orders w where w.id = work_order_id and public.can_access_association(w.association_id)));

drop policy if exists estimates_staff_all on public.work_order_estimates;
create policy estimates_staff_all on public.work_order_estimates
  for all to authenticated
  using (exists (select 1 from public.work_orders w where w.id = work_order_id and public.can_access_association(w.association_id)))
  with check (exists (select 1 from public.work_orders w where w.id = work_order_id and public.can_access_association(w.association_id)));

drop policy if exists inspections_staff_all on public.inspections;
create policy inspections_staff_all on public.inspections
  for all to authenticated
  using (public.can_access_portfolio(portfolio_id)) with check (public.can_access_portfolio(portfolio_id));

drop policy if exists inspection_items_staff_all on public.inspection_items;
create policy inspection_items_staff_all on public.inspection_items
  for all to authenticated
  using (exists (select 1 from public.inspections i where i.id = inspection_id and public.can_access_portfolio(i.portfolio_id)))
  with check (exists (select 1 from public.inspections i where i.id = inspection_id and public.can_access_portfolio(i.portfolio_id)));

drop policy if exists violations_staff_all on public.violations;
create policy violations_staff_all on public.violations
  for all to authenticated
  using (public.can_access_association(association_id)) with check (public.can_access_association(association_id));

drop policy if exists violation_updates_staff_all on public.violation_updates;
create policy violation_updates_staff_all on public.violation_updates
  for all to authenticated
  using (exists (select 1 from public.violations v where v.id = violation_id and public.can_access_association(v.association_id)))
  with check (exists (select 1 from public.violations v where v.id = violation_id and public.can_access_association(v.association_id)));

drop policy if exists calendar_events_staff_all on public.calendar_events;
create policy calendar_events_staff_all on public.calendar_events
  for all to authenticated
  using (public.can_access_portfolio(portfolio_id)) with check (public.can_access_portfolio(portfolio_id));

-- Communication
drop policy if exists notices_staff_all on public.notices;
create policy notices_staff_all on public.notices
  for all to authenticated
  using (public.can_access_association(association_id)) with check (public.can_access_association(association_id));

drop policy if exists notice_recipients_staff_all on public.notice_recipients;
create policy notice_recipients_staff_all on public.notice_recipients
  for all to authenticated
  using (exists (select 1 from public.notices n where n.id = notice_id and public.can_access_association(n.association_id)))
  with check (exists (select 1 from public.notices n where n.id = notice_id and public.can_access_association(n.association_id)));

drop policy if exists email_queue_staff_all on public.email_queue;
create policy email_queue_staff_all on public.email_queue
  for all to authenticated
  using (public.is_platform_operator() or association_id is null or public.can_access_association(association_id))
  with check (public.is_platform_operator() or association_id is null or public.can_access_association(association_id));

drop policy if exists sms_conversations_staff_all on public.sms_conversations;
create policy sms_conversations_staff_all on public.sms_conversations
  for all to authenticated
  using (public.can_access_portfolio(portfolio_id)) with check (public.can_access_portfolio(portfolio_id));

drop policy if exists sms_messages_staff_all on public.sms_messages;
create policy sms_messages_staff_all on public.sms_messages
  for all to authenticated
  using (exists (select 1 from public.sms_conversations c where c.id = conversation_id and public.can_access_portfolio(c.portfolio_id)))
  with check (exists (select 1 from public.sms_conversations c where c.id = conversation_id and public.can_access_portfolio(c.portfolio_id)));

drop policy if exists doc_templates_staff_all on public.document_templates;
create policy doc_templates_staff_all on public.document_templates
  for all to authenticated
  using (public.can_access_portfolio(portfolio_id)) with check (public.can_access_portfolio(portfolio_id));

drop policy if exists form_templates_staff_all on public.form_templates;
create policy form_templates_staff_all on public.form_templates
  for all to authenticated
  using (public.can_access_portfolio(portfolio_id)) with check (public.can_access_portfolio(portfolio_id));

-- Tags + assignments
drop policy if exists tags_staff_all on public.tags;
create policy tags_staff_all on public.tags
  for all to authenticated
  using (public.can_access_portfolio(portfolio_id)) with check (public.can_access_portfolio(portfolio_id));

drop policy if exists tag_assignments_staff_all on public.tag_assignments;
create policy tag_assignments_staff_all on public.tag_assignments
  for all to authenticated
  using (exists (select 1 from public.tags t where t.id = tag_id and public.can_access_portfolio(t.portfolio_id)))
  with check (exists (select 1 from public.tags t where t.id = tag_id and public.can_access_portfolio(t.portfolio_id)));

-- Approvals + surveys
drop policy if exists approval_requests_staff_all on public.approval_requests;
create policy approval_requests_staff_all on public.approval_requests
  for all to authenticated
  using (public.can_access_portfolio(portfolio_id)) with check (public.can_access_portfolio(portfolio_id));

drop policy if exists surveys_staff_all on public.surveys;
create policy surveys_staff_all on public.surveys
  for all to authenticated
  using (public.can_access_portfolio(portfolio_id)) with check (public.can_access_portfolio(portfolio_id));

drop policy if exists survey_responses_staff_all on public.survey_responses;
create policy survey_responses_staff_all on public.survey_responses
  for all to authenticated
  using (exists (select 1 from public.surveys s where s.id = survey_id and public.can_access_portfolio(s.portfolio_id)))
  with check (exists (select 1 from public.surveys s where s.id = survey_id and public.can_access_portfolio(s.portfolio_id)));

-- Reporting
drop policy if exists report_defs_full_all on public.report_definitions;
create policy report_defs_admin_all on public.report_definitions
  for all to authenticated
  using (public.is_platform_operator() or (public.is_full_access_staff() and portfolio_id is not null and portfolio_id = public.current_portfolio_id()))
  with check (public.is_platform_operator() or (public.is_full_access_staff() and portfolio_id is not null and portfolio_id = public.current_portfolio_id()));
-- report_defs_authenticated_read stays (everyone reads system + own-portfolio definitions via the underlying logic below)
drop policy if exists report_defs_authenticated_read on public.report_definitions;
create policy report_defs_authenticated_read on public.report_definitions
  for select to authenticated
  using (is_system or portfolio_id is null or public.can_access_portfolio(portfolio_id));

drop policy if exists saved_reports_staff_all on public.saved_reports;
create policy saved_reports_staff_all on public.saved_reports
  for all to authenticated
  using (public.can_access_portfolio(portfolio_id)) with check (public.can_access_portfolio(portfolio_id));

drop policy if exists scheduled_reports_staff_all on public.scheduled_reports;
create policy scheduled_reports_staff_all on public.scheduled_reports
  for all to authenticated
  using (public.can_access_portfolio(portfolio_id)) with check (public.can_access_portfolio(portfolio_id));

drop policy if exists report_runs_staff_all on public.report_runs;
create policy report_runs_staff_all on public.report_runs
  for all to authenticated
  using (public.can_access_portfolio(portfolio_id)) with check (public.can_access_portfolio(portfolio_id));

drop policy if exists report_snapshots_staff_all on public.report_snapshots;
create policy report_snapshots_staff_all on public.report_snapshots
  for all to authenticated
  using (public.can_access_association(association_id)) with check (public.can_access_association(association_id));

-- Governance
drop policy if exists ballots_staff_all on public.ballots;
create policy ballots_staff_all on public.ballots
  for all to authenticated
  using (public.can_access_association(association_id)) with check (public.can_access_association(association_id));

drop policy if exists votes_staff_all on public.votes;
create policy votes_staff_all on public.votes
  for all to authenticated
  using (exists (select 1 from public.ballots b where b.id = ballot_id and public.can_access_association(b.association_id)))
  with check (exists (select 1 from public.ballots b where b.id = ballot_id and public.can_access_association(b.association_id)));

-- Profiles (portfolio-scoped staff directory + platform operator bypass)
drop policy if exists profiles_full_admin on public.profiles;
drop policy if exists profiles_staff_read on public.profiles;
create policy profiles_platform_all on public.profiles
  for all to authenticated using (public.is_platform_operator()) with check (public.is_platform_operator());
create policy profiles_admin_in_portfolio on public.profiles
  for all to authenticated
  using (public.is_full_access_staff() and portfolio_id = public.current_portfolio_id())
  with check (public.is_full_access_staff() and portfolio_id = public.current_portfolio_id());
create policy profiles_staff_directory_read on public.profiles
  for select to authenticated
  using (public.is_any_staff() and portfolio_id is not null and portfolio_id = public.current_portfolio_id());

-- Documents stays staff-any for now (polymorphic entity_type; needs app-level tenant filter)
comment on table public.documents is 'Polymorphic via entity_type/entity_id. RLS is staff-any; application code must filter by portfolio when querying.';
;
