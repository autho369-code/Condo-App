-- Board portal scope (owner directive): the board is a READ-ONLY view of basic
-- financials, meeting minutes and governing documents. It must never see
-- vendors, owners, owner notes or operational records, and must never change
-- anything.
--
-- Only the board-specific grants are switched off (USING/WITH CHECK false).
-- Owner, tenant and staff policies are untouched, so a board member who is
-- also an owner keeps their own owner-portal access.
--
-- Kept for the board: associations, buildings, units, charges, payments,
-- payment_applications (aggregate receivables), journal entries/lines,
-- gl_accounts, bank_accounts, assessment periods, statements, report
-- snapshots, year-end packages, budgets, meetings / agenda / attendees /
-- action items / meeting documents, documents, house rules, board members.

-- Reads the board no longer has.
alter policy owners_board_read on public.owners using (false);
alter policy unit_owners_board_read on public.unit_owners using (false);
alter policy occupancies_board_read on public.occupancies using (false);
alter policy tenants_board_read on public.tenants using (false);
alter policy vendors_board_read on public.vendors using (false);
alter policy payable_bills_board_read on public.payable_bills using (false);
alter policy work_orders_board_read on public.work_orders using (false);
alter policy wo_msg_board_select on public.work_order_messages using (false);
alter policy service_requests_board_read on public.service_requests using (false);
alter policy maintenance_tasks_board_read on public.maintenance_tasks using (false);
alter policy inspections_board_read on public.inspections using (false);
alter policy violations_board_read on public.violations using (false);
alter policy violation_fines_board_read on public.violation_fines using (false);
alter policy violation_followup_steps_board_read on public.violation_followup_steps using (false);
alter policy association_violation_settings_board_read on public.association_violation_settings using (false);
alter policy arch_req_board_select on public.architectural_requests using (false);
alter policy arch_msg_board_select on public.architectural_request_messages using (false);
alter policy board_comments_board_read on public.board_comments using (false);
alter policy board_view_comments on public.board_comments using (false);
alter policy approval_requests_board_read on public.approval_requests using (false);
alter policy ballots_board_read on public.ballots using (false);
alter policy delinquency_cases_board_read on public.delinquency_cases using (false);
alter policy delinquency_events_board_read on public.delinquency_case_events using (false);
alter policy capital_projects_board_read on public.capital_projects using (false);
alter policy capital_project_milestones_board_read on public.capital_project_milestones using (false);
alter policy capital_project_work_orders_board_read on public.capital_project_work_orders using (false);
alter policy association_insurance_board_read on public.association_insurance_policies using (false);
alter policy insurance_board_association_read on public.insurance_policies using (false);
alter policy calendar_events_board_read on public.calendar_events using (false);
alter policy communications_board_read on public.communications_log using (false);
alter policy notices_board_read on public.notices using (false);
alter policy amenity_res_board_select on public.amenity_reservations using (false);
alter policy fixed_assets_board_read on public.fixed_assets using (false);
alter policy meeting_private_board_read on public.meeting_private using (false);

-- Writes the board no longer has.
alter policy arch_msg_board_insert on public.architectural_request_messages with check (false);
alter policy wo_msg_board_insert on public.work_order_messages with check (false);
alter policy board_insert_comments on public.board_comments with check (false);

-- Board-only write RPCs (voting on approvals, deciding architectural requests).
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('cast_board_approval', 'board_decide_architectural_request')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;
