-- New system report definitions
insert into report_definitions (portfolio_id, slug, name, category, description, output_formats, is_system, active) values
(null,'chart_of_accounts','Chart of Accounts','accounting','All GL accounts with type, fund and status.',array['pdf','csv']::report_format[],true,true),
(null,'bank_account_directory','Bank Account Directory','accounting','Bank accounts with institution, type and linked association.',array['pdf','csv']::report_format[],true,true),
(null,'bank_account_association','Bank Account Association','accounting','Which bank accounts belong to which association.',array['pdf','csv']::report_format[],true,true),
(null,'income_statement_date_range','Income Statement (Date Range)','accounting','Income statement for an arbitrary date range.',array['pdf','csv']::report_format[],true,true),
(null,'dues_roll_itemized','Dues Roll (Itemized)','association','Dues roll broken out by charge item per unit.',array['pdf','csv']::report_format[],true,true),
(null,'fund_balance_sheet_active_funds','Fund Balance Sheet (Active Funds)','accounting','Balance sheet limited to funds with activity.',array['pdf','csv']::report_format[],true,true),
(null,'fund_income_statement','Fund Income Statement','accounting','Income statement by fund.',array['pdf','csv']::report_format[],true,true),
(null,'delinquency_as_of','Homeowner Delinquency (As Of)','association','Delinquent balances as of a chosen date.',array['pdf','csv']::report_format[],true,true),
(null,'homeowner_resale','Homeowner Resale Report','association','Resale data per unit.',array['pdf','csv']::report_format[],true,true),
(null,'vendor_ledger','Vendor Ledger','accounting','Bills and payments per vendor.',array['pdf','csv']::report_format[],true,true),
(null,'owner_insurance_audit','Owner Insurance Audit','compliance','Owner insurance status per unit.',array['pdf','csv']::report_format[],true,true),
(null,'activities_summary','Activities Summary','communication','Calendar events in the period.',array['pdf','csv']::report_format[],true,true),
(null,'additional_fees','Additional Fees','association','Additional fee schedules per association.',array['pdf','csv']::report_format[],true,true),
(null,'budget_detail','Budget Detail','accounting','Budget lines by GL account.',array['pdf','csv']::report_format[],true,true),
(null,'fixed_assets','Fixed Assets','accounting','Fixed asset register with depreciation.',array['pdf','csv']::report_format[],true,true),
(null,'property_group_directory','Property Group Directory','property_unit','Property groups with counts.',array['pdf','csv']::report_format[],true,true),
(null,'property_performance','Property Performance','association','Income, expenses and NOI per association.',array['pdf','csv']::report_format[],true,true)
on conflict (slug) do nothing;

-- Security views: run with caller rights
alter view public.v_due_reminders set (security_invoker = true);
alter view public.v_role_permissions set (security_invoker = true);
alter view public.v_unit_charge_schedule set (security_invoker = true);
alter view public.v_upcoming_expirations set (security_invoker = true);
alter view public.v_upcoming_maintenance set (security_invoker = true);
alter view public.v_company_health set (security_invoker = true);
alter view public.v_company_metrics set (security_invoker = true);
alter view public.v_manager_workload set (security_invoker = true);

-- Trigger functions do not need anon EXECUTE
revoke execute on function public.audit_inspection_finding_lifecycle() from public, anon;
revoke execute on function public.audit_sms_consent() from public, anon;
revoke execute on function public.enforce_capital_project_scope() from public, anon;
revoke execute on function public.enforce_capital_project_work_order_scope() from public, anon;
revoke execute on function public.enforce_delinquency_scope() from public, anon;
revoke execute on function public.enforce_gl_use_permission() from public, anon;
revoke execute on function public.enforce_physical_mail_scope() from public, anon;
revoke execute on function public.guard_capital_project_governance() from public, anon;
revoke execute on function public.guard_delinquency_legal_transition() from public, anon;
revoke execute on function public.guard_sms_consent() from public, anon;
