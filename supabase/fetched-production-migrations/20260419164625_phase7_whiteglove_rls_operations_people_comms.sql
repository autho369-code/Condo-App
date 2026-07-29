-- =============================================================================
-- Phase 7 — White-glove RLS, part 2/2: Operations, People, Communication,
-- Admin, Reporting, Governance
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PEOPLE — Associations, buildings, units, owners, occupancies, board, etc.
-- -----------------------------------------------------------------------------

-- associations
drop policy if exists associations_manager_all on public.associations;
drop policy if exists associations_board_read on public.associations;
drop policy if exists associations_owner_read on public.associations;
drop policy if exists associations_tenant_read on public.associations;
create policy associations_staff_all on public.associations
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy associations_board_read on public.associations
  for select to authenticated
  using (public.is_board_user() and id in (select public.current_board_association_ids()));
create policy associations_resident_read on public.associations
  for select to authenticated
  using (public.is_portal_resident() and id in (select public.current_resident_association_ids()));

-- buildings
drop policy if exists buildings_manager_all on public.buildings;
drop policy if exists buildings_board_read on public.buildings;
drop policy if exists buildings_owner_read on public.buildings;
drop policy if exists buildings_tenant_read on public.buildings;
create policy buildings_staff_all on public.buildings
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy buildings_board_read on public.buildings
  for select to authenticated
  using (public.is_board_user() and association_id in (select public.current_board_association_ids()));
create policy buildings_resident_read on public.buildings
  for select to authenticated
  using (public.is_portal_resident() and association_id in (select public.current_resident_association_ids()));

-- units
drop policy if exists units_manager_all on public.units;
drop policy if exists units_board_read on public.units;
drop policy if exists units_owner_read on public.units;
drop policy if exists units_tenant_read on public.units;
create policy units_staff_all on public.units
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy units_board_read on public.units
  for select to authenticated
  using (public.is_board_user() and building_id in (
    select b.id from public.buildings b where b.association_id in (select public.current_board_association_ids())
  ));
create policy units_resident_read on public.units
  for select to authenticated
  using (public.is_portal_resident() and id in (select public.current_resident_unit_ids()));

-- owners
drop policy if exists owners_manager_all on public.owners;
create policy owners_staff_all on public.owners
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy owners_self_read on public.owners
  for select to authenticated
  using (public.is_portal_resident() and id = public.current_owner_id());
create policy owners_self_update on public.owners
  for update to authenticated
  using (public.is_portal_resident() and id = public.current_owner_id())
  with check (public.is_portal_resident() and id = public.current_owner_id());

-- occupancies
drop policy if exists occupancies_manager_all on public.occupancies;
create policy occupancies_staff_all on public.occupancies
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy occupancies_self_read on public.occupancies
  for select to authenticated
  using (public.is_portal_resident() and owner_id = public.current_owner_id());

-- unit_owners (legacy) and tenancies
drop policy if exists unit_owners_manager_all on public.unit_owners;
create policy unit_owners_staff_all on public.unit_owners
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());

drop policy if exists tenancies_manager_all on public.tenancies;
create policy tenancies_staff_all on public.tenancies
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy tenancies_resident_read on public.tenancies
  for select to authenticated
  using (public.is_portal_resident() and unit_id in (select public.current_resident_unit_ids()));

-- board_members
drop policy if exists board_members_manager_all on public.board_members;
create policy board_members_staff_all on public.board_members
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy board_members_board_read on public.board_members
  for select to authenticated
  using (public.is_board_user() and association_id in (select public.current_board_association_ids()));
create policy board_members_resident_read on public.board_members
  for select to authenticated
  using (public.is_portal_resident() and association_id in (select public.current_resident_association_ids()));

-- committees + committee_members
drop policy if exists committees_manager_all on public.committees;
create policy committees_staff_all on public.committees
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy committees_resident_read on public.committees
  for select to authenticated
  using ((public.is_portal_resident() or public.is_board_user()) and association_id in (
    select public.current_resident_association_ids()
    union select public.current_board_association_ids()
  ));

drop policy if exists committee_members_manager_all on public.committee_members;
create policy committee_members_staff_all on public.committee_members
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());

-- -----------------------------------------------------------------------------
-- OPERATIONS — Work orders, service requests, POs, inspections, violations, calendar
-- -----------------------------------------------------------------------------

-- work_orders
drop policy if exists manager_work_orders_select on public.work_orders;
drop policy if exists manager_work_orders_insert on public.work_orders;
drop policy if exists manager_work_orders_update on public.work_orders;
drop policy if exists manager_work_orders_delete on public.work_orders;
drop policy if exists board_work_orders_select on public.work_orders;
drop policy if exists owner_work_orders_select on public.work_orders;
create policy work_orders_staff_all on public.work_orders
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy work_orders_board_read on public.work_orders
  for select to authenticated
  using (public.is_board_user() and association_id in (select public.current_board_association_ids()));
create policy work_orders_resident_read on public.work_orders
  for select to authenticated
  using (public.is_portal_resident() and unit_id in (select public.current_resident_unit_ids()));
create policy work_orders_vendor_read on public.work_orders
  for select to authenticated using (vendor_id = public.current_vendor_id());
create policy work_orders_vendor_update on public.work_orders
  for update to authenticated
  using (vendor_id = public.current_vendor_id())
  with check (vendor_id = public.current_vendor_id());

-- work_order_updates
drop policy if exists manager_wo_updates_select on public.work_order_updates;
drop policy if exists manager_wo_updates_insert on public.work_order_updates;
create policy wo_updates_staff_all on public.work_order_updates
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy wo_updates_vendor_rw on public.work_order_updates
  for all to authenticated
  using (work_order_id in (select id from public.work_orders where vendor_id = public.current_vendor_id()))
  with check (work_order_id in (select id from public.work_orders where vendor_id = public.current_vendor_id()));

-- service_requests
drop policy if exists service_requests_manager_all on public.service_requests;
create policy service_requests_staff_all on public.service_requests
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy service_requests_board_read on public.service_requests
  for select to authenticated
  using (public.is_board_user() and association_id in (select public.current_board_association_ids()));
create policy service_requests_resident_read on public.service_requests
  for select to authenticated
  using (public.is_portal_resident() and (homeowner_id = public.current_owner_id() or unit_id in (select public.current_resident_unit_ids())));
create policy service_requests_resident_insert on public.service_requests
  for insert to authenticated
  with check (public.is_portal_resident() and homeowner_id = public.current_owner_id() and unit_id in (select public.current_resident_unit_ids()));

-- purchase_orders
drop policy if exists purchase_orders_manager_all on public.purchase_orders;
create policy purchase_orders_staff_all on public.purchase_orders
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy purchase_orders_vendor_read on public.purchase_orders
  for select to authenticated using (vendor_id = public.current_vendor_id());

drop policy if exists po_line_items_manager_all on public.purchase_order_line_items;
create policy po_line_items_staff_all on public.purchase_order_line_items
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy po_line_items_vendor_read on public.purchase_order_line_items
  for select to authenticated
  using (purchase_order_id in (select id from public.purchase_orders where vendor_id = public.current_vendor_id()));

-- recurring_work_orders
drop policy if exists recurring_wo_manager_all on public.recurring_work_orders;
create policy recurring_wo_staff_all on public.recurring_work_orders
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());

-- work_order_labor_entries
drop policy if exists labor_entries_manager_all on public.work_order_labor_entries;
create policy labor_entries_staff_all on public.work_order_labor_entries
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy labor_entries_vendor_rw on public.work_order_labor_entries
  for all to authenticated
  using (work_order_id in (select id from public.work_orders where vendor_id = public.current_vendor_id()))
  with check (work_order_id in (select id from public.work_orders where vendor_id = public.current_vendor_id()));

-- work_order_estimates
drop policy if exists estimates_manager_all on public.work_order_estimates;
create policy estimates_staff_all on public.work_order_estimates
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy estimates_vendor_rw on public.work_order_estimates
  for all to authenticated
  using (vendor_id = public.current_vendor_id())
  with check (vendor_id = public.current_vendor_id());

-- inspections + items
drop policy if exists inspections_manager_all on public.inspections;
create policy inspections_staff_all on public.inspections
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy inspections_board_read on public.inspections
  for select to authenticated
  using (public.is_board_user() and association_id in (select public.current_board_association_ids()));
create policy inspections_resident_read on public.inspections
  for select to authenticated
  using (public.is_portal_resident() and unit_id in (select public.current_resident_unit_ids()));
create policy inspections_vendor_rw on public.inspections
  for all to authenticated
  using (inspector_vendor_id = public.current_vendor_id())
  with check (inspector_vendor_id = public.current_vendor_id());

drop policy if exists inspection_items_manager_all on public.inspection_items;
create policy inspection_items_staff_all on public.inspection_items
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy inspection_items_vendor_rw on public.inspection_items
  for all to authenticated
  using (inspection_id in (select id from public.inspections where inspector_vendor_id = public.current_vendor_id()))
  with check (inspection_id in (select id from public.inspections where inspector_vendor_id = public.current_vendor_id()));

-- violations + updates
drop policy if exists manager_violations_select on public.violations;
drop policy if exists manager_violations_insert on public.violations;
drop policy if exists manager_violations_update on public.violations;
drop policy if exists manager_violations_delete on public.violations;
drop policy if exists board_violations_select on public.violations;
drop policy if exists owner_violations_select on public.violations;
drop policy if exists tenant_violations_select on public.violations;
create policy violations_staff_all on public.violations
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy violations_board_read on public.violations
  for select to authenticated
  using (public.is_board_user() and association_id in (select public.current_board_association_ids()));
create policy violations_resident_read on public.violations
  for select to authenticated
  using (public.is_portal_resident() and (owner_id = public.current_owner_id() or unit_id in (select public.current_resident_unit_ids())));

drop policy if exists manager_violation_updates_select on public.violation_updates;
drop policy if exists manager_violation_updates_insert on public.violation_updates;
drop policy if exists board_violation_updates_select on public.violation_updates;
create policy violation_updates_staff_all on public.violation_updates
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());

-- calendar_events
drop policy if exists calendar_events_manager_all on public.calendar_events;
create policy calendar_events_staff_all on public.calendar_events
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy calendar_events_board_read on public.calendar_events
  for select to authenticated
  using (public.is_board_user() and (association_id is null or association_id in (select public.current_board_association_ids())));
create policy calendar_events_resident_read on public.calendar_events
  for select to authenticated
  using (public.is_portal_resident() and (association_id is null or association_id in (select public.current_resident_association_ids())));

-- -----------------------------------------------------------------------------
-- COMMUNICATION — notices, email_queue, sms, documents, templates, triggers
-- -----------------------------------------------------------------------------

-- notices
drop policy if exists manager_notices_select on public.notices;
drop policy if exists manager_notices_insert on public.notices;
drop policy if exists manager_notices_update on public.notices;
drop policy if exists manager_notices_delete on public.notices;
drop policy if exists board_notices_select on public.notices;
drop policy if exists owner_notices_select on public.notices;
create policy notices_staff_all on public.notices
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy notices_board_read on public.notices
  for select to authenticated
  using (public.is_board_user() and association_id in (select public.current_board_association_ids()) and status <> 'draft');
create policy notices_resident_read on public.notices
  for select to authenticated
  using (
    public.is_portal_resident()
    and status = 'sent'
    and (
      association_id in (select public.current_resident_association_ids())
      or id in (
        select nr.notice_id from public.notice_recipients nr
        where nr.owner_id = public.current_owner_id()
      )
    )
  );

-- notice_recipients
drop policy if exists manager_recipients_select on public.notice_recipients;
drop policy if exists manager_recipients_insert on public.notice_recipients;
create policy notice_recipients_staff_all on public.notice_recipients
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy notice_recipients_resident_read on public.notice_recipients
  for select to authenticated
  using (public.is_portal_resident() and owner_id = public.current_owner_id());

-- email_queue
drop policy if exists email_queue_manager_all on public.email_queue;
create policy email_queue_staff_all on public.email_queue
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());

-- sms_conversations + sms_messages
drop policy if exists sms_conversations_manager_all on public.sms_conversations;
create policy sms_conversations_staff_all on public.sms_conversations
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());

drop policy if exists sms_messages_manager_all on public.sms_messages;
create policy sms_messages_staff_all on public.sms_messages
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());

-- documents
drop policy if exists documents_manager_all on public.documents;
create policy documents_staff_all on public.documents
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy documents_resident_read on public.documents
  for select to authenticated
  using (
    public.is_portal_resident()
    and (
      (entity_type = 'unit' and entity_id in (select public.current_resident_unit_ids()))
      or (entity_type = 'owner' and entity_id = public.current_owner_id())
      or (entity_type = 'association' and entity_id in (select public.current_resident_association_ids()))
    )
  );

-- document_templates + form_templates
drop policy if exists doc_templates_manager_all on public.document_templates;
create policy doc_templates_staff_all on public.document_templates
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());

drop policy if exists form_templates_manager_all on public.form_templates;
create policy form_templates_staff_all on public.form_templates
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());

-- communication_triggers
drop policy if exists comm_triggers_manager_all on public.communication_triggers;
create policy comm_triggers_full_all on public.communication_triggers
  for all to authenticated using (public.is_full_access_staff()) with check (public.is_full_access_staff());
create policy comm_triggers_staff_read on public.communication_triggers
  for select to authenticated using (public.is_staff());

-- -----------------------------------------------------------------------------
-- VENDORS, TAGS, APPROVALS, SURVEYS
-- -----------------------------------------------------------------------------

-- vendors
drop policy if exists vendors_manager_all on public.vendors;
create policy vendors_staff_all on public.vendors
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy vendors_self_read on public.vendors
  for select to authenticated using (id = public.current_vendor_id());
create policy vendors_self_update on public.vendors
  for update to authenticated
  using (id = public.current_vendor_id())
  with check (id = public.current_vendor_id());

-- vendor_compliance
drop policy if exists vendor_compliance_manager_all on public.vendor_compliance;
create policy vendor_compliance_staff_all on public.vendor_compliance
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy vendor_compliance_self_read on public.vendor_compliance
  for select to authenticated using (vendor_id = public.current_vendor_id());
create policy vendor_compliance_self_update on public.vendor_compliance
  for update to authenticated
  using (vendor_id = public.current_vendor_id())
  with check (vendor_id = public.current_vendor_id());

-- tags + tag_assignments
drop policy if exists tags_manager_all on public.tags;
create policy tags_staff_all on public.tags
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());

drop policy if exists tag_assignments_manager_all on public.tag_assignments;
create policy tag_assignments_staff_all on public.tag_assignments
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());

-- approval_requests
drop policy if exists approval_requests_manager_all on public.approval_requests;
create policy approval_requests_staff_all on public.approval_requests
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy approval_requests_board_read on public.approval_requests
  for select to authenticated
  using (public.is_board_user() and association_id in (select public.current_board_association_ids()));
create policy approval_requests_resident_read on public.approval_requests
  for select to authenticated
  using (public.is_portal_resident() and (homeowner_id = public.current_owner_id() or unit_id in (select public.current_resident_unit_ids())));
create policy approval_requests_resident_insert on public.approval_requests
  for insert to authenticated
  with check (public.is_portal_resident() and homeowner_id = public.current_owner_id());
create policy approval_requests_vendor_read on public.approval_requests
  for select to authenticated using (vendor_id = public.current_vendor_id());

-- surveys + survey_responses
drop policy if exists surveys_manager_all on public.surveys;
create policy surveys_staff_all on public.surveys
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy surveys_resident_read on public.surveys
  for select to authenticated using (public.is_portal_resident() and active);

drop policy if exists survey_responses_manager_all on public.survey_responses;
create policy survey_responses_staff_all on public.survey_responses
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy survey_responses_resident_insert on public.survey_responses
  for insert to authenticated
  with check (public.is_portal_resident() and submitted_by_owner_id = public.current_owner_id());
create policy survey_responses_resident_read on public.survey_responses
  for select to authenticated
  using (public.is_portal_resident() and submitted_by_owner_id = public.current_owner_id());

-- -----------------------------------------------------------------------------
-- REPORTING — definitions readable by all staff; runs/saved/snapshots staff-only
-- -----------------------------------------------------------------------------

drop policy if exists report_defs_manager_all on public.report_definitions;
create policy report_defs_full_all on public.report_definitions
  for all to authenticated using (public.is_full_access_staff()) with check (public.is_full_access_staff());
-- report_defs_authenticated_read already exists (everyone reads definitions)

drop policy if exists saved_reports_manager_all on public.saved_reports;
drop policy if exists saved_reports_own_read on public.saved_reports;
create policy saved_reports_staff_all on public.saved_reports
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy saved_reports_own on public.saved_reports
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists scheduled_reports_manager_all on public.scheduled_reports;
create policy scheduled_reports_staff_all on public.scheduled_reports
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());

drop policy if exists report_runs_manager_all on public.report_runs;
create policy report_runs_staff_all on public.report_runs
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());

drop policy if exists manager_report_snapshots_all on public.report_snapshots;
drop policy if exists board_report_snapshots_select on public.report_snapshots;
create policy report_snapshots_staff_all on public.report_snapshots
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy report_snapshots_board_read on public.report_snapshots
  for select to authenticated
  using (public.is_board_user() and association_id in (select public.current_board_association_ids()));

-- -----------------------------------------------------------------------------
-- GOVERNANCE — ballots + votes
-- -----------------------------------------------------------------------------

drop policy if exists manager_ballots_all on public.ballots;
drop policy if exists board_ballots_read on public.ballots;
drop policy if exists owner_ballots_read on public.ballots;
create policy ballots_staff_all on public.ballots
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy ballots_board_read on public.ballots
  for select to authenticated
  using (public.is_board_user() and association_id in (select public.current_board_association_ids()));
create policy ballots_resident_read on public.ballots
  for select to authenticated
  using (public.is_portal_resident() and status in ('open','closed') and association_id in (select public.current_resident_association_ids()));

drop policy if exists manager_votes_all on public.votes;
drop policy if exists owner_votes_insert on public.votes;
drop policy if exists owner_votes_read on public.votes;
create policy votes_staff_all on public.votes
  for all to authenticated using (public.is_any_staff()) with check (public.is_any_staff());
create policy votes_resident_insert on public.votes
  for insert to authenticated
  with check (public.is_portal_resident() and owner_id = public.current_owner_id());
create policy votes_resident_read on public.votes
  for select to authenticated
  using (public.is_portal_resident() and owner_id = public.current_owner_id());

-- -----------------------------------------------------------------------------
-- PROFILES — own access + staff directory read
-- -----------------------------------------------------------------------------

-- profiles_select_own and profiles_update_own already exist; keep them
create policy profiles_staff_read on public.profiles
  for select to authenticated using (public.is_staff());
create policy profiles_full_admin on public.profiles
  for all to authenticated using (public.is_full_access_staff()) with check (public.is_full_access_staff());
;
