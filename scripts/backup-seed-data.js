// One-shot backup of all public-schema table data via the Supabase service role.
// Writes a single timestamped JSON file under ./backups/ so the pre-cleanup
// dataset can be restored if needed. Schema itself lives in supabase/migrations.
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env.local');
const env = {};
for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
  const t = line.trim();
  if (t && !t.startsWith('#') && t.includes('=')) {
    const [k, ...rest] = t.split('=');
    env[k.trim()] = rest.join('=').trim();
  }
}

const TABLES = [
  'accounting_periods','activity','agenda_items','agents','amenity_tags','api_keys','approval_requests',
  'approval_votes','architectural_review_settings','assessment_periods','association_additional_fees',
  'association_amenities','association_assignments','association_attachments','association_keys',
  'association_lease_template_settings','association_managers','association_notes','association_renewal_options',
  'associations','audit_logs','automation_tasks','autopay_mandates','ballots','bank_account_owners',
  'bank_accounts','bank_adjustments','bank_reconciliation_items','bank_reconciliations','bank_transactions',
  'bank_transfers','billing_usage','board_approval_settings','board_comments','board_members','bookings',
  'budget_lines','buildings','calendar_event_reminders','calendar_events','charge_categories','charges',
  'committee_members','committees','communication_messages','communication_triggers','communications_log',
  'companies','company_settings','data_diagnostics','data_export_requests','depreciation_entries',
  'diagnostic_flags','document_requests','document_templates','documents','dues_increase_lines','dues_increases',
  'email_connections','email_queue','email_threads','feature_entitlements','fixed_assets','form_templates',
  'gl_account_role_permissions','gl_accounts','house_rules','income_recertifications','inspection_items',
  'inspections','insurance_policies','inventory_items','invitations','invoices','journal_entries',
  'journal_entry_batches','journal_entry_lines','journal_lines','lead_messages','leads','lock_box_assignments',
  'lock_boxes','lockbox_batches','lockbox_items','login_attempts','maintenance_task_history','maintenance_tasks',
  'maintenance_template_groups','maintenance_templates','management_agreements','management_fee_policies',
  'management_fee_schedules','management_fees','marketing_leads','meeting_action_items','meeting_attendees',
  'meeting_documents','meetings','message_templates','notice_recipients','notices','occupancies','owner_accounts',
  'owner_ach_status','owner_form_submissions','owner_messages','owner_notification_prefs','owner_notifications',
  'owner_packets','owner_payables','owner_portal_invites','owner_statements','owners','parking_assignments',
  'parking_spaces','payable_bill_line_items','payable_bills','payment_applications','payment_intents',
  'payment_methods','payment_processor_configs','payment_transactions','payments','permission_audit_log',
  'plaid_items','platform_impersonation_log','platform_operators','platform_requests','portfolio_settings',
  'portfolios','privacy_actions','profiles','properties','property_assignments','property_documents',
  'property_groups','provider_availability','provider_services','providers','purchase_order_line_items',
  'purchase_orders','recent_activity','recurring_bills','recurring_journal_entries','recurring_work_orders',
  'reminder_settings','report_definitions','report_runs','report_snapshots','saved_reports','schedule_events',
  'scheduled_reports','service_requests','services','shares','sms_conversations','sms_messages','sms_opt_ins',
  'soft_delete_log','statement_batches','statements','subscription_events','subscriptions','superadmin_notes','survey_responses','surveys',
  'tag_assignments','tags','tenancies','tenants','ticket_attachments','ticket_comments','tickets','transactions',
  'unit_amenities','unit_owners','unit_pets','unit_recurring_charges','units','usage_metrics','user_invitations',
  'user_roles','user_sessions','users','vendor_compliance','vendors','violation_cases','violation_followup_steps',
  'violation_updates','violations','votes','webhook_deliveries','webhook_endpoints','work_order_estimates',
  'work_order_labor_entries','work_order_updates','work_orders','workflows',
];

async function main() {
  const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY'], {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const dump = { _meta: { taken_at: new Date().toISOString(), table_count: TABLES.length } };
  let totalRows = 0;
  const errors = [];

  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select('*');
    if (error) { errors.push(`${table}: ${error.message}`); dump[table] = { _error: error.message }; continue; }
    dump[table] = data;
    totalRows += data.length;
    if (data.length) console.log(`  ${table}: ${data.length}`);
  }

  const dir = path.resolve(__dirname, '..', 'backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `seed-backup-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(dump, null, 2));

  console.log(`\nBackup written: ${file}`);
  console.log(`Total rows: ${totalRows} across ${TABLES.length} tables`);
  if (errors.length) console.log(`\nNon-fatal errors (${errors.length}):\n  ${errors.join('\n  ')}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
