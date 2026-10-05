-- Platform operators come in three roles (platform_operators.role):
-- admin, support, readonly. The permissive policies on these tables let ANY
-- active operator write (is_platform_operator()), so a read-only or support
-- operator could change company data: charges, payments, journal entries,
-- owners, bank accounts, API keys, invitations, roles...
--
-- Add a RESTRICTIVE insert/update/delete policy to each: an operator may write
-- only as an admin; support operators may also work support requests
-- (platform_requests and their private notes). Company staff, owners, board,
-- vendors and the service role are unaffected (not operators).
--
-- Left out on purpose: tables an operator writes as part of simply using the
-- app (login_attempts, user_sessions, form_submissions tokens, their own
-- profiles row, report_favorites, saved_report_views) and the impersonation
-- audit log (platform_impersonation_log), whose writes are themselves gated.
--
-- Additive and idempotent: no existing policy is changed or dropped.

create or replace function public.operator_may_write(p_support_ok boolean default false)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select not public.is_platform_operator()
      or public.is_platform_admin()
      or (p_support_ok and exists (
            select 1 from public.platform_operators po
             where po.auth_user_id = auth.uid() and po.active and po.role = 'support'));
$$;
revoke all on function public.operator_may_write(boolean) from public, anon;
grant execute on function public.operator_may_write(boolean) to authenticated;

do $$
declare
  t text;
  support_ok boolean;
begin
  foreach t in array array[
    'agenda_items', 'amenity_reservations', 'api_keys', 'approval_votes', 'architectural_request_messages',
    'architectural_requests', 'assessment_periods', 'association_attachments', 'association_loans',
    'association_managers', 'automation_flow_runs', 'automation_flows', 'automation_tasks', 'bank_accounts',
    'bank_adjustments', 'bank_reconciliation_items', 'bank_reconciliations', 'bank_transactions',
    'bank_transfers', 'calendar_event_reminders', 'capital_project_milestones', 'capital_project_work_orders',
    'capital_projects', 'charges', 'communication_messages', 'data_export_requests', 'delinquency_case_events',
    'delinquency_cases', 'delinquency_policies', 'delinquency_steps', 'document_templates', 'documents',
    'email_queue', 'gl_accounts', 'house_rules', 'inspection_private', 'insurance_policies', 'journal_entries',
    'lock_box_assignments', 'lock_boxes', 'maintenance_task_history', 'maintenance_task_private',
    'maintenance_tasks', 'maintenance_template_groups', 'maintenance_templates', 'meeting_action_items',
    'meeting_attendees', 'meeting_documents', 'meetings', 'message_templates', 'owner_financial_details',
    'owner_payables', 'owner_private', 'owner_statements', 'owners', 'parking_assignments', 'parking_spaces',
    'payable_bills', 'payable_checks', 'payment_intents', 'payment_private', 'payments', 'payout_batches',
    'physical_mail_deliveries', 'plaid_items', 'platform_request_private', 'platform_requests',
    'portfolio_settings', 'privacy_actions', 'reminder_settings', 'report_definitions', 'scheduled_reports',
    'sms_opt_ins', 'statement_batches', 'statements', 'subscription_events', 'tenant_private', 'tenants',
    'unit_pets', 'usage_metrics', 'user_invitations', 'user_roles', 'vendor_financial_details',
    'violation_cases', 'webhook_deliveries', 'webhook_endpoints', 'work_order_messages',
    'work_order_vendor_private'
  ]
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    support_ok := t in ('platform_requests', 'platform_request_private');

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'operator_writes_need_admin_insert') then
      execute format('create policy operator_writes_need_admin_insert on public.%I as restrictive for insert to authenticated with check (public.operator_may_write(%L))', t, support_ok);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'operator_writes_need_admin_update') then
      execute format('create policy operator_writes_need_admin_update on public.%I as restrictive for update to authenticated using (public.operator_may_write(%L)) with check (public.operator_may_write(%L))', t, support_ok, support_ok);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'operator_writes_need_admin_delete') then
      execute format('create policy operator_writes_need_admin_delete on public.%I as restrictive for delete to authenticated using (public.operator_may_write(%L))', t, support_ok);
    end if;
  end loop;
end $$;
