


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."activity_type" AS ENUM (
    'transaction_created',
    'report_run',
    'invoice_processed',
    'user_invited',
    'property_updated',
    'bill_approved',
    'diagnostic_resolved',
    'file_updated'
);


ALTER TYPE "public"."activity_type" OWNER TO "postgres";


CREATE TYPE "public"."agreement_status" AS ENUM (
    'draft',
    'active',
    'expired',
    'terminated',
    'renewing'
);


ALTER TYPE "public"."agreement_status" OWNER TO "postgres";


CREATE TYPE "public"."ai_category" AS ENUM (
    'maintenance_request',
    'billing_payment',
    'noise_complaint',
    'amenity_booking',
    'vendor_communication',
    'board_matter',
    'emergency',
    'general_inquiry',
    'lease_ownership',
    'other'
);


ALTER TYPE "public"."ai_category" OWNER TO "postgres";


CREATE TYPE "public"."ai_urgency" AS ENUM (
    'critical',
    'high',
    'medium',
    'low'
);


ALTER TYPE "public"."ai_urgency" OWNER TO "postgres";


CREATE TYPE "public"."amenity_pricing_mode" AS ENUM (
    'flat',
    'hourly'
);


ALTER TYPE "public"."amenity_pricing_mode" OWNER TO "postgres";


CREATE TYPE "public"."amenity_reserve_method" AS ENUM (
    'email',
    'platform_link'
);


ALTER TYPE "public"."amenity_reserve_method" OWNER TO "postgres";


CREATE TYPE "public"."approval_request_status" AS ENUM (
    'pending',
    'approved',
    'rejected',
    'cancelled'
);


ALTER TYPE "public"."approval_request_status" OWNER TO "postgres";


CREATE TYPE "public"."approval_vote_choice" AS ENUM (
    'yes',
    'no',
    'abstain'
);


ALTER TYPE "public"."approval_vote_choice" OWNER TO "postgres";


CREATE TYPE "public"."asset_status" AS ENUM (
    'active',
    'disposed',
    'sold',
    'fully_depreciated'
);


ALTER TYPE "public"."asset_status" OWNER TO "postgres";


CREATE TYPE "public"."autopay_frequency" AS ENUM (
    'monthly',
    'quarterly',
    'annually',
    'on_charge_posted'
);


ALTER TYPE "public"."autopay_frequency" OWNER TO "postgres";


CREATE TYPE "public"."autopay_status" AS ENUM (
    'pending_verification',
    'active',
    'paused',
    'canceled',
    'failed'
);


ALTER TYPE "public"."autopay_status" OWNER TO "postgres";


CREATE TYPE "public"."bank_account_purpose" AS ENUM (
    'operating',
    'reserve',
    'special_assessment',
    'trust',
    'other'
);


ALTER TYPE "public"."bank_account_purpose" OWNER TO "postgres";


CREATE TYPE "public"."bank_account_type" AS ENUM (
    'checking',
    'savings',
    'money_market'
);


ALTER TYPE "public"."bank_account_type" OWNER TO "postgres";


CREATE TYPE "public"."board_role" AS ENUM (
    'president',
    'vice_president',
    'secretary',
    'treasurer',
    'director'
);


ALTER TYPE "public"."board_role" OWNER TO "postgres";


CREATE TYPE "public"."budget_category" AS ENUM (
    'income',
    'expense'
);


ALTER TYPE "public"."budget_category" OWNER TO "postgres";


CREATE TYPE "public"."calendar_event_status" AS ENUM (
    'draft',
    'scheduled',
    'notice_sent',
    'reminder_sent',
    'completed',
    'canceled',
    'awaiting_confirmation',
    'failed_notification'
);


ALTER TYPE "public"."calendar_event_status" OWNER TO "postgres";


CREATE TYPE "public"."calendar_event_type" AS ENUM (
    'board_meeting',
    'annual_meeting_election',
    'vendor_service',
    'elevator_reservation',
    'move_in_move_out',
    'water_shutoff',
    'pest_control',
    'landscaping',
    'inspection',
    'insurance_expiration',
    'contract_renewal',
    'assessment_deadline',
    'custom_event'
);


ALTER TYPE "public"."calendar_event_type" OWNER TO "postgres";


CREATE TYPE "public"."calendar_scope" AS ENUM (
    'daily',
    'annual'
);


ALTER TYPE "public"."calendar_scope" OWNER TO "postgres";


CREATE TYPE "public"."charge_type" AS ENUM (
    'assessment',
    'late_fee',
    'nsf_fee',
    'fine',
    'special_assessment',
    'move_fee',
    'amenity_fee',
    'other'
);


ALTER TYPE "public"."charge_type" OWNER TO "postgres";


CREATE TYPE "public"."communication_channel" AS ENUM (
    'email',
    'sms',
    'letter',
    'portal'
);


ALTER TYPE "public"."communication_channel" OWNER TO "postgres";


CREATE TYPE "public"."communication_status" AS ENUM (
    'draft',
    'queued',
    'sent',
    'failed',
    'canceled'
);


ALTER TYPE "public"."communication_status" OWNER TO "postgres";


CREATE TYPE "public"."convenience_fee_mode" AS ENUM (
    'absorb',
    'pass_through',
    'split',
    'flat_addon'
);


ALTER TYPE "public"."convenience_fee_mode" OWNER TO "postgres";


CREATE TYPE "public"."depreciation_method" AS ENUM (
    'straight_line',
    'declining_balance',
    'sum_of_years_digits',
    'units_of_production',
    'none'
);


ALTER TYPE "public"."depreciation_method" OWNER TO "postgres";


CREATE TYPE "public"."diagnostic_severity" AS ENUM (
    'info',
    'warning',
    'error'
);


ALTER TYPE "public"."diagnostic_severity" OWNER TO "postgres";


CREATE TYPE "public"."document_category" AS ENUM (
    'governing_documents',
    'meeting_minutes',
    'financial_reports',
    'insurance',
    'contracts',
    'notices',
    'forms',
    'other'
);


ALTER TYPE "public"."document_category" OWNER TO "postgres";


CREATE TYPE "public"."document_request_status" AS ENUM (
    'requested',
    'in_progress',
    'submitted',
    'approved',
    'rejected',
    'expired'
);


ALTER TYPE "public"."document_request_status" OWNER TO "postgres";


CREATE TYPE "public"."dues_increase_status" AS ENUM (
    'draft',
    'scheduled',
    'posted',
    'cancelled'
);


ALTER TYPE "public"."dues_increase_status" OWNER TO "postgres";


CREATE TYPE "public"."email_provider" AS ENUM (
    'gmail',
    'outlook'
);


ALTER TYPE "public"."email_provider" OWNER TO "postgres";


CREATE TYPE "public"."email_source" AS ENUM (
    'gmail',
    'outlook',
    'manual'
);


ALTER TYPE "public"."email_source" OWNER TO "postgres";


CREATE TYPE "public"."event_type" AS ENUM (
    'administrative',
    'announcements',
    'maintenance',
    'meetings',
    'social_events',
    'other',
    'elevator_reservation',
    'move_in',
    'move_out',
    'water_shutoff',
    'vendor_work',
    'common_area_reservation',
    'board_meeting',
    'inspection',
    'annual_meeting_election',
    'vendor_service',
    'move_in_move_out',
    'pest_control',
    'landscaping',
    'insurance_expiration',
    'contract_renewal',
    'assessment_deadline',
    'custom_event'
);


ALTER TYPE "public"."event_type" OWNER TO "postgres";


CREATE TYPE "public"."export_scope" AS ENUM (
    'portfolio_full',
    'portfolio_finance',
    'user_data'
);


ALTER TYPE "public"."export_scope" OWNER TO "postgres";


CREATE TYPE "public"."export_status" AS ENUM (
    'pending',
    'running',
    'ready',
    'failed',
    'expired'
);


ALTER TYPE "public"."export_status" OWNER TO "postgres";


CREATE TYPE "public"."frequency" AS ENUM (
    'daily',
    'weekly',
    'monthly',
    'quarterly'
);


ALTER TYPE "public"."frequency" OWNER TO "postgres";


CREATE TYPE "public"."gl_account_type" AS ENUM (
    'asset',
    'liability',
    'equity',
    'income',
    'expense',
    'cost_of_goods_sold',
    'other_income',
    'other_expense',
    'non_operating',
    'cash',
    'accounts_receivable',
    'accounts_payable',
    'fixed_asset'
);


ALTER TYPE "public"."gl_account_type" OWNER TO "postgres";


CREATE TYPE "public"."gl_fund_account" AS ENUM (
    'operating',
    'reserve',
    'special_assessment'
);


ALTER TYPE "public"."gl_fund_account" OWNER TO "postgres";


CREATE TYPE "public"."gl_permission" AS ENUM (
    'full',
    'read',
    'none'
);


ALTER TYPE "public"."gl_permission" OWNER TO "postgres";


CREATE TYPE "public"."hoa_role" AS ENUM (
    'manager',
    'board',
    'owner',
    'tenant',
    'company_admin'
);


ALTER TYPE "public"."hoa_role" OWNER TO "postgres";


CREATE TYPE "public"."inspection_severity" AS ENUM (
    'info',
    'minor',
    'moderate',
    'major',
    'critical'
);


ALTER TYPE "public"."inspection_severity" OWNER TO "postgres";


CREATE TYPE "public"."inspection_status" AS ENUM (
    'scheduled',
    'in_progress',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."inspection_status" OWNER TO "postgres";


CREATE TYPE "public"."invitation_role" AS ENUM (
    'super_admin',
    'company_admin',
    'portfolio_manager',
    'manager',
    'accountant',
    'assistant',
    'board_member'
);


ALTER TYPE "public"."invitation_role" OWNER TO "postgres";


CREATE TYPE "public"."invitation_status" AS ENUM (
    'pending',
    'accepted',
    'revoked',
    'expired'
);


ALTER TYPE "public"."invitation_status" OWNER TO "postgres";


CREATE TYPE "public"."je_batch_status" AS ENUM (
    'draft',
    'validating',
    'validated',
    'posted',
    'failed'
);


ALTER TYPE "public"."je_batch_status" OWNER TO "postgres";


CREATE TYPE "public"."lease_generation_method" AS ENUM (
    'appfolio_lease_templates',
    'pdf_form_templates'
);


ALTER TYPE "public"."lease_generation_method" OWNER TO "postgres";


CREATE TYPE "public"."lease_template_slot" AS ENUM (
    'new_lease',
    'renewal',
    'renewal_month_to_month'
);


ALTER TYPE "public"."lease_template_slot" OWNER TO "postgres";


CREATE TYPE "public"."lock_box_location_type" AS ENUM (
    'building',
    'unit',
    'gate',
    'entrance',
    'pool',
    'other'
);


ALTER TYPE "public"."lock_box_location_type" OWNER TO "postgres";


CREATE TYPE "public"."lock_box_status" AS ENUM (
    'active',
    'inactive',
    'lost',
    'retired'
);


ALTER TYPE "public"."lock_box_status" OWNER TO "postgres";


CREATE TYPE "public"."lockbox_batch_status" AS ENUM (
    'received',
    'processing',
    'deposited',
    'reconciled',
    'rejected'
);


ALTER TYPE "public"."lockbox_batch_status" OWNER TO "postgres";


CREATE TYPE "public"."management_fee_type" AS ENUM (
    'per_unit',
    'flat_monthly',
    'percentage_of_income'
);


ALTER TYPE "public"."management_fee_type" OWNER TO "postgres";


CREATE TYPE "public"."meeting_status" AS ENUM (
    'scheduled',
    'in_progress',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."meeting_status" OWNER TO "postgres";


CREATE TYPE "public"."meeting_type" AS ENUM (
    'board_meeting',
    'annual_meeting',
    'special_meeting',
    'committee_meeting',
    'executive_session'
);


ALTER TYPE "public"."meeting_type" OWNER TO "postgres";


CREATE TYPE "public"."message_channel" AS ENUM (
    'in_app',
    'email',
    'text'
);


ALTER TYPE "public"."message_channel" OWNER TO "postgres";


CREATE TYPE "public"."message_direction" AS ENUM (
    'owner_to_manager',
    'manager_to_owner'
);


ALTER TYPE "public"."message_direction" OWNER TO "postgres";


CREATE TYPE "public"."mvp_company_role" AS ENUM (
    'company_admin',
    'manager',
    'assistant_manager',
    'accountant'
);


ALTER TYPE "public"."mvp_company_role" OWNER TO "postgres";


COMMENT ON TYPE "public"."mvp_company_role" IS 'Company-level staff roles. company_admin & accountant see all associations in the portfolio. manager & assistant_manager see only associations assigned via association_managers (assistant_manager has read-only enforcement at the application layer).';



CREATE TYPE "public"."notice_status" AS ENUM (
    'draft',
    'sent',
    'archived'
);


ALTER TYPE "public"."notice_status" OWNER TO "postgres";


CREATE TYPE "public"."notice_type" AS ENUM (
    'general',
    'violation',
    'meeting',
    'payment_reminder',
    'maintenance_update',
    'annual_meeting',
    'board_packet',
    'emergency',
    'other'
);


ALTER TYPE "public"."notice_type" OWNER TO "postgres";


CREATE TYPE "public"."notification_type" AS ENUM (
    'document_shared',
    'payment_due',
    'message_received',
    'ticket_update',
    'general'
);


ALTER TYPE "public"."notification_type" OWNER TO "postgres";


CREATE TYPE "public"."occupancy_status" AS ENUM (
    'current',
    'future',
    'past'
);


ALTER TYPE "public"."occupancy_status" OWNER TO "postgres";


CREATE TYPE "public"."occupancy_type" AS ENUM (
    'owner',
    'tenant'
);


ALTER TYPE "public"."occupancy_type" OWNER TO "postgres";


CREATE TYPE "public"."owner_payable_type" AS ENUM (
    'refund',
    'settlement',
    'distribution',
    'other'
);


ALTER TYPE "public"."owner_payable_type" OWNER TO "postgres";


CREATE TYPE "public"."payable_bill_status" AS ENUM (
    'draft',
    'pending_approval',
    'approved',
    'paid',
    'void'
);


ALTER TYPE "public"."payable_bill_status" OWNER TO "postgres";


CREATE TYPE "public"."payment_method" AS ENUM (
    'ach',
    'check',
    'credit_card',
    'cash',
    'other'
);


ALTER TYPE "public"."payment_method" OWNER TO "postgres";


CREATE TYPE "public"."payment_method_type" AS ENUM (
    'bank_account_ach',
    'bank_account_echeck',
    'card_credit',
    'card_debit',
    'paypal',
    'apple_pay',
    'google_pay'
);


ALTER TYPE "public"."payment_method_type" OWNER TO "postgres";


CREATE TYPE "public"."payment_processor" AS ENUM (
    'stripe',
    'dwolla',
    'modern_treasury',
    'gocardless',
    'square',
    'paypal',
    'manual'
);


ALTER TYPE "public"."payment_processor" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'pending',
    'confirmed',
    'failed',
    'refunded'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."payment_type" AS ENUM (
    'payment',
    'charge',
    'credit',
    'refund'
);


ALTER TYPE "public"."payment_type" OWNER TO "postgres";


CREATE TYPE "public"."period_status" AS ENUM (
    'open',
    'soft_closed',
    'closed'
);


ALTER TYPE "public"."period_status" OWNER TO "postgres";


CREATE TYPE "public"."portfolio_profile_type" AS ENUM (
    'association_management',
    'property_management'
);


ALTER TYPE "public"."portfolio_profile_type" OWNER TO "postgres";


CREATE TYPE "public"."portfolio_tier" AS ENUM (
    'foundation',
    'growth',
    'portfolio',
    'enterprise'
);


ALTER TYPE "public"."portfolio_tier" OWNER TO "postgres";


CREATE TYPE "public"."portier_role" AS ENUM (
    'super_admin',
    'company_admin',
    'portfolio_manager',
    'property_manager',
    'accountant',
    'assistant_manager',
    'owner',
    'vendor',
    'resident',
    'user'
);


ALTER TYPE "public"."portier_role" OWNER TO "postgres";


CREATE TYPE "public"."privacy_action_status" AS ENUM (
    'received',
    'verified',
    'in_progress',
    'completed',
    'rejected',
    'partially_completed'
);


ALTER TYPE "public"."privacy_action_status" OWNER TO "postgres";


CREATE TYPE "public"."privacy_action_type" AS ENUM (
    'data_export',
    'data_deletion',
    'anonymization',
    'access_report',
    'consent_withdrawal'
);


ALTER TYPE "public"."privacy_action_type" OWNER TO "postgres";


CREATE TYPE "public"."property_status" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "public"."property_status" OWNER TO "postgres";


CREATE TYPE "public"."property_type" AS ENUM (
    'hoa',
    'condo',
    'commercial',
    'residential'
);


ALTER TYPE "public"."property_type" OWNER TO "postgres";


CREATE TYPE "public"."purchase_order_status" AS ENUM (
    'open',
    'approved',
    'billed',
    'cancelled'
);


ALTER TYPE "public"."purchase_order_status" OWNER TO "postgres";


CREATE TYPE "public"."recert_status" AS ENUM (
    'scheduled',
    'in_progress',
    'submitted',
    'approved',
    'rejected',
    'overdue'
);


ALTER TYPE "public"."recert_status" OWNER TO "postgres";


CREATE TYPE "public"."recurring_frequency" AS ENUM (
    'daily',
    'weekly',
    'monthly',
    'quarterly',
    'annually'
);


ALTER TYPE "public"."recurring_frequency" OWNER TO "postgres";


CREATE TYPE "public"."rent_change_kind" AS ENUM (
    'dollar_amount',
    'percentage'
);


ALTER TYPE "public"."rent_change_kind" OWNER TO "postgres";


CREATE TYPE "public"."report_category" AS ENUM (
    'association',
    'accounting',
    'property_unit',
    'maintenance',
    'people',
    'communication',
    'compliance'
);


ALTER TYPE "public"."report_category" OWNER TO "postgres";


CREATE TYPE "public"."report_delivery_channel" AS ENUM (
    'email',
    'portal',
    'webhook',
    'download_only'
);


ALTER TYPE "public"."report_delivery_channel" OWNER TO "postgres";


CREATE TYPE "public"."report_format" AS ENUM (
    'pdf',
    'xlsx',
    'csv',
    'json',
    'html'
);


ALTER TYPE "public"."report_format" OWNER TO "postgres";


CREATE TYPE "public"."report_run_status" AS ENUM (
    'queued',
    'running',
    'succeeded',
    'failed',
    'cancelled'
);


ALTER TYPE "public"."report_run_status" OWNER TO "postgres";


CREATE TYPE "public"."schedule_frequency" AS ENUM (
    'daily',
    'weekly',
    'biweekly',
    'monthly',
    'quarterly',
    'annually'
);


ALTER TYPE "public"."schedule_frequency" OWNER TO "postgres";


CREATE TYPE "public"."service_request_priority" AS ENUM (
    'low',
    'normal',
    'high',
    'emergency'
);


ALTER TYPE "public"."service_request_priority" OWNER TO "postgres";


CREATE TYPE "public"."service_request_source" AS ENUM (
    'resident',
    'internal',
    'recurring'
);


ALTER TYPE "public"."service_request_source" OWNER TO "postgres";


CREATE TYPE "public"."service_request_status" AS ENUM (
    'open',
    'completed',
    'cancelled',
    'waiting'
);


ALTER TYPE "public"."service_request_status" OWNER TO "postgres";


CREATE TYPE "public"."severity" AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);


ALTER TYPE "public"."severity" OWNER TO "postgres";


CREATE TYPE "public"."sms_direction" AS ENUM (
    'inbound',
    'outbound'
);


ALTER TYPE "public"."sms_direction" OWNER TO "postgres";


CREATE TYPE "public"."sms_status" AS ENUM (
    'queued',
    'sent',
    'delivered',
    'failed',
    'read',
    'undelivered'
);


ALTER TYPE "public"."sms_status" OWNER TO "postgres";


CREATE TYPE "public"."subscription_status" AS ENUM (
    'trialing',
    'active',
    'past_due',
    'canceled',
    'paused',
    'expired'
);


ALTER TYPE "public"."subscription_status" OWNER TO "postgres";


CREATE TYPE "public"."survey_type" AS ENUM (
    'maintenance',
    'leasing',
    'general'
);


ALTER TYPE "public"."survey_type" OWNER TO "postgres";


CREATE TYPE "public"."tag_entity_type" AS ENUM (
    'association',
    'unit',
    'owner',
    'vendor',
    'work_order',
    'service_request',
    'bill',
    'payment',
    'charge',
    'violation',
    'document',
    'inspection',
    'calendar_event'
);


ALTER TYPE "public"."tag_entity_type" OWNER TO "postgres";


CREATE TYPE "public"."template_category" AS ENUM (
    'association',
    'owner',
    'vendor',
    'applicant',
    'statement',
    'generic'
);


ALTER TYPE "public"."template_category" OWNER TO "postgres";


CREATE TYPE "public"."ticket_category" AS ENUM (
    'common_area',
    'unit_related',
    'emergency',
    'vendor',
    'board_matter',
    'maintenance',
    'other'
);


ALTER TYPE "public"."ticket_category" OWNER TO "postgres";


CREATE TYPE "public"."ticket_priority" AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);


ALTER TYPE "public"."ticket_priority" OWNER TO "postgres";


CREATE TYPE "public"."ticket_source" AS ENUM (
    'portal',
    'email',
    'phone',
    'manager',
    'system'
);


ALTER TYPE "public"."ticket_source" OWNER TO "postgres";


CREATE TYPE "public"."ticket_status" AS ENUM (
    'open',
    'in_progress',
    'pending_vendor',
    'resolved',
    'closed'
);


ALTER TYPE "public"."ticket_status" OWNER TO "postgres";


CREATE TYPE "public"."tier" AS ENUM (
    'starter',
    'growth',
    'professional',
    'enterprise'
);


ALTER TYPE "public"."tier" OWNER TO "postgres";


CREATE TYPE "public"."transaction_status" AS ENUM (
    'pending',
    'approved',
    'paid',
    'void',
    'posted'
);


ALTER TYPE "public"."transaction_status" OWNER TO "postgres";


CREATE TYPE "public"."transaction_type" AS ENUM (
    'receipt',
    'charge',
    'bill',
    'payment',
    'journal_entry',
    'bank_deposit',
    'bank_transfer'
);


ALTER TYPE "public"."transaction_type" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'super_admin',
    'company_admin',
    'portfolio_manager',
    'manager',
    'accountant',
    'assistant',
    'board_member',
    'user',
    'admin'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE TYPE "public"."vendor_category" AS ENUM (
    'plumbing',
    'electrical',
    'hvac',
    'landscaping',
    'cleaning',
    'security',
    'elevator',
    'general',
    'other'
);


ALTER TYPE "public"."vendor_category" OWNER TO "postgres";


CREATE TYPE "public"."vendor_payment_type" AS ENUM (
    'check',
    'echeck',
    'ach',
    'online'
);


ALTER TYPE "public"."vendor_payment_type" OWNER TO "postgres";


CREATE TYPE "public"."vendor_trade" AS ENUM (
    'hvac',
    'plumbing',
    'electrical',
    'landscaping',
    'roofing',
    'general_contractor',
    'handyperson',
    'snow_removal',
    'pest_control',
    'pool_spa',
    'painting',
    'keys_locks',
    'fireplace_chimney',
    'garage_doors',
    'gutter_cleaning',
    'inspections',
    'parking_driveways',
    'preventative_maintenance',
    'repairs_exterior',
    'repairs_interior',
    'septic',
    'trash_recycling',
    'utilities',
    'turnover',
    'other'
);


ALTER TYPE "public"."vendor_trade" OWNER TO "postgres";


CREATE TYPE "public"."vendor_type" AS ENUM (
    'general',
    'contractor',
    'sub_contractor',
    'service_provider',
    'other'
);


ALTER TYPE "public"."vendor_type" OWNER TO "postgres";


CREATE TYPE "public"."violation_status" AS ENUM (
    'open',
    'notice_sent',
    'hearing_pending',
    'cured',
    'fined',
    'closed'
);


ALTER TYPE "public"."violation_status" OWNER TO "postgres";


CREATE TYPE "public"."violation_type" AS ENUM (
    'noise',
    'parking',
    'pets',
    'exterior_modification',
    'trash_debris',
    'landscaping',
    'common_area_misuse',
    'lease_violation',
    'assessment_delinquency',
    'other'
);


ALTER TYPE "public"."violation_type" OWNER TO "postgres";


CREATE TYPE "public"."voting_scheme" AS ENUM (
    'majority_approval_required',
    'unanimous_approval_required',
    'any_one_approver',
    'percentage_required'
);


ALTER TYPE "public"."voting_scheme" OWNER TO "postgres";


CREATE TYPE "public"."webhook_delivery_status" AS ENUM (
    'pending',
    'succeeded',
    'failed',
    'retrying',
    'abandoned'
);


ALTER TYPE "public"."webhook_delivery_status" OWNER TO "postgres";


CREATE TYPE "public"."webhook_event" AS ENUM (
    'charge.created',
    'charge.updated',
    'charge.voided',
    'payment.received',
    'payment.failed',
    'payment.refunded',
    'work_order.created',
    'work_order.status_changed',
    'work_order.completed',
    'service_request.created',
    'service_request.resolved',
    'bill.created',
    'bill.approved',
    'bill.paid',
    'violation.created',
    'violation.resolved',
    'notice.sent',
    'statement.generated',
    'owner.created',
    'owner.updated',
    'inspection.completed'
);


ALTER TYPE "public"."webhook_event" OWNER TO "postgres";


CREATE TYPE "public"."work_order_category" AS ENUM (
    'plumbing',
    'electrical',
    'hvac',
    'general_repair',
    'common_area',
    'appliance',
    'pest_control',
    'landscaping',
    'other'
);


ALTER TYPE "public"."work_order_category" OWNER TO "postgres";


CREATE TYPE "public"."work_order_priority" AS ENUM (
    'low',
    'normal',
    'high',
    'emergency'
);


ALTER TYPE "public"."work_order_priority" OWNER TO "postgres";


CREATE TYPE "public"."work_order_status" AS ENUM (
    'new',
    'assigned',
    'scheduled',
    'in_progress',
    'done',
    'completed',
    'billed',
    'closed',
    'cancelled'
);


ALTER TYPE "public"."work_order_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_marketing_leads_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
begin new.updated_at := now(); return new; end;
$$;


ALTER FUNCTION "public"."_marketing_leads_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_invitation"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  inv public.user_invitations;
  calling_user uuid := auth.uid();
  user_email text;
begin
  if calling_user is null then
    raise exception 'accept_invitation: must be authenticated';
  end if;

  select email into user_email from auth.users where id = calling_user;

  select * into inv from public.user_invitations
   where token = p_token and status = 'pending'
   for update;

  if not found then
    raise exception 'invitation not found or already used';
  end if;

  if inv.expires_at < now() then
    update public.user_invitations set status = 'expired' where id = inv.id;
    raise exception 'invitation has expired';
  end if;

  if lower(inv.email) <> lower(user_email) then
    raise exception 'invitation email does not match authenticated user';
  end if;

  update public.profiles
     set portfolio_id = inv.portfolio_id,
         role_id = inv.role_id,
         hoa_role = inv.hoa_role,
         updated_at = now()
   where id = calling_user;

  update public.user_invitations
     set status = 'accepted', used_at = now(), used_by = calling_user
   where id = inv.id;

  return jsonb_build_object(
    'success', true,
    'portfolio_id', inv.portfolio_id,
    'hoa_role', inv.hoa_role,
    'role_id', inv.role_id
  );
end;
$$;


ALTER FUNCTION "public"."accept_invitation"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."aggregate_usage_metrics"("p_year" integer, "p_month" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  period_start timestamptz := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'UTC');
  period_end   timestamptz := period_start + interval '1 month';
begin
  insert into public.usage_metrics (
    portfolio_id, period_year, period_month,
    staff_count, homeowner_count, association_count, unit_count,
    work_orders_created, service_requests_created, bills_posted,
    payments_received, emails_sent, sms_sent, api_calls
  )
  select
    p.id,
    p_year,
    p_month,
    coalesce((select count(*) from public.profiles where portfolio_id = p.id and hoa_role = 'manager'), 0),
    coalesce((select count(*) from public.profiles where portfolio_id = p.id and hoa_role in ('owner','tenant')), 0),
    coalesce((select count(*) from public.associations where portfolio_id = p.id and archived_at is null), 0),
    coalesce((select count(*) from public.units u
              join public.buildings b on b.id = u.building_id
              join public.associations a on a.id = b.association_id
              where a.portfolio_id = p.id and u.archived_at is null), 0),
    coalesce((select count(*) from public.work_orders w
              where w.portfolio_id = p.id and w.created_at >= period_start and w.created_at < period_end), 0),
    coalesce((select count(*) from public.service_requests s
              where s.portfolio_id = p.id and s.created_at >= period_start and s.created_at < period_end), 0),
    coalesce((select count(*) from public.payable_bills b
              where b.portfolio_id = p.id and b.created_at >= period_start and b.created_at < period_end), 0),
    coalesce((select count(*) from public.payments pm
              join public.units u on u.id = pm.unit_id
              join public.buildings b on b.id = u.building_id
              join public.associations a on a.id = b.association_id
              where a.portfolio_id = p.id and pm.created_at >= period_start and pm.created_at < period_end), 0),
    coalesce((select count(*) from public.email_queue eq
              join public.associations a on a.id = eq.association_id
              where a.portfolio_id = p.id and eq.sent_at >= period_start and eq.sent_at < period_end), 0),
    coalesce((select count(*) from public.sms_messages sm
              join public.sms_conversations sc on sc.id = sm.conversation_id
              where sc.portfolio_id = p.id and sm.created_at >= period_start and sm.created_at < period_end), 0),
    0  -- api_calls populated by the api_keys layer in Phase 9c
  from public.portfolios p
  on conflict (portfolio_id, period_year, period_month) do update set
    staff_count = excluded.staff_count,
    homeowner_count = excluded.homeowner_count,
    association_count = excluded.association_count,
    unit_count = excluded.unit_count,
    work_orders_created = excluded.work_orders_created,
    service_requests_created = excluded.service_requests_created,
    bills_posted = excluded.bills_posted,
    payments_received = excluded.payments_received,
    emails_sent = excluded.emails_sent,
    sms_sent = excluded.sms_sent,
    updated_at = now();
end;
$$;


ALTER FUNCTION "public"."aggregate_usage_metrics"("p_year" integer, "p_month" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."alert_overdue_bills"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  row record;
  n integer := 0;
begin
  for row in
    select pb.id, pb.portfolio_id, pb.vendor_id, v.name as vendor_name,
           pb.amount, pb.due_date, pb.bill_number
      from public.payable_bills pb
      join public.vendors v on v.id = pb.vendor_id
     where pb.archived_at is null
       and pb.status in ('approved','pending_approval')
       and pb.due_date < current_date
       and pb.paid_at is null
  loop
    perform public.dispatch_webhook(
      row.portfolio_id,
      'bill.created'::public.webhook_event,
      jsonb_build_object(
        'bill_id', row.id, 'vendor_id', row.vendor_id, 'vendor_name', row.vendor_name,
        'amount', row.amount, 'due_date', row.due_date, 'days_overdue',
        (current_date - row.due_date)
      )
    );
    n := n + 1;
  end loop;
  return n;
end;
$$;


ALTER FUNCTION "public"."alert_overdue_bills"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."alert_overdue_bills"() IS 'Daily: dispatches bill.created webhooks for overdue bills so external systems can follow up.';



CREATE OR REPLACE FUNCTION "public"."amenity_reservations_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."amenity_reservations_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."anonymize_owner"("p_owner_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  update public.owners
     set full_name = 'Anonymized (' || left(id::text, 8) || ')',
         first_name = null, last_name = null,
         email = id::text || '@anonymized.local',
         phone = null,
         phone_numbers = '[]'::jsonb,
         emails = '[]'::jsonb,
         mailing_address = null,
         address_street = null, address_city = null, address_state = null, address_zip = null,
         notes = null,
         portal_activated = false,
         portal_login_last_at = null,
         auth_user_id = null,
         archived_at = coalesce(archived_at, now()),
         updated_at = now()
   where id = p_owner_id;
end;
$$;


ALTER FUNCTION "public"."anonymize_owner"("p_owner_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."app_portal_url"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT coalesce(
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'portal_base_url' LIMIT 1),
    'https://www.portier369.com'
  );
$$;


ALTER FUNCTION "public"."app_portal_url"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_late_fees"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  portfolio_row record;
  charge_row record;
  n_fees integer := 0;
  late_fee_gl_id uuid;
begin
  for portfolio_row in
    select p.id as portfolio_id,
           p.default_late_fee_amount as fee_amount,
           p.default_late_fee_grace_days as grace_days
      from public.portfolios p
     where p.suspended_at is null and p.default_late_fee_amount > 0
  loop
    for charge_row in
      select c.id, c.unit_id, c.assessment_period_id, c.due_date,
             (c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0)) as balance_due,
             b.association_id
        from public.charges c
        join public.units u on u.id = c.unit_id
        join public.buildings b on b.id = u.building_id
        join public.associations a on a.id = b.association_id
       where a.portfolio_id = portfolio_row.portfolio_id
         and c.charge_type = 'assessment'
         and c.due_date < (current_date - make_interval(days => portfolio_row.grace_days))
         and not exists (
           select 1 from public.charges lf
           where lf.unit_id = c.unit_id
             and lf.charge_type = 'late_fee'
             and lf.description = 'Late fee: ' || c.id::text
         )
    loop
      if charge_row.balance_due > 0 then
        select id into late_fee_gl_id
          from public.gl_accounts
         where portfolio_id = portfolio_row.portfolio_id
           and number between 4000 and 4999
           and lower(name) like '%late%'
           and active
         limit 1;

        insert into public.charges (
          unit_id, charge_type, description, amount, due_date, gl_account_id
        ) values (
          charge_row.unit_id, 'late_fee',
          'Late fee: ' || charge_row.id::text,
          portfolio_row.fee_amount,
          current_date + 15,
          late_fee_gl_id
        );
        n_fees := n_fees + 1;
      end if;
    end loop;
  end loop;
  return n_fees;
end;
$$;


ALTER FUNCTION "public"."apply_late_fees"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_payment"("p_payment_id" "uuid", "p_strategy" "text" DEFAULT 'auto_oldest_first'::"text", "p_charge_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  pay public.payments;
  remaining numeric(14,2);
  charge_row record;
  to_apply numeric(14,2);
  applied_total numeric(14,2) := 0;
  applications_made jsonb := '[]'::jsonb;
  alloc_order text[];
begin
  select * into pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'payment % not found', p_payment_id; end if;

  remaining := pay.amount - coalesce(
    (select sum(amount_applied) from public.payment_applications where payment_id = p_payment_id),
    0
  );

  if remaining <= 0 then
    return jsonb_build_object(
      'payment_id', p_payment_id,
      'applied_total', 0,
      'remaining', 0,
      'note', 'payment is already fully applied'
    );
  end if;

  if p_strategy = 'association_policy' then
    select a.payment_allocation_order into alloc_order
      from public.units u
      join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id
     where u.id = pay.unit_id;
    if alloc_order is null then
      alloc_order := array['late_fee','nsf_fee','fine','interest','legal','special_assessment','assessment','other'];
    end if;

    for charge_row in
      select c.id as charge_id,
             (c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0)) as bal
        from public.charges c
       where c.unit_id = pay.unit_id
         and (c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0)) > 0
       order by
         coalesce(array_position(alloc_order, c.charge_type::text), 999),
         c.due_date, c.created_at
    loop
      exit when remaining <= 0;
      to_apply := least(remaining, charge_row.bal);
      if to_apply > 0 then
        insert into public.payment_applications (payment_id, charge_id, amount_applied, applied_by, application_method)
        values (p_payment_id, charge_row.charge_id, to_apply, auth.uid(), 'association_policy');
        remaining := remaining - to_apply;
        applied_total := applied_total + to_apply;
        applications_made := applications_made || jsonb_build_object('charge_id', charge_row.charge_id, 'amount', to_apply);
      end if;
    end loop;

  elsif p_strategy = 'auto_late_fees_first' then
    for charge_row in
      select c.id as charge_id, c.charge_type, c.due_date,
             (c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0)) as bal
        from public.charges c
       where c.unit_id = pay.unit_id
         and (c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0)) > 0
       order by
         case c.charge_type
           when 'late_fee' then 1
           when 'nsf_fee' then 2
           when 'fine' then 3
           when 'assessment' then 4
           when 'special_assessment' then 5
           else 9
         end,
         c.due_date
    loop
      exit when remaining <= 0;
      to_apply := least(remaining, charge_row.bal);
      if to_apply > 0 then
        insert into public.payment_applications (payment_id, charge_id, amount_applied, applied_by, application_method)
        values (p_payment_id, charge_row.charge_id, to_apply, auth.uid(), 'auto_late_fees_first');
        remaining := remaining - to_apply;
        applied_total := applied_total + to_apply;
        applications_made := applications_made || jsonb_build_object('charge_id', charge_row.charge_id, 'amount', to_apply);
      end if;
    end loop;

  elsif p_strategy = 'auto_specific' then
    if p_charge_ids is null or array_length(p_charge_ids, 1) is null then
      raise exception 'auto_specific strategy requires p_charge_ids';
    end if;
    for charge_row in
      select c.id as charge_id,
             (c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0)) as bal
        from public.charges c
       where c.unit_id = pay.unit_id
         and c.id = any(p_charge_ids)
         and (c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0)) > 0
       order by array_position(p_charge_ids, c.id)
    loop
      exit when remaining <= 0;
      to_apply := least(remaining, charge_row.bal);
      if to_apply > 0 then
        insert into public.payment_applications (payment_id, charge_id, amount_applied, applied_by, application_method)
        values (p_payment_id, charge_row.charge_id, to_apply, auth.uid(), 'auto_specific');
        remaining := remaining - to_apply;
        applied_total := applied_total + to_apply;
        applications_made := applications_made || jsonb_build_object('charge_id', charge_row.charge_id, 'amount', to_apply);
      end if;
    end loop;

  else
    for charge_row in
      select c.id as charge_id,
             (c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0)) as bal
        from public.charges c
       where c.unit_id = pay.unit_id
         and (c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0)) > 0
       order by c.due_date, c.created_at
    loop
      exit when remaining <= 0;
      to_apply := least(remaining, charge_row.bal);
      if to_apply > 0 then
        insert into public.payment_applications (payment_id, charge_id, amount_applied, applied_by, application_method)
        values (p_payment_id, charge_row.charge_id, to_apply, auth.uid(), 'auto_oldest_first');
        remaining := remaining - to_apply;
        applied_total := applied_total + to_apply;
        applications_made := applications_made || jsonb_build_object('charge_id', charge_row.charge_id, 'amount', to_apply);
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'payment_id', p_payment_id,
    'strategy', p_strategy,
    'applied_total', applied_total,
    'remaining_credit', remaining,
    'applications', applications_made
  );
end;
$$;


ALTER FUNCTION "public"."apply_payment"("p_payment_id" "uuid", "p_strategy" "text", "p_charge_ids" "uuid"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."apply_payment"("p_payment_id" "uuid", "p_strategy" "text", "p_charge_ids" "uuid"[]) IS 'Applies a payment to outstanding charges. Strategies: auto_oldest_first (HOA default), auto_late_fees_first (pay fees before assessments), auto_specific (caller provides charge list). Leftover becomes an unapplied credit.';



CREATE OR REPLACE FUNCTION "public"."apply_pending_invitation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_invitation public.user_invitations%ROWTYPE;
  v_assoc_id uuid;
BEGIN
  SELECT *
    INTO v_invitation
  FROM public.user_invitations
  WHERE lower(email) = lower(NEW.email)
    AND status = 'pending'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, portfolio_id, mvp_role, hoa_role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(v_invitation.full_name, ''),
    v_invitation.portfolio_id,
    v_invitation.mvp_role,
    v_invitation.hoa_role
  )
  ON CONFLICT (id) DO UPDATE
    SET portfolio_id = EXCLUDED.portfolio_id,
        mvp_role     = EXCLUDED.mvp_role,
        hoa_role     = EXCLUDED.hoa_role,
        full_name    = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name);

  IF (v_invitation.hoa_role = 'manager'
      OR v_invitation.mvp_role IN ('manager', 'assistant_manager'))
     AND array_length(v_invitation.association_ids, 1) > 0 THEN
    FOREACH v_assoc_id IN ARRAY v_invitation.association_ids LOOP
      INSERT INTO public.association_managers (
        user_id, association_id, portfolio_id, assigned_by, assigned_at
      ) VALUES (
        NEW.id, v_assoc_id, v_invitation.portfolio_id, v_invitation.invited_by, now()
      )
      ON CONFLICT (user_id, association_id) DO NOTHING;
    END LOOP;
  END IF;

  UPDATE public.user_invitations
     SET status  = 'accepted',
         used_at = now(),
         used_by = NEW.id,
         updated_at = now()
   WHERE id = v_invitation.id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."apply_pending_invitation"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."apply_pending_invitation"() IS 'Trigger function: when a user signs up, finds the most recent pending invitation for their email and applies portfolio_id + mvp_role + association assignments. Marks the invitation accepted.';



CREATE OR REPLACE FUNCTION "public"."architectural_requests_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."architectural_requests_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assemble_vendor_1099_data"("p_portfolio_id" "uuid", "p_tax_year" integer) RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.total_paid desc), '[]'::jsonb)
    from (
      select
        v.id as vendor_id,
        v.name as vendor_name,
        v.taxpayer_name,
        v.taxpayer_id,
        v.address_street, v.address_city, v.address_state, v.address_zip,
        sum(pb.amount) filter (where pb.paid_at is not null) as total_paid,
        count(*) filter (where pb.paid_at is not null) as bill_count,
        p_tax_year as tax_year
      from public.vendors v
      left join public.payable_bills pb
             on pb.vendor_id = v.id
            and pb.paid_at >= make_date(p_tax_year, 1, 1)
            and pb.paid_at < make_date(p_tax_year + 1, 1, 1)
      where v.portfolio_id = p_portfolio_id
        and v.send_1099 = true
        and v.archived_at is null
      group by v.id, v.name, v.taxpayer_name, v.taxpayer_id,
               v.address_street, v.address_city, v.address_state, v.address_zip
      having coalesce(sum(pb.amount) filter (where pb.paid_at is not null), 0) >= 600  -- IRS threshold
    ) r;
$$;


ALTER FUNCTION "public"."assemble_vendor_1099_data"("p_portfolio_id" "uuid", "p_tax_year" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."assemble_vendor_1099_data"("p_portfolio_id" "uuid", "p_tax_year" integer) IS 'Returns per-vendor 1099-MISC data for a tax year: aggregate payments, taxpayer info, address. Only includes vendors with send_1099=true and >= $600 paid.';



CREATE OR REPLACE FUNCTION "public"."assess_late_fee"("p_charge_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_charge public.charges;
  v_assoc  public.associations;
  v_cat    public.charge_categories;
  v_balance numeric;
  v_fee     numeric;
  v_fee_charge public.charges;
begin
  select * into v_charge from public.charges where id = p_charge_id;
  if not found then raise exception 'charge not found'; end if;

  select a.* into v_assoc
    from public.associations a
    join public.buildings b on b.association_id = a.id
    join public.units u on u.building_id = b.id
   where u.id = v_charge.unit_id;
  if not found then raise exception 'association not found for charge'; end if;

  if auth.uid() is not null and not public.can_manage_finance(v_assoc.portfolio_id) then
    raise exception 'permission denied';
  end if;

  if not v_assoc.late_fee_enabled or coalesce(v_assoc.late_fee_amount, 0) <= 0 then
    return null;
  end if;
  if v_charge.charge_type <> 'assessment' then
    return null;
  end if;
  if v_charge.due_date + coalesce(v_assoc.late_fee_grace_days, 10) >= current_date then
    return null;
  end if;
  if exists (select 1 from public.late_fee_assessments where charge_id = p_charge_id) then
    return null;
  end if;

  v_balance := coalesce(v_charge.amount, 0) - coalesce(
    (select sum(pa.amount_applied) from public.payment_applications pa
      where pa.charge_id = p_charge_id), 0);
  if v_balance <= 0 then return null; end if;

  v_fee := case
    when v_assoc.late_fee_is_percent then round(v_balance * v_assoc.late_fee_amount / 100.0, 2)
    else v_assoc.late_fee_amount
  end;
  if v_fee is null or v_fee <= 0 then return null; end if;

  select * into v_cat
    from public.charge_categories
   where portfolio_id = v_assoc.portfolio_id
     and charge_type = 'late_fee'
     and active
     and archived_at is null
   order by sort_order
   limit 1;
  if v_cat.id is null then
    return null;
  end if;

  insert into public.charges (
    unit_id, charge_category_id, charge_type, description, amount, due_date, gl_account_id, created_by
  ) values (
    v_charge.unit_id, v_cat.id, 'late_fee',
    'Late fee — ' || coalesce(v_charge.description, 'assessment')
      || ' (due ' || to_char(v_charge.due_date, 'YYYY-MM-DD') || ')',
    v_fee, current_date, v_cat.gl_account_id, auth.uid()
  ) returning * into v_fee_charge;

  insert into public.late_fee_assessments (association_id, charge_id, fee_charge_id)
  values (v_assoc.id, p_charge_id, v_fee_charge.id);

  return v_fee_charge.id;
end;
$$;


ALTER FUNCTION "public"."assess_late_fee"("p_charge_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "display_name" "text",
    "avatar_url" "text",
    "role" "text" DEFAULT 'user'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "full_name" "text",
    "hoa_role" "public"."hoa_role" DEFAULT 'owner'::"public"."hoa_role",
    "portfolio_id" "uuid",
    "role_id" "uuid",
    "profile_access" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "gl_account_permissions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "portal_login_last_at" timestamp with time zone,
    "mfa_required" boolean DEFAULT false NOT NULL,
    "mfa_enrolled_at" timestamp with time zone,
    "last_login_at" timestamp with time zone,
    "last_login_ip" "text",
    "mvp_role" "public"."mvp_company_role",
    "disabled_at" timestamp with time zone
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."hoa_role" IS 'Default is owner. Staff get upgraded to manager when accepting a staff invitation; portal users (owner/tenant/board) stay at their portal role.';



COMMENT ON COLUMN "public"."profiles"."mvp_role" IS 'MVP role within their portfolio. NULL = not company staff.';



COMMENT ON COLUMN "public"."profiles"."disabled_at" IS 'When set, the user account is soft-disabled (login should be blocked). Cleared to re-enable. Managed by platform-operator users admin.';



CREATE OR REPLACE FUNCTION "public"."assign_role"("p_profile_id" "uuid", "p_role_id" "uuid") RETURNS "public"."profiles"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  target public.profiles;
  target_role public.user_roles;
begin
  select * into target from public.profiles where id = p_profile_id;
  if not found then
    raise exception 'assign_role: profile % not found', p_profile_id;
  end if;

  if not public.can_admin_portfolio(target.portfolio_id) then
    raise exception 'assign_role: must be admin of profile''s portfolio';
  end if;

  select * into target_role from public.user_roles where id = p_role_id;
  if not found then
    raise exception 'assign_role: role % not found', p_role_id;
  end if;
  if target_role.portfolio_id is not null and target_role.portfolio_id <> target.portfolio_id then
    raise exception 'assign_role: role belongs to a different portfolio';
  end if;

  update public.profiles
     set role_id = p_role_id, updated_at = now()
   where id = p_profile_id
   returning * into target;
  return target;
end;
$$;


ALTER FUNCTION "public"."assign_role"("p_profile_id" "uuid", "p_role_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."association_operating_account"("p_assoc_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  SELECT operating_bank_account_id FROM public.associations WHERE id = p_assoc_id;
$$;


ALTER FUNCTION "public"."association_operating_account"("p_assoc_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."association_reserve_account"("p_assoc_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  SELECT reserve_bank_account_id FROM public.associations WHERE id = p_assoc_id;
$$;


ALTER FUNCTION "public"."association_reserve_account"("p_assoc_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."associations_set_slug"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  base text;
  candidate text;
  n int := 1;
begin
  if NEW.slug is not null and NEW.slug <> '' then
    return NEW;
  end if;
  base := public.slugify_association_name(NEW.name);
  candidate := base;
  while exists (select 1 from public.associations a where a.slug = candidate and a.id <> NEW.id) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  NEW.slug := candidate;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."associations_set_slug"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_apply_credit_on_new_charge"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  credit_row record;
  remaining_charge numeric(14,2);
  to_apply numeric(14,2);
begin
  remaining_charge := new.amount;

  for credit_row in
    select payment_id, unapplied_amount
      from public.v_unapplied_credits
     where unit_id = new.unit_id
     order by payment_id  -- FIFO; could use payment_date for true oldest-first
  loop
    exit when remaining_charge <= 0;
    to_apply := least(remaining_charge, credit_row.unapplied_amount);
    if to_apply > 0 then
      insert into public.payment_applications (payment_id, charge_id, amount_applied, application_method)
      values (credit_row.payment_id, new.id, to_apply, 'credit_application')
      on conflict do nothing;
      remaining_charge := remaining_charge - to_apply;
    end if;
  end loop;
  return new;
end;
$$;


ALTER FUNCTION "public"."auto_apply_credit_on_new_charge"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_apply_new_payment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if new.charge_id is not null then
    insert into public.payment_applications (payment_id, charge_id, amount_applied, applied_by, application_method)
    values (new.id, new.charge_id, new.amount, new.created_by, 'auto_specific')
    on conflict do nothing;
  else
    perform public.apply_payment(new.id, 'association_policy');
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."auto_apply_new_payment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_link_portal_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  update public.owners
     set auth_user_id = new.id, portal_activated = true
   where auth_user_id is null and archived_at is null
     and lower(email) = lower(new.email);

  update public.vendors v
     set auth_user_id = new.id, portal_activated = true
   where v.auth_user_id is null and v.archived_at is null
     and exists (
       select 1 from jsonb_array_elements_text(v.emails) as e(email)
       where lower(e.email) = lower(new.email)
     );

  update public.board_members
     set auth_user_id = new.id
   where auth_user_id is null and active
     and lower(email) = lower(new.email);

  update public.profiles p
     set hoa_role = 'board'
   where p.id = new.id
     and p.hoa_role = 'owner'
     and exists (
       select 1 from public.board_members bm
       where bm.auth_user_id = new.id and bm.active
     );

  return new;
end;
$$;


ALTER FUNCTION "public"."auto_link_portal_user"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auto_link_portal_user"() IS 'Fires on auth.users INSERT. Populates auth_user_id on any matching owner/board_member/vendor by email.';



CREATE OR REPLACE FUNCTION "public"."automation_flows_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."automation_flows_touch_updated_at"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_operators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "role" "text" DEFAULT 'admin'::"text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "mfa_required" boolean DEFAULT true NOT NULL,
    "mfa_enrolled_at" timestamp with time zone,
    CONSTRAINT "platform_operators_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'support'::"text", 'readonly'::"text"])))
);


ALTER TABLE "public"."platform_operators" OWNER TO "postgres";


COMMENT ON TABLE "public"."platform_operators" IS 'SaaS vendor staff (super admins). Separate from portfolio staff. Bypasses portfolio_id isolation for support, cross-tenant analytics, and platform admin.';



CREATE OR REPLACE FUNCTION "public"."bootstrap_platform_admin"("p_auth_user_id" "uuid", "p_full_name" "text" DEFAULT NULL::"text") RETURNS "public"."platform_operators"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  existing_count integer;
  po_row public.platform_operators;
  user_email text;
begin
  select count(*) into existing_count from public.platform_operators;
  if existing_count > 0 then
    raise exception 'platform_operators already bootstrapped; use the regular admin flow';
  end if;

  select email into user_email from auth.users where id = p_auth_user_id;
  if user_email is null then
    raise exception 'no auth.users row for %', p_auth_user_id;
  end if;

  insert into public.platform_operators (auth_user_id, email, full_name, role)
  values (p_auth_user_id, user_email, p_full_name, 'admin')
  returning * into po_row;
  return po_row;
end;
$$;


ALTER FUNCTION "public"."bootstrap_platform_admin"("p_auth_user_id" "uuid", "p_full_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."bootstrap_platform_admin"("p_auth_user_id" "uuid", "p_full_name" "text") IS 'ONE-TIME bootstrap: call via service role to register the first platform admin. Refuses to run once platform_operators has any rows.';



CREATE OR REPLACE FUNCTION "public"."bulk_create_charges"("p_charges" "jsonb", "p_charge_category_id" "uuid" DEFAULT NULL::"uuid", "p_due_date" "date" DEFAULT NULL::"date", "p_description" "text" DEFAULT NULL::"text", "p_gl_account_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("inserted_count" integer, "charge_ids" "uuid"[])
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  charge record;
  new_ids uuid[] := '{}';
  new_id uuid;
  cnt integer := 0;
  v_unit_id uuid;
  v_amount numeric;
  v_desc text;
  v_cat_id uuid;
  v_due date;
  v_gl_id uuid;
  v_created_by uuid;
BEGIN
  v_created_by := (auth.uid())::uuid;
  v_due := COALESCE(p_due_date, CURRENT_DATE + INTERVAL '30 days');
  v_gl_id := p_gl_account_id;
  
  FOR charge IN SELECT * FROM jsonb_to_recordset(p_charges) AS x(unit_id uuid, amount numeric, description text, charge_category_id uuid, due_date date, gl_account_id uuid)
  LOOP
    v_unit_id := charge.unit_id;
    v_amount := charge.amount;
    v_desc := COALESCE(charge.description, p_description, 'Assessment charge');
    v_cat_id := COALESCE(charge.charge_category_id, p_charge_category_id);
    
    IF charge.due_date IS NOT NULL THEN
      v_due := charge.due_date;
    END IF;
    IF charge.gl_account_id IS NOT NULL THEN
      v_gl_id := charge.gl_account_id;
    END IF;
    
    INSERT INTO charges (
      unit_id,
      charge_category_id,
      charge_type,
      description,
      amount,
      due_date,
      gl_account_id,
      created_by
    ) VALUES (
      v_unit_id,
      v_cat_id,
      'assessment',
      v_desc,
      v_amount,
      v_due,
      v_gl_id,
      v_created_by
    )
    RETURNING id INTO new_id;
    
    new_ids := array_append(new_ids, new_id);
    cnt := cnt + 1;
  END LOOP;
  
  RETURN QUERY SELECT cnt, new_ids;
END;
$$;


ALTER FUNCTION "public"."bulk_create_charges"("p_charges" "jsonb", "p_charge_category_id" "uuid", "p_due_date" "date", "p_description" "text", "p_gl_account_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_create_recurring_charges"("p_subscriptions" "jsonb", "p_charge_category_id" "uuid" DEFAULT NULL::"uuid", "p_frequency" "text" DEFAULT 'monthly'::"text", "p_start_date" "date" DEFAULT NULL::"date", "p_memo" "text" DEFAULT NULL::"text") RETURNS TABLE("inserted_count" integer, "subscription_ids" "uuid"[])
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  sub record;
  new_ids uuid[] := '{}';
  new_id uuid;
  cnt integer := 0;
  v_unit_id uuid;
  v_amount numeric;
  v_cat_id uuid;
  v_freq recurring_frequency;
  v_start date;
  v_memo text;
  v_created_by uuid;
BEGIN
  v_created_by := (auth.uid())::uuid;
  v_start := COALESCE(p_start_date, CURRENT_DATE);
  v_memo := p_memo;
  
  -- Cast frequency text to enum safely
  BEGIN
    v_freq := p_frequency::recurring_frequency;
  EXCEPTION WHEN OTHERS THEN
    v_freq := 'monthly';
  END;
  
  FOR sub IN SELECT * FROM jsonb_to_recordset(p_subscriptions) AS x(unit_id uuid, amount numeric, charge_category_id uuid, frequency text, start_date date, memo text)
  LOOP
    v_unit_id := sub.unit_id;
    v_amount := sub.amount;
    v_cat_id := COALESCE(sub.charge_category_id, p_charge_category_id);
    
    IF sub.frequency IS NOT NULL THEN
      BEGIN
        v_freq := sub.frequency::recurring_frequency;
      EXCEPTION WHEN OTHERS THEN
        -- keep current v_freq
      END;
    END IF;
    IF sub.start_date IS NOT NULL THEN v_start := sub.start_date; END IF;
    IF sub.memo IS NOT NULL THEN v_memo := sub.memo; END IF;
    
    INSERT INTO unit_recurring_charges (
      unit_id,
      charge_category_id,
      amount,
      frequency,
      start_date,
      next_post_date,
      memo,
      active,
      created_by
    ) VALUES (
      v_unit_id,
      v_cat_id,
      v_amount,
      v_freq,
      v_start,
      v_start,
      v_memo,
      true,
      v_created_by
    )
    RETURNING id INTO new_id;
    
    new_ids := array_append(new_ids, new_id);
    cnt := cnt + 1;
  END LOOP;
  
  RETURN QUERY SELECT cnt, new_ids;
END;
$$;


ALTER FUNCTION "public"."bulk_create_recurring_charges"("p_subscriptions" "jsonb", "p_charge_category_id" "uuid", "p_frequency" "text", "p_start_date" "date", "p_memo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_queue_reports"("p_association_ids" "uuid"[], "p_report_slugs" "text"[], "p_scope" "text" DEFAULT 'association'::"text", "p_date_start" "date" DEFAULT NULL::"date", "p_date_end" "date" DEFAULT NULL::"date", "p_output_format" "text" DEFAULT 'csv'::"text") RETURNS TABLE("queued_count" integer, "run_ids" "uuid"[])
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_assoc_id uuid;
  v_slug text;
  v_def_id uuid;
  new_ids uuid[] := '{}';
  new_id uuid;
  cnt integer := 0;
  v_created_by uuid;
  v_portfolio_id uuid;
  v_fmt report_format;
BEGIN
  v_created_by := (auth.uid())::uuid;
  
  BEGIN
    v_fmt := p_output_format::report_format;
  EXCEPTION WHEN OTHERS THEN
    v_fmt := 'csv';
  END;
  
  -- Try auth user first, fallback to association portfolio
  IF v_created_by IS NOT NULL THEN
    SELECT p.portfolio_id INTO v_portfolio_id 
    FROM profiles p WHERE p.id = v_created_by;
  END IF;
  
  IF v_portfolio_id IS NULL THEN
    SELECT a.portfolio_id INTO v_portfolio_id 
    FROM associations a WHERE a.id = p_association_ids[1];
  END IF;
  
  FOREACH v_assoc_id IN ARRAY p_association_ids
  LOOP
    FOREACH v_slug IN ARRAY p_report_slugs
    LOOP
      SELECT id INTO v_def_id FROM report_definitions WHERE slug = v_slug AND active = true;
      
      IF v_def_id IS NOT NULL THEN
        INSERT INTO report_runs (
          definition_id,
          portfolio_id,
          parameters,
          output_format,
          status,
          triggered_by
        ) VALUES (
          v_def_id,
          v_portfolio_id,
          jsonb_build_object(
            'scope', p_scope,
            'association_id', v_assoc_id,
            'date_start', p_date_start,
            'date_end', p_date_end
          ),
          v_fmt,
          'queued',
          v_created_by
        )
        RETURNING id INTO new_id;
        
        new_ids := array_append(new_ids, new_id);
        cnt := cnt + 1;
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN QUERY SELECT cnt, new_ids;
END;
$$;


ALTER FUNCTION "public"."bulk_queue_reports"("p_association_ids" "uuid"[], "p_report_slugs" "text"[], "p_scope" "text", "p_date_start" "date", "p_date_end" "date", "p_output_format" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_update_statement_settings"("p_association_ids" "uuid"[], "p_settings" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  update_count integer := 0;
BEGIN
  UPDATE associations
  SET
    use_enhanced_statement = COALESCE((p_settings->>'use_enhanced_statement')::boolean, use_enhanced_statement),
    include_current_and_upcoming_charges = COALESCE((p_settings->>'include_current_and_upcoming_charges')::boolean, include_current_and_upcoming_charges),
    include_upcoming_in_amount_due = COALESCE((p_settings->>'include_upcoming_in_amount_due')::boolean, include_upcoming_in_amount_due),
    upcoming_charges_timeframe = COALESCE(p_settings->>'upcoming_charges_timeframe', upcoming_charges_timeframe),
    include_current_message_on_statement = COALESCE((p_settings->>'include_current_message_on_statement')::boolean, include_current_message_on_statement),
    include_logo_on_statement = COALESCE((p_settings->>'include_logo_on_statement')::boolean, include_logo_on_statement),
    charge_history_includes = COALESCE(p_settings->>'charge_history_includes', charge_history_includes),
    include_payments_due_date = COALESCE((p_settings->>'include_payments_due_date')::boolean, include_payments_due_date),
    include_payments_history_and_balance_forward = COALESCE((p_settings->>'include_payments_history_and_balance_forward')::boolean, include_payments_history_and_balance_forward),
    show_remaining_amount_for_past_due_charges = COALESCE((p_settings->>'show_remaining_amount_for_past_due_charges')::boolean, show_remaining_amount_for_past_due_charges),
    include_payment_coupon_on_statement = COALESCE((p_settings->>'include_payment_coupon_on_statement')::boolean, include_payment_coupon_on_statement)
  WHERE id = ANY(p_association_ids)
    AND archived_at IS NULL;
  
  GET DIAGNOSTICS update_count = ROW_COUNT;
  RETURN update_count;
END;
$$;


ALTER FUNCTION "public"."bulk_update_statement_settings"("p_association_ids" "uuid"[], "p_settings" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bump_saved_report_on_run"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if new.status = 'succeeded' and new.saved_report_id is not null then
    update public.saved_reports
       set last_run_at = coalesce(new.finished_at, now()),
           run_count = run_count + 1,
           updated_at = now()
     where id = new.saved_report_id;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."bump_saved_report_on_run"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calc_next_maintenance_due"("p_frequency" "text", "p_custom_interval_days" integer, "p_from_date" "date") RETURNS "date"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
    BEGIN
      RETURN CASE p_frequency
        WHEN 'weekly' THEN p_from_date + 7
        WHEN 'monthly' THEN p_from_date + INTERVAL '1 month'
        WHEN 'bimonthly' THEN p_from_date + INTERVAL '2 months'
        WHEN 'quarterly' THEN p_from_date + INTERVAL '3 months'
        WHEN 'semiannual' THEN p_from_date + INTERVAL '6 months'
        WHEN 'annual' THEN p_from_date + INTERVAL '1 year'
        WHEN 'custom' THEN p_from_date + (p_custom_interval_days || ' days')::INTERVAL
        ELSE p_from_date + INTERVAL '1 month'
      END;
    END;
    $$;


ALTER FUNCTION "public"."calc_next_maintenance_due"("p_frequency" "text", "p_custom_interval_days" integer, "p_from_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_convenience_fee"("p_portfolio_id" "uuid", "p_amount_cents" bigint, "p_method" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  pf public.portfolios;
  fee_pct numeric := 0;
  fee_fixed integer := 0;
  fee_cents integer := 0;
  owner_pays integer := 0;
begin
  select * into pf from public.portfolios where id = p_portfolio_id;
  if not found then
    return jsonb_build_object('error', 'portfolio not found');
  end if;

  if p_method in ('card','credit_card','debit_card') then
    fee_pct := pf.convenience_fee_card_pct;
    fee_fixed := pf.convenience_fee_card_fixed_cents;
  elsif p_method in ('ach','echeck','bank_transfer') then
    fee_pct := pf.convenience_fee_ach_pct;
    fee_fixed := pf.convenience_fee_ach_fixed_cents;
  else
    return jsonb_build_object('fee_cents', 0, 'owner_pays_cents', p_amount_cents);
  end if;

  fee_cents := round((p_amount_cents * fee_pct / 100.0) + fee_fixed);
  fee_cents := greatest(fee_cents, pf.convenience_fee_minimum_cents);

  case pf.convenience_fee_mode
    when 'absorb'       then owner_pays := p_amount_cents;
    when 'pass_through' then owner_pays := p_amount_cents + fee_cents;
    when 'split'        then owner_pays := p_amount_cents + (fee_cents / 2);
    when 'flat_addon'   then owner_pays := p_amount_cents + pf.convenience_fee_card_fixed_cents;
  end case;

  return jsonb_build_object(
    'fee_cents', fee_cents,
    'owner_pays_cents', owner_pays,
    'mode', pf.convenience_fee_mode,
    'label', pf.convenience_fee_label
  );
end;
$$;


ALTER FUNCTION "public"."calculate_convenience_fee"("p_portfolio_id" "uuid", "p_amount_cents" bigint, "p_method" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_meeting_quorum"("p_meeting_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_meeting meetings;
  v_quorum_pct integer;
  v_total_units integer;
  v_attendee_count integer;
  v_board_count integer;
  v_owner_count integer;
  v_quorum_needed integer;
  v_quorum_reached boolean;
BEGIN
  -- Get meeting info
  SELECT * INTO v_meeting FROM meetings WHERE id = p_meeting_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Meeting not found');
  END IF;

  -- Get association quorum percentage (default 51%)
  SELECT COALESCE(quorum_percentage, 51) INTO v_quorum_pct
  FROM associations WHERE id = v_meeting.association_id;

  -- Get total units for association
  SELECT COALESCE(unit_count, 0) INTO v_total_units
  FROM associations WHERE id = v_meeting.association_id;

  -- Count present attendees
  SELECT COUNT(*) INTO v_attendee_count
  FROM meeting_attendees
  WHERE meeting_id = p_meeting_id AND present = true;

  -- Count board members present
  SELECT COUNT(*) INTO v_board_count
  FROM meeting_attendees
  WHERE meeting_id = p_meeting_id AND present = true AND attendee_role = 'board_member';

  -- Count owners present
  SELECT COUNT(*) INTO v_owner_count
  FROM meeting_attendees
  WHERE meeting_id = p_meeting_id AND present = true AND attendee_role IN ('owner', 'board_member');

  -- Calculate quorum based on unit ownership representation
  -- Quorum = ceil(total_units * quorum_pct / 100)
  v_quorum_needed := CEIL(v_total_units * v_quorum_pct / 100.0);
  v_quorum_reached := v_owner_count >= v_quorum_needed;

  -- Update meeting quorum status
  UPDATE meetings
  SET quorum_met = v_quorum_reached,
      quorum_requirement = v_quorum_needed,
      total_units = v_total_units
  WHERE id = p_meeting_id;

  RETURN jsonb_build_object(
    'meeting_id', p_meeting_id,
    'total_units', v_total_units,
    'quorum_percentage', v_quorum_pct,
    'quorum_needed', v_quorum_needed,
    'attendee_count', v_attendee_count,
    'board_count', v_board_count,
    'owner_count', v_owner_count,
    'quorum_reached', v_quorum_reached
  );
END;
$$;


ALTER FUNCTION "public"."calculate_meeting_quorum"("p_meeting_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_association"("a_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select a_id is not null
    and exists (
      select 1 from public.associations a
      where a.id = a_id
        and public.can_access_portfolio(a.portfolio_id)
    );
$$;


ALTER FUNCTION "public"."can_access_association"("a_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_association_mvp"("a_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    a_id IS NOT NULL
    AND (
      public.is_platform_operator()
      -- company_admin OR accountant: any association in their portfolio
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.associations a ON a.portfolio_id = p.portfolio_id
        WHERE p.id = auth.uid()
          AND p.mvp_role IN ('company_admin', 'accountant')
          AND a.id = a_id
      )
      -- manager OR assistant_manager: only assigned associations
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.association_managers am ON am.user_id = p.id
        WHERE p.id = auth.uid()
          AND p.mvp_role IN ('manager', 'assistant_manager')
          AND am.association_id = a_id
          AND am.ended_at IS NULL
      )
      -- board member: their own association
      OR EXISTS (
        SELECT 1
        FROM public.board_members bm
        WHERE bm.auth_user_id = auth.uid()
          AND bm.association_id = a_id
          AND bm.active = true
      )
      -- owner / tenant: associations where they have a current occupancy
      OR EXISTS (
        SELECT 1
        FROM public.occupancies oc
        JOIN public.units u     ON u.id = oc.unit_id
        JOIN public.buildings b ON b.id = u.building_id
        JOIN public.owners o    ON o.id = oc.owner_id
        WHERE b.association_id = a_id
          AND o.auth_user_id = auth.uid()
          AND oc.status = 'current'
      )
    );
$$;


ALTER FUNCTION "public"."can_access_association_mvp"("a_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_access_association_mvp"("a_id" "uuid") IS 'MVP role-aware access check. Use this in new RLS policies. Replaces the broader can_access_association(a_id) which only checks portfolio scope.';



CREATE OR REPLACE FUNCTION "public"."can_access_portfolio"("p_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select p_id is not null
    and (
      public.is_platform_operator()
      or ((public.is_any_staff() or public.is_company_admin()) and p_id = public.current_portfolio_id())
    );
$$;


ALTER FUNCTION "public"."can_access_portfolio"("p_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_access_portfolio"("p_id" "uuid") IS 'Tier C (any staff) + portfolio isolation. Use in operations/people RLS policies.';



CREATE OR REPLACE FUNCTION "public"."can_access_unit"("u_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select u_id is not null
    and exists (
      select 1 from public.units u
      join public.buildings b on b.id = u.building_id
      where u.id = u_id and public.can_access_association(b.association_id)
    );
$$;


ALTER FUNCTION "public"."can_access_unit"("u_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_admin_portfolio"("p_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select p_id is not null
    and (
      public.is_platform_operator()
      or ((public.is_full_access_staff() or public.is_company_admin()) and p_id = public.current_portfolio_id())
    );
$$;


ALTER FUNCTION "public"."can_admin_portfolio"("p_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_admin_portfolio"("p_id" "uuid") IS 'Tier A (full access staff) + portfolio isolation. Use for admin actions (managing users, roles, portfolio settings).';



CREATE OR REPLACE FUNCTION "public"."can_edit_association_mvp"("a_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    a_id IS NOT NULL
    AND (
      public.is_platform_operator()
      -- company admins: full edit on their portfolio
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.associations a ON a.portfolio_id = p.portfolio_id
        WHERE p.id = auth.uid()
          AND p.mvp_role = 'company_admin'
          AND a.id = a_id
      )
      -- accountants: full edit on their portfolio
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.associations a ON a.portfolio_id = p.portfolio_id
        WHERE p.id = auth.uid()
          AND p.mvp_role = 'accountant'
          AND a.id = a_id
      )
      -- managers: full edit on assigned associations only
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.association_managers am ON am.user_id = p.id
        WHERE p.id = auth.uid()
          AND p.mvp_role = 'manager'
          AND am.association_id = a_id
          AND am.ended_at IS NULL
      )
    );
$$;


ALTER FUNCTION "public"."can_edit_association_mvp"("a_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_edit_association_mvp"("a_id" "uuid") IS 'Write-permission check. Returns true for super admins, company admins, accountants, and managers (assigned associations only). Assistant managers, board members, owners, and tenants get false here — they have read access via can_access_association_mvp() but cannot edit.';



CREATE OR REPLACE FUNCTION "public"."can_manage_finance"("p_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select p_id is not null
    and (
      public.is_platform_operator()
      or (public.is_finance_staff() and p_id = public.current_portfolio_id())
    );
$$;


ALTER FUNCTION "public"."can_manage_finance"("p_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_manage_finance"("p_id" "uuid") IS 'Tier B (finance staff) + portfolio isolation. Use in finance RLS policies.';



CREATE OR REPLACE FUNCTION "public"."can_read_gl"("gl_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select public.is_full_access_staff()
      or exists (
        select 1 from public.profiles p
        join public.gl_account_role_permissions grp on grp.role_id = p.role_id
        where p.id = auth.uid()
          and grp.gl_account_id = gl_id
          and grp.permission in ('read','full')
      );
$$;


ALTER FUNCTION "public"."can_read_gl"("gl_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_association_row"("p_assoc" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select case
    when public.manager_is_scoped() then
      p_assoc is null
      or exists (
        select 1 from public.association_managers am
        where am.user_id = auth.uid() and am.association_id = p_assoc
      )
    else true
  end;
$$;


ALTER FUNCTION "public"."can_view_association_row"("p_assoc" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."autopay_mandates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "association_id" "uuid",
    "owner_id" "uuid" NOT NULL,
    "unit_id" "uuid",
    "payment_method_id" "uuid" NOT NULL,
    "authorized_amount_max_cents" integer NOT NULL,
    "frequency" "public"."autopay_frequency" DEFAULT 'on_charge_posted'::"public"."autopay_frequency" NOT NULL,
    "day_of_month" smallint,
    "start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "end_date" "date",
    "status" "public"."autopay_status" DEFAULT 'pending_verification'::"public"."autopay_status" NOT NULL,
    "mandate_signed_at" timestamp with time zone,
    "mandate_ip_address" "text",
    "mandate_user_agent" "text",
    "mandate_document_url" "text",
    "processor_mandate_id" "text",
    "next_run_date" "date",
    "last_run_at" timestamp with time zone,
    "success_count" integer DEFAULT 0 NOT NULL,
    "failure_count" integer DEFAULT 0 NOT NULL,
    "last_failure_at" timestamp with time zone,
    "last_failure_reason" "text",
    "paused_at" timestamp with time zone,
    "paused_reason" "text",
    "canceled_at" timestamp with time zone,
    "canceled_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "mode" "text" DEFAULT 'current_balance'::"text" NOT NULL,
    "fixed_amount_cents" integer,
    "minimum_amount_cents" integer,
    "include_late_fees" boolean DEFAULT true NOT NULL,
    "skip_until" "date",
    CONSTRAINT "autopay_mandates_authorized_amount_max_cents_check" CHECK (("authorized_amount_max_cents" > 0)),
    CONSTRAINT "autopay_mandates_day_of_month_check" CHECK ((("day_of_month" IS NULL) OR (("day_of_month" >= 1) AND ("day_of_month" <= 28)))),
    CONSTRAINT "autopay_mandates_mode_check" CHECK (("mode" = ANY (ARRAY['fixed'::"text", 'current_balance'::"text", 'minimum'::"text", 'recurring_only'::"text", 'special_only'::"text"])))
);


ALTER TABLE "public"."autopay_mandates" OWNER TO "postgres";


COMMENT ON TABLE "public"."autopay_mandates" IS 'Recurring-payment authorization from the homeowner. ACH autopay is the single biggest processor-cost saver vs one-off card payments.';



CREATE OR REPLACE FUNCTION "public"."cancel_autopay"("p_mandate_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "public"."autopay_mandates"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare m public.autopay_mandates;
begin
  select * into m from public.autopay_mandates where id = p_mandate_id;
  if not found then raise exception 'autopay mandate not found'; end if;
  if m.owner_id <> public.current_owner_id() and not public.can_manage_finance(m.portfolio_id) then
    raise exception 'permission denied';
  end if;
  update public.autopay_mandates
     set status = 'canceled', canceled_at = now(), canceled_by = auth.uid(),
         paused_reason = p_reason, updated_at = now()
   where id = p_mandate_id
   returning * into m;
  return m;
end;
$$;


ALTER FUNCTION "public"."cancel_autopay"("p_mandate_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cast_board_approval"("p_request_id" "uuid", "p_decision" "text", "p_signature" "text", "p_comment" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  r              public.approval_requests%rowtype;
  v_member_id    uuid;
  v_for          int;
  v_against      int;
  v_abstain      int;
  v_eligible     int;
  v_new_status   public.approval_request_status;
begin
  -- Load the request.
  select * into r from public.approval_requests where id = p_request_id;
  if not found then
    raise exception 'Approval request not found';
  end if;

  -- Resolve the caller's active board membership for this request's association.
  select bm.id into v_member_id
  from public.board_members bm
  where bm.auth_user_id = auth.uid()
    and bm.active
    and bm.association_id = r.association_id
  limit 1;
  if v_member_id is null then
    raise exception 'Not a board member for this request';
  end if;

  -- Validate decision.
  if p_decision not in ('approve','reject','abstain') then
    raise exception 'Invalid decision: %', p_decision;
  end if;

  -- Signature required when the request demands signatures.
  if coalesce(r.signatures_required, false) and (p_signature is null or btrim(p_signature) = '') then
    raise exception 'Signature required';
  end if;

  -- Upsert this member's decision.
  insert into public.approval_decisions
    (approval_request_id, board_member_id, decided_by, decision, signature_name, comment, decided_at)
  values
    (p_request_id, v_member_id, auth.uid(), p_decision, nullif(btrim(coalesce(p_signature,'')), ''), nullif(btrim(coalesce(p_comment,'')), ''), now())
  on conflict (approval_request_id, decided_by) do update
    set decision      = excluded.decision,
        signature_name = excluded.signature_name,
        comment        = excluded.comment,
        board_member_id = excluded.board_member_id,
        decided_at     = now();

  -- Recompute tallies.
  select
    count(*) filter (where decision = 'approve'),
    count(*) filter (where decision = 'reject'),
    count(*) filter (where decision = 'abstain')
  into v_for, v_against, v_abstain
  from public.approval_decisions
  where approval_request_id = p_request_id;

  -- Eligible voters.
  if r.board_member_ids is not null and array_length(r.board_member_ids, 1) > 0 then
    v_eligible := array_length(r.board_member_ids, 1);
  else
    select count(*) into v_eligible
    from public.board_members
    where association_id = r.association_id and active;
  end if;
  v_eligible := greatest(coalesce(v_eligible, 0), 0);

  -- Resolve status by voting scheme.
  v_new_status := null;
  if r.voting_scheme = 'any_one_approver' then
    if v_for >= 1 then
      v_new_status := 'approved';
    elsif (v_for + v_against + v_abstain) >= v_eligible and v_for = 0 then
      v_new_status := 'rejected';
    end if;
  elsif r.voting_scheme = 'majority_approval_required' then
    if v_for > v_eligible / 2.0 then
      v_new_status := 'approved';
    elsif v_against >= ceil(v_eligible / 2.0) then
      v_new_status := 'rejected';
    end if;
  elsif r.voting_scheme = 'unanimous_approval_required' then
    if v_eligible > 0 and v_for = v_eligible then
      v_new_status := 'approved';
    elsif v_against >= 1 then
      v_new_status := 'rejected';
    end if;
  elsif r.voting_scheme = 'percentage_required' then
    if (v_for * 100.0 / greatest(v_eligible, 1)) >= coalesce(r.percentage_required, r.required_votes, 100) then
      v_new_status := 'approved';
    elsif ((v_eligible - v_against - v_abstain) * 100.0 / greatest(v_eligible, 1)) < coalesce(r.percentage_required, 100) then
      v_new_status := 'rejected';
    end if;
  end if;

  -- Persist tallies (and resolution if reached). Do not override a non-pending status.
  if v_new_status is not null and r.status = 'pending' then
    update public.approval_requests
      set votes_for     = v_for,
          votes_against = v_against,
          votes_abstain = v_abstain,
          status        = v_new_status,
          decision_by   = auth.uid(),
          decision_at   = now()
      where id = p_request_id;
  else
    update public.approval_requests
      set votes_for     = v_for,
          votes_against = v_against,
          votes_abstain = v_abstain
      where id = p_request_id;
  end if;
end;
$$;


ALTER FUNCTION "public"."cast_board_approval"("p_request_id" "uuid", "p_decision" "text", "p_signature" "text", "p_comment" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_insurance_expirations"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.insurance_policies
  set status = 'expiring_soon', updated_at = now()
  where status = 'active'
    and expiration_date <= (current_date + interval '30 days')
    and expiration_date > current_date;

  update public.insurance_policies
  set status = 'expired', updated_at = now()
  where status in ('active', 'expiring_soon')
    and expiration_date < current_date;
end;
$$;


ALTER FUNCTION "public"."check_insurance_expirations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_portfolio_not_suspended"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  is_suspended boolean;
begin
  if new.portfolio_id is not null then
    select suspended_at is not null into is_suspended
      from public.portfolios where id = new.portfolio_id;
    if is_suspended then
      raise exception 'portfolio % is suspended; no new user assignments allowed', new.portfolio_id;
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."check_portfolio_not_suspended"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_seat_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  sub public.subscriptions;
  current_staff_count integer;
begin
  if new.portfolio_id is null or new.hoa_role <> 'manager' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.portfolio_id = new.portfolio_id and old.hoa_role = 'manager' then
    return new;  -- no-op for this table
  end if;

  select * into sub from public.subscriptions where portfolio_id = new.portfolio_id;
  if not found then
    return new;  -- no subscription = no limit enforced
  end if;

  select count(*) into current_staff_count
    from public.profiles
   where portfolio_id = new.portfolio_id and hoa_role = 'manager';

  if current_staff_count >= sub.seats_included then
    raise exception 'portfolio % has reached its seat limit (% of %). Upgrade to add more staff.',
      new.portfolio_id, current_staff_count, sub.seats_included
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."check_seat_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_owner_invitation"("p_invitation_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  UPDATE public.user_invitations
  SET status = 'sent', updated_at = now()
  WHERE id = p_invitation_id AND status = 'staged';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invitation not found or not in staged status');
  END IF;

  UPDATE public.email_queue
  SET status = 'queued'
  WHERE reference_id = p_invitation_id AND reference_type = 'user_invitation';

  RETURN jsonb_build_object('success', true);
END;
$$;


ALTER FUNCTION "public"."confirm_owner_invitation"("p_invitation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_api_key"("p_portfolio_id" "uuid", "p_name" "text", "p_scopes" "text"[] DEFAULT '{}'::"text"[], "p_expires_days" integer DEFAULT NULL::integer) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public', 'extensions'
    AS $$
declare
  raw_key text;
  key_prefix text;
  k_hash text;
  new_id uuid;
begin
  -- Generates a 48-char hex key prefixed with cak_ (Condo App Key)
  raw_key := 'cak_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  key_prefix := substring(raw_key from 1 for 12);
  k_hash := encode(extensions.digest(raw_key, 'sha256'), 'hex');

  insert into public.api_keys (
    portfolio_id, name, prefix, key_hash, scopes, created_by, expires_at
  ) values (
    p_portfolio_id, p_name, key_prefix, k_hash, coalesce(p_scopes, '{}'),
    auth.uid(),
    case when p_expires_days is not null then now() + make_interval(days => p_expires_days) end
  ) returning id into new_id;

  return jsonb_build_object(
    'id', new_id,
    'api_key', raw_key,
    'prefix', key_prefix,
    'warning', 'Store this key securely — it will not be shown again.'
  );
end;
$$;


ALTER FUNCTION "public"."create_api_key"("p_portfolio_id" "uuid", "p_name" "text", "p_scopes" "text"[], "p_expires_days" integer) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "hoa_role" "public"."hoa_role" DEFAULT 'manager'::"public"."hoa_role" NOT NULL,
    "role_id" "uuid",
    "token" "text" DEFAULT ("replace"(("gen_random_uuid"())::"text", '-'::"text", ''::"text") || "replace"(("gen_random_uuid"())::"text", '-'::"text", ''::"text")) NOT NULL,
    "status" "public"."invitation_status" DEFAULT 'pending'::"public"."invitation_status" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '14 days'::interval) NOT NULL,
    "used_at" timestamp with time zone,
    "used_by" "uuid",
    "invited_by" "uuid",
    "message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "mvp_role" "public"."mvp_company_role",
    "unit_id" "uuid",
    "association_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "full_name" "text",
    "role" "text",
    "association_id" "uuid",
    "accepted_at" timestamp with time zone,
    "created_by" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "user_invitations_email_check" CHECK ((("length"("email") >= 3) AND ("length"("email") <= 320)))
);


ALTER TABLE "public"."user_invitations" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_invitations" IS 'Tokenized email invites. Portfolio admins create invitations; recipients accept via token RPC → auto-links profile to portfolio + role.';



COMMENT ON COLUMN "public"."user_invitations"."mvp_role" IS 'Role to assign on accept: company_admin / manager / assistant_manager / accountant. NULL when invitation is for board/owner/tenant (those use hoa_role + unit_id / board_members links instead).';



COMMENT ON COLUMN "public"."user_invitations"."association_ids" IS 'For manager/assistant_manager invitations: associations they will be assigned to on accept. Empty for company_admin/accountant (full company access) or non-staff invites.';



CREATE OR REPLACE FUNCTION "public"."create_invitation"("p_portfolio_id" "uuid", "p_email" "text", "p_hoa_role" "public"."hoa_role" DEFAULT 'manager'::"public"."hoa_role", "p_role_id" "uuid" DEFAULT NULL::"uuid", "p_message" "text" DEFAULT NULL::"text", "p_expires_days" integer DEFAULT 14) RETURNS "public"."user_invitations"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  inv public.user_invitations;
begin
  insert into public.user_invitations (
    portfolio_id, email, hoa_role, role_id, message, invited_by, expires_at
  ) values (
    p_portfolio_id, lower(p_email), p_hoa_role, p_role_id, p_message, auth.uid(),
    now() + make_interval(days => p_expires_days)
  )
  returning * into inv;
  return inv;
end;
$$;


ALTER FUNCTION "public"."create_invitation"("p_portfolio_id" "uuid", "p_email" "text", "p_hoa_role" "public"."hoa_role", "p_role_id" "uuid", "p_message" "text", "p_expires_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_board_association_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select association_id from public.board_members
   where auth_user_id = auth.uid() and active
  union
  select bm.association_id from public.board_members bm
   join auth.users u on lower(u.email) = lower(bm.email)
   where u.id = auth.uid() and bm.active and bm.auth_user_id is null;
$$;


ALTER FUNCTION "public"."current_board_association_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_owner_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select coalesce(
    -- Strong link
    (select o.id from public.owners o
      where o.auth_user_id = auth.uid() and o.archived_at is null
      limit 1),
    -- Fallback: email match (for rows not yet auto-linked)
    (select o.id from public.owners o
      join auth.users u on lower(u.email) = lower(o.email)
      where u.id = auth.uid() and o.archived_at is null
      limit 1)
  );
$$;


ALTER FUNCTION "public"."current_owner_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."current_owner_id"() IS 'Resolves auth user → owners.id via email match. Null if no linked owner.';



CREATE OR REPLACE FUNCTION "public"."current_portfolio_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select p.portfolio_id
    from public.profiles p
   where p.id = auth.uid();
$$;


ALTER FUNCTION "public"."current_portfolio_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_resident_association_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select distinct b.association_id
    from public.occupancies o
    join public.units un on un.id = o.unit_id
    join public.buildings b on b.id = un.building_id
   where o.owner_id = public.current_owner_id()
     and o.status = 'current';
$$;


ALTER FUNCTION "public"."current_resident_association_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_resident_unit_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select o.unit_id
    from public.occupancies o
   where o.owner_id = public.current_owner_id()
     and o.status = 'current';
$$;


ALTER FUNCTION "public"."current_resident_unit_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_role_name"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$ select coalesce(ur.name, case p.hoa_role when 'owner' then 'Owner' when 'board' then 'Board Member' when 'tenant' then 'Tenant' when 'company_admin' then 'Company Admin' when 'manager' then 'Manager' else p.hoa_role::text end) from public.profiles p left join public.user_roles ur on ur.id=p.role_id where p.id=auth.uid(); $$;


ALTER FUNCTION "public"."current_role_name"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_vendor_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select coalesce(
    -- Strong link
    (select v.id from public.vendors v
      where v.auth_user_id = auth.uid()
        and v.archived_at is null
        and v.portal_activated
      limit 1),
    -- Fallback: jsonb email scan (expensive, but covers pre-linked rows)
    (select v.id from public.vendors v
      where v.archived_at is null
        and v.portal_activated
        and v.auth_user_id is null
        and exists (
          select 1
            from auth.users u
            cross join lateral jsonb_array_elements_text(v.emails) as e(email)
           where u.id = auth.uid()
             and lower(e.email) = lower(u.email)
        )
      limit 1)
  );
$$;


ALTER FUNCTION "public"."current_vendor_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."current_vendor_id"() IS 'Resolves auth user → vendors.id via email in vendors.emails jsonb + portal_activated.';



CREATE OR REPLACE FUNCTION "public"."delete_budget_line"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM budget_lines WHERE id = p_id;
END;
$$;


ALTER FUNCTION "public"."delete_budget_line"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dispatch_bill_webhook"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    perform public.dispatch_webhook(new.portfolio_id, 'bill.created'::public.webhook_event, to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    if new.status = 'approved' and old.status <> 'approved' then
      perform public.dispatch_webhook(new.portfolio_id, 'bill.approved'::public.webhook_event, to_jsonb(new));
    elsif new.status = 'paid' and old.status <> 'paid' then
      perform public.dispatch_webhook(new.portfolio_id, 'bill.paid'::public.webhook_event, to_jsonb(new));
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."dispatch_bill_webhook"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dispatch_calendar_maintenance_notify"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF NEW.notify_maintenance = true AND NEW.maintenance_notified_at IS NULL THEN
    -- Best-effort: try to fan out via the existing webhook dispatcher.
    -- Silently swallows errors so a failed webhook doesn't block the insert.
    BEGIN
      PERFORM public.dispatch_webhook(
        'calendar.maintenance_notify',
        jsonb_build_object(
          'event_id',        NEW.id,
          'portfolio_id',    NEW.portfolio_id,
          'association_id',  NEW.association_id,
          'title',           NEW.title,
          'event_type',      NEW.event_type,
          'start_datetime',  NEW.start_datetime,
          'end_datetime',    NEW.end_datetime,
          'location',        NEW.location,
          'instructions',    NEW.maintenance_instructions
        )
      );
    EXCEPTION WHEN others THEN
      NEW.maintenance_notify_error := SQLERRM;
    END;
  END IF;
  RETURN NEW;
END
$$;


ALTER FUNCTION "public"."dispatch_calendar_maintenance_notify"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dispatch_calendar_sms_notify"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF NEW.notify_sms = true AND NEW.sms_notified_at IS NULL THEN
    BEGIN
      PERFORM public.queue_calendar_sms(NEW.id);
    EXCEPTION WHEN others THEN
      NEW.sms_notify_error := SQLERRM;
    END;
  END IF;
  RETURN NEW;
END
$$;


ALTER FUNCTION "public"."dispatch_calendar_sms_notify"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dispatch_charge_status_webhook"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare pid uuid;
begin
  -- resolve portfolio
  select a.portfolio_id into pid
    from public.units u
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
   where u.id = new.unit_id;

  if pid is null then return new; end if;

  -- If amount was zeroed out or charge "voided" via update, fire charge.voided
  if tg_op = 'UPDATE' and new.amount is distinct from old.amount and coalesce(new.amount, 0) = 0 then
    perform public.dispatch_webhook(pid, 'charge.voided'::public.webhook_event, to_jsonb(new));
  elsif tg_op = 'UPDATE' and (new.description is distinct from old.description or new.amount is distinct from old.amount or new.due_date is distinct from old.due_date) then
    perform public.dispatch_webhook(pid, 'charge.updated'::public.webhook_event, to_jsonb(new));
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."dispatch_charge_status_webhook"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dispatch_charge_webhook"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  pid uuid;
begin
  select a.portfolio_id into pid
    from public.units u
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
   where u.id = new.unit_id;

  if pid is not null then
    perform public.dispatch_webhook(pid, 'charge.created'::public.webhook_event, to_jsonb(new));
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."dispatch_charge_webhook"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dispatch_inspection_webhook"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if tg_op = 'UPDATE' and new.status = 'completed' and old.status <> 'completed' then
    perform public.dispatch_webhook(new.portfolio_id, 'inspection.completed'::public.webhook_event, to_jsonb(new));
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."dispatch_inspection_webhook"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dispatch_notice_webhook"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare pid uuid;
begin
  if tg_op = 'UPDATE' and new.status = 'sent' and old.status <> 'sent' then
    select portfolio_id into pid from public.associations where id = new.association_id;
    if pid is not null then
      perform public.dispatch_webhook(pid, 'notice.sent'::public.webhook_event, to_jsonb(new));
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."dispatch_notice_webhook"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dispatch_owner_webhook"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if new.portfolio_id is null then return new; end if;

  if tg_op = 'INSERT' then
    perform public.dispatch_webhook(new.portfolio_id, 'owner.created'::public.webhook_event, to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    if new.email is distinct from old.email
       or new.full_name is distinct from old.full_name
       or new.phone is distinct from old.phone then
      perform public.dispatch_webhook(new.portfolio_id, 'owner.updated'::public.webhook_event, to_jsonb(new));
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."dispatch_owner_webhook"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dispatch_payment_intent_webhook"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare pid uuid;
begin
  select a.portfolio_id into pid
    from public.units u
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
   where u.id = new.unit_id;
  if pid is null then return new; end if;

  if new.status is distinct from old.status then
    if new.status = 'failed' then
      perform public.dispatch_webhook(pid, 'payment.failed'::public.webhook_event, to_jsonb(new));
    elsif new.status = 'refunded' then
      perform public.dispatch_webhook(pid, 'payment.refunded'::public.webhook_event, to_jsonb(new));
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."dispatch_payment_intent_webhook"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dispatch_payment_webhook"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  pid uuid;
begin
  select a.portfolio_id into pid
    from public.units u
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
   where u.id = new.unit_id;

  if pid is not null then
    perform public.dispatch_webhook(pid, 'payment.received'::public.webhook_event, to_jsonb(new));
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."dispatch_payment_webhook"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dispatch_sr_webhook"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    perform public.dispatch_webhook(new.portfolio_id, 'service_request.created'::public.webhook_event, to_jsonb(new));
  elsif tg_op = 'UPDATE' and new.status = 'completed' and old.status <> 'completed' then
    perform public.dispatch_webhook(new.portfolio_id, 'service_request.resolved'::public.webhook_event, to_jsonb(new));
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."dispatch_sr_webhook"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dispatch_statement_webhook"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare pid uuid;
begin
  select portfolio_id into pid from public.associations where id = new.association_id;
  if pid is not null then
    perform public.dispatch_webhook(pid, 'statement.generated'::public.webhook_event, to_jsonb(new));
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."dispatch_statement_webhook"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dispatch_violation_webhook"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare pid uuid;
begin
  select portfolio_id into pid from public.associations where id = new.association_id;
  if pid is null then return new; end if;

  if tg_op = 'INSERT' then
    perform public.dispatch_webhook(pid, 'violation.created'::public.webhook_event, to_jsonb(new));
  elsif tg_op = 'UPDATE' and new.status in ('cured','closed') and old.status not in ('cured','closed') then
    perform public.dispatch_webhook(pid, 'violation.resolved'::public.webhook_event, to_jsonb(new));
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."dispatch_violation_webhook"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dispatch_webhook"("p_portfolio_id" "uuid", "p_event" "public"."webhook_event", "p_payload" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  queued_count integer := 0;
  endpoint_row public.webhook_endpoints;
begin
  if not public.has_entitlement(p_portfolio_id, 'webhooks') then
    return 0;
  end if;

  for endpoint_row in
    select * from public.webhook_endpoints
     where portfolio_id = p_portfolio_id
       and active
       and (disabled_until is null or disabled_until < now())
       and p_event = any(events)
  loop
    insert into public.webhook_deliveries (endpoint_id, event_type, payload)
    values (endpoint_row.id, p_event, p_payload);
    queued_count := queued_count + 1;
  end loop;
  return queued_count;
end;
$$;


ALTER FUNCTION "public"."dispatch_webhook"("p_portfolio_id" "uuid", "p_event" "public"."webhook_event", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dispatch_wo_created_webhook"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare pid uuid;
begin
  select portfolio_id into pid from public.associations where id = new.association_id;
  if pid is not null then
    perform public.dispatch_webhook(pid, 'work_order.created'::public.webhook_event, to_jsonb(new));
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."dispatch_wo_created_webhook"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dispatch_wo_status_webhook"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  pid uuid;
begin
  if new.status is distinct from old.status then
    select a.portfolio_id into pid
      from public.associations a
     where a.id = new.association_id;

    if pid is not null then
      perform public.dispatch_webhook(
        pid,
        case when new.status in ('completed','done') then 'work_order.completed'
             else 'work_order.status_changed' end::public.webhook_event,
        jsonb_build_object(
          'work_order_id', new.id,
          'old_status', old.status,
          'new_status', new.status,
          'title', new.title,
          'priority', new.priority,
          'vendor_id', new.vendor_id,
          'unit_id', new.unit_id,
          'association_id', new.association_id
        )
      );
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."dispatch_wo_status_webhook"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."effective_late_fee_amount"("p_association_id" "uuid") RETURNS numeric
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select coalesce(a.late_fee_amount_override, p.default_late_fee_amount)
    from public.associations a join public.portfolios p on p.id = a.portfolio_id where a.id = p_association_id;
$$;


ALTER FUNCTION "public"."effective_late_fee_amount"("p_association_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."effective_late_fee_grace_days"("p_association_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select coalesce(a.late_fee_grace_days_override, p.default_late_fee_grace_days)
    from public.associations a join public.portfolios p on p.id = a.portfolio_id where a.id = p_association_id;
$$;


ALTER FUNCTION "public"."effective_late_fee_grace_days"("p_association_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."effective_nsf_fee_amount"("p_association_id" "uuid") RETURNS numeric
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select coalesce(a.nsf_fee_amount_override, p.default_nsf_fee_amount)
    from public.associations a join public.portfolios p on p.id = a.portfolio_id where a.id = p_association_id;
$$;


ALTER FUNCTION "public"."effective_nsf_fee_amount"("p_association_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_scheduled_reports"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  row record;
  n integer := 0;
  next_at timestamptz;
begin
  for row in
    select * from public.scheduled_reports
     where active and archived_at is null
       and (next_run_at is null or next_run_at <= now())
  loop
    insert into public.report_runs (
      portfolio_id, definition_id, saved_report_id, scheduled_report_id,
      status, parameters, output_format, triggered_by
    ) values (
      row.portfolio_id, row.definition_id, row.saved_report_id, row.id,
      'queued', row.parameters, row.output_format, row.created_by
    );

    -- Compute next_run_at based on frequency
    next_at := case row.frequency
      when 'daily'     then date_trunc('day', now()) + interval '1 day' + make_interval(hours => row.hour_utc)
      when 'weekly'    then date_trunc('week', now()) + interval '1 week' + make_interval(days => coalesce(row.day_of_week, 1), hours => row.hour_utc)
      when 'biweekly'  then now() + interval '2 weeks'
      when 'monthly'   then date_trunc('month', now()) + interval '1 month' + make_interval(days => coalesce(row.day_of_month, 1) - 1, hours => row.hour_utc)
      when 'quarterly' then date_trunc('quarter', now()) + interval '3 months'
      when 'annually'  then date_trunc('year', now()) + interval '1 year'
    end;

    update public.scheduled_reports
       set next_run_at = next_at, last_run_at = now(), updated_at = now()
     where id = row.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;


ALTER FUNCTION "public"."enqueue_scheduled_reports"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enroll_autopay"("p_unit_id" "uuid", "p_payment_method_id" "uuid", "p_authorized_max_cents" integer, "p_frequency" "public"."autopay_frequency" DEFAULT 'on_charge_posted'::"public"."autopay_frequency") RETURNS "public"."autopay_mandates"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  m public.autopay_mandates;
  v_owner uuid := public.current_owner_id();
  v_portfolio uuid;
  v_assoc uuid;
begin
  if v_owner is null then
    raise exception 'must be logged in as a homeowner to enroll';
  end if;

  select a.portfolio_id, a.id into v_portfolio, v_assoc
    from public.units u
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
   where u.id = p_unit_id;

  if not exists (
    select 1 from public.occupancies o
     where o.unit_id = p_unit_id and o.owner_id = v_owner and o.status = 'current'
  ) then
    raise exception 'you are not a current occupant of this unit';
  end if;

  if not exists (
    select 1 from public.payment_methods pm
     where pm.id = p_payment_method_id and pm.owner_id = v_owner and pm.archived_at is null
  ) then
    raise exception 'payment method not found or not owned by you';
  end if;

  insert into public.autopay_mandates (
    portfolio_id, association_id, owner_id, unit_id, payment_method_id,
    authorized_amount_max_cents, frequency, status,
    mandate_signed_at
  ) values (
    v_portfolio, v_assoc, v_owner, p_unit_id, p_payment_method_id,
    p_authorized_max_cents, p_frequency, 'active',
    now()
  ) returning * into m;
  return m;
end;
$$;


ALTER FUNCTION "public"."enroll_autopay"("p_unit_id" "uuid", "p_payment_method_id" "uuid", "p_authorized_max_cents" integer, "p_frequency" "public"."autopay_frequency") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_operating_and_reserve_accounts"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  op_id uuid;
  rs_id uuid;
BEGIN
  INSERT INTO public.bank_accounts (portfolio_id, association_id, name, account_type, purpose)
  VALUES (NEW.portfolio_id, NEW.id, 'Operating', 'checking', 'operating')
  RETURNING id INTO op_id;

  INSERT INTO public.bank_accounts (portfolio_id, association_id, name, account_type, purpose)
  VALUES (NEW.portfolio_id, NEW.id, 'Reserve', 'savings', 'reserve')
  RETURNING id INTO rs_id;

  UPDATE public.associations
    SET operating_bank_account_id = op_id,
        reserve_bank_account_id   = rs_id
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_operating_and_reserve_accounts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_invite_token"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$;


ALTER FUNCTION "public"."generate_invite_token"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_monthly_statements"("p_year" integer DEFAULT (EXTRACT(year FROM ("now"() - '1 mon'::interval)))::integer, "p_month" integer DEFAULT (EXTRACT(month FROM ("now"() - '1 mon'::interval)))::integer) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  n_statements integer := 0;
  row record;
  period_start date;
  period_end date;
begin
  period_start := make_date(p_year, p_month, 1);
  period_end := (period_start + interval '1 month')::date;

  for row in
    select u.id as unit_id, b.association_id, occ.owner_id,
           -- opening balance: charges - payments before period_start
           coalesce((select sum(amount) from public.charges
                     where unit_id = u.id and due_date < period_start), 0)
           -
           coalesce((select sum(amount) from public.payments
                     where unit_id = u.id and payment_date < period_start), 0)
             as opening_balance,
           coalesce((select sum(amount) from public.charges
                     where unit_id = u.id and due_date >= period_start and due_date < period_end), 0)
             as total_charges,
           coalesce((select sum(amount) from public.payments
                     where unit_id = u.id and payment_date >= period_start and payment_date < period_end), 0)
             as total_payments
      from public.units u
      join public.buildings b on b.id = u.building_id
      join public.occupancies occ on occ.unit_id = u.id and occ.status = 'current' and occ.is_primary
     where u.archived_at is null
  loop
    insert into public.statements (
      owner_id, unit_id, association_id, period_month, period_year,
      opening_balance, total_charges, total_payments, closing_balance
    ) values (
      row.owner_id, row.unit_id, row.association_id, p_month, p_year,
      row.opening_balance, row.total_charges, row.total_payments,
      row.opening_balance + row.total_charges - row.total_payments
    )
    on conflict do nothing;

    if found then n_statements := n_statements + 1; end if;
  end loop;

  return n_statements;
end;
$$;


ALTER FUNCTION "public"."generate_monthly_statements"("p_year" integer, "p_month" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_owner_payable_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_year text;
  v_seq int;
BEGIN
  v_year := to_char(CURRENT_DATE, 'YYYY');
  SELECT COALESCE(MAX(NULLIF(regexp_replace(payable_number, '^OP-\d{4}-', ''), '')::int), 0) + 1
    INTO v_seq
    FROM owner_payables
    WHERE payable_number LIKE 'OP-' || v_year || '-%';
  NEW.payable_number := 'OP-' || v_year || '-' || lpad(v_seq::text, 4, '0');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_owner_payable_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_owner_statements"("p_association_id" "uuid", "p_period_start" "date", "p_period_end" "date", "p_delivery_channel" "text" DEFAULT 'email'::"text", "p_batch_name" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_batch_id uuid;
  v_created_by uuid;
  v_owner record;
  v_total_due numeric;
  v_amount_due numeric;
  v_amount_past_due numeric;
BEGIN
  v_created_by := (auth.uid())::uuid;
  
  -- Create batch
  INSERT INTO statement_batches (
    association_id,
    batch_name,
    period_start,
    period_end,
    delivery_channel,
    status,
    created_by
  ) VALUES (
    p_association_id,
    COALESCE(p_batch_name, 'Statement batch ' || to_char(p_period_end, 'Mon YYYY')),
    p_period_start,
    p_period_end,
    p_delivery_channel,
    'generating',
    v_created_by
  ) RETURNING id INTO v_batch_id;
  
  -- For each owner with current occupancy in the association
  FOR v_owner IN
    SELECT 
      o.id AS owner_id,
      occ.unit_id,
      occ.id AS occupancy_id,
      o.email
    FROM occupancies occ
    JOIN owners o ON o.id = occ.owner_id
    WHERE occ.association_id = p_association_id
      AND occ.status = 'current'
      AND o.archived_at IS NULL
  LOOP
    -- Calculate amounts from charges
    SELECT 
      COALESCE(SUM(CASE WHEN c.due_date <= p_period_end THEN c.amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN c.due_date < p_period_start THEN c.amount ELSE 0 END), 0)
    INTO v_total_due, v_amount_past_due
    FROM charges c
    WHERE c.unit_id = v_owner.unit_id;
    
    -- Subtract payments
    SELECT v_total_due - COALESCE(SUM(p.amount), 0) INTO v_amount_due
    FROM payments p
    WHERE p.unit_id = v_owner.unit_id
      AND p.payment_date <= p_period_end;
    
    INSERT INTO owner_statements (
      batch_id,
      association_id,
      owner_id,
      unit_id,
      occupancy_id,
      period_start,
      period_end,
      delivery_channel,
      delivery_status,
      amount_due,
      amount_past_due,
      total_due,
      created_by
    ) VALUES (
      v_batch_id,
      p_association_id,
      v_owner.owner_id,
      v_owner.unit_id,
      v_owner.occupancy_id,
      p_period_start,
      p_period_end,
      p_delivery_channel,
      'pending',
      GREATEST(v_amount_due, 0),
      GREATEST(v_amount_past_due, 0),
      GREATEST(v_total_due, 0),
      v_created_by
    );
  END LOOP;
  
  -- Update batch counts
  UPDATE statement_batches SET
    total_owners = (SELECT count(*) FROM owner_statements WHERE batch_id = v_batch_id),
    generated_count = (SELECT count(*) FROM owner_statements WHERE batch_id = v_batch_id),
    status = 'generated',
    updated_at = now()
  WHERE id = v_batch_id;
  
  RETURN v_batch_id;
END;
$$;


ALTER FUNCTION "public"."generate_owner_statements"("p_association_id" "uuid", "p_period_start" "date", "p_period_end" "date", "p_delivery_channel" "text", "p_batch_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_portfolio_slug"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $_$
    BEGIN
      IF NEW.slug IS NULL AND NEW.company_name IS NOT NULL THEN
        NEW.slug := lower(regexp_replace(regexp_replace(NEW.company_name, '[^a-zA-Z0-9]+', '-', 'g'), '^-+|-+$', '', 'g'));
      END IF;
      RETURN NEW;
    END;
    $_$;


ALTER FUNCTION "public"."generate_portfolio_slug"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_recurring_bills"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  row record;
  next_due date;
  n integer := 0;
  new_bill_id uuid;
begin
  for row in
    select * from public.recurring_bills
     where auto_generate and archived_at is null
       and next_post_date <= current_date
       and (end_date is null or next_post_date <= end_date)
  loop
    insert into public.payable_bills (
      portfolio_id, vendor_id, association_id, gl_account_id, bank_account_id,
      bill_date, due_date, amount, memo, status, paid_at, approved_at, created_by
    ) values (
      row.portfolio_id, row.vendor_id, row.association_id, row.gl_account_id, row.bank_account_id,
      current_date, current_date + 30, row.amount,
      row.memo || ' (recurring)',
      case when row.is_auto_pay then 'paid'::public.payable_bill_status else 'draft'::public.payable_bill_status end,
      case when row.is_auto_pay then now() else null end,
      case when row.is_auto_pay then now() else null end,
      row.created_by
    ) returning id into new_bill_id;

    next_due := case row.frequency
      when 'daily'     then row.next_post_date + (row.interval_count || ' days')::interval
      when 'weekly'    then row.next_post_date + (row.interval_count || ' weeks')::interval
      when 'monthly'   then row.next_post_date + (row.interval_count || ' months')::interval
      when 'quarterly' then row.next_post_date + (row.interval_count * 3 || ' months')::interval
      when 'annually'  then row.next_post_date + (row.interval_count || ' years')::interval
    end::date;

    update public.recurring_bills
       set next_post_date = next_due, last_generated_at = now(), updated_at = now()
     where id = row.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;


ALTER FUNCTION "public"."generate_recurring_bills"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_recurring_journal_entries"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare row record; new_entry_id uuid; line jsonb; next_due date; n integer := 0;
begin
  for row in
    select * from public.recurring_journal_entries
     where auto_generate and archived_at is null and next_post_date <= current_date
  loop
    insert into public.journal_entries (
      portfolio_id, entry_date, memo, source_type, source_id, created_by, posted
    ) values (
      row.portfolio_id, current_date, row.memo || ' (recurring)', 'recurring_je', row.id, row.created_by, false
    ) returning id into new_entry_id;
    for line in select * from jsonb_array_elements(row.template_lines) loop
      insert into public.journal_lines (entry_id, gl_account_id, association_id, debit_amount, credit_amount, memo)
      values (
        new_entry_id, (line->>'gl_account_id')::uuid, (line->>'association_id')::uuid,
        coalesce((line->>'debit')::numeric, 0), coalesce((line->>'credit')::numeric, 0), line->>'memo'
      );
    end loop;
    update public.journal_entries set posted = true where id = new_entry_id;
    next_due := case row.frequency
      when 'daily'     then row.next_post_date + (row.interval_count || ' days')::interval
      when 'weekly'    then row.next_post_date + (row.interval_count || ' weeks')::interval
      when 'monthly'   then row.next_post_date + (row.interval_count || ' months')::interval
      when 'quarterly' then row.next_post_date + (row.interval_count * 3 || ' months')::interval
      when 'annually'  then row.next_post_date + (row.interval_count || ' years')::interval
    end::date;
    update public.recurring_journal_entries set next_post_date = next_due, last_generated_at = now(), updated_at = now() where id = row.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;


ALTER FUNCTION "public"."generate_recurring_journal_entries"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_recurring_work_orders"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  row record;
  new_sr_id uuid;
  next_due date;
  n_generated integer := 0;
begin
  for row in
    select *
      from public.recurring_work_orders
     where auto_generate
       and archived_at is null
       and next_due_date <= current_date
       and (end_date is null or next_due_date <= end_date)
  loop
    -- Create parent service_request
    insert into public.service_requests (
      portfolio_id, association_id, unit_id,
      description, priority, source, created_by
    ) values (
      row.portfolio_id, row.association_id, row.unit_id,
      row.description || E'\n(auto-generated from recurring work order)',
      coalesce(row.priority::text, 'normal')::public.service_request_priority,
      'recurring', row.created_by
    ) returning id into new_sr_id;

    -- Create the work order
    insert into public.work_orders (
      service_request_id, portfolio_id, unit_id, association_id,
      title, description, category, priority, vendor_id,
      trade, created_by
    ) values (
      new_sr_id, row.portfolio_id, row.unit_id, row.association_id,
      row.title, row.description, row.category, row.priority, row.vendor_id,
      row.trade, row.created_by
    );

    -- Advance next_due_date based on frequency + interval_count
    next_due := case row.frequency
      when 'daily'     then row.next_due_date + (row.interval_count || ' days')::interval
      when 'weekly'    then row.next_due_date + (row.interval_count || ' weeks')::interval
      when 'monthly'   then row.next_due_date + (row.interval_count || ' months')::interval
      when 'quarterly' then row.next_due_date + (row.interval_count * 3 || ' months')::interval
      when 'annually'  then row.next_due_date + (row.interval_count || ' years')::interval
    end::date;

    update public.recurring_work_orders
       set next_due_date = next_due,
           last_generated_at = now(),
           updated_at = now()
     where id = row.id;

    n_generated := n_generated + 1;
  end loop;

  return n_generated;
end;
$$;


ALTER FUNCTION "public"."generate_recurring_work_orders"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_budget_vs_actuals"("p_association_id" "uuid", "p_fiscal_year" integer) RETURNS TABLE("budget_line_id" "uuid", "gl_account_id" "uuid", "gl_account_number" integer, "gl_account_name" "text", "category" "text", "notes" "text", "monthly_budget" numeric[], "monthly_actuals" numeric[], "monthly_variance" numeric[], "annual_budget" numeric, "annual_actual" numeric, "annual_variance" numeric, "annual_variance_pct" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_month int;
  v_budget_line record;
  v_actual numeric;
  v_actuals numeric[];
  v_total_budget numeric := 0;
  v_total_actual numeric := 0;
BEGIN
  FOR v_budget_line IN 
    SELECT bl.*, ga.number as gl_number, ga.name as gl_name
    FROM budget_lines bl
    JOIN gl_accounts ga ON ga.id = bl.gl_account_id
    WHERE bl.association_id = p_association_id
      AND bl.fiscal_year = p_fiscal_year
    ORDER BY ga.number
  LOOP
    v_actuals := ARRAY[0,0,0,0,0,0,0,0,0,0,0,0];
    
    FOR v_month IN 1..12 LOOP
      DECLARE
        v_start date := make_date(p_fiscal_year, v_month, 1);
        v_end date := (v_start + interval '1 month')::date;
      BEGIN
        IF v_budget_line.category = 'expense' THEN
          SELECT COALESCE(SUM(pb.amount), 0) INTO v_actual
          FROM payable_bills pb
          WHERE pb.association_id = p_association_id
            AND pb.gl_account_id = v_budget_line.gl_account_id
            AND pb.occurred_on >= v_start
            AND pb.occurred_on < v_end
            AND pb.status IN ('paid', 'approved');
        ELSE
          SELECT COALESCE(SUM(c.amount), 0) INTO v_actual
          FROM charges c
          JOIN units u ON u.id = c.unit_id
          JOIN buildings b ON b.id = u.building_id
          WHERE b.association_id = p_association_id
            AND c.gl_account_id = v_budget_line.gl_account_id
            AND c.created_at::date >= v_start
            AND c.created_at::date < v_end;
        END IF;
        
        v_actuals[v_month] := v_actual;
      END;
    END LOOP;
    
    v_total_budget := 0;
    v_total_actual := 0;
    FOR v_month IN 1..12 LOOP
      v_total_budget := v_total_budget + v_budget_line.monthly_amounts[v_month];
      v_total_actual := v_total_actual + v_actuals[v_month];
    END LOOP;
    
    DECLARE
      v_variances numeric[];
    BEGIN
      v_variances := ARRAY[0,0,0,0,0,0,0,0,0,0,0,0];
      FOR v_month IN 1..12 LOOP
        v_variances[v_month] := v_actuals[v_month] - v_budget_line.monthly_amounts[v_month];
      END LOOP;
      
      budget_line_id := v_budget_line.id;
      gl_account_id := v_budget_line.gl_account_id;
      gl_account_number := v_budget_line.gl_number;
      gl_account_name := v_budget_line.gl_name;
      category := v_budget_line.category;
      notes := v_budget_line.notes;
      monthly_budget := v_budget_line.monthly_amounts;
      monthly_actuals := v_actuals;
      monthly_variance := v_variances;
      annual_budget := v_total_budget;
      annual_actual := v_total_actual;
      annual_variance := v_total_actual - v_total_budget;
      annual_variance_pct := CASE 
        WHEN v_total_budget != 0 THEN ROUND(((v_total_actual - v_total_budget) / v_total_budget * 100)::numeric, 1)
        ELSE 0 
      END;
      
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."get_budget_vs_actuals"("p_association_id" "uuid", "p_fiscal_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_charge_categories_for_portfolio"() RETURNS TABLE("id" "uuid", "name" "text", "code" "text", "charge_type" "text", "is_assessment" boolean, "default_amount" numeric, "default_frequency" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT id, name, code, charge_type, is_assessment, default_amount, default_frequency
  FROM charge_categories
  WHERE active = true
  ORDER BY sort_order, name;
$$;


ALTER FUNCTION "public"."get_charge_categories_for_portfolio"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_meeting_financial_snapshot"("p_association_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_result jsonb;
  v_total_receivables numeric := 0;
  v_total_payables numeric := 0;
  v_delinquency_count int := 0;
  v_bank_balance numeric := 0;
  v_current_month_income numeric := 0;
  v_current_month_expenses numeric := 0;
BEGIN
  -- Total open receivables
  SELECT COALESCE(SUM(c.amount), 0) INTO v_total_receivables
  FROM charges c
  JOIN units u ON u.id = c.unit_id
  JOIN buildings b ON b.id = u.building_id
  WHERE b.association_id = p_association_id
    AND c.paid = false;

  -- Total open payables
  SELECT COALESCE(SUM(amount), 0) INTO v_total_payables
  FROM payable_bills
  WHERE association_id = p_association_id
    AND status NOT IN ('paid', 'cancelled', 'void');

  -- Delinquency count (owners behind on dues)
  SELECT COUNT(*) INTO v_delinquency_count
  FROM occupancies o
  JOIN units u ON u.id = o.unit_id
  JOIN buildings b ON b.id = u.building_id
  WHERE b.association_id = p_association_id
    AND o.dues_paid_through < date_trunc('month', now())::date;

  -- Total bank balance
  SELECT COALESCE(SUM(current_balance), 0) INTO v_bank_balance
  FROM bank_accounts
  WHERE association_id = p_association_id;

  -- Current month income
  SELECT COALESCE(SUM(c.amount), 0) INTO v_current_month_income
  FROM charges c
  JOIN units u ON u.id = c.unit_id
  JOIN buildings b ON b.id = u.building_id
  WHERE b.association_id = p_association_id
    AND c.created_at >= date_trunc('month', now());

  -- Current month expenses
  SELECT COALESCE(SUM(amount), 0) INTO v_current_month_expenses
  FROM payable_bills
  WHERE association_id = p_association_id
    AND occurred_on >= date_trunc('month', now())::date
    AND status IN ('paid', 'approved');

  v_result := jsonb_build_object(
    'total_receivables', v_total_receivables,
    'total_payables', v_total_payables,
    'delinquency_count', v_delinquency_count,
    'bank_balance', v_bank_balance,
    'current_month_income', v_current_month_income,
    'current_month_expenses', v_current_month_expenses,
    'net_income', v_current_month_income - v_current_month_expenses,
    'generated_at', now()
  );

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_meeting_financial_snapshot"("p_association_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_vault_secret"("p_name" "text") RETURNS "text"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'vault'
    AS $$
  select decrypted_secret from vault.decrypted_secrets where name = p_name limit 1;
$$;


ALTER FUNCTION "public"."get_vault_secret"("p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_closed_period_on_je"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare period_row public.accounting_periods;
begin
  if new.posted = true and (tg_op = 'INSERT' or old.posted = false or old.posted is null) then
    select * into period_row from public.accounting_periods
     where portfolio_id = new.portfolio_id
       and fiscal_year = extract(year from new.entry_date)::int
       and period_month = extract(month from new.entry_date)::int;
    if found and period_row.status = 'closed' then
      raise exception 'cannot post journal entry to closed period %/%', period_row.fiscal_year, period_row.period_month;
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."guard_closed_period_on_je"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_cross_fund_transfer"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  from_fund text;
  to_fund text;
begin
  select fund_type into from_fund from public.bank_accounts where id = new.from_bank_account_id;
  select fund_type into to_fund from public.bank_accounts where id = new.to_bank_account_id;
  if from_fund is distinct from to_fund and new.authorized_by is null then
    raise exception 'Transfers between % and % funds require explicit authorization (set authorized_by with an authorization note).', from_fund, to_fund;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."guard_cross_fund_transfer"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_profile_privilege_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  is_privilege_change boolean;
begin
  is_privilege_change :=
    (new.portfolio_id is distinct from old.portfolio_id)
    or (new.role_id is distinct from old.role_id)
    or (new.hoa_role is distinct from old.hoa_role);

  if is_privilege_change then
    if auth.uid() is null then
      return new;
    end if;
    if not (
      public.is_platform_operator()
      or public.can_admin_portfolio(coalesce(new.portfolio_id, old.portfolio_id))
    ) then
      raise exception 'profile privilege change denied: requires platform operator or full-access staff in portfolio %',
        coalesce(new.portfolio_id, old.portfolio_id)::text;
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."guard_profile_privilege_changes"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."guard_profile_privilege_changes"() IS 'Prevents self-escalation. A user cannot change their own portfolio_id / role_id / hoa_role via UPDATE; only platform operators or portfolio admins can.';



CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  insert into public.profiles (id, email, hoa_role)
  values (
    new.id,
    new.email,
    -- Default to 'owner' for portal signups. Staff get upgraded via invitation acceptance.
    'owner'::public.hoa_role
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_entitlement"("p_portfolio_id" "uuid", "p_feature_key" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select exists (
    select 1
      from public.portfolios p
      join public.feature_entitlements fe on true
     where p.id = p_portfolio_id
       and fe.key = p_feature_key
       and case
             when fe.min_tier = 'foundation' then true
             when fe.min_tier = 'growth' then p.tier in ('growth','portfolio','enterprise')
             when fe.min_tier = 'portfolio' then p.tier in ('portfolio','enterprise')
             when fe.min_tier = 'enterprise' then p.tier = 'enterprise'
           end
       and p.suspended_at is null
  );
$$;


ALTER FUNCTION "public"."has_entitlement"("p_portfolio_id" "uuid", "p_feature_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("role_name" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select exists (
    select 1 from public.profiles p
    join public.user_roles ur on ur.id = p.role_id
    where p.id = auth.uid() and ur.name = role_name
  );
$$;


ALTER FUNCTION "public"."has_role"("role_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invite_board_member"("p_email" "text", "p_full_name" "text", "p_association_id" "uuid", "p_board_role" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_user_id uuid;
  v_portfolio_id uuid;
  v_token text;
  v_invitation_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT portfolio_id INTO v_portfolio_id FROM public.associations WHERE id = p_association_id;
  IF v_portfolio_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Association not found');
  END IF;

  v_token := public.generate_invite_token();
  
  INSERT INTO public.user_invitations (email, full_name, role, association_id, portfolio_id, token, created_by, status, expires_at, metadata)
  VALUES (p_email, p_full_name, 'board_member', p_association_id, v_portfolio_id, v_token, v_user_id::text, 'sent', now() + interval '7 days',
          jsonb_build_object('type', 'board_member', 'board_role', p_board_role, 'invited_by', v_user_id::text))
  RETURNING id INTO v_invitation_id;

  RETURN jsonb_build_object('success', true, 'invitation_id', v_invitation_id, 'token', v_token);
END;
$$;


ALTER FUNCTION "public"."invite_board_member"("p_email" "text", "p_full_name" "text", "p_association_id" "uuid", "p_board_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invite_company_admin"("p_email" "text", "p_full_name" "text", "p_company_name" "text", "p_portfolio_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_user_id uuid;
  v_portfolio_id uuid;
  v_token text;
  v_invitation_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- SUPERADMIN GATE: only platform operators can invite company admins
  IF NOT EXISTS (
    SELECT 1 FROM public.platform_operators 
    WHERE auth_user_id = v_user_id AND active = true
  ) THEN
    RETURN jsonb_build_object('error', 'Only platform operators can invite company admins');
  END IF;

  -- Use existing portfolio or create new one
  IF p_portfolio_id IS NOT NULL THEN
    v_portfolio_id := p_portfolio_id;
  ELSE
    INSERT INTO public.portfolios (company_name, created_by)
    VALUES (p_company_name, v_user_id::text)
    RETURNING id INTO v_portfolio_id;
  END IF;

  -- Check if this email already has a pending invitation for this portfolio
  IF EXISTS (
    SELECT 1 FROM public.user_invitations
    WHERE email = p_email AND portfolio_id = v_portfolio_id AND status = 'sent'
  ) THEN
    RETURN jsonb_build_object('error', 'An invitation is already pending for this email');
  END IF;

  v_token := public.generate_invite_token();
  
  INSERT INTO public.user_invitations (
    email, full_name, role, portfolio_id, token, created_by, 
    status, expires_at, metadata
  )
  VALUES (
    p_email, p_full_name, 'company_admin', v_portfolio_id, v_token, v_user_id::text, 
    'sent', now() + interval '7 days',
    jsonb_build_object(
      'type', 'company_admin', 
      'company_name', p_company_name,
      'invited_by', v_user_id::text
    )
  )
  RETURNING id INTO v_invitation_id;

  RETURN jsonb_build_object(
    'success', true, 
    'invitation_id', v_invitation_id, 
    'portfolio_id', v_portfolio_id,
    'token', v_token
  );
END;
$$;


ALTER FUNCTION "public"."invite_company_admin"("p_email" "text", "p_full_name" "text", "p_company_name" "text", "p_portfolio_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invite_homeowner"("p_portfolio_id" "uuid", "p_owner_id" "uuid", "p_email" "text" DEFAULT NULL::"text", "p_message" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  resolved_email text;
  new_invitation public.user_invitations;
begin
  if not public.can_access_portfolio(p_portfolio_id) then
    raise exception 'invite_homeowner: must be staff of portfolio';
  end if;

  resolved_email := coalesce(p_email, (select email from public.owners where id = p_owner_id));
  if resolved_email is null then
    raise exception 'invite_homeowner: no email on owner % and none provided', p_owner_id;
  end if;

  insert into public.user_invitations (
    portfolio_id, email, hoa_role, invited_by, message, expires_at
  ) values (
    p_portfolio_id, lower(resolved_email), 'owner', auth.uid(),
    coalesce(p_message, 'You have been invited to the homeowner portal.'),
    now() + interval '30 days'
  ) returning * into new_invitation;

  return jsonb_build_object(
    'invitation_id', new_invitation.id,
    'token', new_invitation.token,
    'email', resolved_email,
    'expires_at', new_invitation.expires_at
  );
end;
$$;


ALTER FUNCTION "public"."invite_homeowner"("p_portfolio_id" "uuid", "p_owner_id" "uuid", "p_email" "text", "p_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invite_owner"("p_email" "text", "p_full_name" "text", "p_association_id" "uuid", "p_unit_number" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_user_id uuid;
  v_portfolio_id uuid;
  v_unit_id uuid;
  v_token text;
  v_invitation_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT portfolio_id INTO v_portfolio_id FROM public.associations WHERE id = p_association_id;
  
  SELECT u.id INTO v_unit_id 
  FROM public.units u 
  JOIN public.buildings b ON b.id = u.building_id 
  WHERE b.association_id = p_association_id AND u.unit_number = p_unit_number AND u.archived_at IS NULL
  LIMIT 1;

  v_token := public.generate_invite_token();
  
  INSERT INTO public.user_invitations (email, full_name, role, association_id, portfolio_id, token, created_by, status, expires_at, metadata)
  VALUES (p_email, p_full_name, 'homeowner', p_association_id, v_portfolio_id, v_token, v_user_id::text, 'sent', now() + interval '7 days',
          jsonb_build_object('type', 'homeowner', 'unit_id', v_unit_id, 'unit_number', p_unit_number, 'invited_by', v_user_id::text))
  RETURNING id INTO v_invitation_id;

  RETURN jsonb_build_object('success', true, 'invitation_id', v_invitation_id, 'token', v_token);
END;
$$;


ALTER FUNCTION "public"."invite_owner"("p_email" "text", "p_full_name" "text", "p_association_id" "uuid", "p_unit_number" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invite_property_manager"("p_email" "text", "p_full_name" "text", "p_unit_ids" "uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_user_id uuid;
  v_portfolio_id uuid;
  v_token text;
  v_invitation_id uuid;
  v_unit_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Get the caller's portfolio from their profile
  SELECT portfolio_id INTO v_portfolio_id FROM public.profiles WHERE id = v_user_id;
  
  IF v_portfolio_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No portfolio found for your account');
  END IF;

  -- Verify the caller is a company_admin or manager in this portfolio
  IF NOT EXISTS (
    SELECT 1 FROM public.user_invitations 
    WHERE email = (SELECT email FROM auth.users WHERE id = v_user_id)
    AND portfolio_id = v_portfolio_id 
    AND (role = 'company_admin' OR role = 'manager')
    AND status = 'accepted'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.platform_operators 
    WHERE auth_user_id = v_user_id AND active = true
  ) THEN
    RETURN jsonb_build_object('error', 'Only company admins can invite property managers');
  END IF;

  -- Verify all unit_ids belong to this portfolio
  IF array_length(p_unit_ids, 1) > 0 THEN
    FOR v_unit_id IN SELECT unnest(p_unit_ids) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.units u
        JOIN public.buildings b ON b.id = u.building_id
        WHERE u.id = v_unit_id AND b.association_id IN (
          SELECT id FROM public.associations WHERE portfolio_id = v_portfolio_id
        )
      ) THEN
        RETURN jsonb_build_object('error', 'Unit ' || v_unit_id || ' does not belong to your portfolio');
      END IF;
    END LOOP;
  END IF;

  v_token := public.generate_invite_token();
  
  INSERT INTO public.user_invitations (
    email, full_name, role, portfolio_id, token, created_by, 
    status, expires_at, metadata
  )
  VALUES (
    p_email, p_full_name, 'property_manager', v_portfolio_id, v_token, v_user_id::text, 
    'sent', now() + interval '7 days',
    jsonb_build_object(
      'type', 'property_manager',
      'unit_ids', p_unit_ids,
      'invited_by', v_user_id::text
    )
  )
  RETURNING id INTO v_invitation_id;

  RETURN jsonb_build_object(
    'success', true, 
    'invitation_id', v_invitation_id, 
    'token', v_token
  );
END;
$$;


ALTER FUNCTION "public"."invite_property_manager"("p_email" "text", "p_full_name" "text", "p_unit_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invite_staff"("p_email" "text", "p_full_name" "text", "p_role" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_user_id uuid;
  v_portfolio_id uuid;
  v_token text;
  v_invitation_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT portfolio_id INTO v_portfolio_id FROM public.profiles WHERE id = v_user_id;
  
  IF v_portfolio_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.platform_operators WHERE auth_user_id = v_user_id AND active = true) THEN
      SELECT id INTO v_portfolio_id FROM public.portfolios WHERE archived_at IS NULL ORDER BY created_at LIMIT 1;
    END IF;
  END IF;

  v_token := public.generate_invite_token();
  
  INSERT INTO public.user_invitations (email, full_name, role, portfolio_id, token, created_by, status, expires_at, metadata)
  VALUES (p_email, p_full_name, p_role, v_portfolio_id, v_token, v_user_id::text, 'sent', now() + interval '7 days', 
          jsonb_build_object('type', 'staff', 'invited_by', v_user_id::text))
  RETURNING id INTO v_invitation_id;

  RETURN jsonb_build_object('success', true, 'invitation_id', v_invitation_id, 'token', v_token);
END;
$$;


ALTER FUNCTION "public"."invite_staff"("p_email" "text", "p_full_name" "text", "p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invite_staff"("p_portfolio_id" "uuid", "p_email" "text", "p_role_name" "text" DEFAULT 'Property Manager'::"text", "p_message" "text" DEFAULT NULL::"text", "p_expires_days" integer DEFAULT 14) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  target_role_id uuid;
  new_invitation public.user_invitations;
begin
  if not public.can_admin_portfolio(p_portfolio_id) then
    raise exception 'invite_staff: must be portfolio admin';
  end if;

  select id into target_role_id from public.user_roles
   where name = p_role_name
     and (portfolio_id = p_portfolio_id or (is_system and portfolio_id is null))
   order by (portfolio_id = p_portfolio_id) desc nulls last
   limit 1;

  if target_role_id is null then
    raise exception 'invite_staff: role "%" not found for portfolio', p_role_name;
  end if;

  insert into public.user_invitations (
    portfolio_id, email, hoa_role, role_id, invited_by, message, expires_at
  ) values (
    p_portfolio_id, lower(p_email), 'manager', target_role_id, auth.uid(),
    p_message, now() + make_interval(days => p_expires_days)
  ) returning * into new_invitation;

  return jsonb_build_object(
    'invitation_id', new_invitation.id,
    'token', new_invitation.token,
    'expires_at', new_invitation.expires_at
  );
end;
$$;


ALTER FUNCTION "public"."invite_staff"("p_portfolio_id" "uuid", "p_email" "text", "p_role_name" "text", "p_message" "text", "p_expires_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invite_vendor"("p_name" "text", "p_email" "text", "p_trade" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_user_id uuid;
  v_portfolio_id uuid;
  v_token text;
  v_invitation_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT portfolio_id INTO v_portfolio_id FROM public.profiles WHERE id = v_user_id;

  v_token := public.generate_invite_token();
  
  INSERT INTO public.user_invitations (email, full_name, role, portfolio_id, token, created_by, status, expires_at, metadata)
  VALUES (p_email, p_name, 'vendor', v_portfolio_id, v_token, v_user_id::text, 'sent', now() + interval '7 days',
          jsonb_build_object('type', 'vendor', 'trade', p_trade, 'invited_by', v_user_id::text))
  RETURNING id INTO v_invitation_id;

  RETURN jsonb_build_object('success', true, 'invitation_id', v_invitation_id, 'token', v_token);
END;
$$;


ALTER FUNCTION "public"."invite_vendor"("p_name" "text", "p_email" "text", "p_trade" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invite_vendor"("p_portfolio_id" "uuid", "p_vendor_id" "uuid", "p_email" "text", "p_message" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  new_invitation public.user_invitations;
  v public.vendors;
begin
  if not public.can_access_portfolio(p_portfolio_id) then
    raise exception 'invite_vendor: must be staff of portfolio';
  end if;

  select * into v from public.vendors where id = p_vendor_id and portfolio_id = p_portfolio_id;
  if not found then
    raise exception 'invite_vendor: vendor % not in portfolio %', p_vendor_id, p_portfolio_id;
  end if;

  -- Add the email to the vendor's emails array if not already present
  if not v.emails @> to_jsonb(array[lower(p_email)]) then
    update public.vendors
       set emails = emails || to_jsonb(array[lower(p_email)]),
           portal_activated = true,
           updated_at = now()
     where id = p_vendor_id;
  end if;

  insert into public.user_invitations (
    portfolio_id, email, hoa_role, invited_by, message, expires_at
  ) values (
    p_portfolio_id, lower(p_email), 'manager', auth.uid(),
    coalesce(p_message, format('Vendor portal access for %s.', v.name)),
    now() + interval '30 days'
  ) returning * into new_invitation;

  return jsonb_build_object(
    'invitation_id', new_invitation.id,
    'token', new_invitation.token,
    'vendor_id', p_vendor_id,
    'email', p_email
  );
end;
$$;


ALTER FUNCTION "public"."invite_vendor"("p_portfolio_id" "uuid", "p_vendor_id" "uuid", "p_email" "text", "p_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invoke_edge_function"("fn_name" "text", "body" "jsonb" DEFAULT '{}'::"jsonb") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'vault', 'extensions', 'net'
    AS $$
declare
  url_secret text;
  key_secret text;
  request_id bigint;
begin
  select decrypted_secret into url_secret from vault.decrypted_secrets where name = 'project_url' limit 1;
  select decrypted_secret into key_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1;

  if url_secret is null or key_secret is null then
    raise notice 'invoke_edge_function: vault secrets project_url and/or service_role_key not configured — skipping %', fn_name;
    return null;
  end if;

  select net.http_post(
    url := rtrim(url_secret, '/') || '/functions/v1/' || fn_name,
    body := body,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || key_secret
    ),
    timeout_milliseconds := 30000
  ) into request_id;
  return request_id;
end;
$$;


ALTER FUNCTION "public"."invoke_edge_function"("fn_name" "text", "body" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."invoke_edge_function"("fn_name" "text", "body" "jsonb") IS 'Posts to an edge function using URL + service key stored in Supabase Vault. Requires vault secrets named "project_url" (e.g. https://<ref>.supabase.co) and "service_role_key".';



CREATE OR REPLACE FUNCTION "public"."is_accountant"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND mvp_role = 'accountant'
      AND portfolio_id IS NOT NULL
  );
$$;


ALTER FUNCTION "public"."is_accountant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_any_staff"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$ select public.is_staff(); $$;


ALTER FUNCTION "public"."is_any_staff"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_any_staff"() IS 'Tier C: any staff user. Full CRUD over operations (maintenance, inspections, calendar, comms).';



CREATE OR REPLACE FUNCTION "public"."is_assistant_manager"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND mvp_role = 'assistant_manager'
      AND portfolio_id IS NOT NULL
  );
$$;


ALTER FUNCTION "public"."is_assistant_manager"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_board_user"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.hoa_role = 'board'
  )
  or exists (
    select 1 from public.board_members bm
    where bm.active and bm.auth_user_id = auth.uid()
  )
  or exists (
    select 1 from public.board_members bm
    join auth.users u on lower(u.email) = lower(bm.email)
    where u.id = auth.uid() and bm.active and bm.auth_user_id is null
  );
$$;


ALTER FUNCTION "public"."is_board_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_company_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$ select exists(select 1 from public.profiles p left join public.user_roles ur on ur.id=p.role_id where p.id=auth.uid() and (p.hoa_role='company_admin' or ur.name='President')); $$;


ALTER FUNCTION "public"."is_company_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_finance_staff"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select exists(
    select 1
    from public.profiles p
    left join public.user_roles ur on ur.id = p.role_id
    where p.id = auth.uid()
      and (
        p.hoa_role = 'company_admin'
        or (
          p.hoa_role = 'manager'
          and (ur.name in ('President', 'Property Manager', 'Accountant') or ur.name is null)
        )
      )
  );
$$;


ALTER FUNCTION "public"."is_finance_staff"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_finance_staff"() IS 'Tier B: Tier A + Accountant + Accounts Payable. Full CRUD over financial tables.';



CREATE OR REPLACE FUNCTION "public"."is_full_access_staff"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select exists (
    select 1 from public.profiles p
    left join public.user_roles ur on ur.id = p.role_id
    where p.id = auth.uid()
      and p.hoa_role = 'manager'
      and (ur.name in ('President','Property Manager') or ur.name is null)
  );
$$;


ALTER FUNCTION "public"."is_full_access_staff"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_full_access_staff"() IS 'Tier A: President, Property Manager, and legacy staff (profile.role_id IS NULL). Full CRUD across all domains.';



CREATE OR REPLACE FUNCTION "public"."is_manager"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND mvp_role = 'manager'
      AND portfolio_id IS NOT NULL
  );
$$;


ALTER FUNCTION "public"."is_manager"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_notice_recipient"("p_notice_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select exists (
    select 1 from public.notice_recipients nr
    where nr.notice_id = p_notice_id
      and nr.owner_id = public.current_owner_id()
  );
$$;


ALTER FUNCTION "public"."is_notice_recipient"("p_notice_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_platform_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select exists (
    select 1 from public.platform_operators po
    where po.auth_user_id = auth.uid() and po.active and po.role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_platform_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_platform_operator"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select exists (
    select 1 from public.platform_operators po
    where po.auth_user_id = auth.uid() and po.active
  );
$$;


ALTER FUNCTION "public"."is_platform_operator"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_platform_operator_safe"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$ SELECT EXISTS (SELECT 1 FROM public.platform_operators po WHERE po.auth_user_id = auth.uid() AND po.active); $$;


ALTER FUNCTION "public"."is_platform_operator_safe"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_portal_resident"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        p.hoa_role in ('owner','tenant')
        or (p.hoa_role = 'board' and public.current_owner_id() is not null)
      )
  );
$$;


ALTER FUNCTION "public"."is_portal_resident"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_staff"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.hoa_role = 'manager'
  );
$$;


ALTER FUNCTION "public"."is_staff"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_budget_lines"("p_association_id" "uuid", "p_fiscal_year" integer DEFAULT NULL::integer) RETURNS TABLE("id" "uuid", "association_id" "uuid", "gl_account_id" "uuid", "gl_account_number" integer, "gl_account_name" "text", "fiscal_year" integer, "monthly_amounts" numeric[], "annual_total" numeric, "category" "text", "notes" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bl.id,
    bl.association_id,
    bl.gl_account_id,
    ga.number as gl_account_number,
    ga.name as gl_account_name,
    bl.fiscal_year,
    bl.monthly_amounts,
    bl.annual_total,
    bl.category::text,
    bl.notes,
    bl.created_at,
    bl.updated_at
  FROM budget_lines bl
  JOIN gl_accounts ga ON ga.id = bl.gl_account_id
  WHERE bl.association_id = p_association_id
    AND (p_fiscal_year IS NULL OR bl.fiscal_year = p_fiscal_year)
  ORDER BY bl.category, ga.number;
END;
$$;


ALTER FUNCTION "public"."list_budget_lines"("p_association_id" "uuid", "p_fiscal_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_company_invitations"() RETURNS TABLE("id" "uuid", "email" "text", "full_name" "text", "company_name" "text", "portfolio_id" "uuid", "status" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.platform_operators 
    WHERE auth_user_id = auth.uid() AND active = true
  ) THEN
    RAISE EXCEPTION 'Only platform operators can view company invitations';
  END IF;

  RETURN QUERY
  SELECT 
    ui.id, ui.email, ui.full_name,
    ui.metadata->>'company_name' as company_name,
    ui.portfolio_id, ui.status, ui.created_at
  FROM public.user_invitations ui
  WHERE ui.role = 'company_admin'
  ORDER BY ui.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."list_company_invitations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_audit_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  INSERT INTO public.audit_logs (entity_type, entity_id, action, actor_id, actor_email, changes)
  VALUES (TG_TABLE_NAME, NEW.id, TG_OP, auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()), to_jsonb(NEW));
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_audit_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_invitation_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  insert into public.permission_audit_log (
    actor_user_id, actor_portfolio_id, target_entity_type, target_entity_id,
    action, before_state, after_state
  ) values (
    auth.uid(), coalesce(new.portfolio_id, old.portfolio_id),
    'user_invitation', coalesce(new.id, old.id),
    case
      when tg_op = 'INSERT' then 'invitation_created'
      when tg_op = 'UPDATE' and new.status = 'accepted' and old.status = 'pending' then 'invitation_accepted'
      when tg_op = 'UPDATE' and new.status = 'revoked' and old.status = 'pending' then 'invitation_revoked'
      when tg_op = 'UPDATE' and new.status = 'expired' then 'invitation_expired'
      else 'invitation_update'
    end,
    case when tg_op = 'UPDATE' then to_jsonb(old) end,
    to_jsonb(new)
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."log_invitation_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_owner_audit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_changes jsonb;
  v_entity uuid;
  v_row jsonb;
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, jsonb_build_object(
      'from', case when n.key in ('taxpayer_id','bank_account_number','bank_routing_number') then '"[redacted]"'::jsonb else o.value end,
      'to',   case when n.key in ('taxpayer_id','bank_account_number','bank_routing_number') then '"[redacted]"'::jsonb else n.value end))
      into v_changes
    from jsonb_each(to_jsonb(old)) o
    join jsonb_each(to_jsonb(new)) n on n.key = o.key
    where o.value is distinct from n.value and n.key not in ('updated_at','updated_by');
    if v_changes is null then return new; end if;
  end if;
  v_row := to_jsonb(coalesce(new, old));
  if tg_table_name = 'owners' then
    v_entity := (v_row->>'id')::uuid;
  else
    v_entity := (v_row->>'owner_id')::uuid;
  end if;
  insert into public.audit_logs (entity_type, entity_id, action, actor_id, actor_email, changes)
  values ('owner', v_entity, lower(tg_op) || case when tg_table_name <> 'owners' then ':' || tg_table_name else '' end,
          auth.uid(), (select email from auth.users where id = auth.uid()), v_changes);
  return coalesce(new, old);
end $$;


ALTER FUNCTION "public"."log_owner_audit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_platform_operator_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  insert into public.permission_audit_log (
    actor_user_id, actor_portfolio_id, target_entity_type, target_entity_id,
    action, before_state, after_state
  ) values (
    auth.uid(), null, 'platform_operator', coalesce(new.id, old.id),
    lower(tg_op),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."log_platform_operator_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_profile_privilege_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if tg_op = 'UPDATE' and (
    new.portfolio_id is distinct from old.portfolio_id
    or new.role_id is distinct from old.role_id
    or new.hoa_role is distinct from old.hoa_role
  ) then
    insert into public.permission_audit_log (
      actor_user_id, actor_portfolio_id, target_entity_type, target_entity_id,
      action, before_state, after_state
    ) values (
      auth.uid(), public.current_portfolio_id(), 'profile', new.id,
      'privilege_change',
      jsonb_build_object('portfolio_id', old.portfolio_id, 'role_id', old.role_id, 'hoa_role', old.hoa_role),
      jsonb_build_object('portfolio_id', new.portfolio_id, 'role_id', new.role_id, 'hoa_role', new.hoa_role)
    );
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."log_profile_privilege_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_soft_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $_$
declare
  resolved_portfolio_id uuid;
begin
  if new.archived_at is not null and (old.archived_at is null or old.archived_at is distinct from new.archived_at) then
    -- Try to pick the portfolio_id off the row directly; otherwise leave null
    begin
      execute format('select ($1::%I).portfolio_id', tg_relid::regclass::text)
        into resolved_portfolio_id using new;
    exception when others then
      resolved_portfolio_id := null;
    end;

    insert into public.soft_delete_log (
      portfolio_id, entity_type, entity_id, archived_by, prior_state
    ) values (
      resolved_portfolio_id,
      tg_table_name,
      (row_to_json(new)->>'id')::uuid,
      auth.uid(),
      to_jsonb(old)
    );
  end if;
  return new;
end;
$_$;


ALTER FUNCTION "public"."log_soft_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_subscription_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    insert into public.subscription_events (subscription_id, portfolio_id, event_type, to_tier, to_status, actor_user_id, payload)
    values (new.id, new.portfolio_id, 'created', new.tier, new.status, auth.uid(), to_jsonb(new));
  elsif tg_op = 'UPDATE' and (new.tier is distinct from old.tier or new.status is distinct from old.status) then
    insert into public.subscription_events (
      subscription_id, portfolio_id, event_type, from_tier, to_tier, from_status, to_status, actor_user_id, payload
    ) values (
      new.id, new.portfolio_id,
      case
        when new.tier <> old.tier and new.tier > old.tier then 'upgrade'
        when new.tier <> old.tier and new.tier < old.tier then 'downgrade'
        when new.status <> old.status then 'status_change'
        else 'update'
      end,
      old.tier, new.tier, old.status, new.status, auth.uid(),
      jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
    );
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."log_subscription_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_user_role_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  insert into public.permission_audit_log (
    actor_user_id, actor_portfolio_id, target_entity_type, target_entity_id,
    action, before_state, after_state
  ) values (
    auth.uid(), public.current_portfolio_id(), 'user_role', coalesce(new.id, old.id),
    lower(tg_op),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."log_user_role_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."manager_is_scoped"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select public.is_staff()
     and exists (select 1 from public.association_managers am where am.user_id = auth.uid());
$$;


ALTER FUNCTION "public"."manager_is_scoped"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_webhook_delivery"("p_delivery_id" "uuid", "p_success" boolean, "p_response_code" integer DEFAULT NULL::integer, "p_response_body" "text" DEFAULT NULL::"text", "p_error_message" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  d public.webhook_deliveries;
  ep public.webhook_endpoints;
  retry_delay_seconds integer;
begin
  select * into d from public.webhook_deliveries where id = p_delivery_id for update;
  if not found then return; end if;

  select * into ep from public.webhook_endpoints where id = d.endpoint_id for update;

  if p_success then
    update public.webhook_deliveries
       set status = 'succeeded',
           attempts = attempts + 1,
           last_attempt_at = now(),
           succeeded_at = now(),
           response_code = p_response_code,
           response_body = left(coalesce(p_response_body, ''), 4000),
           error_message = null
     where id = p_delivery_id;

    update public.webhook_endpoints
       set failure_count = 0,
           last_success_at = now(),
           disabled_until = null
     where id = d.endpoint_id;
  else
    -- Exponential backoff: 1m, 5m, 25m, 2h, capped; abandon after 8 attempts
    retry_delay_seconds := least(power(5, d.attempts)::integer * 60, 7200);

    update public.webhook_deliveries
       set attempts = attempts + 1,
           last_attempt_at = now(),
           response_code = p_response_code,
           response_body = left(coalesce(p_response_body, ''), 4000),
           error_message = left(coalesce(p_error_message, ''), 1000),
           status = case when attempts + 1 >= 8 then 'abandoned'::public.webhook_delivery_status
                         else 'retrying'::public.webhook_delivery_status end,
           next_attempt_at = now() + make_interval(secs => retry_delay_seconds)
     where id = p_delivery_id;

    update public.webhook_endpoints
       set failure_count = failure_count + 1,
           last_failure_at = now(),
           last_failure_message = left(coalesce(p_error_message, ''), 500),
           -- Auto-disable endpoint for 1 hour after 10 consecutive failures
           disabled_until = case when failure_count + 1 >= 10 then now() + interval '1 hour' else disabled_until end
     where id = d.endpoint_id;
  end if;
end;
$$;


ALTER FUNCTION "public"."mark_webhook_delivery"("p_delivery_id" "uuid", "p_success" boolean, "p_response_code" integer, "p_response_body" "text", "p_error_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."me"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$ select jsonb_build_object( 'auth_user_id', auth.uid(), 'email', (select email from auth.users where id = auth.uid()), 'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()), 'portfolio', (select to_jsonb(po) from public.portfolios po where po.id = public.current_portfolio_id()), 'role_name', public.current_role_name(), 'is_platform_operator', public.is_platform_operator(), 'is_company_admin', public.is_company_admin(), 'is_full_access_staff', public.is_full_access_staff(), 'is_finance_staff', public.is_finance_staff(), 'is_staff', public.is_staff(), 'is_board', public.is_board_user(), 'is_resident', public.is_portal_resident(), 'owner_id', public.current_owner_id(), 'vendor_id', public.current_vendor_id(), 'board_association_ids', array(select public.current_board_association_ids()), 'resident_association_ids', array(select public.current_resident_association_ids()), 'resident_unit_ids', array(select public.current_resident_unit_ids()) ) $$;


ALTER FUNCTION "public"."me"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."me"() IS 'Single-call bootstrap for the admin/portal UI. Returns the user''s identity, portfolio, role, and all the boolean capability flags.';



CREATE OR REPLACE FUNCTION "public"."platform_create_company"("p_company_name" "text", "p_admin_email" "text", "p_admin_full_name" "text", "p_message" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_portfolio_id uuid;
  v_invitation_id uuid;
  v_token text;
BEGIN
  -- Only platform operators can call this
  IF NOT public.is_platform_operator() THEN
    RAISE EXCEPTION 'Only platform operators can onboard companies' USING ERRCODE = '42501';
  END IF;

  IF p_company_name IS NULL OR length(trim(p_company_name)) = 0 THEN
    RAISE EXCEPTION 'Company name is required';
  END IF;
  IF p_admin_email IS NULL OR length(trim(p_admin_email)) = 0 THEN
    RAISE EXCEPTION 'Admin email is required';
  END IF;

  -- Create the portfolio (company)
  INSERT INTO public.portfolios (company_name)
  VALUES (trim(p_company_name))
  RETURNING id INTO v_portfolio_id;

  -- Create the invitation for the first Company Admin
  INSERT INTO public.user_invitations (
    portfolio_id, email, mvp_role, hoa_role,
    full_name, message, invited_by
  ) VALUES (
    v_portfolio_id,
    lower(trim(p_admin_email)),
    'company_admin',
    'manager',
    trim(coalesce(p_admin_full_name, '')),
    p_message,
    auth.uid()
  )
  RETURNING id, token INTO v_invitation_id, v_token;

  RETURN jsonb_build_object(
    'portfolio_id', v_portfolio_id,
    'invitation_id', v_invitation_id,
    'invitation_token', v_token,
    'admin_email', lower(trim(p_admin_email))
  );
END;
$$;


ALTER FUNCTION "public"."platform_create_company"("p_company_name" "text", "p_admin_email" "text", "p_admin_full_name" "text", "p_message" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."platform_create_company"("p_company_name" "text", "p_admin_email" "text", "p_admin_full_name" "text", "p_message" "text") IS 'Super-admin RPC: creates a portfolio + first Company Admin invitation. Returns IDs and the invitation token (the calling code is then responsible for sending the email via the invite-user edge function).';



CREATE TABLE IF NOT EXISTS "public"."charges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "assessment_period_id" "uuid",
    "charge_type" "public"."charge_type" DEFAULT 'assessment'::"public"."charge_type" NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "due_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "gl_account_id" "uuid",
    "charge_category_id" "uuid",
    CONSTRAINT "charges_amount_check" CHECK (("amount" >= (0)::numeric))
);


ALTER TABLE "public"."charges" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_ad_hoc_charge"("p_unit_id" "uuid", "p_charge_category_id" "uuid", "p_amount" numeric, "p_description" "text", "p_due_date" "date" DEFAULT (CURRENT_DATE + 30)) RETURNS "public"."charges"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare cat public.charge_categories; row public.charges;
begin
  select * into cat from public.charge_categories where id = p_charge_category_id;
  if not found then raise exception 'charge category not found'; end if;
  if not public.can_manage_finance(cat.portfolio_id) then raise exception 'permission denied'; end if;
  insert into public.charges (
    unit_id, charge_category_id, charge_type, description, amount, due_date, gl_account_id, created_by
  ) values (
    p_unit_id, p_charge_category_id, cat.charge_type, p_description,
    p_amount, p_due_date, cat.gl_account_id, auth.uid()
  ) returning * into row;
  return row;
end;
$$;


ALTER FUNCTION "public"."post_ad_hoc_charge"("p_unit_id" "uuid", "p_charge_category_id" "uuid", "p_amount" numeric, "p_description" "text", "p_due_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_assessment_charges"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  charge_gl_id uuid;
  unit_row record;
  n_charges integer := 0;
begin
  if new.status <> 'posted' or (old.status = 'posted') then
    return new;
  end if;

  -- Look up a sensible GL account for HOA assessments (4xxx income range)
  select id into charge_gl_id
    from public.gl_accounts
   where association_id = new.association_id
     and account_type = 'income'
     and number between 4000 and 4999
     and active
   order by number
   limit 1;

  -- Fan out charges for every active unit
  for unit_row in
    select u.id as unit_id, u.ownership_pct,
           round(((coalesce(u.ownership_pct, 0) / 100.0) * new.base_amount)::numeric, 2) as amount
      from public.units u
      join public.buildings b on b.id = u.building_id
     where b.association_id = new.association_id
       and u.archived_at is null
  loop
    if unit_row.amount > 0 then
      insert into public.charges (
        unit_id, assessment_period_id, charge_type, description,
        amount, due_date, gl_account_id, created_by
      ) values (
        unit_row.unit_id, new.id, 'assessment',
        new.name,
        unit_row.amount,
        coalesce(new.period_start, current_date),
        charge_gl_id,
        new.created_by
      )
      on conflict do nothing;
      n_charges := n_charges + 1;
    end if;
  end loop;

  -- Log to activity
  insert into public.activity (action, details)
  values ('assessment_posted',
          format('Posted %s charges for assessment "%s" (period %s)',
                 n_charges, new.name, new.id));

  return new;
end;
$$;


ALTER FUNCTION "public"."post_assessment_charges"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_dues_increase"("p_dues_increase_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare increase_row public.dues_increases; line_row record; n integer := 0;
begin
  select * into increase_row from public.dues_increases where id = p_dues_increase_id for update;
  if not found then raise exception 'dues_increase not found'; end if;
  if increase_row.status <> 'scheduled' then
    raise exception 'dues_increase status must be scheduled (is %)', increase_row.status;
  end if;
  for line_row in select * from public.dues_increase_lines where dues_increase_id = p_dues_increase_id loop
    update public.occupancies
       set dues_amount = line_row.new_amount,
           last_dues_increase_date = increase_row.effective_date,
           last_dues_increase_amount = line_row.new_amount - line_row.old_amount,
           next_scheduled_increase_date = null, next_scheduled_increase_amount = null, updated_at = now()
     where id = line_row.occupancy_id;
    n := n + 1;
  end loop;
  update public.dues_increases set status = 'posted', posted_at = now(), posted_by = auth.uid(), updated_at = now()
   where id = p_dues_increase_id;
  return n;
end;
$$;


ALTER FUNCTION "public"."post_dues_increase"("p_dues_increase_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_nsf_fee"("p_payment_id" "uuid", "p_reason" "text" DEFAULT 'NSF - returned payment'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  payment_row public.payments;
  v_association_id uuid;
  v_portfolio_id uuid;
  fee_amount numeric(10,2);
  new_charge_id uuid;
begin
  select * into payment_row from public.payments where id = p_payment_id;
  if not found then raise exception 'payment not found'; end if;

  select a.id, a.portfolio_id into v_association_id, v_portfolio_id
    from public.units u
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
   where u.id = payment_row.unit_id;

  select coalesce(a.nsf_fee_amount_override, p.default_nsf_fee_amount) into fee_amount
    from public.associations a
    join public.portfolios p on p.id = a.portfolio_id
   where a.id = v_association_id;

  insert into public.charges (
    unit_id, charge_type, description, amount, due_date
  ) values (
    payment_row.unit_id, 'nsf_fee', p_reason, fee_amount, current_date + 15
  ) returning id into new_charge_id;

  update public.occupancies
     set nsf_count = nsf_count + 1, updated_at = now()
   where unit_id = payment_row.unit_id and status = 'current';

  return new_charge_id;
end;
$$;


ALTER FUNCTION "public"."post_nsf_fee"("p_payment_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_stripe_ledger_payment"("p_intent_id" "uuid", "p_method" "text", "p_processor_payment_intent_id" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_intent public.payment_intents%rowtype;
  v_payment_id uuid;
begin
  if p_method not in ('card', 'ach') then
    raise exception 'Unsupported Stripe payment method';
  end if;
  if p_processor_payment_intent_id is null
     or p_processor_payment_intent_id !~ '^pi_' then
    raise exception 'Invalid Stripe PaymentIntent id';
  end if;

  select * into v_intent
  from public.payment_intents
  where id = p_intent_id
  for update;

  if not found then
    raise exception 'Payment intent not found';
  end if;
  if v_intent.payment_id is not null then
    return v_intent.payment_id;
  end if;

  insert into public.payments (
    unit_id,
    amount,
    payment_date,
    method,
    reference,
    notes
  ) values (
    v_intent.unit_id,
    v_intent.amount,
    current_date,
    p_method,
    p_processor_payment_intent_id,
    format('Online payment via Stripe (%s)', p_method)
  )
  on conflict (reference) where reference ~ '^pi_'
  do nothing
  returning id into v_payment_id;

  if v_payment_id is null then
    select id into v_payment_id
    from public.payments
    where reference = p_processor_payment_intent_id;
  end if;

  if v_payment_id is null then
    raise exception 'Could not resolve Stripe ledger payment';
  end if;

  update public.payment_intents
  set payment_id = v_payment_id,
      updated_at = now()
  where id = v_intent.id;

  return v_payment_id;
end;
$$;


ALTER FUNCTION "public"."post_stripe_ledger_payment"("p_intent_id" "uuid", "p_method" "text", "p_processor_payment_intent_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_unit_recurring_charges"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare row record; n integer := 0; new_charge_id uuid; next_due date;
begin
  for row in
    select urc.*, cc.name as category_name, cc.gl_account_id as category_gl,
           cc.charge_type as category_charge_type, cc.code as category_code
      from public.unit_recurring_charges urc
      join public.charge_categories cc on cc.id = urc.charge_category_id
     where urc.active and cc.active
       and urc.next_post_date <= current_date
       and (urc.end_date is null or urc.next_post_date <= urc.end_date)
  loop
    insert into public.charges (
      unit_id, charge_category_id, charge_type, description,
      amount, due_date, gl_account_id, created_by
    ) values (
      row.unit_id, row.charge_category_id, row.category_charge_type,
      coalesce(row.memo, row.category_name),
      row.amount, row.next_post_date, row.category_gl, row.created_by
    ) returning id into new_charge_id;

    next_due := case row.frequency
      when 'daily'     then row.next_post_date + interval '1 day'
      when 'weekly'    then row.next_post_date + interval '1 week'
      when 'monthly'   then row.next_post_date + interval '1 month'
      when 'quarterly' then row.next_post_date + interval '3 months'
      when 'annually'  then row.next_post_date + interval '1 year'
    end::date;

    update public.unit_recurring_charges set next_post_date = next_due, last_posted_at = now(), updated_at = now() where id = row.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;


ALTER FUNCTION "public"."post_unit_recurring_charges"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."provision_portfolio"("p_company_name" "text", "p_first_admin_email" "text", "p_first_admin_name" "text" DEFAULT NULL::"text", "p_tier" "public"."portfolio_tier" DEFAULT 'foundation'::"public"."portfolio_tier", "p_seats" integer DEFAULT 5, "p_trial_days" integer DEFAULT 14, "p_allowed_email_domains" "text"[] DEFAULT NULL::"text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  new_portfolio public.portfolios;
  new_subscription public.subscriptions;
  new_invitation public.user_invitations;
  president_role_id uuid;
begin
  if not public.is_platform_operator() then
    raise exception 'provision_portfolio: platform operator required';
  end if;

  insert into public.portfolios (
    company_name, tier, allowed_email_domains, created_by
  ) values (
    p_company_name, p_tier, coalesce(p_allowed_email_domains, '{}'), auth.uid()
  ) returning * into new_portfolio;

  insert into public.subscriptions (
    portfolio_id, tier, status, seats_included, trial_ends_at,
    billing_email, current_period_start
  ) values (
    new_portfolio.id, p_tier, 'trialing', p_seats,
    now() + make_interval(days => p_trial_days),
    p_first_admin_email,
    now()
  ) returning * into new_subscription;

  select id into president_role_id from public.user_roles
   where is_system and name = 'President' limit 1;

  insert into public.user_invitations (
    portfolio_id, email, hoa_role, role_id, invited_by,
    message, expires_at
  ) values (
    new_portfolio.id, lower(p_first_admin_email),
    'manager', president_role_id, auth.uid(),
    format('Welcome to %s — your management platform is ready.', p_company_name),
    now() + interval '30 days'
  ) returning * into new_invitation;

  return jsonb_build_object(
    'portfolio_id', new_portfolio.id,
    'subscription_id', new_subscription.id,
    'invitation_id', new_invitation.id,
    'invitation_token', new_invitation.token,
    'invitation_expires_at', new_invitation.expires_at,
    'trial_ends_at', new_subscription.trial_ends_at
  );
end;
$$;


ALTER FUNCTION "public"."provision_portfolio"("p_company_name" "text", "p_first_admin_email" "text", "p_first_admin_name" "text", "p_tier" "public"."portfolio_tier", "p_seats" integer, "p_trial_days" integer, "p_allowed_email_domains" "text"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."provision_portfolio"("p_company_name" "text", "p_first_admin_email" "text", "p_first_admin_name" "text", "p_tier" "public"."portfolio_tier", "p_seats" integer, "p_trial_days" integer, "p_allowed_email_domains" "text"[]) IS 'Platform operator onboards a new management company. Creates portfolio + trialing subscription + invitation to the first President.';



CREATE OR REPLACE FUNCTION "public"."queue_calendar_sms"("p_event_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  ev            RECORD;
  our_number    text;
  their_number  text;
  convo_id      uuid;
  msg_id        uuid;
  msg_body      text;
BEGIN
  SELECT ce.id, ce.title, ce.start_datetime, ce.location,
         ce.maintenance_instructions,
         a.id AS assoc_id, a.name AS assoc_name,
         a.maintenance_contact_phone, a.maintenance_contact_name,
         p.texting_phone_number
    INTO ev
  FROM public.calendar_events ce
  LEFT JOIN public.associations a ON a.id = ce.association_id
  LEFT JOIN public.portfolios p ON p.id = ce.portfolio_id
  WHERE ce.id = p_event_id;

  IF ev.maintenance_contact_phone IS NULL THEN
    UPDATE public.calendar_events SET sms_notify_error = 'No maintenance_contact_phone on association' WHERE id = p_event_id;
    RETURN NULL;
  END IF;

  our_number   := COALESCE(ev.texting_phone_number, '+10000000000');
  their_number := ev.maintenance_contact_phone;

  -- Find or create SMS conversation
  SELECT id INTO convo_id FROM public.sms_conversations
    WHERE with_phone_number = their_number AND our_phone_number = our_number
    LIMIT 1;
  IF convo_id IS NULL THEN
    INSERT INTO public.sms_conversations
      (portfolio_id, association_id, with_entity_type, with_entity_id, with_name, with_phone_number, our_phone_number)
    VALUES (
      (SELECT portfolio_id FROM public.calendar_events WHERE id = p_event_id),
      ev.assoc_id, 'maintenance', ev.assoc_id,
      COALESCE(ev.maintenance_contact_name, 'Maintenance'),
      their_number, our_number
    )
    RETURNING id INTO convo_id;
  END IF;

  msg_body := '[' || COALESCE(ev.assoc_name, 'Association') || '] ' || ev.title
              || E'\n' || to_char(ev.start_datetime, 'Mon DD, HH12:MIam')
              || CASE WHEN ev.location IS NOT NULL THEN ' @ ' || ev.location ELSE '' END
              || CASE WHEN ev.maintenance_instructions IS NOT NULL THEN E'\n' || ev.maintenance_instructions ELSE '' END;

  INSERT INTO public.sms_messages
    (conversation_id, direction, body, from_number, to_number, status, provider)
  VALUES
    (convo_id, 'outbound', msg_body, our_number, their_number, 'queued', 'pending')
  RETURNING id INTO msg_id;

  RETURN msg_id;
END;
$$;


ALTER FUNCTION "public"."queue_calendar_sms"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."queue_invitation_email"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  rendered jsonb;
  pf_email jsonb;
  pf_from_addr text;
  pf_from_name text;
  pf_reply_to text;
BEGIN
  IF new.status <> 'pending' THEN
    RETURN new;
  END IF;

  rendered := public.render_invitation_email(new);

  -- Read portfolio email settings
  SELECT email_settings INTO pf_email
    FROM public.portfolios WHERE id = new.portfolio_id;

  pf_from_addr := pf_email->>'from_address';
  pf_from_name := pf_email->>'from_name';
  pf_reply_to  := pf_email->>'reply_to';

  -- Fallback to platform default
  IF pf_from_addr IS NULL OR pf_from_addr = '' THEN
    pf_from_addr := 'noreply@portier369.com';
  END IF;
  IF pf_from_name IS NULL OR pf_from_name = '' THEN
    SELECT company_name INTO pf_from_name
      FROM public.portfolios WHERE id = new.portfolio_id;
  END IF;

  INSERT INTO public.email_queue (
    portfolio_id, to_email, to_name, subject, body,
    from_address, from_name, reply_to, status
  ) VALUES (
    new.portfolio_id,
    new.email,
    new.full_name,
    rendered->>'subject',
    rendered->>'html',
    pf_from_addr,
    pf_from_name,
    pf_reply_to,
    'pending'
  );

  RETURN new;
END;
$$;


ALTER FUNCTION "public"."queue_invitation_email"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."queue_invitation_email"() IS 'On each new pending invitation, drops a rendered HTML email into email_queue. The process-email-queue cron picks it up within ~2 minutes.';



CREATE OR REPLACE FUNCTION "public"."queue_payment_reminders"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $_$
declare
  portfolio_row record;
  reminder_row record;
  n_sent integer := 0;
  days_offset integer;
  reminder_day integer;
begin
  for portfolio_row in
    select id, company_name, default_payment_reminder_days
      from public.portfolios where suspended_at is null
  loop
    foreach reminder_day in array portfolio_row.default_payment_reminder_days loop
      days_offset := reminder_day;
      for reminder_row in
        select distinct o.email, o.full_name, c.description, c.amount, c.due_date,
               u.unit_number, a.name as association_name, a.id as association_id,
               (c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0)) as balance_due
          from public.charges c
          join public.units u on u.id = c.unit_id
          join public.buildings b on b.id = u.building_id
          join public.associations a on a.id = b.association_id
          left join public.occupancies occ on occ.unit_id = u.id and occ.status = 'current'
          join public.owners o on o.id = occ.owner_id
         where a.portfolio_id = portfolio_row.id
           and o.preferred_comm = 'email'
           and o.email is not null
           and c.due_date = (current_date + make_interval(days => days_offset))::date
           and (c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0)) > 0
      loop
        insert into public.email_queue (
          to_email, to_name, subject, body, association_id, status
        ) values (
          reminder_row.email, reminder_row.full_name,
          case
            when days_offset > 0 then format('Payment reminder: %s due in %s days', to_char(reminder_row.amount, 'FM$999,999.00'), days_offset)
            when days_offset = 0 then format('Payment due today: %s',               to_char(reminder_row.amount, 'FM$999,999.00'))
            else                      format('PAST DUE: Payment was due %s days ago', abs(days_offset))
          end,
          format(
            '<p>Hello %s,</p><p>This is a reminder that a %s payment for Unit %s at %s is %s on %s.</p><p>Outstanding balance: <strong>%s</strong></p><p>Please log in to the homeowner portal to make a payment.</p>',
            coalesce(reminder_row.full_name, 'Homeowner'),
            to_char(reminder_row.amount, 'FM$999,999.00'),
            reminder_row.unit_number,
            reminder_row.association_name,
            case when days_offset >= 0 then 'due' else 'PAST DUE (was due' end,
            to_char(reminder_row.due_date, 'FMMonth DD, YYYY') || case when days_offset < 0 then ')' else '' end,
            to_char(reminder_row.balance_due, 'FM$999,999.00')
          ),
          reminder_row.association_id, 'pending'
        );
        n_sent := n_sent + 1;
      end loop;
    end loop;
  end loop;
  return n_sent;
end;
$_$;


ALTER FUNCTION "public"."queue_payment_reminders"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "definition_id" "uuid" NOT NULL,
    "saved_report_id" "uuid",
    "scheduled_report_id" "uuid",
    "status" "public"."report_run_status" DEFAULT 'queued'::"public"."report_run_status" NOT NULL,
    "parameters" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "output_format" "public"."report_format" DEFAULT 'pdf'::"public"."report_format" NOT NULL,
    "output_url" "text",
    "output_size_bytes" bigint,
    "row_count" integer,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "duration_ms" integer GENERATED ALWAYS AS (
CASE
    WHEN (("started_at" IS NOT NULL) AND ("finished_at" IS NOT NULL)) THEN ((EXTRACT(epoch FROM ("finished_at" - "started_at")) * (1000)::numeric))::integer
    ELSE NULL::integer
END) STORED,
    "error_message" "text",
    "triggered_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."report_runs" OWNER TO "postgres";


COMMENT ON TABLE "public"."report_runs" IS 'Async generation log. duration_ms is computed from started_at/finished_at.';



CREATE OR REPLACE FUNCTION "public"."queue_report_run"("p_definition_id" "uuid", "p_parameters" "jsonb" DEFAULT '{}'::"jsonb", "p_saved_report_id" "uuid" DEFAULT NULL::"uuid", "p_output_format" "public"."report_format" DEFAULT 'csv'::"public"."report_format") RETURNS "public"."report_runs"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  def public.report_definitions;
  row public.report_runs;
  target_portfolio uuid;
begin
  select * into def from public.report_definitions where id = p_definition_id;
  if not found then
    raise exception 'report definition not found';
  end if;

  target_portfolio := coalesce(def.portfolio_id, public.current_portfolio_id());
  if target_portfolio is null then
    raise exception 'cannot determine target portfolio for report run';
  end if;

  if not public.can_access_portfolio(target_portfolio) then
    raise exception 'insufficient permissions for portfolio %', target_portfolio;
  end if;

  insert into public.report_runs (
    portfolio_id, definition_id, saved_report_id, status,
    parameters, output_format, triggered_by
  ) values (
    target_portfolio, p_definition_id, p_saved_report_id, 'queued',
    p_parameters, p_output_format, auth.uid()
  ) returning * into row;

  return row;
end;
$$;


ALTER FUNCTION "public"."queue_report_run"("p_definition_id" "uuid", "p_parameters" "jsonb", "p_saved_report_id" "uuid", "p_output_format" "public"."report_format") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portfolios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_name" "text" NOT NULL,
    "address_street" "text",
    "address_city" "text",
    "address_state" "text",
    "address_zip" "text",
    "phone_number" "text",
    "texting_phone_number" "text",
    "profile_type" "public"."portfolio_profile_type" DEFAULT 'association_management'::"public"."portfolio_profile_type" NOT NULL,
    "tier" "public"."portfolio_tier" DEFAULT 'foundation'::"public"."portfolio_tier" NOT NULL,
    "entitlements" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "require_mfa_for_staff" boolean DEFAULT false NOT NULL,
    "require_mfa_for_admins" boolean DEFAULT true NOT NULL,
    "allowed_email_domains" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "session_timeout_minutes" integer DEFAULT 60 NOT NULL,
    "password_min_length" smallint DEFAULT 12 NOT NULL,
    "suspended_at" timestamp with time zone,
    "suspension_reason" "text",
    "default_late_fee_amount" numeric(10,2) DEFAULT 25.00 NOT NULL,
    "default_late_fee_grace_days" integer DEFAULT 10 NOT NULL,
    "default_nsf_fee_amount" numeric(10,2) DEFAULT 35.00 NOT NULL,
    "default_payment_reminder_days" integer[] DEFAULT ARRAY[14, 7, 1, '-7'::integer, '-30'::integer] NOT NULL,
    "statement_generation_day" smallint DEFAULT 1 NOT NULL,
    "fiscal_year_start_month" smallint DEFAULT 1 NOT NULL,
    "convenience_fee_mode" "public"."convenience_fee_mode" DEFAULT 'pass_through'::"public"."convenience_fee_mode" NOT NULL,
    "convenience_fee_card_pct" numeric(5,3) DEFAULT 2.9 NOT NULL,
    "convenience_fee_card_fixed_cents" integer DEFAULT 30 NOT NULL,
    "convenience_fee_ach_pct" numeric(5,3) DEFAULT 0 NOT NULL,
    "convenience_fee_ach_fixed_cents" integer DEFAULT 0 NOT NULL,
    "convenience_fee_minimum_cents" integer DEFAULT 0 NOT NULL,
    "convenience_fee_label" "text" DEFAULT 'Processing fee'::"text" NOT NULL,
    "slug" "text" NOT NULL,
    "custom_domain" "text",
    "logo_url" "text",
    "website" "text",
    "brand_email" "text",
    "billing_email_from" "text",
    "favicon_url" "text",
    "email_settings" "jsonb" DEFAULT '{}'::"jsonb",
    "brand_color" "text" DEFAULT '#10B981'::"text",
    "support_email" "text",
    "support_phone" "text",
    "public_website" "text",
    "ai_provider" "text" DEFAULT 'openai'::"text",
    "ai_model" "text" DEFAULT 'gpt-4o'::"text",
    "ai_endpoint" "text",
    "ai_api_key" "text",
    CONSTRAINT "portfolios_company_name_check" CHECK ((("length"("company_name") >= 1) AND ("length"("company_name") <= 200))),
    CONSTRAINT "portfolios_convenience_fee_ach_fixed_cents_check" CHECK (("convenience_fee_ach_fixed_cents" >= 0)),
    CONSTRAINT "portfolios_convenience_fee_ach_pct_check" CHECK (("convenience_fee_ach_pct" >= (0)::numeric)),
    CONSTRAINT "portfolios_convenience_fee_card_fixed_cents_check" CHECK (("convenience_fee_card_fixed_cents" >= 0)),
    CONSTRAINT "portfolios_convenience_fee_card_pct_check" CHECK ((("convenience_fee_card_pct" >= (0)::numeric) AND ("convenience_fee_card_pct" <= (10)::numeric))),
    CONSTRAINT "portfolios_default_late_fee_amount_check" CHECK (("default_late_fee_amount" >= (0)::numeric)),
    CONSTRAINT "portfolios_default_late_fee_grace_days_check" CHECK ((("default_late_fee_grace_days" >= 0) AND ("default_late_fee_grace_days" <= 60))),
    CONSTRAINT "portfolios_default_nsf_fee_amount_check" CHECK (("default_nsf_fee_amount" >= (0)::numeric)),
    CONSTRAINT "portfolios_fiscal_year_start_month_check" CHECK ((("fiscal_year_start_month" >= 1) AND ("fiscal_year_start_month" <= 12))),
    CONSTRAINT "portfolios_password_min_length_check" CHECK ((("password_min_length" >= 8) AND ("password_min_length" <= 128))),
    CONSTRAINT "portfolios_session_timeout_minutes_check" CHECK ((("session_timeout_minutes" >= 5) AND ("session_timeout_minutes" <= 43200))),
    CONSTRAINT "portfolios_slug_format" CHECK ((("slug" IS NULL) OR ("slug" ~ '^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])$'::"text"))),
    CONSTRAINT "portfolios_statement_generation_day_check" CHECK ((("statement_generation_day" >= 1) AND ("statement_generation_day" <= 28)))
);


ALTER TABLE "public"."portfolios" OWNER TO "postgres";


COMMENT ON TABLE "public"."portfolios" IS 'Top-level tenant (management company) — multi-tenancy root';



COMMENT ON COLUMN "public"."portfolios"."default_payment_reminder_days" IS 'Days relative to charge.due_date when reminders fire. Positive = before due; negative = after due.';



COMMENT ON COLUMN "public"."portfolios"."convenience_fee_mode" IS 'How to handle processor fees. pass_through is the cheapest path for the management company.';



COMMENT ON COLUMN "public"."portfolios"."slug" IS 'URL-safe identifier used as a subdomain on portier369.com (e.g. "beacon" → beacon.portier369.com).';



COMMENT ON COLUMN "public"."portfolios"."custom_domain" IS 'Optional vanity domain mapped via CNAME to Vercel (e.g. "app.managebeacon.com").';



COMMENT ON COLUMN "public"."portfolios"."logo_url" IS 'Public Supabase Storage URL for the tenant''s brand mark. Shown on auth pages and the resident portal when reached via the tenant''s subdomain or custom domain.';



COMMENT ON COLUMN "public"."portfolios"."website" IS 'Public-facing website. Shown on the portal and owner statements.';



COMMENT ON COLUMN "public"."portfolios"."brand_email" IS 'Public-facing inbox (e.g. info@beacon.co). Shown on the owner portal & invoices.';



COMMENT ON COLUMN "public"."portfolios"."billing_email_from" IS 'From: address on outbound statements (defaults to billing@portier369.com if blank).';



COMMENT ON COLUMN "public"."portfolios"."favicon_url" IS 'Public Supabase Storage URL for the tenant''s favicon. Served via <link rel="icon"> when the request reaches us via the tenant''s subdomain or custom domain.';



COMMENT ON COLUMN "public"."portfolios"."email_settings" IS 'Per-portfolio email configuration. Shape:
{
  "provider": "resend" | "smtp" | "sendgrid" | "postmark",
  "from_address": "manager@company.com",
  "from_name": "Company Name",
  "reply_to": "support@company.com",
  "smtp": { "host": "", "port": 587, "user": "", "pass_encrypted": null }
}';



CREATE OR REPLACE FUNCTION "public"."reactivate_portfolio"("p_portfolio_id" "uuid") RETURNS "public"."portfolios"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  updated public.portfolios;
begin
  if not public.is_platform_operator() then
    raise exception 'reactivate_portfolio: platform operator required';
  end if;

  update public.portfolios
     set suspended_at = null, suspension_reason = null, updated_at = now()
   where id = p_portfolio_id
   returning * into updated;

  update public.subscriptions set status = 'active', updated_at = now()
   where portfolio_id = p_portfolio_id and status = 'paused';
  return updated;
end;
$$;


ALTER FUNCTION "public"."reactivate_portfolio"("p_portfolio_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recent_failed_attempts"("p_email" "text", "p_window_minutes" integer DEFAULT 15) RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select count(*)::integer
    from public.login_attempts
   where lower(email) = lower(p_email)
     and not success
     and at > now() - make_interval(mins => p_window_minutes);
$$;


ALTER FUNCTION "public"."recent_failed_attempts"("p_email" "text", "p_window_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."receptionist_knowledge_search"("q" "text", "max_rows" integer DEFAULT 3) RETURNS TABLE("title" "text", "body" "text", "category" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select k.title, k.body, k.category
  from receptionist_knowledge k
  where k.active
    and to_tsvector('english', k.title || ' ' || k.body) @@ plainto_tsquery('english', q)
  order by ts_rank(to_tsvector('english', k.title || ' ' || k.body), plainto_tsquery('english', q)) desc
  limit greatest(1, least(max_rows, 5));
$$;


ALTER FUNCTION "public"."receptionist_knowledge_search"("q" "text", "max_rows" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_check_run"("p_bank_account_id" "uuid", "p_bill_ids" "uuid"[], "p_starting_check_number" integer, "p_payment_date" "date" DEFAULT CURRENT_DATE) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  bill_id uuid;
  idx integer := 0;
  bank_row public.bank_accounts;
  results jsonb := '[]'::jsonb;
begin
  select * into bank_row from public.bank_accounts where id = p_bank_account_id for update;
  if not found then raise exception 'bank account not found'; end if;

  if not public.can_manage_finance(bank_row.portfolio_id) then
    raise exception 'permission denied';
  end if;

  foreach bill_id in array p_bill_ids loop
    update public.payable_bills
       set status = 'paid'::public.payable_bill_status,
           paid_at = p_payment_date::timestamptz,
           bank_account_id = p_bank_account_id,
           check_number = p_starting_check_number + idx,
           updated_at = now()
     where id = bill_id
       and public.can_manage_finance(portfolio_id);
    if found then
      results := results || jsonb_build_object(
        'bill_id', bill_id,
        'check_number', p_starting_check_number + idx
      );
      idx := idx + 1;
    end if;
  end loop;

  -- Advance bank_accounts.next_check_number
  update public.bank_accounts
     set next_check_number = p_starting_check_number + idx,
         updated_at = now()
   where id = p_bank_account_id;

  return jsonb_build_object(
    'checks_written', idx,
    'starting_check_number', p_starting_check_number,
    'next_check_number', p_starting_check_number + idx,
    'results', results
  );
end;
$$;


ALTER FUNCTION "public"."record_check_run"("p_bank_account_id" "uuid", "p_bill_ids" "uuid"[], "p_starting_check_number" integer, "p_payment_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_login_attempt"("p_email" "text", "p_auth_user_id" "uuid", "p_success" boolean, "p_ip_address" "text" DEFAULT NULL::"text", "p_user_agent" "text" DEFAULT NULL::"text", "p_failure_reason" "text" DEFAULT NULL::"text", "p_mfa_used" boolean DEFAULT false) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  attempt_id uuid;
  user_portfolio uuid;
begin
  select portfolio_id into user_portfolio from public.profiles where id = p_auth_user_id;

  insert into public.login_attempts (
    email, auth_user_id, portfolio_id, ip_address, user_agent,
    success, failure_reason, mfa_used
  ) values (
    lower(p_email), p_auth_user_id, user_portfolio, p_ip_address, p_user_agent,
    p_success, p_failure_reason, p_mfa_used
  ) returning id into attempt_id;

  if p_success and p_auth_user_id is not null then
    update public.profiles
       set last_login_at = now(), last_login_ip = p_ip_address, updated_at = now()
     where id = p_auth_user_id;
  end if;

  return attempt_id;
end;
$$;


ALTER FUNCTION "public"."record_login_attempt"("p_email" "text", "p_auth_user_id" "uuid", "p_success" boolean, "p_ip_address" "text", "p_user_agent" "text", "p_failure_reason" "text", "p_mfa_used" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."record_login_attempt"("p_email" "text", "p_auth_user_id" "uuid", "p_success" boolean, "p_ip_address" "text", "p_user_agent" "text", "p_failure_reason" "text", "p_mfa_used" boolean) IS 'Call from an Auth hook edge function on every sign-in attempt. Logs to login_attempts and updates profiles.last_login_* on success.';



CREATE OR REPLACE FUNCTION "public"."record_meeting_attendance"("p_meeting_id" "uuid", "p_attendee_name" "text", "p_owner_id" "uuid" DEFAULT NULL::"uuid", "p_attendee_role" "text" DEFAULT 'owner'::"text", "p_signature_data" "text" DEFAULT NULL::"text", "p_voting_eligible" boolean DEFAULT true, "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_attendee_id uuid;
BEGIN
  -- Check if this owner already signed in for this meeting
  IF p_owner_id IS NOT NULL THEN
    SELECT id INTO v_attendee_id
    FROM meeting_attendees
    WHERE meeting_id = p_meeting_id AND owner_id = p_owner_id;

    IF FOUND THEN
      -- Update existing record
      UPDATE meeting_attendees
      SET signature_data = COALESCE(p_signature_data, signature_data),
          present = true,
          attendee_name = p_attendee_name,
          attendee_role = p_attendee_role,
          voting_eligible = p_voting_eligible,
          notes = COALESCE(p_notes, notes),
          check_in_time = now()
      WHERE id = v_attendee_id;
      
      -- Recalculate quorum
      PERFORM calculate_meeting_quorum(p_meeting_id);
      
      RETURN v_attendee_id;
    END IF;
  END IF;

  -- Insert new attendance record
  INSERT INTO meeting_attendees (
    meeting_id, owner_id, attendee_name, attendee_role,
    check_in_time, signature_data, present, voting_eligible, notes
  ) VALUES (
    p_meeting_id, p_owner_id, p_attendee_name, p_attendee_role,
    now(), p_signature_data, true, p_voting_eligible, p_notes
  )
  RETURNING id INTO v_attendee_id;

  -- Recalculate quorum
  PERFORM calculate_meeting_quorum(p_meeting_id);

  RETURN v_attendee_id;
END;
$$;


ALTER FUNCTION "public"."record_meeting_attendance"("p_meeting_id" "uuid", "p_attendee_name" "text", "p_owner_id" "uuid", "p_attendee_role" "text", "p_signature_data" "text", "p_voting_eligible" boolean, "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recount_seats_used"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  affected uuid;
begin
  -- Recount for both the old and new portfolio when relevant
  for affected in
    select distinct p from (values (new.portfolio_id), (case when tg_op = 'UPDATE' then old.portfolio_id end)) v(p)
    where p is not null
  loop
    update public.subscriptions
       set seats_used = (select count(*) from public.profiles
                         where portfolio_id = affected and hoa_role = 'manager'),
           updated_at = now()
     where portfolio_id = affected;
  end loop;
  return new;
end;
$$;


ALTER FUNCTION "public"."recount_seats_used"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."relink_all_portal_users"() RETURNS TABLE("target_table" "text", "rows_linked" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  n_owners integer;
  n_board integer;
  n_vendors integer;
begin
  with upd as (
    update public.owners o
       set auth_user_id = u.id
      from auth.users u
     where o.auth_user_id is null
       and o.archived_at is null
       and lower(u.email) = lower(o.email)
    returning 1
  ) select count(*) into n_owners from upd;

  with upd as (
    update public.board_members bm
       set auth_user_id = u.id
      from auth.users u
     where bm.auth_user_id is null
       and bm.active
       and lower(u.email) = lower(bm.email)
    returning 1
  ) select count(*) into n_board from upd;

  with upd as (
    update public.vendors v
       set auth_user_id = u.id
      from auth.users u
     where v.auth_user_id is null
       and v.archived_at is null
       and exists (
         select 1 from jsonb_array_elements_text(v.emails) as e(email)
         where lower(e.email) = lower(u.email)
       )
    returning 1
  ) select count(*) into n_vendors from upd;

  return query values
    ('owners', n_owners),
    ('board_members', n_board),
    ('vendors', n_vendors);
end;
$$;


ALTER FUNCTION "public"."relink_all_portal_users"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."relink_all_portal_users"() IS 'One-shot backfill. Run after bulk importing owners/vendors/board_members to link them to existing auth users. Returns counts per table.';



CREATE OR REPLACE FUNCTION "public"."relink_portal_user_on_email_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if new.email is distinct from old.email then
    -- Clear stale links where the email no longer matches
    update public.owners set auth_user_id = null
      where auth_user_id = new.id and lower(email) <> lower(new.email);
    update public.board_members set auth_user_id = null
      where auth_user_id = new.id and lower(email) <> lower(new.email);
    update public.vendors v set auth_user_id = null
      where v.auth_user_id = new.id
        and not exists (
          select 1 from jsonb_array_elements_text(v.emails) as e(email)
          where lower(e.email) = lower(new.email)
        );
    -- Then re-run the linker for the new email
    perform public.auto_link_portal_user() from (select new.*) s;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."relink_portal_user_on_email_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_staff_member"("p_profile_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "public"."profiles"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  target public.profiles;
  updated public.profiles;
begin
  select * into target from public.profiles where id = p_profile_id;
  if not found then
    raise exception 'remove_staff_member: profile not found';
  end if;

  if not public.can_admin_portfolio(target.portfolio_id) then
    raise exception 'remove_staff_member: must be admin of profile''s portfolio';
  end if;

  if p_profile_id = auth.uid() then
    raise exception 'remove_staff_member: cannot remove yourself';
  end if;

  update public.profiles
     set portfolio_id = null,
         role_id = null,
         hoa_role = 'owner',
         updated_at = now()
   where id = p_profile_id
   returning * into updated;

  -- Log reason separately into audit log details
  insert into public.permission_audit_log (
    actor_user_id, actor_portfolio_id, target_entity_type, target_entity_id,
    action, details
  ) values (
    auth.uid(), target.portfolio_id, 'profile', p_profile_id,
    'staff_removed',
    jsonb_build_object('reason', p_reason)
  );

  return updated;
end;
$$;


ALTER FUNCTION "public"."remove_staff_member"("p_profile_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."render_invitation_email"("inv" "public"."user_invitations") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $_$
declare
  portfolio_row public.portfolios;
  role_name text;
  accept_url text;
  inviter_email text;
  html text;
  txt text;
  subject text;
begin
  select * into portfolio_row from public.portfolios where id = inv.portfolio_id;
  select name into role_name from public.user_roles where id = inv.role_id;
  select email into inviter_email from auth.users where id = inv.invited_by;

  accept_url := rtrim(public.app_portal_url(), '/') || '/invite?token=' || inv.token;
  subject := format('You''re invited to %s', coalesce(portfolio_row.company_name, 'the portal'));

  html := format($html$<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:40px auto;padding:24px;color:#1a1a1a;">
  <h2 style="margin:0 0 16px;">You're invited to %s</h2>
  <p>%s invited you to join <strong>%s</strong>%s.</p>
  %s
  <p style="margin:24px 0;"><a href="%s" style="background:#2563eb;color:white;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">Accept invitation</a></p>
  <p style="font-size:12px;color:#666;">This invitation expires on %s. If you can't click the button, copy this link into your browser:<br/><code style="font-size:11px;word-break:break-all;">%s</code></p>
</body></html>$html$,
    coalesce(portfolio_row.company_name, 'the portal'),
    coalesce(inviter_email, 'An administrator'),
    coalesce(portfolio_row.company_name, 'the portal'),
    case when role_name is not null then ' as a ' || role_name else '' end,
    case when inv.message is not null and length(inv.message) > 0 then
      '<p style="background:#f3f4f6;padding:12px 16px;border-radius:6px;font-style:italic;">' || inv.message || '</p>'
    else '' end,
    accept_url,
    to_char(inv.expires_at at time zone 'UTC', 'Mon DD YYYY "at" HH24:MI "UTC"'),
    accept_url
  );

  txt := format(E'You''re invited to %s.\n\n%s invited you to join%s.\n\n%sAccept the invitation: %s\n\nExpires: %s',
    coalesce(portfolio_row.company_name, 'the portal'),
    coalesce(inviter_email, 'An administrator'),
    case when role_name is not null then ' as a ' || role_name else '' end,
    case when inv.message is not null then inv.message || E'\n\n' else '' end,
    accept_url,
    to_char(inv.expires_at at time zone 'UTC', 'Mon DD YYYY HH24:MI UTC')
  );

  return jsonb_build_object('subject', subject, 'html', html, 'text', txt);
end;
$_$;


ALTER FUNCTION "public"."render_invitation_email"("inv" "public"."user_invitations") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."render_invitation_email"("inv" "public"."user_invitations") IS 'Produces subject/html/text for an invitation email. Portal URL pulled from vault.decrypted_secrets.portal_base_url.';



CREATE OR REPLACE FUNCTION "public"."reorder_agenda_items"("p_meeting_id" integer, "p_item_ids" integer[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  FOR i IN 1..array_length(p_item_ids, 1) LOOP
    UPDATE agenda_items
    SET sort_order = i, updated_at = now()
    WHERE meeting_id = p_meeting_id AND id = p_item_ids[i];
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."reorder_agenda_items"("p_meeting_id" integer, "p_item_ids" integer[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."report_data_delinquency"("p_portfolio_id" "uuid", "p_params" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.balance desc), '[]'::jsonb)
    from (
      select a.name as association_name,
             u.unit_number,
             o.full_name as homeowner,
             o.email as homeowner_email,
             ub.balance,
             du.oldest_due as oldest_due_date,
             (current_date - du.oldest_due) as days_past_due
        from public.unit_balances ub
        join public.units u on u.id = ub.unit_id
        join public.buildings b on b.id = u.building_id
        join public.associations a on a.id = b.association_id
        left join lateral (
          select min(c.due_date) as oldest_due
            from public.charges c
           where c.unit_id = ub.unit_id and c.due_date < current_date
           group by c.unit_id
        ) du on true
        left join public.occupancies occ on occ.unit_id = u.id and occ.status = 'current' and occ.is_primary
        left join public.owners o on o.id = occ.owner_id
       where a.portfolio_id = p_portfolio_id
         and ub.balance > 0
    ) r;
$$;


ALTER FUNCTION "public"."report_data_delinquency"("p_portfolio_id" "uuid", "p_params" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."report_data_dispatch"("p_portfolio_id" "uuid", "p_slug" "text", "p_params" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  result jsonb;
begin
  case p_slug
    when 'delinquency'           then result := public.report_data_delinquency(p_portfolio_id, p_params);
    when 'homeowner_ledger'      then result := public.report_data_homeowner_ledger(p_portfolio_id, p_params);
    when 'work_order_report'     then result := public.report_data_work_orders(p_portfolio_id, p_params);
    when 'open_work_orders'      then result := public.report_data_open_work_orders(p_portfolio_id, p_params);
    when 'property_directory'    then result := public.report_data_property_directory(p_portfolio_id, p_params);
    when 'vendor_directory'      then result := public.report_data_vendor_directory(p_portfolio_id, p_params);
    when 'violation_log'         then result := public.report_data_violation_log(p_portfolio_id, p_params);
    when 'vendor_1099_detail'    then result := public.report_data_vendor_1099(p_portfolio_id, p_params);
    when 'vendor_1099_summary'   then result := public.report_data_vendor_1099(p_portfolio_id, p_params);
    else
      raise exception 'report slug "%" not implemented', p_slug;
  end case;
  return result;
end;
$$;


ALTER FUNCTION "public"."report_data_dispatch"("p_portfolio_id" "uuid", "p_slug" "text", "p_params" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."report_data_homeowner_ledger"("p_portfolio_id" "uuid", "p_params" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  t_unit uuid := (p_params->>'unit_id')::uuid;
  t_from date := coalesce((p_params->>'from_date')::date, current_date - interval '1 year');
  t_to date := coalesce((p_params->>'to_date')::date, current_date);
begin
  return (
    with events as (
      select c.due_date as event_date, 'charge'::text as kind, c.description, c.amount, 0::numeric as payment
        from public.charges c
       where c.unit_id = t_unit and c.due_date between t_from and t_to
      union all
      select p.payment_date, 'payment'::text, coalesce(p.notes, p.method), 0, p.amount
        from public.payments p
       where p.unit_id = t_unit and p.payment_date between t_from and t_to
    )
    select coalesce(jsonb_agg(to_jsonb(e.*) order by e.event_date), '[]'::jsonb) from events e
  );
end;
$$;


ALTER FUNCTION "public"."report_data_homeowner_ledger"("p_portfolio_id" "uuid", "p_params" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."report_data_open_work_orders"("p_portfolio_id" "uuid", "p_params" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.priority desc, r.created_at), '[]'::jsonb)
    from (
      select w.number, w.title, w.status::text, w.priority::text,
             a.name as association, u.unit_number, v.name as vendor,
             w.scheduled_date, w.created_at,
             (current_date - w.created_at::date) as age_days
        from public.work_orders w
        join public.associations a on a.id = w.association_id
        left join public.units u on u.id = w.unit_id
        left join public.vendors v on v.id = w.vendor_id
       where a.portfolio_id = p_portfolio_id
         and w.archived_at is null
         and w.status in ('new','assigned','scheduled','in_progress')
    ) r;
$$;


ALTER FUNCTION "public"."report_data_open_work_orders"("p_portfolio_id" "uuid", "p_params" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."report_data_property_directory"("p_portfolio_id" "uuid", "p_params" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.association_name, r.unit_number), '[]'::jsonb)
    from (
      select a.name as association_name, b.name as building_name, b.address as building_address,
             u.unit_number, u.bedrooms, u.bathrooms, u.sqft,
             o.full_name as primary_owner, o.email as owner_email,
             u.parking_spaces, u.storage_number
        from public.associations a
        join public.buildings b on b.association_id = a.id
        join public.units u on u.building_id = b.id
        left join public.occupancies occ on occ.unit_id = u.id and occ.status = 'current' and occ.is_primary
        left join public.owners o on o.id = occ.owner_id
       where a.portfolio_id = p_portfolio_id
         and a.archived_at is null
         and b.archived_at is null
         and u.archived_at is null
    ) r;
$$;


ALTER FUNCTION "public"."report_data_property_directory"("p_portfolio_id" "uuid", "p_params" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."report_data_vendor_1099"("p_portfolio_id" "uuid", "p_params" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select public.assemble_vendor_1099_data(
    p_portfolio_id,
    coalesce((p_params->>'tax_year')::integer, extract(year from (now() - interval '1 year'))::integer)
  );
$$;


ALTER FUNCTION "public"."report_data_vendor_1099"("p_portfolio_id" "uuid", "p_params" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."report_data_vendor_directory"("p_portfolio_id" "uuid", "p_params" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.name), '[]'::jsonb)
    from (
      select v.name, v.trade::text, v.vendor_type::text,
             v.address_street, v.address_city, v.address_state, v.address_zip,
             v.send_1099,
             vc.workers_comp_expiration, vc.general_liability_expiration,
             vc.contract_expiration
        from public.vendors v
        left join public.vendor_compliance vc on vc.vendor_id = v.id
       where v.portfolio_id = p_portfolio_id
         and v.archived_at is null
    ) r;
$$;


ALTER FUNCTION "public"."report_data_vendor_directory"("p_portfolio_id" "uuid", "p_params" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."report_data_violation_log"("p_portfolio_id" "uuid", "p_params" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.date_observed desc), '[]'::jsonb)
    from (
      select v.title, v.violation_type::text, v.status::text,
             a.name as association, u.unit_number,
             o.full_name as owner_name,
             v.date_observed, v.due_date, v.fine_amount, v.cured_at
        from public.violations v
        join public.associations a on a.id = v.association_id
        left join public.units u on u.id = v.unit_id
        left join public.owners o on o.id = v.owner_id
       where a.portfolio_id = p_portfolio_id
         and v.archived_at is null
    ) r;
$$;


ALTER FUNCTION "public"."report_data_violation_log"("p_portfolio_id" "uuid", "p_params" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."report_data_work_orders"("p_portfolio_id" "uuid", "p_params" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  f_from date := coalesce((p_params->>'from_date')::date, current_date - interval '90 days');
  f_to date := coalesce((p_params->>'to_date')::date, current_date);
  f_status text := p_params->>'status';
begin
  return (
    select coalesce(jsonb_agg(to_jsonb(r.*) order by r.created_at desc), '[]'::jsonb)
      from (
        select w.number, w.title, w.status::text, w.priority::text, w.category::text, w.trade::text,
               a.name as association, u.unit_number, v.name as vendor,
               w.scheduled_date, w.completed_date, w.created_at, w.assigned_to
          from public.work_orders w
          left join public.associations a on a.id = w.association_id
          left join public.units u on u.id = w.unit_id
          left join public.vendors v on v.id = w.vendor_id
         where a.portfolio_id = p_portfolio_id
           and w.created_at::date between f_from and f_to
           and w.archived_at is null
           and (f_status is null or w.status::text = f_status)
      ) r
  );
end;
$$;


ALTER FUNCTION "public"."report_data_work_orders"("p_portfolio_id" "uuid", "p_params" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."data_export_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid",
    "subject_auth_user_id" "uuid",
    "scope" "public"."export_scope" DEFAULT 'portfolio_full'::"public"."export_scope" NOT NULL,
    "requested_by" "uuid",
    "status" "public"."export_status" DEFAULT 'pending'::"public"."export_status" NOT NULL,
    "format" "text" DEFAULT 'json'::"text" NOT NULL,
    "file_url" "text",
    "file_size_bytes" bigint,
    "error_message" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval),
    "download_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "data_export_requests_format_check" CHECK (("format" = ANY (ARRAY['json'::"text", 'csv'::"text", 'zip'::"text"])))
);


ALTER TABLE "public"."data_export_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."data_export_requests" IS 'Async data export jobs. Portfolio admins request via admin panel (requires data_export entitlement). Expired exports are purged by cron.';



CREATE OR REPLACE FUNCTION "public"."request_data_export"("p_portfolio_id" "uuid", "p_scope" "public"."export_scope" DEFAULT 'portfolio_full'::"public"."export_scope", "p_format" "text" DEFAULT 'json'::"text") RETURNS "public"."data_export_requests"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  row public.data_export_requests;
begin
  if not public.can_admin_portfolio(p_portfolio_id) then
    raise exception 'request_data_export: portfolio admin required';
  end if;
  if not public.has_entitlement(p_portfolio_id, 'data_export') then
    raise exception 'request_data_export: data_export entitlement required (upgrade to Max tier)';
  end if;

  insert into public.data_export_requests (
    portfolio_id, scope, format, requested_by
  ) values (
    p_portfolio_id, p_scope, p_format, auth.uid()
  ) returning * into row;
  return row;
end;
$$;


ALTER FUNCTION "public"."request_data_export"("p_portfolio_id" "uuid", "p_scope" "public"."export_scope", "p_format" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resend_invitation"("p_invitation_id" "uuid") RETURNS "public"."user_invitations"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  old_inv public.user_invitations;
  new_inv public.user_invitations;
begin
  select * into old_inv from public.user_invitations where id = p_invitation_id;
  if not found then raise exception 'resend_invitation: not found'; end if;
  if not public.can_admin_portfolio(old_inv.portfolio_id) then
    raise exception 'resend_invitation: must be admin of portfolio';
  end if;
  if old_inv.status <> 'pending' then
    raise exception 'resend_invitation: only pending invitations can be resent';
  end if;

  update public.user_invitations set status = 'revoked', updated_at = now() where id = p_invitation_id;

  insert into public.user_invitations (
    portfolio_id, email, hoa_role, role_id, invited_by, message, expires_at
  ) values (
    old_inv.portfolio_id, old_inv.email, old_inv.hoa_role, old_inv.role_id,
    auth.uid(), old_inv.message, now() + interval '14 days'
  ) returning * into new_inv;
  return new_inv;
end;
$$;


ALTER FUNCTION "public"."resend_invitation"("p_invitation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_portfolio_for_host"("p_host" "text") RETURNS TABLE("id" "uuid", "slug" "text", "company_name" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with h as (
    select lower(split_part(p_host, ':', 1)) as host
  )
  select p.id, p.slug, p.company_name
    from public.portfolios p, h
   where p.archived_at is null
     and (
       lower(p.custom_domain) = h.host
       or (
         h.host like '%.portier369.com'
         and p.slug = split_part(h.host, '.', 1)
       )
     )
   order by case when lower(p.custom_domain) = h.host then 0 else 1 end
   limit 1;
$$;


ALTER FUNCTION "public"."resolve_portfolio_for_host"("p_host" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."resolve_portfolio_for_host"("p_host" "text") IS 'Resolves an HTTP host header to a portfolio. Called from Next.js middleware via the anon role to set tenant branding context BEFORE authentication. Granted to anon by design — see _REDESIGN_README.md.';



CREATE OR REPLACE FUNCTION "public"."revoke_invitation"("p_invitation_id" "uuid") RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  update public.user_invitations
     set status = 'revoked', updated_at = now()
   where id = p_invitation_id and status = 'pending';
$$;


ALTER FUNCTION "public"."revoke_invitation"("p_invitation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rotate_api_key"("p_api_key_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  old_key public.api_keys;
  new_key_result jsonb;
begin
  select * into old_key from public.api_keys where id = p_api_key_id;
  if not found then
    raise exception 'rotate_api_key: key not found';
  end if;
  if not public.can_admin_portfolio(old_key.portfolio_id) then
    raise exception 'rotate_api_key: must be portfolio admin';
  end if;

  update public.api_keys
     set revoked_at = now(), revoked_by = auth.uid(), updated_at = now()
   where id = p_api_key_id;

  new_key_result := public.create_api_key(
    old_key.portfolio_id,
    old_key.name || ' (rotated)',
    old_key.scopes,
    case when old_key.expires_at is not null then extract(day from (old_key.expires_at - now()))::integer end
  );

  return jsonb_build_object(
    'old_key_id', p_api_key_id,
    'new_key', new_key_result
  );
end;
$$;


ALTER FUNCTION "public"."rotate_api_key"("p_api_key_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."run_autopay_mandates"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  m record;
  n integer := 0;
  amount_cents integer;
  target_charge_id uuid;
begin
  for m in
    select am.*
      from public.autopay_mandates am
     where am.status = 'active'
       and am.next_run_date <= current_date
       and (am.end_date is null or current_date <= am.end_date)
  loop
    -- Find outstanding dues for this owner/unit
    select c.id,
           (c.amount - coalesce((select sum(amount) from public.payments where charge_id = c.id), 0))::integer * 100
      into target_charge_id, amount_cents
      from public.charges c
     where c.unit_id = m.unit_id
       and c.charge_type = 'assessment'
       and (c.amount - coalesce((select sum(amount) from public.payments where charge_id = c.id), 0)) > 0
     order by c.due_date
     limit 1;

    if amount_cents is not null and amount_cents > 0
       and amount_cents <= m.authorized_amount_max_cents then

      -- Create pending payment_intent (edge function will execute the charge via processor)
      insert into public.payment_intents (
        unit_id, owner_id, charge_id, amount, method, description,
        processor, metadata, status
      ) values (
        m.unit_id, m.owner_id, target_charge_id,
        (amount_cents / 100.0)::numeric(14,2),
        'ach',
        'Autopay mandate ' || m.id::text,
        (select processor from public.payment_methods where id = m.payment_method_id),
        jsonb_build_object('autopay_mandate_id', m.id, 'payment_method_id', m.payment_method_id),
        'pending'
      );

      -- Advance next_run_date based on frequency
      update public.autopay_mandates
         set next_run_date = case frequency
               when 'monthly'          then current_date + interval '1 month'
               when 'quarterly'        then current_date + interval '3 months'
               when 'annually'         then current_date + interval '1 year'
               when 'on_charge_posted' then null  -- event-driven; advanced when next charge posts
             end::date,
             last_run_at = now(),
             updated_at = now()
       where id = m.id;
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;


ALTER FUNCTION "public"."run_autopay_mandates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."scan_data_diagnostics"("p_portfolio_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $_$
declare
  n integer := 0;
begin
  -- Invalid phone numbers (not matching typical US format)
  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title)
  select p_portfolio_id, 'invalid_phone', 'owner', o.id, 'warning',
         'Owner ' || coalesce(o.full_name,'<unknown>') || ' has unparseable phone: ' || o.phone
    from public.owners o
   where o.portfolio_id = p_portfolio_id
     and o.phone is not null
     and o.phone !~ '^\+?[0-9 ().-]{10,20}$'
     and o.archived_at is null
  on conflict do nothing;
  get diagnostics n = row_count;

  -- Missing owner email (preferred_comm is email but email null/empty)
  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title)
  select p_portfolio_id, 'missing_email', 'owner', o.id, 'warning',
         'Owner ' || coalesce(o.full_name,'<unknown>') || ' prefers email but email is missing'
    from public.owners o
   where o.portfolio_id = p_portfolio_id
     and o.preferred_comm = 'email'
     and (o.email is null or o.email = '')
     and o.archived_at is null
  on conflict do nothing;

  -- Vendors missing taxpayer_id but send_1099 = true
  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title)
  select p_portfolio_id, 'missing_taxpayer_id', 'vendor', v.id, 'error',
         'Vendor ' || v.name || ' has send_1099=true but no taxpayer_id'
    from public.vendors v
   where v.portfolio_id = p_portfolio_id
     and v.send_1099 = true
     and (v.taxpayer_id is null or v.taxpayer_id = '')
     and v.archived_at is null
  on conflict do nothing;

  -- Vendor compliance expired
  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title)
  select p_portfolio_id, 'vendor_compliance_expired', 'vendor', v.id, 'error',
         'Vendor ' || v.name || ' has expired compliance documents'
    from public.vendors v
    join public.vendor_compliance vc on vc.vendor_id = v.id
   where v.portfolio_id = p_portfolio_id
     and v.archived_at is null
     and (vc.workers_comp_expiration < current_date
          or vc.general_liability_expiration < current_date
          or vc.auto_insurance_expiration < current_date)
  on conflict do nothing;

  -- Units without an active occupancy (potentially vacant / data-missing)
  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title)
  select p_portfolio_id, 'unit_no_current_occupancy', 'unit', u.id, 'info',
         'Unit ' || u.unit_number || ' has no current occupancy record'
    from public.units u
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
   where a.portfolio_id = p_portfolio_id
     and u.archived_at is null
     and not exists (select 1 from public.occupancies occ
                      where occ.unit_id = u.id and occ.status = 'current')
  on conflict do nothing;

  return (select count(*) from public.data_diagnostics
          where portfolio_id = p_portfolio_id and resolved_at is null);
end;
$_$;


ALTER FUNCTION "public"."scan_data_diagnostics"("p_portfolio_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."scan_financial_diagnostics"("p_portfolio_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $_$
declare n integer := 0;
begin
  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title)
  select p_portfolio_id, 'reconciliation_lapsed', 'bank_account', ba.id, 'error',
         'Bank account ' || ba.name || ' not reconciled in ' || (current_date - coalesce(ba.last_reconciliation_date, ba.created_at::date))::text || ' days'
    from public.bank_accounts ba
   where ba.portfolio_id = p_portfolio_id
     and ba.archived_at is null
     and (ba.last_reconciliation_date is null or ba.last_reconciliation_date < current_date - interval '60 days')
  on conflict do nothing;

  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title)
  select p_portfolio_id, 'unused_prepayment', 'unit', u.id, 'info',
         'Unit ' || u.unit_number || ' has credit balance of ' || to_char(-ub.balance, 'FM$999,999.00')
    from public.unit_balances ub
    join public.units u on u.id = ub.unit_id
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
   where a.portfolio_id = p_portfolio_id and ub.balance < -0.01
  on conflict do nothing;

  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title)
  select p_portfolio_id, 'vendor_insurance_expiring', 'vendor', v.id, 'warning',
         'Vendor ' || v.name || ' has insurance expiring within 30 days'
    from public.vendors v
    join public.vendor_compliance vc on vc.vendor_id = v.id
   where v.portfolio_id = p_portfolio_id and v.archived_at is null
     and ((vc.workers_comp_expiration between current_date and current_date + interval '30 days')
          or (vc.general_liability_expiration between current_date and current_date + interval '30 days')
          or (vc.auto_insurance_expiration between current_date and current_date + interval '30 days'))
  on conflict do nothing;

  get diagnostics n = row_count;
  return n;
end;
$_$;


ALTER FUNCTION "public"."scan_financial_diagnostics"("p_portfolio_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_standard_charge_categories"("p_portfolio_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare n integer := 0;
begin
  if not public.can_admin_portfolio(p_portfolio_id) then
    raise exception 'permission denied';
  end if;
  insert into public.charge_categories (
    portfolio_id, name, code, description, default_amount, default_frequency,
    charge_type, is_income, is_assessment, is_fee, is_system, applies_by_default, sort_order
  ) values
    (p_portfolio_id, 'HOA Dues',           'DUES',      'Regular monthly HOA assessment',            0, 'monthly',  'assessment',         true, true,  false, true, true,  10),
    (p_portfolio_id, 'Special Assessment', 'SPECIAL',   'One-time or short-term assessment',          0, 'monthly',  'special_assessment', true, true,  false, true, false, 20),
    (p_portfolio_id, 'Parking Fee',        'PARKING',   'Monthly parking space rental',               0, 'monthly',  'amenity_fee',        true, false, true,  true, false, 30),
    (p_portfolio_id, 'Storage Fee',        'STORAGE',   'Monthly storage locker rental',              0, 'monthly',  'amenity_fee',        true, false, true,  true, false, 35),
    (p_portfolio_id, 'Cable TV',           'CABLE',     'Bulk cable service passed through',          0, 'monthly',  'amenity_fee',        true, false, true,  true, false, 40),
    (p_portfolio_id, 'Internet',           'INTERNET',  'Bulk internet service passed through',       0, 'monthly',  'amenity_fee',        true, false, true,  true, false, 45),
    (p_portfolio_id, 'Pool Key Fee',       'POOLKEY',   'Pool key / fob issuance',                    0, 'annually', 'amenity_fee',        true, false, true,  true, false, 50),
    (p_portfolio_id, 'Move-In Fee',        'MOVEIN',    'One-time move-in charge',                    0, 'annually', 'move_fee',           true, false, true,  true, false, 55),
    (p_portfolio_id, 'Move-Out Fee',       'MOVEOUT',   'One-time move-out charge',                   0, 'annually', 'move_fee',           true, false, true,  true, false, 60),
    (p_portfolio_id, 'Late Fee',           'LATEFEE',   'Auto-posted late payment fee',               0, 'monthly',  'late_fee',           true, false, true,  true, false, 70),
    (p_portfolio_id, 'NSF Fee',            'NSFFEE',    'Returned payment fee',                       0, 'monthly',  'nsf_fee',            true, false, true,  true, false, 75),
    (p_portfolio_id, 'Violation Fine',     'VIOLATION', 'HOA rules violation fine',                   0, 'monthly',  'fine',               true, false, true,  true, false, 80),
    (p_portfolio_id, 'Other',              'OTHER',     'Custom / miscellaneous charge',              0, 'monthly',  'other',              true, false, false, true, false, 100)
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;


ALTER FUNCTION "public"."seed_standard_charge_categories"("p_portfolio_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."select_payment_processor"("p_portfolio_id" "uuid", "p_method" "text") RETURNS "public"."payment_processor"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  chosen public.payment_processor;
begin
  -- Prefer configured default if it supports the method
  select processor into chosen
    from public.payment_processor_configs
   where portfolio_id = p_portfolio_id
     and is_active
     and is_default
     and (
       (p_method in ('ach','echeck') and supports_ach)
       or (p_method in ('card','credit_card','debit_card') and supports_card)
     )
   limit 1;

  if chosen is not null then
    return chosen;
  end if;

  -- Fall back to cheapest ACH processor configured
  if p_method in ('ach','echeck') then
    select processor into chosen
      from public.payment_processor_configs
     where portfolio_id = p_portfolio_id and is_active and supports_ach
     order by coalesce(ach_fee_fixed_cents, 999999) + coalesce(ach_fee_bps, 0) * 10
     limit 1;
  else
    select processor into chosen
      from public.payment_processor_configs
     where portfolio_id = p_portfolio_id and is_active and supports_card
     order by coalesce(card_fee_bps, 0) * 10 + coalesce(card_fee_fixed_cents, 0)
     limit 1;
  end if;

  return coalesce(chosen, 'stripe'::public.payment_processor);
end;
$$;


ALTER FUNCTION "public"."select_payment_processor"("p_portfolio_id" "uuid", "p_method" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_document_template_portfolio_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF NEW.portfolio_id IS NULL THEN
    NEW.portfolio_id := public.current_portfolio_id();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_document_template_portfolio_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."setup_edge_function_secrets"("p_project_url" "text", "p_service_role_key" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'vault'
    AS $$
declare
  existing_url_id uuid;
  existing_key_id uuid;
begin
  -- Refuse unless caller is a platform admin or running as service role
  if not (public.is_platform_operator() or current_user = 'service_role') then
    raise exception 'setup_edge_function_secrets: platform operator or service_role required';
  end if;

  select id into existing_url_id from vault.secrets where name = 'project_url';
  select id into existing_key_id from vault.secrets where name = 'service_role_key';

  if existing_url_id is null then
    perform vault.create_secret(p_project_url, 'project_url', 'Supabase project URL for edge function invocation');
  else
    perform vault.update_secret(existing_url_id, p_project_url);
  end if;

  if existing_key_id is null then
    perform vault.create_secret(p_service_role_key, 'service_role_key', 'Supabase service role key for edge function invocation');
  else
    perform vault.update_secret(existing_key_id, p_service_role_key);
  end if;

  return 'secrets configured';
end;
$$;


ALTER FUNCTION "public"."setup_edge_function_secrets"("p_project_url" "text", "p_service_role_key" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."setup_edge_function_secrets"("p_project_url" "text", "p_service_role_key" "text") IS 'One-shot setup for the edge function cron system. Call via service_role (e.g., from a one-time psql session or a Supabase SQL Editor query) to populate project_url and service_role_key Vault secrets.';



CREATE OR REPLACE FUNCTION "public"."slugify_association_name"("p_name" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select coalesce(nullif(
    trim(both '-' from
      regexp_replace(
        regexp_replace(
          regexp_replace(
            lower(coalesce(p_name, '')),
            '\m(condominium|condominiums|condo|association|associations|assoc|hoa|homeowners|homeowner|owners|community|communities|incorporated|inc|llc|ltd|the)\M',
            ' ', 'g'),
          '[^a-z0-9]+', '-', 'g'),
        '-+', '-', 'g')
    ), ''), 'assoc');
$$;


ALTER FUNCTION "public"."slugify_association_name"("p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."stage_owner_activation"("p_owner_id" "uuid", "p_subject" "text" DEFAULT 'Activate your owner portal'::"text", "p_message" "text" DEFAULT 'Click the link to access your owner portal.'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$ DECLARE v_email text; v_full_name text; v_invitation_id uuid; BEGIN SELECT email, full_name INTO v_email, v_full_name FROM public.owners WHERE id = p_owner_id; IF v_email IS NULL THEN RETURN jsonb_build_object('error', 'Owner not found'); END IF; IF EXISTS (SELECT 1 FROM public.user_invitations WHERE email = v_email AND role = 'homeowner' AND status IN ('sent', 'staged')) THEN RETURN jsonb_build_object('error', 'Invitation already exists'); END IF; INSERT INTO public.user_invitations (email, full_name, role, status, message, metadata) VALUES (v_email, v_full_name, 'homeowner', 'staged', p_subject || E'\n\n' || p_message, jsonb_build_object('owner_id', p_owner_id, 'template', 'portal_activation')) RETURNING id INTO v_invitation_id; INSERT INTO public.email_queue (to_address, to_name, subject, body, template, reference_type, reference_id, status) VALUES (v_email, v_full_name, p_subject, p_message, 'portal_activation', 'user_invitation', v_invitation_id, 'queued'); RETURN jsonb_build_object('success', true, 'invitation_id', v_invitation_id); END; $$;


ALTER FUNCTION "public"."stage_owner_activation"("p_owner_id" "uuid", "p_subject" "text", "p_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."stage_owner_form"("p_owner_id" "uuid", "p_template" "text" DEFAULT 'owner_intake'::"text", "p_subject" "text" DEFAULT 'Communication from Stellar Property Management'::"text", "p_message" "text" DEFAULT 'Please review the attached information.'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_email text;
  v_full_name text;
  v_comm_id uuid;
BEGIN
  SELECT email, full_name INTO v_email, v_full_name
  FROM public.owners WHERE id = p_owner_id;

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('error', 'Owner not found');
  END IF;

  -- For portal activation, reuse the activation flow
  IF p_template = 'portal_activation' THEN
    RETURN public.stage_owner_activation(p_owner_id, p_subject, p_message);
  END IF;

  -- Create communication message
  INSERT INTO public.communication_messages (
    recipient_name, recipient_email, subject, body, channel,
    status, template, metadata
  ) VALUES (
    v_full_name, v_email, p_subject, p_message, 'email',
    'staged', p_template,
    jsonb_build_object('owner_id', p_owner_id)
  )
  RETURNING id INTO v_comm_id;

  -- Queue email
  INSERT INTO public.email_queue (
    to_address, to_name, subject, body, template,
    reference_type, reference_id, status
  ) VALUES (
    v_email, v_full_name, p_subject, p_message,
    p_template, 'communication_message', v_comm_id, 'queued'
  );

  RETURN jsonb_build_object('success', true, 'communication_id', v_comm_id);
END;
$$;


ALTER FUNCTION "public"."stage_owner_form"("p_owner_id" "uuid", "p_template" "text", "p_subject" "text", "p_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."subscribe_association_to_charge"("p_association_id" "uuid", "p_charge_category_id" "uuid", "p_amount" numeric DEFAULT NULL::numeric, "p_frequency" "public"."recurring_frequency" DEFAULT NULL::"public"."recurring_frequency") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare cat public.charge_categories; unit_row record; n integer := 0;
begin
  select * into cat from public.charge_categories where id = p_charge_category_id;
  if not found then raise exception 'charge category not found'; end if;
  if not public.can_manage_finance(cat.portfolio_id) then raise exception 'permission denied'; end if;
  for unit_row in
    select u.id from public.units u
    join public.buildings b on b.id = u.building_id
    where b.association_id = p_association_id and u.archived_at is null
  loop
    insert into public.unit_recurring_charges (
      unit_id, charge_category_id, amount, frequency, created_by
    ) values (
      unit_row.id, p_charge_category_id,
      coalesce(p_amount, cat.default_amount),
      coalesce(p_frequency, cat.default_frequency),
      auth.uid()
    ) on conflict do nothing;
    n := n + 1;
  end loop;
  return n;
end;
$$;


ALTER FUNCTION "public"."subscribe_association_to_charge"("p_association_id" "uuid", "p_charge_category_id" "uuid", "p_amount" numeric, "p_frequency" "public"."recurring_frequency") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."unit_recurring_charges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "charge_category_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "frequency" "public"."recurring_frequency" DEFAULT 'monthly'::"public"."recurring_frequency" NOT NULL,
    "start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "end_date" "date",
    "next_post_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "last_posted_at" timestamp with time zone,
    "memo" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "identifier" "text",
    CONSTRAINT "unit_recurring_charges_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "unit_recurring_charges_check" CHECK ((("end_date" IS NULL) OR ("end_date" >= "start_date")))
);


ALTER TABLE "public"."unit_recurring_charges" OWNER TO "postgres";


COMMENT ON COLUMN "public"."unit_recurring_charges"."identifier" IS 'Optional asset identifier for this fee, e.g. parking space # or locker #.';



CREATE OR REPLACE FUNCTION "public"."subscribe_unit_to_charge"("p_unit_id" "uuid", "p_charge_category_id" "uuid", "p_amount" numeric DEFAULT NULL::numeric, "p_frequency" "public"."recurring_frequency" DEFAULT NULL::"public"."recurring_frequency", "p_start_date" "date" DEFAULT CURRENT_DATE, "p_memo" "text" DEFAULT NULL::"text") RETURNS "public"."unit_recurring_charges"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare cat public.charge_categories; row public.unit_recurring_charges;
begin
  select * into cat from public.charge_categories where id = p_charge_category_id;
  if not found then raise exception 'charge category not found'; end if;
  if not public.can_manage_finance(cat.portfolio_id) then raise exception 'permission denied'; end if;
  insert into public.unit_recurring_charges (
    unit_id, charge_category_id, amount, frequency, start_date, next_post_date, memo, created_by
  ) values (
    p_unit_id, p_charge_category_id,
    coalesce(p_amount, cat.default_amount),
    coalesce(p_frequency, cat.default_frequency),
    p_start_date, p_start_date, p_memo, auth.uid()
  ) returning * into row;
  return row;
end;
$$;


ALTER FUNCTION "public"."subscribe_unit_to_charge"("p_unit_id" "uuid", "p_charge_category_id" "uuid", "p_amount" numeric, "p_frequency" "public"."recurring_frequency", "p_start_date" "date", "p_memo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."subscribe_unit_to_charge"("p_unit_id" "uuid", "p_charge_category_id" "uuid", "p_amount" numeric DEFAULT NULL::numeric, "p_frequency" "public"."recurring_frequency" DEFAULT NULL::"public"."recurring_frequency", "p_start_date" "date" DEFAULT CURRENT_DATE, "p_memo" "text" DEFAULT NULL::"text", "p_identifier" "text" DEFAULT NULL::"text") RETURNS "public"."unit_recurring_charges"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare cat public.charge_categories; row public.unit_recurring_charges;
begin
  select * into cat from public.charge_categories where id = p_charge_category_id;
  if not found then raise exception 'charge category not found'; end if;
  if not public.can_manage_finance(cat.portfolio_id) then raise exception 'permission denied'; end if;
  insert into public.unit_recurring_charges (
    unit_id, charge_category_id, amount, frequency, start_date, next_post_date, memo, identifier, created_by
  ) values (
    p_unit_id, p_charge_category_id,
    coalesce(p_amount, cat.default_amount),
    coalesce(p_frequency, cat.default_frequency),
    p_start_date, p_start_date, p_memo, p_identifier, auth.uid()
  ) returning * into row;
  return row;
end;
$$;


ALTER FUNCTION "public"."subscribe_unit_to_charge"("p_unit_id" "uuid", "p_charge_category_id" "uuid", "p_amount" numeric, "p_frequency" "public"."recurring_frequency", "p_start_date" "date", "p_memo" "text", "p_identifier" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."suspend_portfolio"("p_portfolio_id" "uuid", "p_reason" "text") RETURNS "public"."portfolios"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  updated public.portfolios;
begin
  if not public.is_platform_operator() then
    raise exception 'suspend_portfolio: platform operator required';
  end if;

  update public.portfolios
     set suspended_at = now(), suspension_reason = p_reason, updated_at = now()
   where id = p_portfolio_id
   returning * into updated;

  update public.subscriptions set status = 'paused', updated_at = now()
   where portfolio_id = p_portfolio_id;

  insert into public.permission_audit_log (
    actor_user_id, actor_portfolio_id, target_entity_type, target_entity_id,
    action, details
  ) values (
    auth.uid(), null, 'portfolio', p_portfolio_id,
    'suspended',
    jsonb_build_object('reason', p_reason)
  );
  return updated;
end;
$$;


ALTER FUNCTION "public"."suspend_portfolio"("p_portfolio_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_association_unit_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  affected uuid[];
begin
  select array_agg(distinct b.association_id) into affected
  from public.buildings b
  where b.id in (coalesce(new.building_id, old.building_id), coalesce(old.building_id, new.building_id));

  update public.associations a
  set unit_count = (
    select count(*) from public.units u
    join public.buildings b on b.id = u.building_id
    where b.association_id = a.id
  )
  where a.id = any(affected);

  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."sync_association_unit_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_portfolio_tier_from_subscription"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  update public.portfolios set tier = new.tier, updated_at = now()
   where id = new.portfolio_id and tier is distinct from new.tier;
  return new;
end;
$$;


ALTER FUNCTION "public"."sync_portfolio_tier_from_subscription"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_sms_conversation_on_message"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  update public.sms_conversations
     set last_message_at = greatest(coalesce(last_message_at, new.created_at), new.created_at),
         last_message_preview = left(coalesce(new.body, ''), 200),
         unread_count = case
           when new.direction = 'inbound' and new.read_at is null then unread_count + 1
           else unread_count
         end,
         updated_at = now()
   where id = new.conversation_id;
  return new;
end;
$$;


ALTER FUNCTION "public"."sync_sms_conversation_on_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tally_approval_vote"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  req public.approval_requests;
  n_for integer; n_against integer; n_abstain integer;
begin
  select count(*) filter (where choice = 'yes'),
         count(*) filter (where choice = 'no'),
         count(*) filter (where choice = 'abstain')
    into n_for, n_against, n_abstain
    from public.approval_votes
   where approval_request_id = new.approval_request_id;

  select * into req from public.approval_requests where id = new.approval_request_id;

  update public.approval_requests
     set votes_for = n_for,
         votes_against = n_against,
         votes_abstain = n_abstain,
         status = case
           when n_for >= req.required_votes then 'approved'::public.approval_request_status
           when n_against >= req.required_votes then 'rejected'::public.approval_request_status
           else status
         end,
         decision_at = case
           when (n_for >= req.required_votes or n_against >= req.required_votes) and decision_at is null then now()
           else decision_at
         end,
         updated_at = now()
   where id = new.approval_request_id;
  return new;
end;
$$;


ALTER FUNCTION "public"."tally_approval_vote"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tenant_branding"("p_host" "text" DEFAULT NULL::"text", "p_slug" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "company_name" "text", "logo_url" "text", "brand_color" "text", "support_email" "text", "support_phone" "text", "public_website" "text", "slug" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select p.id, p.company_name, p.logo_url, p.brand_color, p.support_email, p.support_phone, p.public_website, p.slug
  from public.portfolios p
  where (p_host is not null and p.custom_domain = p_host)
     or (p_slug is not null and p.slug = p_slug)
  order by (p_host is not null and p.custom_domain = p_host) desc
  limit 1;
$$;


ALTER FUNCTION "public"."tenant_branding"("p_host" "text", "p_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_violation_updated"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_violation_updated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transfer_user_to_portfolio"("p_profile_id" "uuid", "p_new_portfolio_id" "uuid", "p_new_role_id" "uuid" DEFAULT NULL::"uuid", "p_new_hoa_role" "public"."hoa_role" DEFAULT NULL::"public"."hoa_role") RETURNS "public"."profiles"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  updated public.profiles;
begin
  if not public.is_platform_operator() then
    raise exception 'transfer_user_to_portfolio: platform operator required';
  end if;

  update public.profiles
     set portfolio_id = p_new_portfolio_id,
         role_id = coalesce(p_new_role_id, role_id),
         hoa_role = coalesce(p_new_hoa_role, hoa_role),
         updated_at = now()
   where id = p_profile_id
   returning * into updated;

  if not found then
    raise exception 'transfer_user_to_portfolio: profile % not found', p_profile_id;
  end if;
  return updated;
end;
$$;


ALTER FUNCTION "public"."transfer_user_to_portfolio"("p_profile_id" "uuid", "p_new_portfolio_id" "uuid", "p_new_role_id" "uuid", "p_new_hoa_role" "public"."hoa_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_seed_standard_charge_categories"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  insert into public.charge_categories (
    portfolio_id, name, code, description, default_amount, default_frequency,
    charge_type, is_income, is_assessment, is_fee, is_system, applies_by_default, sort_order
  ) values
    (new.id, 'HOA Dues',           'DUES',      'Regular monthly HOA assessment',            0, 'monthly',  'assessment',         true, true,  false, true, true,  10),
    (new.id, 'Special Assessment', 'SPECIAL',   'One-time or short-term assessment',          0, 'monthly',  'special_assessment', true, true,  false, true, false, 20),
    (new.id, 'Parking Fee',        'PARKING',   'Monthly parking space rental',               0, 'monthly',  'amenity_fee',        true, false, true,  true, false, 30),
    (new.id, 'Storage Fee',        'STORAGE',   'Monthly storage locker rental',              0, 'monthly',  'amenity_fee',        true, false, true,  true, false, 35),
    (new.id, 'Cable TV',           'CABLE',     'Bulk cable service passed through',          0, 'monthly',  'amenity_fee',        true, false, true,  true, false, 40),
    (new.id, 'Internet',           'INTERNET',  'Bulk internet service passed through',       0, 'monthly',  'amenity_fee',        true, false, true,  true, false, 45),
    (new.id, 'Pool Key Fee',       'POOLKEY',   'Pool key / fob issuance',                    0, 'annually', 'amenity_fee',        true, false, true,  true, false, 50),
    (new.id, 'Move-In Fee',        'MOVEIN',    'One-time move-in charge',                    0, 'annually', 'move_fee',           true, false, true,  true, false, 55),
    (new.id, 'Move-Out Fee',       'MOVEOUT',   'One-time move-out charge',                   0, 'annually', 'move_fee',           true, false, true,  true, false, 60),
    (new.id, 'Late Fee',           'LATEFEE',   'Auto-posted late payment fee',               0, 'monthly',  'late_fee',           true, false, true,  true, false, 70),
    (new.id, 'NSF Fee',            'NSFFEE',    'Returned payment fee',                       0, 'monthly',  'nsf_fee',            true, false, true,  true, false, 75),
    (new.id, 'Violation Fine',     'VIOLATION', 'HOA rules violation fine',                   0, 'monthly',  'fine',               true, false, true,  true, false, 80),
    (new.id, 'Other',              'OTHER',     'Custom / miscellaneous charge',              0, 'monthly',  'other',              true, false, false, true, false, 100)
  on conflict do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_seed_standard_charge_categories"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unapply_payment"("p_payment_id" "uuid", "p_charge_id" "uuid" DEFAULT NULL::"uuid") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare n integer;
begin
  if p_charge_id is null then
    -- Remove ALL applications for this payment
    delete from public.payment_applications where payment_id = p_payment_id;
  else
    delete from public.payment_applications where payment_id = p_payment_id and charge_id = p_charge_id;
  end if;
  get diagnostics n = row_count;
  return n;
end;
$$;


ALTER FUNCTION "public"."unapply_payment"("p_payment_id" "uuid", "p_charge_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_bank_account_reconciliation_date"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE bank_accounts
    SET last_reconciliation_date = NEW.statement_date,
        updated_at = now()
    WHERE id = NEW.bank_account_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_bank_account_reconciliation_date"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_meetings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_meetings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_owner_payables_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_owner_payables_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_payment_intent_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_payment_intent_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_plaid_items_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_plaid_items_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_work_order_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_work_order_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_budget_line"("p_id" "uuid", "p_association_id" "uuid", "p_gl_account_id" "uuid", "p_fiscal_year" integer, "p_monthly_amounts" numeric[], "p_category" "text", "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_id IS NOT NULL THEN
    UPDATE budget_lines
    SET 
      gl_account_id = p_gl_account_id,
      fiscal_year = p_fiscal_year,
      monthly_amounts = p_monthly_amounts,
      category = p_category::budget_category,
      notes = p_notes,
      updated_at = now()
    WHERE id = p_id
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO budget_lines (
      association_id, gl_account_id, fiscal_year, 
      monthly_amounts, category, notes
    ) VALUES (
      p_association_id, p_gl_account_id, p_fiscal_year,
      p_monthly_amounts, p_category::budget_category, p_notes
    )
    RETURNING id INTO v_id;
  END IF;
  
  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."upsert_budget_line"("p_id" "uuid", "p_association_id" "uuid", "p_gl_account_id" "uuid", "p_fiscal_year" integer, "p_monthly_amounts" numeric[], "p_category" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_invitation_email_domain"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  domains text[];
  invitee_domain text;
begin
  select allowed_email_domains into domains
    from public.portfolios
   where id = new.portfolio_id;

  if domains is null or array_length(domains, 1) is null then
    return new;  -- no restriction
  end if;

  invitee_domain := lower(split_part(new.email, '@', 2));
  if invitee_domain = '' then
    raise exception 'invalid email: %', new.email;
  end if;

  if not (invitee_domain = any(domains)) then
    raise exception 'email domain % not in portfolio allowlist (%)', invitee_domain, array_to_string(domains, ', ');
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."validate_invitation_email_domain"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_journal_entry_balance"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  total_debit numeric;
  total_credit numeric;
  should_check boolean;
begin
  should_check := false;
  if tg_op = 'INSERT' and new.posted = true then
    should_check := true;
  elsif tg_op = 'UPDATE' and new.posted = true and (old.posted is distinct from true) then
    should_check := true;
  end if;

  if should_check then
    select coalesce(sum(debit_amount), 0), coalesce(sum(credit_amount), 0)
      into total_debit, total_credit
      from public.journal_lines
      where entry_id = new.id;

    if abs(total_debit - total_credit) > 0.001 then
      raise exception 'Journal entry % unbalanced: debits=% credits=%', new.id, total_debit, total_credit;
    end if;
    if new.posted_at is null then
      new.posted_at := now();
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."validate_journal_entry_balance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_api_key"("p_raw_key" "text") RETURNS TABLE("portfolio_id" "uuid", "key_id" "uuid", "scopes" "text"[])
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'extensions'
    AS $$
declare
  k_hash text;
  k_row public.api_keys;
begin
  if p_raw_key is null or length(p_raw_key) < 16 then
    return;
  end if;

  k_hash := encode(extensions.digest(p_raw_key, 'sha256'), 'hex');

  select * into k_row
    from public.api_keys
   where key_hash = k_hash
     and revoked_at is null
     and (expires_at is null or expires_at > now())
   limit 1;

  if not found then
    return;
  end if;

  -- Update last_used stats (don't block verification if this fails)
  update public.api_keys
     set last_used_at = now(), use_count = use_count + 1
   where id = k_row.id;

  portfolio_id := k_row.portfolio_id;
  key_id := k_row.id;
  scopes := k_row.scopes;
  return next;
end;
$$;


ALTER FUNCTION "public"."verify_api_key"("p_raw_key" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."accounting_periods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "fiscal_year" integer NOT NULL,
    "period_month" smallint NOT NULL,
    "status" "public"."period_status" DEFAULT 'open'::"public"."period_status" NOT NULL,
    "closed_at" timestamp with time zone,
    "closed_by" "uuid",
    "reopened_at" timestamp with time zone,
    "reopened_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "accounting_periods_fiscal_year_check" CHECK ((("fiscal_year" >= 2000) AND ("fiscal_year" <= 2100))),
    CONSTRAINT "accounting_periods_period_month_check" CHECK ((("period_month" >= 1) AND ("period_month" <= 12)))
);


ALTER TABLE "public"."accounting_periods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "agent" "text",
    "file" "text",
    "details" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."activity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."associations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "address" "text" NOT NULL,
    "city" "text" NOT NULL,
    "state" "text" NOT NULL,
    "zip" "text" NOT NULL,
    "fiscal_year_start" smallint NOT NULL,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" NOT NULL,
    "portfolio_id" "uuid",
    "property_group_id" "uuid",
    "unit_count" integer,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "management_fee_schedule_id" "uuid",
    "primary_bank_account_id" "uuid",
    "late_fee_amount_override" numeric(10,2),
    "late_fee_type" "text",
    "late_fee_grace_days_override" integer,
    "late_fee_eligible_charges" "text" DEFAULT 'every_charge'::"text",
    "nsf_fee_amount_override" numeric(10,2),
    "maintenance_limit" numeric(14,2),
    "insurance_expiration" "date",
    "home_warranty_covered" boolean DEFAULT false NOT NULL,
    "unit_entry_pre_authorized" boolean DEFAULT false NOT NULL,
    "maintenance_notes" "text",
    "online_maintenance_request_instructions" "text",
    "year_built" smallint,
    "budget_variance_threshold_amount" numeric(14,2),
    "budget_variance_threshold_pct" numeric(5,2),
    "budget_variance_threshold_op" "text",
    "reserve_funds" numeric(14,2) DEFAULT 0 NOT NULL,
    "basis_for_owner_packets" "text" DEFAULT 'cash'::"text",
    "maintenance_contact_email" "text",
    "maintenance_contact_name" "text",
    "address_line_2" "text",
    "lockbox_id" "text",
    "operating_bank_account_id" "uuid",
    "reserve_bank_account_id" "uuid",
    "maintenance_contact_phone" "text",
    "description" "text",
    "site_manager" "text",
    "payment_frequency" "text" DEFAULT 'monthly'::"text",
    "owner_can_override_frequency" boolean DEFAULT true NOT NULL,
    "management_start_date" "date",
    "management_end_date" "date",
    "management_end_reason" "text",
    "hide_calendar_in_portal" boolean DEFAULT false NOT NULL,
    "disable_contacts_editing_in_portal" boolean DEFAULT false NOT NULL,
    "disable_renter_editing_in_portal" boolean DEFAULT false NOT NULL,
    "residents_check_fee_coverage_enabled" boolean DEFAULT false NOT NULL,
    "property_type" "text" DEFAULT 'HOA'::"text",
    "county" "text",
    "amenities" "jsonb" DEFAULT '[]'::"jsonb",
    "interest_grace_days" integer DEFAULT 15,
    "interest_post_day_of_month" integer DEFAULT 15,
    "interest_grace_balance" numeric DEFAULT 0 NOT NULL,
    "annual_interest_rate" numeric DEFAULT 0 NOT NULL,
    "interest_income_gl_account_id" "uuid",
    "use_enhanced_statement" boolean DEFAULT true NOT NULL,
    "include_current_and_upcoming_charges" boolean DEFAULT true NOT NULL,
    "include_upcoming_in_amount_due" boolean DEFAULT true NOT NULL,
    "upcoming_charges_timeframe" "text" DEFAULT 'next_month'::"text" NOT NULL,
    "include_current_message_on_statement" boolean DEFAULT false NOT NULL,
    "include_logo_on_statement" boolean DEFAULT false NOT NULL,
    "charge_history_includes" "text" DEFAULT 'all_past_due_charges'::"text" NOT NULL,
    "include_payments_due_date" boolean DEFAULT false NOT NULL,
    "include_payments_history_and_balance_forward" boolean DEFAULT false NOT NULL,
    "show_remaining_amount_for_past_due_charges" boolean DEFAULT false NOT NULL,
    "include_payment_coupon_on_statement" boolean DEFAULT false NOT NULL,
    "disable_online_maintenance_requests" boolean DEFAULT false NOT NULL,
    "maintenance_phone" "text",
    "electronic_doc_delivery_terms" "text",
    "violation_sender_name" "text",
    "violation_sender_email_uses_logged_in_user" boolean DEFAULT true NOT NULL,
    "violation_sender_email" "text",
    "site_manager_phone" "text",
    "vendor_1099_payer" "text" DEFAULT 'use_management_company'::"text",
    "owner_payout_basis" "text" DEFAULT 'cash'::"text",
    "legal_name" "text",
    "tax_id" "text",
    "lease_fee_type" "text",
    "lease_fee_pct" numeric(6,3),
    "lease_fee_amount" numeric(10,2),
    "renewal_fee_type" "text",
    "renewal_fee_pct" numeric(6,3),
    "renewal_fee_amount" numeric(10,2),
    "late_fee_grace_day_of_following_month" smallint,
    "site_manager_first_name" "text",
    "site_manager_last_name" "text",
    "site_manager_user_id" "uuid",
    "lease_generation_method" "public"."lease_generation_method" DEFAULT 'appfolio_lease_templates'::"public"."lease_generation_method" NOT NULL,
    "rent_change_kind" "public"."rent_change_kind" DEFAULT 'dollar_amount'::"public"."rent_change_kind" NOT NULL,
    "default_renewal_letter_template_id" "uuid",
    "quorum_percentage" integer DEFAULT 51,
    "slug" "text",
    "remit_payee" "text",
    "remit_address" "text",
    "payment_instructions" "text",
    "stripe_account_id" "text",
    "stripe_charges_enabled" boolean DEFAULT false NOT NULL,
    "stripe_details_submitted" boolean DEFAULT false NOT NULL,
    "stripe_onboarded_at" timestamp with time zone,
    "payment_allocation_order" "text"[] DEFAULT ARRAY['late_fee'::"text", 'nsf_fee'::"text", 'fine'::"text", 'interest'::"text", 'legal'::"text", 'special_assessment'::"text", 'assessment'::"text", 'other'::"text"] NOT NULL,
    "timezone" "text" DEFAULT 'America/Chicago'::"text" NOT NULL,
    "late_fee_enabled" boolean DEFAULT false NOT NULL,
    "late_fee_amount" numeric,
    "late_fee_is_percent" boolean DEFAULT false NOT NULL,
    "late_fee_grace_days" integer DEFAULT 10 NOT NULL,
    CONSTRAINT "associations_basis_for_owner_packets_check" CHECK (("basis_for_owner_packets" = ANY (ARRAY['cash'::"text", 'accrual'::"text"]))),
    CONSTRAINT "associations_budget_variance_threshold_op_check" CHECK ((("budget_variance_threshold_op" = ANY (ARRAY['and'::"text", 'or'::"text"])) OR ("budget_variance_threshold_op" IS NULL))),
    CONSTRAINT "associations_fiscal_year_start_check" CHECK ((("fiscal_year_start" >= 1) AND ("fiscal_year_start" <= 12))),
    CONSTRAINT "associations_late_fee_amount_override_check" CHECK ((("late_fee_amount_override" IS NULL) OR ("late_fee_amount_override" >= (0)::numeric))),
    CONSTRAINT "associations_late_fee_grace_day_of_following_month_check" CHECK ((("late_fee_grace_day_of_following_month" >= 1) AND ("late_fee_grace_day_of_following_month" <= 31))),
    CONSTRAINT "associations_late_fee_grace_days_override_check" CHECK ((("late_fee_grace_days_override" IS NULL) OR (("late_fee_grace_days_override" >= 0) AND ("late_fee_grace_days_override" <= 60)))),
    CONSTRAINT "associations_late_fee_type_check" CHECK ((("late_fee_type" = ANY (ARRAY['flat'::"text", 'percent'::"text"])) OR ("late_fee_type" IS NULL))),
    CONSTRAINT "associations_lease_fee_type_check" CHECK (("lease_fee_type" = ANY (ARRAY['flat'::"text", 'percent'::"text"]))),
    CONSTRAINT "associations_maintenance_limit_check" CHECK ((("maintenance_limit" IS NULL) OR ("maintenance_limit" >= (0)::numeric))),
    CONSTRAINT "associations_nsf_fee_amount_override_check" CHECK ((("nsf_fee_amount_override" IS NULL) OR ("nsf_fee_amount_override" >= (0)::numeric))),
    CONSTRAINT "associations_owner_payout_basis_check" CHECK (("owner_payout_basis" = ANY (ARRAY['cash'::"text", 'accrual'::"text"]))),
    CONSTRAINT "associations_renewal_fee_type_check" CHECK (("renewal_fee_type" = ANY (ARRAY['flat'::"text", 'percent'::"text"]))),
    CONSTRAINT "associations_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"]))),
    CONSTRAINT "associations_vendor_1099_payer_check" CHECK (("vendor_1099_payer" = ANY (ARRAY['use_management_company'::"text", 'use_owner'::"text"]))),
    CONSTRAINT "associations_year_built_check" CHECK ((("year_built" IS NULL) OR (("year_built" >= 1700) AND ("year_built" <= 2100))))
);


ALTER TABLE "public"."associations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."associations"."management_fee_schedule_id" IS 'FK to management_fee_schedules — wired in Phase 2';



COMMENT ON COLUMN "public"."associations"."primary_bank_account_id" IS 'FK to public.bank_accounts — wired in Phase 2';



COMMENT ON COLUMN "public"."associations"."site_manager_phone" IS 'Phone number for the on-site manager (free-text).';



COMMENT ON COLUMN "public"."associations"."vendor_1099_payer" IS 'Who is the vendor 1099 payer for tax purposes: the management company or the owner.';



COMMENT ON COLUMN "public"."associations"."owner_payout_basis" IS 'Basis for owner payouts: cash or accrual.';



COMMENT ON COLUMN "public"."associations"."legal_name" IS 'Registered legal name of the HOA/Condo corporation (if different from display name).';



COMMENT ON COLUMN "public"."associations"."tax_id" IS 'Federal EIN / tax identification number for the legal entity.';



COMMENT ON COLUMN "public"."associations"."remit_payee" IS 'Make checks payable to (manager-entered)';



COMMENT ON COLUMN "public"."associations"."remit_address" IS 'Mailing address for check/bill-pay payments (manager-entered, multi-line)';



COMMENT ON COLUMN "public"."associations"."payment_instructions" IS 'Free-text payment notes: bill-pay payee, account #, lockbox, online options (manager-entered)';



COMMENT ON COLUMN "public"."associations"."late_fee_amount" IS 'Flat dollar amount, or percent (0-100) of the unpaid balance when late_fee_is_percent.';



CREATE TABLE IF NOT EXISTS "public"."buildings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "association_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text" NOT NULL,
    "year_built" smallint,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "address_line_2" "text",
    "city" "text",
    "state" "text",
    "zip" "text",
    "county" "text",
    "property_type" "text",
    "description" "text",
    "site_manager" "text",
    "site_manager_phone" "text",
    "management_start_date" "date",
    "amenities" "jsonb" DEFAULT '[]'::"jsonb",
    "maintenance_limit" numeric(14,2) DEFAULT 0,
    "insurance_expiration" "date",
    "home_warranty_covered" boolean DEFAULT false,
    "disable_online_maintenance_requests" boolean DEFAULT false,
    "unit_entry_pre_authorized" boolean DEFAULT false,
    "maintenance_notes" "text",
    "online_maintenance_request_instructions" "text",
    "lockbox_id" "text",
    "is_primary" boolean DEFAULT false,
    CONSTRAINT "buildings_year_built_check" CHECK ((("year_built" >= 1700) AND ("year_built" <= 2100)))
);


ALTER TABLE "public"."buildings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."buildings"."property_type" IS 'Physical structure type: hoa, condo, coop, commercial, single_family, multi_family, mixed.';



COMMENT ON COLUMN "public"."buildings"."site_manager" IS 'Name of the on-site manager for this building.';



COMMENT ON COLUMN "public"."buildings"."amenities" IS 'JSON array of amenity tags. e.g. ["pool","gym","clubhouse"]';



COMMENT ON COLUMN "public"."buildings"."is_primary" IS 'The default/headline building for an association (used for address display, maintenance info, etc.). Exactly one per association.';



CREATE TABLE IF NOT EXISTS "public"."payment_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "charge_id" "uuid" NOT NULL,
    "amount_applied" numeric(14,2) NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_by" "uuid",
    "application_method" "text" DEFAULT 'manual'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_applications_amount_applied_check" CHECK (("amount_applied" > (0)::numeric)),
    CONSTRAINT "payment_applications_application_method_check" CHECK (("application_method" = ANY (ARRAY['manual'::"text", 'auto_oldest_first'::"text", 'auto_late_fees_first'::"text", 'auto_specific'::"text", 'credit_application'::"text", 'association_policy'::"text"])))
);


ALTER TABLE "public"."payment_applications" OWNER TO "postgres";


COMMENT ON TABLE "public"."payment_applications" IS 'One payment can cover many charges and one charge can receive many partial payments. Source of truth for payment application (not payments.charge_id).';



COMMENT ON COLUMN "public"."payment_applications"."application_method" IS 'auto_oldest_first / auto_late_fees_first / auto_specific when applied automatically; manual when a staff user chose.';



CREATE TABLE IF NOT EXISTS "public"."units" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "building_id" "uuid" NOT NULL,
    "unit_number" "text" NOT NULL,
    "sqft" integer,
    "bedrooms" smallint,
    "ownership_pct" numeric(6,3) NOT NULL,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parking_spaces" "text",
    "storage_number" "text",
    "name" "text",
    "bathrooms" numeric(3,1),
    "notes" "text",
    "home_warranty_company" "text",
    "home_warranty_expires" "date",
    "address_override" "text",
    CONSTRAINT "units_bedrooms_check" CHECK ((("bedrooms" IS NULL) OR ("bedrooms" >= 0))),
    CONSTRAINT "units_ownership_pct_check" CHECK ((("ownership_pct" >= (0)::numeric) AND ("ownership_pct" <= (100)::numeric))),
    CONSTRAINT "units_sqft_check" CHECK ((("sqft" IS NULL) OR ("sqft" > 0)))
);


ALTER TABLE "public"."units" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."aged_receivables" WITH ("security_invoker"='true') AS
 SELECT "c"."unit_id",
    "u"."unit_number",
    "b"."name" AS "building_name",
    "a"."name" AS "association_name",
    "a"."id" AS "association_id",
    "c"."id" AS "charge_id",
    "c"."description",
    "c"."amount",
    "c"."due_date",
    COALESCE(( SELECT "sum"("payment_applications"."amount_applied") AS "sum"
           FROM "public"."payment_applications"
          WHERE ("payment_applications"."charge_id" = "c"."id")), (0)::numeric) AS "total_paid",
    ("c"."amount" - COALESCE(( SELECT "sum"("payment_applications"."amount_applied") AS "sum"
           FROM "public"."payment_applications"
          WHERE ("payment_applications"."charge_id" = "c"."id")), (0)::numeric)) AS "balance_due",
        CASE
            WHEN ("c"."due_date" >= CURRENT_DATE) THEN 'current'::"text"
            WHEN ("c"."due_date" >= (CURRENT_DATE - '30 days'::interval)) THEN '1_30'::"text"
            WHEN ("c"."due_date" >= (CURRENT_DATE - '60 days'::interval)) THEN '31_60'::"text"
            WHEN ("c"."due_date" >= (CURRENT_DATE - '90 days'::interval)) THEN '61_90'::"text"
            ELSE '90_plus'::"text"
        END AS "aging_bucket"
   FROM ((("public"."charges" "c"
     JOIN "public"."units" "u" ON (("u"."id" = "c"."unit_id")))
     JOIN "public"."buildings" "b" ON (("b"."id" = "u"."building_id")))
     JOIN "public"."associations" "a" ON (("a"."id" = "b"."association_id")))
  WHERE (("c"."amount" - COALESCE(( SELECT "sum"("payment_applications"."amount_applied") AS "sum"
           FROM "public"."payment_applications"
          WHERE ("payment_applications"."charge_id" = "c"."id")), (0)::numeric)) > (0)::numeric);


ALTER VIEW "public"."aged_receivables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agenda_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "duration_minutes" integer,
    "presenter" "text",
    "category" "text" DEFAULT 'general'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "agenda_items_category_check" CHECK (("category" = ANY (ARRAY['general'::"text", 'financial'::"text", 'operations'::"text", 'governance'::"text", 'compliance'::"text", 'old_business'::"text", 'new_business'::"text", 'executive_session'::"text"])))
);


ALTER TABLE "public"."agenda_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "summary" "text",
    "files" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."agents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."amenity_reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "amenity_id" "uuid" NOT NULL,
    "association_id" "uuid" NOT NULL,
    "portfolio_id" "uuid",
    "unit_id" "uuid",
    "owner_id" "uuid",
    "reserved_by" "uuid",
    "reserved_for_name" "text",
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "party_size" integer,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "amenity_reservations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'denied'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."amenity_reservations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."amenity_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text",
    "icon" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."amenity_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "prefix" "text" NOT NULL,
    "key_hash" "text" NOT NULL,
    "scopes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "description" "text",
    "created_by" "uuid",
    "last_used_at" timestamp with time zone,
    "last_used_ip" "text",
    "use_count" bigint DEFAULT 0 NOT NULL,
    "expires_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "revoked_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "api_keys_name_check" CHECK ((("length"("name") >= 1) AND ("length"("name") <= 200)))
);


ALTER TABLE "public"."api_keys" OWNER TO "postgres";


COMMENT ON TABLE "public"."api_keys" IS 'Portfolio-scoped API keys. Stored as SHA-256 hash; the raw key is shown only once at creation and never again.';



COMMENT ON COLUMN "public"."api_keys"."prefix" IS 'First chars of the key (e.g. cak_abc1...) — safe to show in UIs for identification.';



COMMENT ON COLUMN "public"."api_keys"."scopes" IS 'Array of permission strings (e.g. read:work_orders, write:charges). Empty = full portfolio access.';



CREATE TABLE IF NOT EXISTS "public"."approval_decisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "approval_request_id" "uuid" NOT NULL,
    "board_member_id" "uuid",
    "decided_by" "uuid",
    "decision" "text" NOT NULL,
    "signature_name" "text",
    "comment" "text",
    "decided_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "approval_decisions_decision_check" CHECK (("decision" = ANY (ARRAY['approve'::"text", 'reject'::"text", 'abstain'::"text"])))
);


ALTER TABLE "public"."approval_decisions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."approval_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "association_id" "uuid" NOT NULL,
    "vendor_id" "uuid",
    "unit_id" "uuid",
    "owner_id" "uuid",
    "request_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "requested_by_name" "text",
    "requested_by_email" "text",
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "decision_by" "uuid",
    "decision_at" timestamp with time zone,
    "status" "public"."approval_request_status" DEFAULT 'pending'::"public"."approval_request_status" NOT NULL,
    "notes" "text",
    "attachments" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "required_votes" integer DEFAULT 1 NOT NULL,
    "votes_for" integer DEFAULT 0 NOT NULL,
    "votes_against" integer DEFAULT 0 NOT NULL,
    "votes_abstain" integer DEFAULT 0 NOT NULL,
    "amount" numeric(12,2),
    "due_date" "date",
    "voting_scheme" "public"."voting_scheme" DEFAULT 'majority_approval_required'::"public"."voting_scheme" NOT NULL,
    "signatures_required" boolean DEFAULT false NOT NULL,
    "board_member_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "percentage_required" smallint,
    CONSTRAINT "approval_requests_required_votes_check" CHECK (("required_votes" >= 1))
);


ALTER TABLE "public"."approval_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."approval_requests" IS 'HOA-side approval workflow (architectural review, pet requests, etc.) — distinct from payable_bill approvals.';



CREATE TABLE IF NOT EXISTS "public"."approval_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "approval_request_id" "uuid" NOT NULL,
    "board_member_id" "uuid",
    "voter_user_id" "uuid",
    "choice" "public"."approval_vote_choice" NOT NULL,
    "comment" "text",
    "cast_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."approval_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."architectural_request_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "author_id" "uuid",
    "author_name" "text",
    "author_role" "text" DEFAULT 'staff'::"text" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "architectural_request_messages_author_role_check" CHECK (("author_role" = ANY (ARRAY['owner'::"text", 'staff'::"text", 'board'::"text"])))
);


ALTER TABLE "public"."architectural_request_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."architectural_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "association_id" "uuid" NOT NULL,
    "portfolio_id" "uuid",
    "unit_id" "uuid",
    "owner_id" "uuid",
    "submitted_by" "uuid",
    "committee_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "category" "text" DEFAULT 'other'::"text" NOT NULL,
    "status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "decision_notes" "text",
    "decided_by" "uuid",
    "decided_at" timestamp with time zone,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "architectural_requests_category_check" CHECK (("category" = ANY (ARRAY['exterior_paint'::"text", 'fence'::"text", 'landscaping'::"text", 'roof'::"text", 'addition'::"text", 'deck_patio'::"text", 'windows_doors'::"text", 'solar'::"text", 'pool'::"text", 'other'::"text"]))),
    CONSTRAINT "architectural_requests_status_check" CHECK (("status" = ANY (ARRAY['submitted'::"text", 'under_review'::"text", 'more_info'::"text", 'approved'::"text", 'denied'::"text", 'withdrawn'::"text"])))
);


ALTER TABLE "public"."architectural_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."architectural_review_settings" (
    "association_id" "uuid" NOT NULL,
    "online_requests_disabled" boolean DEFAULT false NOT NULL,
    "default_committee_id" "uuid",
    "default_approver_scope" "text" DEFAULT 'all'::"text" NOT NULL,
    "default_approver_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "default_voting_scheme" "public"."voting_scheme" DEFAULT 'majority_approval_required'::"public"."voting_scheme" NOT NULL,
    "default_percentage_required" smallint,
    "portal_homepage_html" "text",
    "submission_form_html" "text",
    "document_upload_html" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "architectural_review_settings_default_approver_scope_check" CHECK (("default_approver_scope" = ANY (ARRAY['all'::"text", 'select'::"text"])))
);


ALTER TABLE "public"."architectural_review_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assessment_periods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "association_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "base_amount" numeric(10,2) NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "assessment_periods_base_amount_check" CHECK (("base_amount" >= (0)::numeric)),
    CONSTRAINT "assessment_periods_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'posted'::"text", 'closed'::"text"]))),
    CONSTRAINT "period_dates_valid" CHECK (("period_end" >= "period_start"))
);


ALTER TABLE "public"."assessment_periods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."association_additional_fees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "association_id" "uuid" NOT NULL,
    "gl_account_id" "uuid",
    "label" "text",
    "percentage" numeric,
    "amount" numeric,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."association_additional_fees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."association_amenities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "association_id" "uuid" NOT NULL,
    "amenity_tag_id" "uuid",
    "name" "text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "image_url" "text",
    "description_html" "text",
    "opens_at" time without time zone,
    "closes_at" time without time zone,
    "allow_reservations" boolean DEFAULT false NOT NULL,
    "pricing_mode" "public"."amenity_pricing_mode",
    "price_amount" numeric(10,2),
    "reserve_method" "public"."amenity_reserve_method",
    "reservation_email" "text",
    "reservation_url" "text",
    "archived_at" timestamp with time zone
);


ALTER TABLE "public"."association_amenities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."association_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "association_id" "uuid" NOT NULL,
    "manager_id" "uuid",
    "portfolio_id" "uuid",
    "role" "text" DEFAULT 'primary'::"text",
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "assigned_by" "uuid"
);


ALTER TABLE "public"."association_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."association_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "association_id" "uuid" NOT NULL,
    "folder" "text",
    "file_name" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "byte_size" bigint,
    "content_type" "text",
    "uploaded_by" "uuid",
    "shared_with_owner" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_at" timestamp with time zone
);


ALTER TABLE "public"."association_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."association_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "association_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "key_number" "text",
    "held_by" "text",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_at" timestamp with time zone
);


ALTER TABLE "public"."association_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."association_lease_template_settings" (
    "association_id" "uuid" NOT NULL,
    "slot" "public"."lease_template_slot" NOT NULL,
    "primary_template_id" "uuid",
    "addenda_template_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "attachment_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."association_lease_template_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."association_loans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "association_id" "uuid" NOT NULL,
    "lender" "text" NOT NULL,
    "loan_type" "text" DEFAULT 'mortgage'::"text" NOT NULL,
    "original_principal" numeric,
    "current_balance" numeric,
    "interest_rate" numeric,
    "term_months" integer,
    "start_date" "date",
    "maturity_date" "date",
    "payment_amount" numeric,
    "payment_frequency" "text" DEFAULT 'monthly'::"text" NOT NULL,
    "next_payment_date" "date",
    "gl_account_id" "uuid",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "notes" "text",
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "association_loans_loan_type_check" CHECK (("loan_type" = ANY (ARRAY['mortgage'::"text", 'line_of_credit'::"text", 'note'::"text", 'other'::"text"]))),
    CONSTRAINT "association_loans_payment_frequency_check" CHECK (("payment_frequency" = ANY (ARRAY['monthly'::"text", 'quarterly'::"text", 'annual'::"text"]))),
    CONSTRAINT "association_loans_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paid_off'::"text", 'refinanced'::"text"])))
);


ALTER TABLE "public"."association_loans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."association_managers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "association_id" "uuid" NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "assigned_by" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone
);


ALTER TABLE "public"."association_managers" OWNER TO "postgres";


COMMENT ON TABLE "public"."association_managers" IS 'Manager-to-association assignments. A manager can access only the associations they have an active row for. Company admins do NOT need rows here.';



CREATE TABLE IF NOT EXISTS "public"."association_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "association_id" "uuid" NOT NULL,
    "is_standard" boolean DEFAULT false NOT NULL,
    "body" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_at" timestamp with time zone
);


ALTER TABLE "public"."association_notes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."association_ownership_totals" WITH ("security_invoker"='true') AS
 SELECT "a"."id" AS "association_id",
    (COALESCE("sum"("u"."ownership_pct"), (0)::numeric))::numeric(8,3) AS "total_pct",
    ("count"("u"."id"))::integer AS "unit_count"
   FROM (("public"."associations" "a"
     LEFT JOIN "public"."buildings" "b" ON ((("b"."association_id" = "a"."id") AND ("b"."archived_at" IS NULL))))
     LEFT JOIN "public"."units" "u" ON ((("u"."building_id" = "b"."id") AND ("u"."archived_at" IS NULL))))
  WHERE ("a"."archived_at" IS NULL)
  GROUP BY "a"."id";


ALTER VIEW "public"."association_ownership_totals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."association_renewal_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "association_id" "uuid" NOT NULL,
    "term_months" smallint NOT NULL,
    "change_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "additional_fee" numeric(10,2) DEFAULT 0 NOT NULL,
    "sort_order" smallint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "association_renewal_options_term_months_check" CHECK (("term_months" > 0))
);


ALTER TABLE "public"."association_renewal_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "action" "text" NOT NULL,
    "actor_id" "uuid",
    "actor_email" "text",
    "changes" "jsonb" DEFAULT '{}'::"jsonb",
    "ip_address" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automation_flow_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "flow_id" "uuid" NOT NULL,
    "subject_type" "text" NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "fired_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'success'::"text" NOT NULL,
    "detail" "jsonb",
    CONSTRAINT "automation_flow_runs_status_check" CHECK (("status" = ANY (ARRAY['success'::"text", 'partial'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."automation_flow_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automation_flows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "association_id" "uuid",
    "name" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "trigger_type" "text" NOT NULL,
    "trigger_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "actions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_run_at" timestamp with time zone,
    "run_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "automation_flows_trigger_type_check" CHECK (("trigger_type" = ANY (ARRAY['charge_overdue'::"text", 'work_order_stale'::"text", 'violation_stale'::"text", 'insurance_expiring'::"text", 'arc_pending'::"text"])))
);


ALTER TABLE "public"."automation_flows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automation_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid",
    "association_id" "uuid",
    "calendar_event_id" "uuid",
    "violation_id" "uuid",
    "task_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "assigned_to" "uuid",
    "due_at" timestamp with time zone,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "completed_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."automation_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ballots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "association_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "ballot_type" "text" DEFAULT 'yes_no'::"text" NOT NULL,
    "options" "jsonb" DEFAULT '["Yes", "No"]'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "opens_at" timestamp with time zone,
    "closes_at" timestamp with time zone,
    "require_quorum" boolean DEFAULT true NOT NULL,
    "quorum_pct" integer DEFAULT 50,
    "results" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_at" timestamp with time zone,
    CONSTRAINT "ballots_ballot_type_check" CHECK (("ballot_type" = ANY (ARRAY['yes_no'::"text", 'multiple_choice'::"text", 'ranked'::"text"]))),
    CONSTRAINT "ballots_quorum_pct_check" CHECK ((("quorum_pct" >= 1) AND ("quorum_pct" <= 100))),
    CONSTRAINT "ballots_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'open'::"text", 'closed'::"text", 'canceled'::"text"]))),
    CONSTRAINT "ballots_title_check" CHECK ((("length"("title") >= 1) AND ("length"("title") <= 200)))
);


ALTER TABLE "public"."ballots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bank_account_owners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bank_account_id" "uuid" NOT NULL,
    "owner_id" "uuid",
    "full_name" "text" NOT NULL,
    "role" "text" DEFAULT 'authorized'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bank_account_owners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bank_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "association_id" "uuid",
    "name" "text" NOT NULL,
    "bank_name" "text",
    "description" "text",
    "routing_number" "text",
    "account_number" "text",
    "account_type" "public"."bank_account_type" DEFAULT 'checking'::"public"."bank_account_type" NOT NULL,
    "gl_account_id" "uuid",
    "use_printable_deposit_slip" boolean DEFAULT false NOT NULL,
    "address_street" "text",
    "address_city" "text",
    "address_state" "text",
    "address_zip" "text",
    "payments_enabled" boolean DEFAULT false NOT NULL,
    "auto_reconciliation" boolean DEFAULT false NOT NULL,
    "last_reconciliation_date" "date",
    "next_check_number" integer,
    "company_name" "text",
    "company_address" "text",
    "check_signature" "text",
    "entity_name" "text",
    "entity_address" "text",
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "purpose" "public"."bank_account_purpose" DEFAULT 'other'::"public"."bank_account_purpose" NOT NULL,
    "fund_type" "text" DEFAULT 'operating'::"text" NOT NULL,
    CONSTRAINT "bank_accounts_fund_type_check" CHECK (("fund_type" = ANY (ARRAY['operating'::"text", 'reserve'::"text", 'insurance_proceeds'::"text", 'special_assessment'::"text", 'construction_escrow'::"text", 'petty_cash'::"text"]))),
    CONSTRAINT "bank_accounts_name_check" CHECK ((("length"("name") >= 1) AND ("length"("name") <= 200)))
);


ALTER TABLE "public"."bank_accounts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."bank_accounts"."account_number" IS 'Sensitive — consider Vault encryption for production.';



CREATE TABLE IF NOT EXISTS "public"."bank_adjustments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bank_account_id" "uuid",
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "adjustment_date" "date",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bank_adjustments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bank_reconciliation_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reconciliation_id" "uuid" NOT NULL,
    "journal_line_id" "uuid",
    "description" "text",
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "type" "text" DEFAULT 'book'::"text" NOT NULL,
    "is_cleared" boolean DEFAULT false NOT NULL,
    "cleared_at" timestamp with time zone,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bank_reconciliation_items_type_check" CHECK (("type" = ANY (ARRAY['book'::"text", 'bank_only'::"text"])))
);


ALTER TABLE "public"."bank_reconciliation_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bank_reconciliations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "bank_account_id" "uuid" NOT NULL,
    "statement_date" "date" NOT NULL,
    "statement_balance" numeric(12,2) DEFAULT 0 NOT NULL,
    "ending_book_balance" numeric(12,2) DEFAULT 0 NOT NULL,
    "reconciled_balance" numeric(12,2),
    "difference" numeric(12,2) DEFAULT 0,
    "status" "text" DEFAULT 'in_progress'::"text" NOT NULL,
    "notes" "text",
    "completed_at" timestamp with time zone,
    "completed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bank_reconciliations_status_check" CHECK (("status" = ANY (ARRAY['in_progress'::"text", 'completed'::"text", 'void'::"text"])))
);


ALTER TABLE "public"."bank_reconciliations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bank_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "bank_account_id" "uuid",
    "plaid_item_id" "uuid",
    "plaid_transaction_id" "text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "date" "date" NOT NULL,
    "name" "text" NOT NULL,
    "merchant_name" "text",
    "category" "text",
    "category_detail" "text",
    "pending" boolean DEFAULT false NOT NULL,
    "iso_currency_code" "text" DEFAULT 'USD'::"text",
    "gl_account_id" "uuid",
    "matched_at" timestamp with time zone,
    "match_confidence" numeric(3,2),
    "match_method" "text",
    "reviewed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bank_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bank_transfers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "from_bank_account_id" "uuid" NOT NULL,
    "to_bank_account_id" "uuid" NOT NULL,
    "amount" numeric(14,2) NOT NULL,
    "transfer_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "reference_number" "text",
    "memo" "text",
    "journal_entry_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "authorized_by" "uuid",
    "authorization_note" "text",
    CONSTRAINT "bank_transfers_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "bank_transfers_check" CHECK (("from_bank_account_id" <> "to_bank_account_id"))
);


ALTER TABLE "public"."bank_transfers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "subscription_id" "uuid",
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "doors_active" integer DEFAULT 0,
    "doors_limit" integer,
    "doors_overage" integer,
    "price_per_door_cents" integer,
    "total_charge_cents" integer,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."billing_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."board_approval_settings" (
    "association_id" "uuid" NOT NULL,
    "signatures_required" boolean DEFAULT true NOT NULL,
    "default_board_member_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "default_voting_scheme" "public"."voting_scheme" DEFAULT 'majority_approval_required'::"public"."voting_scheme" NOT NULL,
    "default_percentage_required" smallint,
    "sends_bills_to_board" "text" DEFAULT 'never'::"text" NOT NULL,
    "bills_threshold" numeric(12,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "board_approval_settings_sends_bills_to_board_check" CHECK (("sends_bills_to_board" = ANY (ARRAY['never'::"text", 'always'::"text", 'over_threshold'::"text"])))
);


ALTER TABLE "public"."board_approval_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."board_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "violation_id" "uuid",
    "association_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "author_name" "text",
    "comment" "text" NOT NULL,
    "visibility" "text" DEFAULT 'board_and_staff'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "board_comments_visibility_check" CHECK (("visibility" = ANY (ARRAY['board_only'::"text", 'board_and_staff'::"text", 'board_staff_admin'::"text"])))
);


ALTER TABLE "public"."board_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."board_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "association_id" "uuid" NOT NULL,
    "owner_id" "uuid",
    "full_name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "role" "public"."board_role" DEFAULT 'director'::"public"."board_role" NOT NULL,
    "term_start" "date",
    "term_end" "date",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "auth_user_id" "uuid",
    "signature_on_file" boolean DEFAULT false NOT NULL,
    "signature_url" "text"
);


ALTER TABLE "public"."board_members" OWNER TO "postgres";


COMMENT ON COLUMN "public"."board_members"."auth_user_id" IS 'Strong link. A single user can be linked to multiple board_members rows (one per association they serve on).';



CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "lead_id" "uuid",
    "cal_event_id" "text",
    "cal_event_uid" "text",
    "service_id" "uuid",
    "provider_id" "uuid",
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attendee_name" "text" NOT NULL,
    "attendee_email" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'cancelled'::"text", 'completed'::"text", 'no_show'::"text"]))),
    CONSTRAINT "valid_booking_time" CHECK (("start_time" < "end_time"))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."budget_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "association_id" "uuid" NOT NULL,
    "gl_account_id" "uuid" NOT NULL,
    "fiscal_year" integer NOT NULL,
    "monthly_amounts" numeric(14,2)[] DEFAULT "array_fill"((0)::numeric, ARRAY[12]) NOT NULL,
    "category" "public"."budget_category" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "annual_total" numeric GENERATED ALWAYS AS (((((((((((("monthly_amounts"[1] + "monthly_amounts"[2]) + "monthly_amounts"[3]) + "monthly_amounts"[4]) + "monthly_amounts"[5]) + "monthly_amounts"[6]) + "monthly_amounts"[7]) + "monthly_amounts"[8]) + "monthly_amounts"[9]) + "monthly_amounts"[10]) + "monthly_amounts"[11]) + "monthly_amounts"[12])) STORED,
    CONSTRAINT "budget_lines_fiscal_year_check" CHECK ((("fiscal_year" >= 2000) AND ("fiscal_year" <= 2100))),
    CONSTRAINT "budget_lines_monthly_amounts_check" CHECK (("array_length"("monthly_amounts", 1) = 12))
);


ALTER TABLE "public"."budget_lines" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."budget_line_totals" WITH ("security_invoker"='true') AS
 SELECT "id",
    "association_id",
    "gl_account_id",
    "fiscal_year",
    "monthly_amounts",
    "category",
    "notes",
    "created_at",
    "updated_at",
    ((((((((((((COALESCE("monthly_amounts"[1], (0)::numeric) + COALESCE("monthly_amounts"[2], (0)::numeric)) + COALESCE("monthly_amounts"[3], (0)::numeric)) + COALESCE("monthly_amounts"[4], (0)::numeric)) + COALESCE("monthly_amounts"[5], (0)::numeric)) + COALESCE("monthly_amounts"[6], (0)::numeric)) + COALESCE("monthly_amounts"[7], (0)::numeric)) + COALESCE("monthly_amounts"[8], (0)::numeric)) + COALESCE("monthly_amounts"[9], (0)::numeric)) + COALESCE("monthly_amounts"[10], (0)::numeric)) + COALESCE("monthly_amounts"[11], (0)::numeric)) + COALESCE("monthly_amounts"[12], (0)::numeric)))::numeric(14,2) AS "annual_total"
   FROM "public"."budget_lines" "bl";


ALTER VIEW "public"."budget_line_totals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calendar_event_reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid",
    "association_id" "uuid",
    "calendar_event_id" "uuid",
    "offset_minutes" integer NOT NULL,
    "remind_at" timestamp with time zone NOT NULL,
    "recipient_group" "text" NOT NULL,
    "action" "text" NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "communication_message_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."calendar_event_reminders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calendar_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "association_id" "uuid",
    "title" "text" NOT NULL,
    "event_type" "public"."event_type" DEFAULT 'other'::"public"."event_type" NOT NULL,
    "start_datetime" timestamp with time zone NOT NULL,
    "end_datetime" timestamp with time zone,
    "all_day" boolean DEFAULT false NOT NULL,
    "recurrence_rule" "text",
    "location" "text",
    "description" "text",
    "attendees" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "notify_maintenance" boolean DEFAULT false NOT NULL,
    "maintenance_instructions" "text",
    "maintenance_notified_at" timestamp with time zone,
    "maintenance_notify_error" "text",
    "notify_sms" boolean DEFAULT false NOT NULL,
    "sms_notified_at" timestamp with time zone,
    "sms_notify_error" "text",
    "calendar_scope" "public"."calendar_scope" DEFAULT 'daily'::"public"."calendar_scope" NOT NULL,
    "reminder_days_before" smallint,
    "reminder_triggered_at" timestamp with time zone,
    "reminder_acknowledged_at" timestamp with time zone,
    "reminder_acknowledged_by" "uuid",
    "building_id" "uuid",
    "unit_id" "uuid",
    "vendor_id" "uuid",
    "owner_id" "uuid",
    "resident_id" "uuid",
    "internal_notes" "text",
    "public_notice_text" "text",
    "notification_recipients" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "reminder_rules" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "operations_status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "maintenance_task_id" "uuid",
    CONSTRAINT "calendar_events_check" CHECK ((("end_datetime" IS NULL) OR ("end_datetime" >= "start_datetime"))),
    CONSTRAINT "calendar_events_reminder_days_before_check" CHECK ((("reminder_days_before" IS NULL) OR (("reminder_days_before" >= 1) AND ("reminder_days_before" <= 30)))),
    CONSTRAINT "calendar_events_title_check" CHECK ((("length"("title") >= 1) AND ("length"("title") <= 200)))
);


ALTER TABLE "public"."calendar_events" OWNER TO "postgres";


COMMENT ON COLUMN "public"."calendar_events"."recurrence_rule" IS 'iCal RRULE string (RFC 5545) for recurring events.';



COMMENT ON COLUMN "public"."calendar_events"."maintenance_task_id" IS 'Links a calendar event back to its originating maintenance task';



CREATE TABLE IF NOT EXISTS "public"."charge_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "association_id" "uuid",
    "name" "text" NOT NULL,
    "code" "text",
    "description" "text",
    "default_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "default_frequency" "public"."recurring_frequency" DEFAULT 'monthly'::"public"."recurring_frequency" NOT NULL,
    "gl_account_id" "uuid",
    "charge_type" "public"."charge_type" DEFAULT 'other'::"public"."charge_type" NOT NULL,
    "is_income" boolean DEFAULT true NOT NULL,
    "is_assessment" boolean DEFAULT false NOT NULL,
    "is_fee" boolean DEFAULT false NOT NULL,
    "is_system" boolean DEFAULT false NOT NULL,
    "icon" "text",
    "color" "text",
    "applies_by_default" boolean DEFAULT false NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "charge_categories_default_amount_check" CHECK (("default_amount" >= (0)::numeric)),
    CONSTRAINT "charge_categories_name_check" CHECK ((("length"("name") >= 1) AND ("length"("name") <= 150)))
);


ALTER TABLE "public"."charge_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."committee_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "committee_id" "uuid" NOT NULL,
    "owner_id" "uuid",
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "joined_at" "date" DEFAULT CURRENT_DATE NOT NULL,
    "left_at" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."committee_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."committees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "association_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."committees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."communication_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid",
    "association_id" "uuid",
    "calendar_event_id" "uuid",
    "violation_id" "uuid",
    "channel" "public"."communication_channel" DEFAULT 'email'::"public"."communication_channel" NOT NULL,
    "status" "public"."communication_status" DEFAULT 'draft'::"public"."communication_status" NOT NULL,
    "recipient_group" "text" DEFAULT 'management_office'::"text" NOT NULL,
    "recipient_name" "text",
    "recipient_email" "text",
    "recipient_phone" "text",
    "subject" "text",
    "body" "text" NOT NULL,
    "provider_message_id" "text",
    "error_message" "text",
    "queued_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."communication_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."communication_triggers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "association_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "trigger_event" "text" NOT NULL,
    "delay_days" integer DEFAULT 0 NOT NULL,
    "template_id" "uuid",
    "channel" "public"."communication_channel" DEFAULT 'email'::"public"."communication_channel" NOT NULL,
    "recipient_rule" "text",
    "active" boolean DEFAULT true NOT NULL,
    "last_fired_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "communication_triggers_delay_days_check" CHECK (("delay_days" >= 0)),
    CONSTRAINT "communication_triggers_name_check" CHECK ((("length"("name") >= 1) AND ("length"("name") <= 200)))
);


ALTER TABLE "public"."communication_triggers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."communication_triggers"."trigger_event" IS 'String-typed event name (e.g., payment_due, payment_late, work_order_completed). Application code fires triggers by matching this value.';



COMMENT ON COLUMN "public"."communication_triggers"."recipient_rule" IS 'SQL expression or name referencing application logic that resolves who receives the communication.';



CREATE TABLE IF NOT EXISTS "public"."communications_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "association_id" "uuid",
    "sender_id" "uuid",
    "direction" "text" DEFAULT 'outbound'::"text" NOT NULL,
    "channel" "text" DEFAULT 'email'::"text" NOT NULL,
    "recipient_count" integer DEFAULT 1,
    "status" "text" DEFAULT 'sent'::"text",
    "subject" "text",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "communications_log_channel_check" CHECK (("channel" = ANY (ARRAY['email'::"text", 'sms'::"text", 'announcement'::"text", 'board_message'::"text"]))),
    CONSTRAINT "communications_log_direction_check" CHECK (("direction" = ANY (ARRAY['outbound'::"text", 'inbound'::"text"]))),
    CONSTRAINT "communications_log_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'failed'::"text", 'delivered'::"text"])))
);


ALTER TABLE "public"."communications_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" integer NOT NULL,
    "name" character varying(255) NOT NULL,
    "slug" character varying(100) NOT NULL,
    "email" character varying(320),
    "phone" character varying(30),
    "address" "text",
    "logoUrl" "text",
    "brandColor" character varying(7) DEFAULT '#2D4A3E'::character varying,
    "tier" "public"."tier" DEFAULT 'starter'::"public"."tier" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."companies_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."companies_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."companies_id_seq" OWNED BY "public"."companies"."id";



CREATE TABLE IF NOT EXISTS "public"."company_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "logo_url" "text",
    "office_address" "text",
    "office_city" "text",
    "office_state" "text",
    "office_zip" "text",
    "phone" "text",
    "billing_email" "text",
    "notification_defaults" "jsonb" DEFAULT '{}'::"jsonb",
    "manager_permission_defaults" "jsonb" DEFAULT '{}'::"jsonb",
    "owner_invite_defaults" "jsonb" DEFAULT '{}'::"jsonb",
    "vendor_invite_defaults" "jsonb" DEFAULT '{}'::"jsonb",
    "branding" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."company_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."data_diagnostics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "entity_type" "text",
    "entity_id" "uuid",
    "severity" "public"."diagnostic_severity" DEFAULT 'warning'::"public"."diagnostic_severity" NOT NULL,
    "title" "text" NOT NULL,
    "details" "text",
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "occurrence_count" integer DEFAULT 1 NOT NULL
);


ALTER TABLE "public"."data_diagnostics" OWNER TO "postgres";


COMMENT ON TABLE "public"."data_diagnostics" IS 'AppFolio-style Data Diagnostics: tracks invalid phone numbers, missing emails, duplicate vendors, etc.';



CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "charge_id" "uuid",
    "amount" numeric(10,2) NOT NULL,
    "payment_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "method" "text" DEFAULT 'manual'::"text" NOT NULL,
    "reference" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "gl_account_id" "uuid",
    "bank_account_id" "uuid",
    CONSTRAINT "payments_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "payments_method_check" CHECK (("method" = ANY (ARRAY['manual'::"text", 'check'::"text", 'ach'::"text", 'card'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."unit_balances" WITH ("security_invoker"='true') AS
 SELECT "u"."id" AS "unit_id",
    "u"."unit_number",
    "u"."building_id",
    "b"."association_id",
    COALESCE("c"."total_charges", (0)::numeric) AS "total_charges",
    COALESCE("p"."total_payments", (0)::numeric) AS "total_payments",
    (COALESCE("c"."total_charges", (0)::numeric) - COALESCE("p"."total_payments", (0)::numeric)) AS "balance"
   FROM ((("public"."units" "u"
     JOIN "public"."buildings" "b" ON (("b"."id" = "u"."building_id")))
     LEFT JOIN ( SELECT "charges"."unit_id",
            "sum"("charges"."amount") AS "total_charges"
           FROM "public"."charges"
          GROUP BY "charges"."unit_id") "c" ON (("c"."unit_id" = "u"."id")))
     LEFT JOIN ( SELECT "payments"."unit_id",
            "sum"("payments"."amount") AS "total_payments"
           FROM "public"."payments"
          GROUP BY "payments"."unit_id") "p" ON (("p"."unit_id" = "u"."id")))
  WHERE ("u"."archived_at" IS NULL);


ALTER VIEW "public"."unit_balances" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."delinquent_units" WITH ("security_invoker"='true') AS
 SELECT "ub"."unit_id",
    "ub"."unit_number",
    "ub"."building_id",
    "ub"."association_id",
    "ub"."balance",
    "oldest"."oldest_due"
   FROM ("public"."unit_balances" "ub"
     JOIN LATERAL ( SELECT "min"("ch"."due_date") AS "oldest_due"
           FROM "public"."charges" "ch"
          WHERE (("ch"."unit_id" = "ub"."unit_id") AND ("ch"."due_date" < CURRENT_DATE))) "oldest" ON (true))
  WHERE (("ub"."balance" > (0)::numeric) AND ("oldest"."oldest_due" IS NOT NULL));


ALTER VIEW "public"."delinquent_units" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."depreciation_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fixed_asset_id" "uuid" NOT NULL,
    "period_year" integer NOT NULL,
    "period_month" integer NOT NULL,
    "amount" numeric(14,2) NOT NULL,
    "journal_entry_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "depreciation_entries_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "depreciation_entries_period_month_check" CHECK ((("period_month" >= 1) AND ("period_month" <= 12))),
    CONSTRAINT "depreciation_entries_period_year_check" CHECK ((("period_year" >= 2000) AND ("period_year" <= 2100)))
);


ALTER TABLE "public"."depreciation_entries" OWNER TO "postgres";


COMMENT ON TABLE "public"."depreciation_entries" IS 'Period-level depreciation posting. One row per asset per month; optionally ties to the journal entry that booked it.';



CREATE TABLE IF NOT EXISTS "public"."diagnostic_flags" (
    "id" integer NOT NULL,
    "propertyId" integer NOT NULL,
    "flagType" character varying(128) NOT NULL,
    "description" "text",
    "severity" "public"."severity" DEFAULT 'medium'::"public"."severity" NOT NULL,
    "detectedAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "resolvedAt" timestamp without time zone,
    "manusResolutionDraft" "text"
);


ALTER TABLE "public"."diagnostic_flags" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."diagnostic_flags_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."diagnostic_flags_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."diagnostic_flags_id_seq" OWNED BY "public"."diagnostic_flags"."id";



CREATE TABLE IF NOT EXISTS "public"."document_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "vendor_id" "uuid",
    "owner_id" "uuid",
    "doc_type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "status" "public"."document_request_status" DEFAULT 'requested'::"public"."document_request_status" NOT NULL,
    "requested_by" "uuid",
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "due_date" "date",
    "submitted_at" timestamp with time zone,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "attachment_urls" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "document_requests_check" CHECK ((("vendor_id" IS NOT NULL) OR ("owner_id" IS NOT NULL)))
);


ALTER TABLE "public"."document_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "letter_type" "text",
    "template_category" "public"."template_category" DEFAULT 'generic'::"public"."template_category" NOT NULL,
    "subject" "text",
    "body" "text" NOT NULL,
    "merge_variables" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "document_templates_name_check" CHECK ((("length"("name") >= 1) AND ("length"("name") <= 200)))
);


ALTER TABLE "public"."document_templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."document_templates" IS 'Reusable letter/email templates with merge fields. See merge_variables for field metadata.';



COMMENT ON COLUMN "public"."document_templates"."merge_variables" IS 'Array of {name, label, default} describing supported merge tags in body.';



CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "doc_type" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "expires_at" timestamp with time zone,
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "uploaded_by" "uuid",
    CONSTRAINT "documents_doc_type_check" CHECK (("doc_type" = ANY (ARRAY['lease'::"text", 'ho6'::"text", 'renters_insurance'::"text", 'bylaws'::"text", 'minutes'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


COMMENT ON TABLE "public"."documents" IS 'Polymorphic via entity_type/entity_id. RLS is staff-any; application code must filter by portfolio when querying.';



CREATE TABLE IF NOT EXISTS "public"."dues_increase_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dues_increase_id" "uuid" NOT NULL,
    "occupancy_id" "uuid" NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "old_amount" numeric(12,2) NOT NULL,
    "new_amount" numeric(12,2) NOT NULL,
    "change_type" "text" DEFAULT 'flat'::"text" NOT NULL,
    "change_value" numeric(12,2),
    "letter_generated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "dues_increase_lines_change_type_check" CHECK (("change_type" = ANY (ARRAY['flat'::"text", 'percent'::"text", 'dollar_amount'::"text"]))),
    CONSTRAINT "dues_increase_lines_new_amount_check" CHECK (("new_amount" >= (0)::numeric))
);


ALTER TABLE "public"."dues_increase_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dues_increases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "association_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "status" "public"."dues_increase_status" DEFAULT 'draft'::"public"."dues_increase_status" NOT NULL,
    "effective_date" "date" NOT NULL,
    "letter_template_id" "uuid",
    "notes" "text",
    "posted_at" timestamp with time zone,
    "posted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."dues_increases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_connections" (
    "id" integer NOT NULL,
    "userId" integer NOT NULL,
    "companyId" integer NOT NULL,
    "provider" "public"."email_provider" NOT NULL,
    "accountEmail" character varying(320) NOT NULL,
    "accessToken" "text" NOT NULL,
    "refreshToken" "text",
    "expiresAt" timestamp without time zone,
    "lastSyncedAt" timestamp without time zone,
    "syncCursor" "text",
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."email_connections" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."email_connections_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."email_connections_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."email_connections_id_seq" OWNED BY "public"."email_connections"."id";



CREATE TABLE IF NOT EXISTS "public"."email_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "to_email" "text" NOT NULL,
    "to_name" "text",
    "subject" "text" NOT NULL,
    "body" "text" NOT NULL,
    "association_id" "uuid",
    "sent_by" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_at" timestamp with time zone,
    "template_id" "uuid",
    "notice_id" "uuid",
    "portfolio_id" "uuid",
    "from_address" "text",
    "from_name" "text",
    "reply_to" "text",
    CONSTRAINT "email_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."email_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_threads" (
    "id" integer NOT NULL,
    "companyId" integer NOT NULL,
    "propertyId" integer,
    "ticketId" integer,
    "subject" character varying(500),
    "fromAddress" character varying(320),
    "toAddresses" "text",
    "bodyPreview" "text",
    "fullBody" "text",
    "aiSummary" "text",
    "aiDraftReply" "text",
    "aiUrgency" "public"."ai_urgency",
    "aiCategory" "public"."ai_category",
    "aiMatchedPropertyId" integer,
    "aiConfidence" integer,
    "aiReasoning" "text",
    "aiCategorizedAt" timestamp without time zone,
    "convertedToTicketId" integer,
    "isRead" boolean DEFAULT false NOT NULL,
    "source" "public"."email_source" DEFAULT 'manual'::"public"."email_source" NOT NULL,
    "receivedAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."email_threads" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."email_threads_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."email_threads_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."email_threads_id_seq" OWNED BY "public"."email_threads"."id";



CREATE TABLE IF NOT EXISTS "public"."feature_entitlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "min_tier" "public"."portfolio_tier" DEFAULT 'foundation'::"public"."portfolio_tier" NOT NULL,
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "feature_entitlements_key_check" CHECK ((("length"("key") >= 1) AND ("length"("key") <= 100)))
);


ALTER TABLE "public"."feature_entitlements" OWNER TO "postgres";


COMMENT ON TABLE "public"."feature_entitlements" IS 'Catalog of features available per subscription tier. Used to gate functionality in the UI and API.';



CREATE TABLE IF NOT EXISTS "public"."fixed_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "association_id" "uuid",
    "unit_id" "uuid",
    "gl_account_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "asset_type" "text",
    "purchase_date" "date",
    "purchase_price" numeric(14,2),
    "salvage_value" numeric(14,2) DEFAULT 0 NOT NULL,
    "useful_life_years" integer,
    "depreciation_method" "public"."depreciation_method" DEFAULT 'straight_line'::"public"."depreciation_method" NOT NULL,
    "accumulated_depreciation" numeric(14,2) DEFAULT 0 NOT NULL,
    "status" "public"."asset_status" DEFAULT 'active'::"public"."asset_status" NOT NULL,
    "disposed_at" timestamp with time zone,
    "disposed_amount" numeric(14,2),
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "fixed_assets_accumulated_depreciation_check" CHECK (("accumulated_depreciation" >= (0)::numeric)),
    CONSTRAINT "fixed_assets_name_check" CHECK ((("length"("name") >= 1) AND ("length"("name") <= 200))),
    CONSTRAINT "fixed_assets_purchase_price_check" CHECK ((("purchase_price" IS NULL) OR ("purchase_price" >= (0)::numeric))),
    CONSTRAINT "fixed_assets_salvage_value_check" CHECK (("salvage_value" >= (0)::numeric)),
    CONSTRAINT "fixed_assets_useful_life_years_check" CHECK ((("useful_life_years" IS NULL) OR ("useful_life_years" > 0)))
);


ALTER TABLE "public"."fixed_assets" OWNER TO "postgres";


COMMENT ON TABLE "public"."fixed_assets" IS 'Depreciable assets per §3.18. accumulated_depreciation is maintained by the depreciation job (future automation).';



COMMENT ON COLUMN "public"."fixed_assets"."depreciation_method" IS 'Accounting method. Straight-line is the most common; others supported for GAAP compliance.';



CREATE TABLE IF NOT EXISTS "public"."form_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "form_type" "text",
    "file_url" "text",
    "field_definitions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "form_templates_name_check" CHECK ((("length"("name") >= 1) AND ("length"("name") <= 200)))
);


ALTER TABLE "public"."form_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gl_account_role_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gl_account_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "permission" "public"."gl_permission" DEFAULT 'read'::"public"."gl_permission" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."gl_account_role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gl_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "association_id" "uuid",
    "number" integer NOT NULL,
    "name" "text" NOT NULL,
    "account_type" "public"."gl_account_type" NOT NULL,
    "sub_account_of_id" "uuid",
    "include_on_cash_flow" boolean DEFAULT true NOT NULL,
    "fund_account" "public"."gl_fund_account",
    "subject_to_management_fees" boolean DEFAULT false NOT NULL,
    "description" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "gl_accounts_name_check" CHECK ((("length"("name") >= 1) AND ("length"("name") <= 200))),
    CONSTRAINT "gl_accounts_number_check" CHECK ((("number" >= 1000) AND ("number" <= 9999)))
);


ALTER TABLE "public"."gl_accounts" OWNER TO "postgres";


COMMENT ON TABLE "public"."gl_accounts" IS 'Chart of accounts per portfolio (optionally per-association). Hierarchical via sub_account_of_id.';



COMMENT ON COLUMN "public"."gl_accounts"."number" IS 'AppFolio-style 4-digit account number. 1xxx=assets, 2xxx=liabilities, 3xxx=equity, 4xxx=income, 5xxx=COGS, 6xxx=opex, 7xxx=other income, 8xxx=other expense, 9xxx=non-operating.';



CREATE TABLE IF NOT EXISTS "public"."house_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "association_id" "uuid" NOT NULL,
    "rule_number" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "category" "text" NOT NULL,
    "penalty_type" "text" DEFAULT 'warning'::"text",
    "fine_amount" numeric(12,2),
    "active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."house_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."income_recertifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "association_id" "uuid",
    "unit_id" "uuid" NOT NULL,
    "occupancy_id" "uuid",
    "owner_id" "uuid",
    "program" "text",
    "due_date" "date" NOT NULL,
    "status" "public"."recert_status" DEFAULT 'scheduled'::"public"."recert_status" NOT NULL,
    "previous_income" numeric(14,2),
    "current_income" numeric(14,2),
    "household_size" smallint,
    "documents" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "submitted_at" timestamp with time zone,
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."income_recertifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inspection_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "inspection_id" "uuid" NOT NULL,
    "area" "text",
    "issue" "text" NOT NULL,
    "severity" "public"."inspection_severity" DEFAULT 'minor'::"public"."inspection_severity" NOT NULL,
    "photo_urls" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "resolved" boolean DEFAULT false NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolution_notes" "text",
    "work_order_id" "uuid",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."inspection_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."inspection_items"."work_order_id" IS 'Link to a WO created to remediate this finding.';



CREATE TABLE IF NOT EXISTS "public"."inspections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "association_id" "uuid" NOT NULL,
    "unit_id" "uuid",
    "inspection_type" "text",
    "scheduled_date" "date",
    "completed_date" "date",
    "inspector_user_id" "uuid",
    "inspector_vendor_id" "uuid",
    "status" "public"."inspection_status" DEFAULT 'scheduled'::"public"."inspection_status" NOT NULL,
    "notes" "text",
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."inspections" OWNER TO "postgres";


COMMENT ON TABLE "public"."inspections" IS 'Scheduled/completed inspections. inspection_items are the findings.';



CREATE TABLE IF NOT EXISTS "public"."insurance_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "association_id" "uuid",
    "policy_number" "text" NOT NULL,
    "insurance_company" "text" NOT NULL,
    "coverage_amount" numeric(12,2),
    "liability_amount" numeric(12,2),
    "deductible_amount" numeric(12,2),
    "effective_date" "date" NOT NULL,
    "expiration_date" "date" NOT NULL,
    "certificate_file_url" "text",
    "extracted_fields" "jsonb",
    "extraction_status" "text" DEFAULT 'pending'::"text",
    "status" "text" DEFAULT 'active'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "archived_at" timestamp with time zone,
    "remind_owner" boolean DEFAULT true NOT NULL,
    "remind_manager" boolean DEFAULT true NOT NULL,
    "reminder_30_sent_at" timestamp with time zone,
    "reminder_15_sent_at" timestamp with time zone
);


ALTER TABLE "public"."insurance_policies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "sku" "text",
    "category" "text",
    "quantity_on_hand" numeric(10,2) DEFAULT 0,
    "reorder_point" numeric(10,2),
    "unit_of_measure" "text" DEFAULT 'ea'::"text",
    "location" "text",
    "unit_cost" numeric(12,2),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."inventory_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invitations" (
    "id" integer NOT NULL,
    "token" character varying(128) NOT NULL,
    "email" character varying(320) NOT NULL,
    "role" "public"."invitation_role" NOT NULL,
    "companyId" integer,
    "assignedPropertyIds" json,
    "invitedBy" integer NOT NULL,
    "status" "public"."invitation_status" DEFAULT 'pending'::"public"."invitation_status" NOT NULL,
    "expiresAt" timestamp without time zone NOT NULL,
    "acceptedAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."invitations" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."invitations_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."invitations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."invitations_id_seq" OWNED BY "public"."invitations"."id";



CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "subscription_id" "uuid",
    "number" "text",
    "period_start" "date",
    "period_end" "date",
    "subtotal_cents" integer,
    "tax_cents" integer,
    "total_cents" integer,
    "status" "text" DEFAULT 'draft'::"text",
    "paid_at" timestamp with time zone,
    "billing_usage_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sent_at" timestamp with time zone,
    CONSTRAINT "invoices_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'open'::"text", 'paid'::"text", 'void'::"text", 'overdue'::"text"])))
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


COMMENT ON COLUMN "public"."invoices"."sent_at" IS 'When the invoice email was last sent to the company billing contact.';



CREATE TABLE IF NOT EXISTS "public"."journal_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "entry_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "reference_number" "text",
    "memo" "text",
    "description" "text",
    "source_type" "text",
    "source_id" "uuid",
    "posted" boolean DEFAULT false NOT NULL,
    "posted_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "batch_id" "uuid"
);


ALTER TABLE "public"."journal_entries" OWNER TO "postgres";


COMMENT ON TABLE "public"."journal_entries" IS 'Double-entry journal. Flipping posted=true triggers balance validation.';



CREATE TABLE IF NOT EXISTS "public"."journal_entry_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "status" "public"."je_batch_status" DEFAULT 'draft'::"public"."je_batch_status" NOT NULL,
    "upload_url" "text",
    "total_entries" integer DEFAULT 0 NOT NULL,
    "total_debit" numeric(14,2) DEFAULT 0 NOT NULL,
    "total_credit" numeric(14,2) DEFAULT 0 NOT NULL,
    "posted_at" timestamp with time zone,
    "posted_by" "uuid",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."journal_entry_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."journal_entry_lines" (
    "id" integer NOT NULL,
    "transactionId" integer NOT NULL,
    "glAccountId" integer NOT NULL,
    "debit" numeric(12,2) DEFAULT '0'::numeric,
    "credit" numeric(12,2) DEFAULT '0'::numeric,
    "memo" "text"
);


ALTER TABLE "public"."journal_entry_lines" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."journal_entry_lines_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."journal_entry_lines_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."journal_entry_lines_id_seq" OWNED BY "public"."journal_entry_lines"."id";



CREATE TABLE IF NOT EXISTS "public"."journal_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entry_id" "uuid" NOT NULL,
    "gl_account_id" "uuid" NOT NULL,
    "association_id" "uuid",
    "debit_amount" numeric(14,2) DEFAULT 0 NOT NULL,
    "credit_amount" numeric(14,2) DEFAULT 0 NOT NULL,
    "memo" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "journal_lines_check" CHECK (((("debit_amount" > (0)::numeric) AND ("credit_amount" = (0)::numeric)) OR (("credit_amount" > (0)::numeric) AND ("debit_amount" = (0)::numeric)))),
    CONSTRAINT "journal_lines_credit_amount_check" CHECK (("credit_amount" >= (0)::numeric)),
    CONSTRAINT "journal_lines_debit_amount_check" CHECK (("debit_amount" >= (0)::numeric))
);


ALTER TABLE "public"."journal_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."late_fee_assessments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "association_id" "uuid" NOT NULL,
    "charge_id" "uuid" NOT NULL,
    "fee_charge_id" "uuid",
    "assessed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."late_fee_assessments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lead_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."lead_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "email" "text",
    "name" "text",
    "phone" "text",
    "source" "text",
    "qualification_data" "jsonb" DEFAULT '{}'::"jsonb",
    "conversation_summary" "text",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "leads_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'qualifying'::"text", 'qualified'::"text", 'contacted'::"text", 'converted'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lock_box_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lock_box_id" "uuid" NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "vendor_id" "uuid",
    "profile_id" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "returned_at" timestamp with time zone,
    "purpose" "text",
    "contact_phone" "text",
    "contact_email" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "lock_box_assignments_assignee_check" CHECK ((("vendor_id" IS NOT NULL) OR ("profile_id" IS NOT NULL)))
);


ALTER TABLE "public"."lock_box_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lock_boxes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "association_id" "uuid",
    "building_id" "uuid",
    "unit_id" "uuid",
    "serial_number" "text",
    "combination" "text",
    "location_description" "text",
    "location_type" "public"."lock_box_location_type" DEFAULT 'building'::"public"."lock_box_location_type",
    "status" "public"."lock_box_status" DEFAULT 'active'::"public"."lock_box_status",
    "keys_contained" "text"[] DEFAULT '{}'::"text"[],
    "key_count" integer DEFAULT 0,
    "notes" "text",
    "last_accessed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."lock_boxes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lockbox_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "bank_account_id" "uuid",
    "provider" "text" NOT NULL,
    "provider_batch_id" "text",
    "batch_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "total_items" integer DEFAULT 0 NOT NULL,
    "total_amount_cents" bigint DEFAULT 0 NOT NULL,
    "status" "public"."lockbox_batch_status" DEFAULT 'received'::"public"."lockbox_batch_status" NOT NULL,
    "deposit_reference" "text",
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deposited_at" timestamp with time zone,
    "reconciled_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lockbox_batches" OWNER TO "postgres";


COMMENT ON TABLE "public"."lockbox_batches" IS 'Paper-check lockbox feeds. Provider scans + ACH-deposits the checks; we import the batch and auto-match to units.';



CREATE TABLE IF NOT EXISTS "public"."lockbox_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "association_id" "uuid",
    "unit_id" "uuid",
    "owner_id" "uuid",
    "payment_id" "uuid",
    "check_number" "text",
    "check_amount_cents" bigint NOT NULL,
    "routing_number" "text",
    "account_number_masked" "text",
    "payer_name" "text",
    "scan_url" "text",
    "matched_confidence" numeric(5,2),
    "manually_matched" boolean DEFAULT false NOT NULL,
    "rejected" boolean DEFAULT false NOT NULL,
    "rejection_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lockbox_items_check_amount_cents_check" CHECK (("check_amount_cents" > 0)),
    CONSTRAINT "lockbox_items_matched_confidence_check" CHECK ((("matched_confidence" IS NULL) OR (("matched_confidence" >= (0)::numeric) AND ("matched_confidence" <= (100)::numeric))))
);


ALTER TABLE "public"."lockbox_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."lockbox_items" IS 'Individual check within a lockbox batch. matched_confidence = fuzzy match score to a unit/owner.';



CREATE TABLE IF NOT EXISTS "public"."login_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text",
    "auth_user_id" "uuid",
    "portfolio_id" "uuid",
    "ip_address" "text",
    "user_agent" "text",
    "success" boolean NOT NULL,
    "failure_reason" "text",
    "mfa_used" boolean DEFAULT false NOT NULL,
    "at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."login_attempts" OWNER TO "postgres";


COMMENT ON TABLE "public"."login_attempts" IS 'Sign-in audit. Edge function or Auth hook inserts rows; used for rate-limiting detection and security analytics.';



CREATE TABLE IF NOT EXISTS "public"."maintenance_task_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "now"(),
    "completed_by" "uuid",
    "vendor_id" "uuid",
    "notes" "text",
    "next_due_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."maintenance_task_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."maintenance_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "association_id" "uuid" NOT NULL,
    "template_id" "uuid",
    "task_name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "frequency" "text" NOT NULL,
    "custom_interval_days" integer,
    "vendor_id" "uuid",
    "assigned_staff_id" "uuid",
    "reminder_days" integer[] DEFAULT ARRAY[30, 14, 7, 3, 1],
    "priority" "text" DEFAULT 'normal'::"text",
    "start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "end_date" "date",
    "notes" "text",
    "status" "text" DEFAULT 'active'::"text",
    "last_completed_at" timestamp with time zone,
    "next_due_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "archived_at" timestamp with time zone,
    CONSTRAINT "maintenance_tasks_frequency_check" CHECK (("frequency" = ANY (ARRAY['weekly'::"text", 'monthly'::"text", 'bimonthly'::"text", 'quarterly'::"text", 'semiannual'::"text", 'annual'::"text", 'custom'::"text"]))),
    CONSTRAINT "maintenance_tasks_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "maintenance_tasks_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."maintenance_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."maintenance_template_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "icon" "text",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."maintenance_template_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."maintenance_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text",
    "is_system" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "group_id" "uuid"
);


ALTER TABLE "public"."maintenance_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."management_agreements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "association_id" "uuid",
    "owner_id" "uuid",
    "name" "text" NOT NULL,
    "status" "public"."agreement_status" DEFAULT 'active'::"public"."agreement_status" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "auto_renew" boolean DEFAULT true NOT NULL,
    "renewal_term_months" integer,
    "management_fee_schedule_id" "uuid",
    "termination_notice_days" integer,
    "terms" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "document_url" "text",
    "signed_at" timestamp with time zone,
    "signed_by_owner" "text",
    "signed_by_manager" "uuid",
    "notes" "text",
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "unit_id" "uuid",
    "agreement_data" "jsonb" DEFAULT '{}'::"jsonb",
    "owner_signed_at" timestamp with time zone,
    "owner_signature" "text",
    "manager_signed_at" timestamp with time zone,
    "manager_signature" "text",
    CONSTRAINT "management_agreements_check" CHECK ((("end_date" IS NULL) OR ("end_date" > "start_date"))),
    CONSTRAINT "management_agreements_renewal_term_months_check" CHECK ((("renewal_term_months" IS NULL) OR ("renewal_term_months" > 0)))
);


ALTER TABLE "public"."management_agreements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."management_fee_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "association_id" "uuid" NOT NULL,
    "effective_from" "date" NOT NULL,
    "effective_to" "date",
    "fee_type" "text" DEFAULT 'management_fee'::"text" NOT NULL,
    "amount" numeric NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."management_fee_policies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."management_fee_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "fee_type" "public"."management_fee_type" DEFAULT 'per_unit'::"public"."management_fee_type" NOT NULL,
    "amount" numeric(14,2) DEFAULT 0 NOT NULL,
    "percentage" numeric(5,2),
    "notes" "text",
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."management_fee_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."management_fees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "association_id" "uuid" NOT NULL,
    "month" "date" NOT NULL,
    "fee_amount_cents" integer DEFAULT 0,
    "collected_cents" integer DEFAULT 0,
    "delinquent_cents" integer DEFAULT 0,
    "door_count" integer,
    "avg_per_door_cents" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."management_fees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "contact_name" "text" NOT NULL,
    "contact_email" "text" NOT NULL,
    "contact_phone" "text",
    "company_name" "text" NOT NULL,
    "portfolio_size" "text",
    "current_platform" "text",
    "message" "text",
    "source_url" "text",
    "utm_source" "text",
    "utm_medium" "text",
    "utm_campaign" "text",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "assigned_to" "uuid",
    "notes" "text",
    "converted_portfolio_id" "uuid",
    CONSTRAINT "marketing_leads_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'contacted'::"text", 'qualified'::"text", 'converted'::"text", 'declined'::"text", 'spam'::"text"])))
);


ALTER TABLE "public"."marketing_leads" OWNER TO "postgres";


COMMENT ON TABLE "public"."marketing_leads" IS 'White-glove sales pipeline. Captured from /request-access on the marketing site, qualified by the concierge in /platform/leads, then converted into a provisioned portfolio.';



CREATE TABLE IF NOT EXISTS "public"."meeting_action_items" (
    "id" integer NOT NULL,
    "meetingId" integer NOT NULL,
    "title" character varying(255) NOT NULL,
    "assignedToId" integer,
    "dueDate" timestamp without time zone,
    "isCompleted" boolean DEFAULT false NOT NULL,
    "completedAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."meeting_action_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."meeting_action_items_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."meeting_action_items_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."meeting_action_items_id_seq" OWNED BY "public"."meeting_action_items"."id";



CREATE TABLE IF NOT EXISTS "public"."meeting_attendees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "owner_id" "uuid",
    "attendee_name" "text" NOT NULL,
    "attendee_role" "text",
    "check_in_time" timestamp with time zone DEFAULT "now"(),
    "signature_data" "text",
    "present" boolean DEFAULT true NOT NULL,
    "voting_eligible" boolean DEFAULT true,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."meeting_attendees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meeting_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "file_size" bigint,
    "file_type" "text",
    "uploaded_by" "uuid",
    "uploaded_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."meeting_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meetings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "association_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "meeting_type" "public"."meeting_type" DEFAULT 'board_meeting'::"public"."meeting_type" NOT NULL,
    "status" "public"."meeting_status" DEFAULT 'scheduled'::"public"."meeting_status" NOT NULL,
    "start_time" timestamp with time zone,
    "end_time" timestamp with time zone,
    "location" "text",
    "agenda" "text",
    "minutes" "text",
    "ai_summary" "text",
    "quorum_requirement" integer,
    "quorum_met" boolean DEFAULT false,
    "total_units" integer,
    "created_by" "uuid",
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."meetings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "channel" "text" DEFAULT 'sms'::"text" NOT NULL,
    "category" "text" DEFAULT 'general'::"text",
    "subject" "text",
    "body" "text" NOT NULL,
    "is_system" boolean DEFAULT false,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "message_templates_channel_check" CHECK (("channel" = ANY (ARRAY['sms'::"text", 'email'::"text", 'both'::"text"])))
);


ALTER TABLE "public"."message_templates" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."monthly_income" WITH ("security_invoker"='true') AS
 SELECT "date_trunc"('month'::"text", ("p"."payment_date")::timestamp with time zone) AS "month",
    "a"."id" AS "association_id",
    "a"."name" AS "association_name",
    "p"."method",
    "count"(*) AS "payment_count",
    "sum"("p"."amount") AS "total_amount"
   FROM ((("public"."payments" "p"
     JOIN "public"."units" "u" ON (("u"."id" = "p"."unit_id")))
     JOIN "public"."buildings" "b" ON (("b"."id" = "u"."building_id")))
     JOIN "public"."associations" "a" ON (("a"."id" = "b"."association_id")))
  GROUP BY ("date_trunc"('month'::"text", ("p"."payment_date")::timestamp with time zone)), "a"."id", "a"."name", "p"."method"
  ORDER BY ("date_trunc"('month'::"text", ("p"."payment_date")::timestamp with time zone)) DESC, "a"."name";


ALTER VIEW "public"."monthly_income" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notice_recipients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "notice_id" "uuid" NOT NULL,
    "owner_id" "uuid",
    "email" "text" NOT NULL,
    "name" "text",
    "delivered_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notice_recipients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "association_id" "uuid" NOT NULL,
    "notice_type" "public"."notice_type" DEFAULT 'general'::"public"."notice_type" NOT NULL,
    "status" "public"."notice_status" DEFAULT 'draft'::"public"."notice_status" NOT NULL,
    "subject" "text" NOT NULL,
    "body" "text" NOT NULL,
    "send_to" "text" DEFAULT 'all_owners'::"text" NOT NULL,
    "sent_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_at" timestamp with time zone,
    "template_id" "uuid",
    "channel" "public"."communication_channel" DEFAULT 'email'::"public"."communication_channel" NOT NULL,
    CONSTRAINT "notices_body_check" CHECK (("length"("body") >= 1)),
    CONSTRAINT "notices_subject_check" CHECK ((("length"("subject") >= 2) AND ("length"("subject") <= 300)))
);


ALTER TABLE "public"."notices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."occupancies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "association_id" "uuid" NOT NULL,
    "owner_id" "uuid",
    "occupancy_type" "public"."occupancy_type" DEFAULT 'owner'::"public"."occupancy_type" NOT NULL,
    "status" "public"."occupancy_status" DEFAULT 'current'::"public"."occupancy_status" NOT NULL,
    "move_in_date" "date",
    "move_out_date" "date",
    "dues_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "online_portal_activated" boolean DEFAULT false NOT NULL,
    "online_payments_recurring_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "online_payments_recurring_count" integer DEFAULT 0 NOT NULL,
    "is_primary" boolean DEFAULT true NOT NULL,
    "share_pct" numeric(5,2) DEFAULT 100 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dues_frequency" "public"."recurring_frequency" DEFAULT 'monthly'::"public"."recurring_frequency" NOT NULL,
    "dues_paid_through" "date",
    "last_dues_increase_date" "date",
    "last_dues_increase_amount" numeric(12,2),
    "next_scheduled_increase_date" "date",
    "next_scheduled_increase_amount" numeric(12,2),
    "nsf_count" integer DEFAULT 0 NOT NULL,
    "late_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "occupancies_dues_amount_check" CHECK (("dues_amount" >= (0)::numeric)),
    CONSTRAINT "occupancies_share_pct_check" CHECK ((("share_pct" >= (0)::numeric) AND ("share_pct" <= (100)::numeric)))
);


ALTER TABLE "public"."occupancies" OWNER TO "postgres";


COMMENT ON TABLE "public"."occupancies" IS 'Unified unit↔person relationship; will eventually supersede unit_owners/tenancies';



CREATE TABLE IF NOT EXISTS "public"."owner_accounts" (
    "id" integer NOT NULL,
    "ownerId" integer NOT NULL,
    "propertyId" integer NOT NULL,
    "companyId" integer NOT NULL,
    "balanceCents" integer DEFAULT 0 NOT NULL,
    "currency" character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    "notes" "text",
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."owner_accounts" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."owner_accounts_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."owner_accounts_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."owner_accounts_id_seq" OWNED BY "public"."owner_accounts"."id";



CREATE TABLE IF NOT EXISTS "public"."owner_ach_status" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'not_started'::"text",
    "payment_method_id" "text",
    "invited_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "verified_at" timestamp with time zone,
    "last_error" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "owner_ach_status_status_check" CHECK (("status" = ANY (ARRAY['not_started'::"text", 'invite_sent'::"text", 'completed'::"text", 'verified'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."owner_ach_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."owner_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "content_type" "text",
    "size_bytes" bigint,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."owner_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."owner_financial_details" (
    "owner_id" "uuid" NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "taxpayer_name" "text",
    "taxpayer_id" "text",
    "tax_form_account_number" "text",
    "send_1099" boolean DEFAULT false NOT NULL,
    "electronic_1099_consent" boolean DEFAULT false NOT NULL,
    "sending_preference_1099" "text" DEFAULT 'paper'::"text" NOT NULL,
    "paid_by_ach" boolean DEFAULT false NOT NULL,
    "bank_routing_number" "text",
    "bank_account_number" "text",
    "check_consolidation" "text" DEFAULT 'single_check'::"text" NOT NULL,
    "check_stub_show_detail" boolean DEFAULT true NOT NULL,
    "hold_payments" boolean DEFAULT false NOT NULL,
    "email_echeck_receipt" boolean DEFAULT false NOT NULL,
    "default_check_memo" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "owner_financial_details_check_consolidation_check" CHECK (("check_consolidation" = ANY (ARRAY['single_check'::"text", 'separate_checks'::"text"]))),
    CONSTRAINT "owner_financial_details_sending_preference_1099_check" CHECK (("sending_preference_1099" = ANY (ARRAY['paper'::"text", 'electronic'::"text"])))
);


ALTER TABLE "public"."owner_financial_details" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."owner_form_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "form_type" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text",
    "form_data" "jsonb" DEFAULT '{}'::"jsonb",
    "submitted_at" timestamp with time zone,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "owner_form_submissions_form_type_check" CHECK (("form_type" = ANY (ARRAY['owner_contact'::"text", 'emergency_contact'::"text", 'tenant_info'::"text", 'vehicle_parking'::"text", 'pet_esa'::"text", 'ach_setup'::"text", 'management_agreement_intake'::"text", 'management_agreement'::"text"]))),
    CONSTRAINT "owner_form_submissions_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."owner_form_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."owner_messages" (
    "id" integer NOT NULL,
    "propertyId" integer NOT NULL,
    "companyId" integer NOT NULL,
    "ownerId" integer NOT NULL,
    "managerId" integer,
    "direction" "public"."message_direction" NOT NULL,
    "channel" "public"."message_channel" DEFAULT 'in_app'::"public"."message_channel" NOT NULL,
    "subject" character varying(255),
    "body" "text" NOT NULL,
    "isRead" boolean DEFAULT false NOT NULL,
    "isReadByManager" boolean DEFAULT false NOT NULL,
    "threadKey" character varying(64),
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."owner_messages" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."owner_messages_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."owner_messages_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."owner_messages_id_seq" OWNED BY "public"."owner_messages"."id";



CREATE TABLE IF NOT EXISTS "public"."owner_notification_prefs" (
    "id" integer NOT NULL,
    "ownerId" integer NOT NULL,
    "docSharedInApp" boolean DEFAULT true NOT NULL,
    "docSharedEmail" boolean DEFAULT true NOT NULL,
    "paymentDueInApp" boolean DEFAULT true NOT NULL,
    "paymentDueEmail" boolean DEFAULT true NOT NULL,
    "msgReceivedInApp" boolean DEFAULT true NOT NULL,
    "msgReceivedEmail" boolean DEFAULT true NOT NULL,
    "ticketUpdateInApp" boolean DEFAULT true NOT NULL,
    "ticketUpdateEmail" boolean DEFAULT true NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."owner_notification_prefs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."owner_notification_prefs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."owner_notification_prefs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."owner_notification_prefs_id_seq" OWNED BY "public"."owner_notification_prefs"."id";



CREATE TABLE IF NOT EXISTS "public"."owner_notifications" (
    "id" integer NOT NULL,
    "ownerId" integer NOT NULL,
    "propertyId" integer NOT NULL,
    "companyId" integer NOT NULL,
    "type" "public"."notification_type" DEFAULT 'general'::"public"."notification_type" NOT NULL,
    "title" character varying(255) NOT NULL,
    "body" "text" NOT NULL,
    "documentId" integer,
    "ticketId" integer,
    "isRead" boolean DEFAULT false NOT NULL,
    "readAt" timestamp without time zone,
    "emailSent" boolean DEFAULT false NOT NULL,
    "emailSentAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."owner_notifications" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."owner_notifications_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."owner_notifications_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."owner_notifications_id_seq" OWNED BY "public"."owner_notifications"."id";



CREATE TABLE IF NOT EXISTS "public"."owner_packet_settings" (
    "owner_id" "uuid" NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "frequency" "text" DEFAULT 'monthly'::"text" NOT NULL,
    "delivery" "text" DEFAULT 'email'::"text" NOT NULL,
    "statement_template" "text" DEFAULT 'standard'::"text" NOT NULL,
    "include_statement" boolean DEFAULT true NOT NULL,
    "include_ledger_detail" boolean DEFAULT true NOT NULL,
    "include_delinquency" boolean DEFAULT true NOT NULL,
    "include_documents" boolean DEFAULT false NOT NULL,
    "include_violations" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "owner_packet_settings_delivery_check" CHECK (("delivery" = ANY (ARRAY['email'::"text", 'paper'::"text", 'both'::"text"]))),
    CONSTRAINT "owner_packet_settings_frequency_check" CHECK (("frequency" = ANY (ARRAY['monthly'::"text", 'quarterly'::"text", 'semiannual'::"text", 'annual'::"text"]))),
    CONSTRAINT "owner_packet_settings_statement_template_check" CHECK (("statement_template" = ANY (ARRAY['standard'::"text", 'enhanced'::"text"])))
);


ALTER TABLE "public"."owner_packet_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."owner_packets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "owner_info" "jsonb" DEFAULT '{}'::"jsonb",
    "unit_info" "jsonb" DEFAULT '{}'::"jsonb",
    "emergency_contact" "jsonb" DEFAULT '{}'::"jsonb",
    "vehicle_info" "jsonb" DEFAULT '[]'::"jsonb",
    "pet_info" "jsonb" DEFAULT '[]'::"jsonb",
    "communication_pref" "text" DEFAULT 'email'::"text",
    "acknowledgments" "jsonb" DEFAULT '{}'::"jsonb",
    "submitted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "owner_packets_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'completed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."owner_packets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."owner_payables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "association_id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "gl_account_id" "uuid",
    "bank_account_id" "uuid",
    "payable_number" "text",
    "payable_type" "public"."owner_payable_type" DEFAULT 'refund'::"public"."owner_payable_type" NOT NULL,
    "payable_date" "date" DEFAULT CURRENT_DATE,
    "due_date" "date",
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "memo" "text",
    "status" "public"."payable_bill_status" DEFAULT 'draft'::"public"."payable_bill_status" NOT NULL,
    "payment_method" "text",
    "payment_reference" "text",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."owner_payables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."owner_portal_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "status" "text" DEFAULT 'not_invited'::"text" NOT NULL,
    "token" "text",
    "sent_at" timestamp with time zone,
    "activated_at" timestamp with time zone,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval),
    "last_login_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "owner_portal_invites_status_check" CHECK (("status" = ANY (ARRAY['not_invited'::"text", 'sent'::"text", 'active'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."owner_portal_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."owner_statements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_id" "uuid",
    "association_id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "unit_id" "uuid",
    "occupancy_id" "uuid",
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"(),
    "sent_at" timestamp with time zone,
    "delivery_channel" "text" DEFAULT 'email'::"text",
    "delivery_status" "text" DEFAULT 'pending'::"text",
    "amount_due" numeric(12,2),
    "amount_past_due" numeric(12,2),
    "amount_prepaid" numeric(12,2),
    "total_due" numeric(12,2),
    "statement_data" "jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "owner_statements_delivery_channel_check" CHECK (("delivery_channel" = ANY (ARRAY['email'::"text", 'print'::"text", 'portal'::"text", 'none'::"text"]))),
    CONSTRAINT "owner_statements_delivery_status_check" CHECK (("delivery_status" = ANY (ARRAY['pending'::"text", 'queued'::"text", 'sent'::"text", 'failed'::"text", 'viewed'::"text"])))
);


ALTER TABLE "public"."owner_statements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."owner_vehicles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "make" "text",
    "model" "text",
    "color" "text",
    "year" integer,
    "license_plate" "text",
    "plate_state" "text",
    "notes" "text",
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."owner_vehicles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."owners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "mailing_address" "text",
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "preferred_comm" "text" DEFAULT 'email'::"text" NOT NULL,
    "electronic_consent" boolean DEFAULT false NOT NULL,
    "electronic_consent_date" timestamp with time zone,
    "portfolio_id" "uuid",
    "first_name" "text",
    "last_name" "text",
    "portal_activated" boolean DEFAULT false NOT NULL,
    "portal_login_last_at" timestamp with time zone,
    "phone_numbers" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "emails" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "address_street" "text",
    "address_city" "text",
    "address_state" "text",
    "address_zip" "text",
    "notes" "text",
    "auth_user_id" "uuid",
    "emergency_contact_name" "text",
    "emergency_contact_phone" "text",
    CONSTRAINT "owners_preferred_comm_check" CHECK (("preferred_comm" = ANY (ARRAY['email'::"text", 'mail'::"text", 'phone'::"text"])))
);


ALTER TABLE "public"."owners" OWNER TO "postgres";


COMMENT ON COLUMN "public"."owners"."auth_user_id" IS 'Strong link to auth.users. Auto-populated on signup by trg_auto_link_portal_user; email match is the fallback.';



CREATE TABLE IF NOT EXISTS "public"."parking_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "parking_space_id" "uuid" NOT NULL,
    "unit_id" "uuid",
    "owner_id" "uuid",
    "tenant_id" "uuid",
    "occupant_name" "text",
    "start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "end_date" "date",
    "monthly_fee" numeric,
    "deposit_amount" numeric,
    "deposit_paid" boolean DEFAULT false NOT NULL,
    "deposit_paid_at" "date",
    "deposit_returned" boolean DEFAULT false NOT NULL,
    "deposit_returned_at" "date",
    "vehicle_make" "text",
    "vehicle_model" "text",
    "vehicle_color" "text",
    "license_plate" "text",
    "insurance_company" "text",
    "insurance_policy_number" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "recurring_charge_id" "uuid",
    CONSTRAINT "parking_assignments_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'ended'::"text"])))
);


ALTER TABLE "public"."parking_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parking_spaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "association_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "space_type" "text" DEFAULT 'standard'::"text" NOT NULL,
    "monthly_fee" numeric DEFAULT 0 NOT NULL,
    "deposit_amount" numeric DEFAULT 0 NOT NULL,
    "notes" "text",
    "active" boolean DEFAULT true NOT NULL,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."parking_spaces" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payable_bill_line_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bill_id" "uuid" NOT NULL,
    "description" "text",
    "amount" numeric(14,2) NOT NULL,
    "gl_account_id" "uuid",
    "association_id" "uuid",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payable_bill_line_items_amount_check" CHECK (("amount" >= (0)::numeric))
);


ALTER TABLE "public"."payable_bill_line_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payable_bills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "association_id" "uuid",
    "gl_account_id" "uuid",
    "bank_account_id" "uuid",
    "work_order_id" "uuid",
    "bill_number" "text",
    "bill_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "due_date" "date",
    "occurred_on" "date",
    "amount" numeric(14,2) NOT NULL,
    "memo" "text",
    "status" "public"."payable_bill_status" DEFAULT 'draft'::"public"."payable_bill_status" NOT NULL,
    "approval_required" boolean DEFAULT false NOT NULL,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "check_number" integer,
    CONSTRAINT "payable_bills_amount_check" CHECK (("amount" >= (0)::numeric))
);


ALTER TABLE "public"."payable_bills" OWNER TO "postgres";


COMMENT ON COLUMN "public"."payable_bills"."status" IS 'Workflow: draft → pending_approval → approved → paid (or void).';



CREATE TABLE IF NOT EXISTS "public"."vendors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "vendor_type" "public"."vendor_type" DEFAULT 'general'::"public"."vendor_type" NOT NULL,
    "trade" "public"."vendor_trade" DEFAULT 'other'::"public"."vendor_trade" NOT NULL,
    "phone_numbers" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "emails" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "address_street" "text",
    "address_city" "text",
    "address_state" "text",
    "address_zip" "text",
    "portal_activated" boolean DEFAULT false NOT NULL,
    "portal_login_last_at" timestamp with time zone,
    "taxpayer_name" "text",
    "taxpayer_id" "text",
    "tax_account_number" "text",
    "send_1099" boolean DEFAULT false NOT NULL,
    "check_consolidation" "text",
    "check_stub_breakdown" "text",
    "hold_payments" boolean DEFAULT false NOT NULL,
    "email_echeck_receipt" boolean DEFAULT true NOT NULL,
    "payment_terms" "text",
    "default_check_memo" "text",
    "default_gl_account_id" "uuid",
    "work_order_adjustment" numeric(5,2) DEFAULT 0 NOT NULL,
    "payment_type" "public"."vendor_payment_type" DEFAULT 'check'::"public"."vendor_payment_type",
    "bank_routing_number" "text",
    "bank_account_number" "text",
    "savings_account" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "auth_user_id" "uuid",
    "is_auto_pay" boolean DEFAULT false NOT NULL,
    "auto_pay_setup_at" timestamp with time zone,
    "auto_pay_notes" "text",
    "is_utility" boolean DEFAULT false NOT NULL,
    "workers_comp_expiration" "date",
    "general_liability_expiration" "date",
    "epa_certification_expiration" "date",
    "auto_insurance_expiration" "date",
    "state_license_expiration" "date",
    "contract_expiration" "date",
    "ach_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "ach_verified_at" timestamp with time zone,
    "ach_verified_by" "uuid",
    "ach_activated_at" timestamp with time zone,
    "ach_activated_by" "uuid",
    CONSTRAINT "vendors_ach_status_check" CHECK (("ach_status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'active'::"text"]))),
    CONSTRAINT "vendors_name_check" CHECK ((("length"("name") >= 1) AND ("length"("name") <= 200))),
    CONSTRAINT "vendors_work_order_adjustment_check" CHECK ((("work_order_adjustment" >= (0)::numeric) AND ("work_order_adjustment" <= (100)::numeric)))
);


ALTER TABLE "public"."vendors" OWNER TO "postgres";


COMMENT ON COLUMN "public"."vendors"."taxpayer_id" IS 'Sensitive: EIN/SSN — consider Vault encryption';



COMMENT ON COLUMN "public"."vendors"."default_gl_account_id" IS 'FK to public.gl_accounts — wired in Phase 2';



COMMENT ON COLUMN "public"."vendors"."payment_type" IS 'Default is ''check'' — most vendors are paid by check. Set to ''ach'' or ''echeck'' for utility auto-pay or portal-activated vendors.';



COMMENT ON COLUMN "public"."vendors"."auth_user_id" IS 'Strong link for the vendor portal user. Vendors can have multiple team emails in vendors.emails, but only one primary portal auth user.';



COMMENT ON COLUMN "public"."vendors"."is_auto_pay" IS 'When true, bills from this vendor skip the manual check-writing queue and post straight to the bank account. Typically utilities (gas/electric/water).';



COMMENT ON COLUMN "public"."vendors"."is_utility" IS 'Marks gas/electric/water/sewer/trash vendors. Used to pre-categorize bills and pre-fill GL accounts.';



COMMENT ON COLUMN "public"."vendors"."workers_comp_expiration" IS 'Workers compensation insurance expiration';



COMMENT ON COLUMN "public"."vendors"."general_liability_expiration" IS 'General liability insurance expiration';



COMMENT ON COLUMN "public"."vendors"."epa_certification_expiration" IS 'EPA certification expiration';



COMMENT ON COLUMN "public"."vendors"."auto_insurance_expiration" IS 'Auto insurance expiration';



COMMENT ON COLUMN "public"."vendors"."state_license_expiration" IS 'State trade license expiration';



COMMENT ON COLUMN "public"."vendors"."contract_expiration" IS 'Service contract expiration';



COMMENT ON COLUMN "public"."vendors"."ach_status" IS 'ACH authorization status: pending → verified → active';



COMMENT ON COLUMN "public"."vendors"."ach_verified_at" IS 'Timestamp when bank account was verified by staff';



COMMENT ON COLUMN "public"."vendors"."ach_verified_by" IS 'Staff user who verified the bank account';



COMMENT ON COLUMN "public"."vendors"."ach_activated_at" IS 'Timestamp when ACH payments were activated';



COMMENT ON COLUMN "public"."vendors"."ach_activated_by" IS 'Staff user who activated ACH payments';



CREATE TABLE IF NOT EXISTS "public"."work_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid",
    "association_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "category" "public"."work_order_category" DEFAULT 'other'::"public"."work_order_category" NOT NULL,
    "priority" "public"."work_order_priority" DEFAULT 'normal'::"public"."work_order_priority" NOT NULL,
    "status" "public"."work_order_status" DEFAULT 'new'::"public"."work_order_status" NOT NULL,
    "assigned_to" "text",
    "scheduled_date" "date",
    "completed_date" "date",
    "requested_by" "text",
    "internal_notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_at" timestamp with time zone,
    "service_request_id" "uuid",
    "portfolio_id" "uuid",
    "vendor_id" "uuid",
    "number" "text",
    "job_description" "text",
    "owner_approved" boolean DEFAULT false NOT NULL,
    "trade" "public"."vendor_trade",
    "issue" "text",
    "vendor_instructions" "text",
    "scheduled_time" time without time zone,
    "owner_availability" "text",
    "next_followup_date" "date",
    "assignee_id" "uuid",
    "withheld_amount_from_owner" numeric(14,2) DEFAULT 0 NOT NULL,
    CONSTRAINT "work_orders_description_check" CHECK (("length"("description") <= 2000)),
    CONSTRAINT "work_orders_title_check" CHECK ((("length"("title") >= 2) AND ("length"("title") <= 200))),
    CONSTRAINT "work_orders_withheld_amount_from_owner_check" CHECK (("withheld_amount_from_owner" >= (0)::numeric))
);


ALTER TABLE "public"."work_orders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."work_orders"."service_request_id" IS 'Parent service_request. New WOs should set this; legacy rows may be null.';



CREATE OR REPLACE VIEW "public"."payable_invoices_ledger" WITH ("security_invoker"='true') AS
 SELECT "b"."id" AS "bill_id",
    "b"."bill_number",
    "b"."bill_date",
    "b"."due_date",
    "b"."occurred_on",
    "b"."created_at",
    "b"."updated_at",
    "b"."amount",
    "b"."memo",
    "b"."status",
    "b"."approval_required",
    "b"."approved_at",
    "b"."paid_at",
    "b"."vendor_id",
    "v"."name" AS "vendor_name",
    "v"."payment_type" AS "vendor_payment_type",
    "v"."hold_payments" AS "vendor_hold_payments",
    "b"."association_id",
    "a"."name" AS "association_name",
    "b"."gl_account_id",
    "ga"."number" AS "gl_account_number",
    "ga"."name" AS "gl_account_name",
    "b"."bank_account_id",
    "ba"."name" AS "bank_account_name",
    "ba"."bank_name",
    "b"."work_order_id",
    "wo"."number" AS "work_order_number",
    "wo"."title" AS "work_order_title",
        CASE
            WHEN ("b"."status" = 'paid'::"public"."payable_bill_status") THEN 'Paid'::"text"
            WHEN ("b"."status" = 'approved'::"public"."payable_bill_status") THEN 'Approved'::"text"
            WHEN ("b"."status" = 'pending_approval'::"public"."payable_bill_status") THEN 'Pending Approval'::"text"
            WHEN ("b"."status" = 'draft'::"public"."payable_bill_status") THEN 'Draft'::"text"
            WHEN ("b"."status" = 'void'::"public"."payable_bill_status") THEN 'Void'::"text"
            ELSE "initcap"("replace"(("b"."status")::"text", '_'::"text", ' '::"text"))
        END AS "status_label",
        CASE
            WHEN ("b"."status" = 'paid'::"public"."payable_bill_status") THEN 'Closed'::"text"
            WHEN ("b"."status" = 'approved'::"public"."payable_bill_status") THEN 'Ready to Pay'::"text"
            WHEN ("b"."status" = 'pending_approval'::"public"."payable_bill_status") THEN 'Approval Needed'::"text"
            WHEN ("b"."status" = 'draft'::"public"."payable_bill_status") THEN 'Needs Review'::"text"
            ELSE 'Review'::"text"
        END AS "task_label"
   FROM ((((("public"."payable_bills" "b"
     LEFT JOIN "public"."vendors" "v" ON (("v"."id" = "b"."vendor_id")))
     LEFT JOIN "public"."associations" "a" ON (("a"."id" = "b"."association_id")))
     LEFT JOIN "public"."gl_accounts" "ga" ON (("ga"."id" = "b"."gl_account_id")))
     LEFT JOIN "public"."bank_accounts" "ba" ON (("ba"."id" = "b"."bank_account_id")))
     LEFT JOIN "public"."work_orders" "wo" ON (("wo"."id" = "b"."work_order_id")))
  WHERE ("b"."archived_at" IS NULL);


ALTER VIEW "public"."payable_invoices_ledger" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_intent_id" "uuid" NOT NULL,
    "event" "text" NOT NULL,
    "detail" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payment_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_intents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "association_id" "uuid" NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'usd'::"text" NOT NULL,
    "method" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "processor" "text" DEFAULT 'stripe'::"text" NOT NULL,
    "processor_session_id" "text",
    "processor_payment_intent_id" "text",
    "processor_charge_id" "text",
    "processor_payout_id" "text",
    "payment_id" "uuid",
    "failure_reason" "text",
    "breakdown" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "succeeded_at" timestamp with time zone,
    "settled_at" timestamp with time zone,
    "processor_fee_cents" integer,
    CONSTRAINT "payment_intents_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "payment_intents_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'succeeded'::"text", 'failed'::"text", 'canceled'::"text", 'returned'::"text", 'refunded'::"text", 'chargeback'::"text"])))
);


ALTER TABLE "public"."payment_intents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_methods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "processor" "public"."payment_processor" NOT NULL,
    "method_type" "public"."payment_method_type" NOT NULL,
    "processor_token" "text" NOT NULL,
    "processor_customer_id" "text",
    "last_four" "text",
    "brand" "text",
    "exp_month" smallint,
    "exp_year" smallint,
    "bank_name" "text",
    "account_type" "text",
    "is_default" boolean DEFAULT false NOT NULL,
    "is_verified" boolean DEFAULT false NOT NULL,
    "verified_at" timestamp with time zone,
    "failed_attempts" integer DEFAULT 0 NOT NULL,
    "last_failure_at" timestamp with time zone,
    "last_failure_reason" "text",
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_methods_account_type_check" CHECK ((("account_type" = ANY (ARRAY['checking'::"text", 'savings'::"text"])) OR ("account_type" IS NULL))),
    CONSTRAINT "payment_methods_exp_month_check" CHECK ((("exp_month" IS NULL) OR (("exp_month" >= 1) AND ("exp_month" <= 12)))),
    CONSTRAINT "payment_methods_exp_year_check" CHECK ((("exp_year" IS NULL) OR (("exp_year" >= 2020) AND ("exp_year" <= 2100))))
);


ALTER TABLE "public"."payment_methods" OWNER TO "postgres";


COMMENT ON TABLE "public"."payment_methods" IS 'Tokenized payment methods on file per homeowner. Raw card/bank numbers are NEVER stored — only processor tokens. Satisfies PCI-DSS / NACHA.';



CREATE TABLE IF NOT EXISTS "public"."payment_processor_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "processor" "public"."payment_processor" NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "supports_ach" boolean DEFAULT true NOT NULL,
    "supports_card" boolean DEFAULT true NOT NULL,
    "supports_apple_pay" boolean DEFAULT false NOT NULL,
    "vault_secret_name" "text",
    "public_key" "text",
    "webhook_secret_vault_name" "text",
    "ach_fee_bps" integer,
    "ach_fee_cap_cents" integer,
    "ach_fee_fixed_cents" integer,
    "card_fee_bps" integer,
    "card_fee_fixed_cents" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_processor_configs_ach_fee_bps_check" CHECK (("ach_fee_bps" >= 0))
);


ALTER TABLE "public"."payment_processor_configs" OWNER TO "postgres";


COMMENT ON TABLE "public"."payment_processor_configs" IS 'Per-portfolio processor setup. Stripe default; add Dwolla for lower-cost ACH at scale, Modern Treasury for enterprise. Credentials via Supabase Vault.';



CREATE TABLE IF NOT EXISTS "public"."payment_transactions" (
    "id" integer NOT NULL,
    "ownerAccountId" integer NOT NULL,
    "ownerId" integer NOT NULL,
    "propertyId" integer NOT NULL,
    "companyId" integer NOT NULL,
    "amountCents" integer NOT NULL,
    "type" "public"."payment_type" DEFAULT 'payment'::"public"."payment_type" NOT NULL,
    "method" "public"."payment_method" DEFAULT 'other'::"public"."payment_method" NOT NULL,
    "status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status" NOT NULL,
    "description" "text",
    "referenceNumber" character varying(100),
    "memo" "text",
    "confirmedAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payment_transactions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."payment_transactions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."payment_transactions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."payment_transactions_id_seq" OWNED BY "public"."payment_transactions"."id";



CREATE TABLE IF NOT EXISTS "public"."payout_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "association_id" "uuid",
    "processor" "text" DEFAULT 'stripe'::"text" NOT NULL,
    "processor_payout_id" "text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'usd'::"text" NOT NULL,
    "arrival_date" "date",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "expected_amount" numeric(12,2),
    "bank_transaction_id" "uuid",
    "matched_at" timestamp with time zone,
    "match_method" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payout_batches_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'matched'::"text", 'reconciled'::"text", 'needs_review'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."payout_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permission_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid",
    "actor_portfolio_id" "uuid",
    "target_entity_type" "text" NOT NULL,
    "target_entity_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "before_state" "jsonb",
    "after_state" "jsonb",
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "ip_address" "text",
    "user_agent" "text",
    "at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."permission_audit_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."permission_audit_log" IS 'Immutable log of privilege-changing events (role assignments, invitations, portfolio moves). Only platform operators and portfolio admins can read; writes come from triggers.';



CREATE TABLE IF NOT EXISTS "public"."phone_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "caller_name" "text",
    "callback_number" "text",
    "email" "text",
    "company" "text",
    "doors" "text",
    "current_software" "text",
    "topic" "text",
    "message" "text",
    "urgency" "text" DEFAULT 'normal'::"text",
    "provider" "text",
    "call_id" "text",
    "from_number" "text",
    "handled" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."phone_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plaid_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "bank_account_id" "uuid",
    "plaid_item_id" "text" NOT NULL,
    "plaid_access_token" "text" NOT NULL,
    "plaid_institution_id" "text",
    "plaid_institution_name" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "last_sync_at" timestamp with time zone,
    "error_message" "text",
    "cursor" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "plaid_items_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'error'::"text", 'disconnected'::"text"])))
);


ALTER TABLE "public"."plaid_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_impersonation_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "operator_id" "uuid" NOT NULL,
    "operator_email" "text" NOT NULL,
    "impersonated_user_id" "uuid",
    "impersonated_email" "text",
    "impersonated_portfolio_id" "uuid",
    "reason" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "ip_address" "text",
    "user_agent" "text"
);


ALTER TABLE "public"."platform_impersonation_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."platform_impersonation_log" IS 'Forensic log of every "Login as" action by a ManageOps super admin. Append-only history; ended_at filled when the operator returns to their own session.';



CREATE TABLE IF NOT EXISTS "public"."platform_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "request_type" "text" NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text",
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'open'::"text",
    "submitted_by" "uuid",
    "assigned_to" "uuid",
    "platform_response" "text",
    "internal_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "resolved_at" timestamp with time zone
);


ALTER TABLE "public"."platform_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portfolio_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "logo_url" "text",
    "office_address" "text",
    "office_phone" "text",
    "billing_email" "text",
    "notification_prefs" "jsonb" DEFAULT '{}'::"jsonb",
    "manager_defaults" "jsonb" DEFAULT '{}'::"jsonb",
    "owner_invite_defaults" "jsonb" DEFAULT '{}'::"jsonb",
    "vendor_invite_defaults" "jsonb" DEFAULT '{}'::"jsonb",
    "branding_enabled" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."portfolio_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."privacy_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subject_email" "text" NOT NULL,
    "subject_auth_user_id" "uuid",
    "subject_owner_id" "uuid",
    "portfolio_id" "uuid",
    "action_type" "public"."privacy_action_type" NOT NULL,
    "status" "public"."privacy_action_status" DEFAULT 'received'::"public"."privacy_action_status" NOT NULL,
    "jurisdiction" "text",
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deadline" timestamp with time zone DEFAULT ("now"() + '30 days'::interval) NOT NULL,
    "verified_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "rejection_reason" "text",
    "handler_user_id" "uuid",
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "evidence_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "privacy_actions_jurisdiction_check" CHECK ((("jurisdiction" = ANY (ARRAY['gdpr'::"text", 'ccpa'::"text", 'other'::"text"])) OR ("jurisdiction" IS NULL)))
);


ALTER TABLE "public"."privacy_actions" OWNER TO "postgres";


COMMENT ON TABLE "public"."privacy_actions" IS 'GDPR / CCPA privacy request tracking. 30-day deadline default. Completion writes to the permission_audit_log via a separate trigger path on implementing code.';



CREATE TABLE IF NOT EXISTS "public"."properties" (
    "id" integer NOT NULL,
    "companyId" integer NOT NULL,
    "name" character varying(255) NOT NULL,
    "address" "text",
    "city" character varying(100),
    "state" character varying(50),
    "zip" character varying(20),
    "country" character varying(50) DEFAULT 'US'::character varying,
    "totalUnits" integer DEFAULT 0,
    "yearBuilt" integer,
    "propertyType" "text" DEFAULT 'condominium'::"text",
    "amenities" "text",
    "notes" "text",
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."properties" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."properties_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."properties_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."properties_id_seq" OWNED BY "public"."properties"."id";



CREATE TABLE IF NOT EXISTS "public"."property_assignments" (
    "id" integer NOT NULL,
    "propertyId" integer NOT NULL,
    "userId" integer NOT NULL,
    "role" "public"."portier_role" DEFAULT 'property_manager'::"public"."portier_role",
    "assignedAt" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."property_assignments" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."property_assignments_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."property_assignments_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."property_assignments_id_seq" OWNED BY "public"."property_assignments"."id";



CREATE TABLE IF NOT EXISTS "public"."property_documents" (
    "id" integer NOT NULL,
    "propertyId" integer NOT NULL,
    "companyId" integer NOT NULL,
    "uploadedById" integer NOT NULL,
    "title" character varying(255) NOT NULL,
    "category" "public"."document_category" DEFAULT 'other'::"public"."document_category" NOT NULL,
    "description" "text",
    "fileName" character varying(255) NOT NULL,
    "fileKey" character varying(512) NOT NULL,
    "fileUrl" "text" NOT NULL,
    "mimeType" character varying(100) NOT NULL,
    "fileSize" integer NOT NULL,
    "isSharedWithOwners" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."property_documents" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."property_documents_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."property_documents_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."property_documents_id_seq" OWNED BY "public"."property_documents"."id";



CREATE TABLE IF NOT EXISTS "public"."property_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "property_groups_name_check" CHECK ((("length"("name") >= 1) AND ("length"("name") <= 200)))
);


ALTER TABLE "public"."property_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_availability" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "provider_availability_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6))),
    CONSTRAINT "valid_window" CHECK (("start_time" < "end_time"))
);


ALTER TABLE "public"."provider_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_services" (
    "provider_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL
);


ALTER TABLE "public"."provider_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."providers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "title" "text",
    "bio" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."providers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_order_line_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "purchase_order_id" "uuid" NOT NULL,
    "description" "text",
    "qty" numeric(12,3) DEFAULT 1 NOT NULL,
    "unit_price" numeric(14,4) DEFAULT 0 NOT NULL,
    "line_total" numeric(14,2) GENERATED ALWAYS AS ("round"(("qty" * "unit_price"), 2)) STORED,
    "gl_account_id" "uuid",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "purchase_order_line_items_qty_check" CHECK (("qty" > (0)::numeric)),
    CONSTRAINT "purchase_order_line_items_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."purchase_order_line_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "association_id" "uuid" NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "work_order_id" "uuid",
    "number" "text",
    "status" "public"."purchase_order_status" DEFAULT 'open'::"public"."purchase_order_status" NOT NULL,
    "po_total" numeric(14,2) DEFAULT 0 NOT NULL,
    "po_billed" numeric(14,2) DEFAULT 0 NOT NULL,
    "notes" "text",
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "purchase_orders_po_billed_check" CHECK (("po_billed" >= (0)::numeric)),
    CONSTRAINT "purchase_orders_po_total_check" CHECK (("po_total" >= (0)::numeric))
);


ALTER TABLE "public"."purchase_orders" OWNER TO "postgres";


COMMENT ON TABLE "public"."purchase_orders" IS 'Vendor purchase orders, optionally tied to a work order. Status: open → approved → billed → cancelled.';



CREATE TABLE IF NOT EXISTS "public"."unit_owners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "is_primary" boolean DEFAULT true NOT NULL,
    "share_pct" numeric(5,2) DEFAULT 100 NOT NULL,
    "start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "end_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "unit_owners_share_pct_check" CHECK ((("share_pct" >= (0)::numeric) AND ("share_pct" <= (100)::numeric)))
);


ALTER TABLE "public"."unit_owners" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."receivable_payments_ledger" WITH ("security_invoker"='true') AS
 SELECT "p"."id" AS "payment_id",
    "p"."payment_date",
    "p"."created_at",
    "p"."amount",
    "p"."method",
    "p"."reference",
    "p"."notes",
    "p"."unit_id",
    "u"."unit_number",
    "assoc"."id" AS "association_id",
    "assoc"."name" AS "association_name",
    "owner_row"."owner_id",
    "owner_row"."owner_name",
    "p"."charge_id",
    COALESCE("primary_charge"."description", "applied"."first_charge_description", "p"."notes", 'Receipt'::"text") AS "receipt_description",
    "p"."bank_account_id",
    "ba"."name" AS "bank_account_name",
    "ba"."bank_name",
    COALESCE("applied"."applied_amount", (0)::numeric) AS "applied_amount",
    GREATEST((COALESCE("p"."amount", (0)::numeric) - COALESCE("applied"."applied_amount", (0)::numeric)), (0)::numeric) AS "unapplied_amount",
    COALESCE("applied"."application_count", 0) AS "application_count"
   FROM ((((((("public"."payments" "p"
     LEFT JOIN "public"."units" "u" ON (("u"."id" = "p"."unit_id")))
     LEFT JOIN "public"."buildings" "b" ON (("b"."id" = "u"."building_id")))
     LEFT JOIN "public"."associations" "assoc" ON (("assoc"."id" = "b"."association_id")))
     LEFT JOIN "public"."bank_accounts" "ba" ON (("ba"."id" = "p"."bank_account_id")))
     LEFT JOIN "public"."charges" "primary_charge" ON (("primary_charge"."id" = "p"."charge_id")))
     LEFT JOIN LATERAL ( SELECT "uo"."owner_id",
            "o"."full_name" AS "owner_name"
           FROM ("public"."unit_owners" "uo"
             JOIN "public"."owners" "o" ON (("o"."id" = "uo"."owner_id")))
          WHERE (("uo"."unit_id" = "p"."unit_id") AND (("uo"."end_date" IS NULL) OR ("uo"."end_date" >= "p"."payment_date")))
          ORDER BY "uo"."is_primary" DESC, "uo"."start_date" DESC NULLS LAST, "uo"."created_at" DESC
         LIMIT 1) "owner_row" ON (true))
     LEFT JOIN LATERAL ( SELECT "sum"("pa"."amount_applied") AS "applied_amount",
            ("count"(*))::integer AS "application_count",
            "min"("c"."description") AS "first_charge_description"
           FROM ("public"."payment_applications" "pa"
             LEFT JOIN "public"."charges" "c" ON (("c"."id" = "pa"."charge_id")))
          WHERE ("pa"."payment_id" = "p"."id")) "applied" ON (true));


ALTER VIEW "public"."receivable_payments_ledger" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recent_activity" (
    "id" integer NOT NULL,
    "userId" integer NOT NULL,
    "propertyId" integer,
    "activityType" "public"."activity_type" NOT NULL,
    "title" character varying(255) NOT NULL,
    "description" "text",
    "metadata" json,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."recent_activity" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."recent_activity_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."recent_activity_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."recent_activity_id_seq" OWNED BY "public"."recent_activity"."id";



CREATE TABLE IF NOT EXISTS "public"."receptionist_knowledge" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "pinned" boolean DEFAULT false NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."receptionist_knowledge" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_bills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "association_id" "uuid",
    "gl_account_id" "uuid",
    "bank_account_id" "uuid",
    "name" "text" NOT NULL,
    "memo" "text",
    "amount" numeric(14,2) NOT NULL,
    "frequency" "public"."recurring_frequency" DEFAULT 'monthly'::"public"."recurring_frequency" NOT NULL,
    "interval_count" integer DEFAULT 1 NOT NULL,
    "start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "end_date" "date",
    "next_post_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "last_generated_at" timestamp with time zone,
    "auto_generate" boolean DEFAULT true NOT NULL,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "is_auto_pay" boolean DEFAULT false NOT NULL,
    CONSTRAINT "recurring_bills_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "recurring_bills_interval_count_check" CHECK (("interval_count" >= 1))
);


ALTER TABLE "public"."recurring_bills" OWNER TO "postgres";


COMMENT ON COLUMN "public"."recurring_bills"."is_auto_pay" IS 'When true, the generated payable_bill is auto-approved and marked paid (matching the utility auto-debit from the bank). When false, staff writes a check.';



CREATE TABLE IF NOT EXISTS "public"."recurring_journal_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "memo" "text",
    "frequency" "public"."recurring_frequency" DEFAULT 'monthly'::"public"."recurring_frequency" NOT NULL,
    "interval_count" integer DEFAULT 1 NOT NULL,
    "next_post_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "last_generated_at" timestamp with time zone,
    "auto_generate" boolean DEFAULT true NOT NULL,
    "template_lines" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "recurring_journal_entries_interval_count_check" CHECK (("interval_count" >= 1))
);


ALTER TABLE "public"."recurring_journal_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_work_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "association_id" "uuid" NOT NULL,
    "unit_id" "uuid",
    "vendor_id" "uuid",
    "gl_account_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "trade" "public"."vendor_trade",
    "category" "public"."work_order_category",
    "priority" "public"."work_order_priority" DEFAULT 'normal'::"public"."work_order_priority" NOT NULL,
    "frequency" "public"."recurring_frequency" DEFAULT 'monthly'::"public"."recurring_frequency" NOT NULL,
    "interval_count" integer DEFAULT 1 NOT NULL,
    "start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "end_date" "date",
    "next_due_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "last_generated_at" timestamp with time zone,
    "auto_generate" boolean DEFAULT true NOT NULL,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "recurring_work_orders_interval_count_check" CHECK (("interval_count" >= 1)),
    CONSTRAINT "recurring_work_orders_title_check" CHECK ((("length"("title") >= 1) AND ("length"("title") <= 200)))
);


ALTER TABLE "public"."recurring_work_orders" OWNER TO "postgres";


COMMENT ON TABLE "public"."recurring_work_orders" IS 'Templates that generate work_orders on a schedule. A cron job (future phase) advances next_due_date and creates SR+WO rows.';



CREATE TABLE IF NOT EXISTS "public"."reminder_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "alert_type" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "lead_days" integer DEFAULT 30 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."reminder_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_definitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid",
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "category" "public"."report_category" NOT NULL,
    "description" "text",
    "parameter_schema" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "default_filters" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "output_formats" "public"."report_format"[] DEFAULT ARRAY['pdf'::"public"."report_format", 'xlsx'::"public"."report_format"] NOT NULL,
    "is_system" boolean DEFAULT false NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "report_definitions_name_check" CHECK ((("length"("name") >= 1) AND ("length"("name") <= 200)))
);


ALTER TABLE "public"."report_definitions" OWNER TO "postgres";


COMMENT ON TABLE "public"."report_definitions" IS '26 system report templates seeded by default (schematic §7.1). Per-portfolio custom reports set portfolio_id.';



COMMENT ON COLUMN "public"."report_definitions"."parameter_schema" IS 'JSON Schema describing required/optional parameters for this report.';



CREATE TABLE IF NOT EXISTS "public"."report_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "association_id" "uuid" NOT NULL,
    "report_type" "text" NOT NULL,
    "parameters" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "generated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "definition_id" "uuid",
    "run_id" "uuid",
    CONSTRAINT "report_snapshots_report_type_check" CHECK (("report_type" = ANY (ARRAY['aged_receivables'::"text", 'account_ledger'::"text", 'income_summary'::"text", 'unpaid_balances'::"text", 'delinquency'::"text", 'work_order_aging'::"text", 'violation_summary'::"text"])))
);


ALTER TABLE "public"."report_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reserve_fund_settings" (
    "association_id" "uuid" NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "target_amount" numeric,
    "monthly_contribution" numeric,
    "percent_funded" numeric,
    "last_study_date" "date",
    "next_study_due" "date",
    "notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid"
);


ALTER TABLE "public"."reserve_fund_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_report_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "name" "text" NOT NULL,
    "source_key" "text" NOT NULL,
    "columns" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "filters" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."saved_report_views" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "definition_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "parameters" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "pinned" boolean DEFAULT false NOT NULL,
    "last_run_at" timestamp with time zone,
    "run_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "saved_reports_name_check" CHECK ((("length"("name") >= 1) AND ("length"("name") <= 200)))
);


ALTER TABLE "public"."saved_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedule_events" (
    "id" integer NOT NULL,
    "propertyId" integer NOT NULL,
    "companyId" integer NOT NULL,
    "title" character varying(255) NOT NULL,
    "description" "text",
    "eventType" "public"."event_type" DEFAULT 'other'::"public"."event_type" NOT NULL,
    "startTime" timestamp without time zone NOT NULL,
    "endTime" timestamp without time zone,
    "isAllDay" boolean DEFAULT false NOT NULL,
    "isRecurring" boolean DEFAULT false NOT NULL,
    "recurringPattern" character varying(50),
    "assignedToId" integer,
    "ticketId" integer,
    "createdById" integer,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."schedule_events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."schedule_events_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."schedule_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."schedule_events_id_seq" OWNED BY "public"."schedule_events"."id";



CREATE TABLE IF NOT EXISTS "public"."scheduled_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "saved_report_id" "uuid",
    "definition_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "parameters" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "frequency" "public"."schedule_frequency" NOT NULL,
    "day_of_week" smallint,
    "day_of_month" smallint,
    "hour_utc" smallint DEFAULT 8 NOT NULL,
    "next_run_at" timestamp with time zone,
    "last_run_at" timestamp with time zone,
    "output_format" "public"."report_format" DEFAULT 'pdf'::"public"."report_format" NOT NULL,
    "delivery_channel" "public"."report_delivery_channel" DEFAULT 'email'::"public"."report_delivery_channel" NOT NULL,
    "delivery_targets" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "scheduled_reports_day_of_month_check" CHECK ((("day_of_month" >= 1) AND ("day_of_month" <= 31))),
    CONSTRAINT "scheduled_reports_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6))),
    CONSTRAINT "scheduled_reports_hour_utc_check" CHECK ((("hour_utc" >= 0) AND ("hour_utc" <= 23)))
);


ALTER TABLE "public"."scheduled_reports" OWNER TO "postgres";


COMMENT ON TABLE "public"."scheduled_reports" IS 'Recurring generation. A cron job picks rows where next_run_at <= now() AND active AND archived_at IS NULL.';



CREATE TABLE IF NOT EXISTS "public"."schema_migrations" (
    "version" "text" NOT NULL,
    "checksum" "text" NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" NOT NULL,
    "duration_ms" integer,
    "error" "text",
    CONSTRAINT "schema_migrations_status_check" CHECK (("status" = ANY (ARRAY['success'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."schema_migrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "association_id" "uuid" NOT NULL,
    "unit_id" "uuid",
    "homeowner_id" "uuid",
    "owner_id" "uuid",
    "number" "text",
    "description" "text" NOT NULL,
    "priority" "public"."service_request_priority" DEFAULT 'normal'::"public"."service_request_priority" NOT NULL,
    "permission_to_enter" boolean DEFAULT false NOT NULL,
    "source" "public"."service_request_source" DEFAULT 'resident'::"public"."service_request_source" NOT NULL,
    "status" "public"."service_request_status" DEFAULT 'open'::"public"."service_request_status" NOT NULL,
    "created_on" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_by" "uuid",
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "service_requests_description_check" CHECK (("length"("description") >= 1))
);


ALTER TABLE "public"."service_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."service_requests" IS 'Maintenance ticket created by resident/staff — parent of work_orders. AppFolio §3.10.';



COMMENT ON COLUMN "public"."service_requests"."source" IS 'resident = homeowner portal, internal = staff-initiated, recurring = auto-generated from recurring_work_orders.';



CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "duration_minutes" integer DEFAULT 30 NOT NULL,
    "price_cents" integer,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shares" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "text" NOT NULL,
    "snapshot" "jsonb" NOT NULL,
    "slug" "text" DEFAULT SUBSTRING("md5"(("random"())::"text") FROM 1 FOR 10) NOT NULL,
    "title" "text",
    "description" "text",
    "view_count" integer DEFAULT 0,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "shares_resource_type_check" CHECK (("resource_type" = ANY (ARRAY['agent'::"text", 'workflow'::"text", 'query'::"text", 'file'::"text", 'note'::"text"])))
);


ALTER TABLE "public"."shares" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "association_id" "uuid",
    "with_entity_type" "text",
    "with_entity_id" "uuid",
    "with_name" "text",
    "with_phone_number" "text" NOT NULL,
    "our_phone_number" "text",
    "last_message_at" timestamp with time zone,
    "last_message_preview" "text",
    "unread_count" integer DEFAULT 0 NOT NULL,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sms_conversations_unread_count_check" CHECK (("unread_count" >= 0))
);


ALTER TABLE "public"."sms_conversations" OWNER TO "postgres";


COMMENT ON TABLE "public"."sms_conversations" IS 'Threaded texting inbox — one row per thread. with_entity_type + with_entity_id point at owner/vendor/staff; phone_number is the authoritative matcher.';



CREATE TABLE IF NOT EXISTS "public"."sms_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "direction" "public"."sms_direction" NOT NULL,
    "body" "text",
    "media_urls" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "from_number" "text" NOT NULL,
    "to_number" "text" NOT NULL,
    "provider" "text",
    "provider_message_id" "text",
    "status" "public"."sms_status" DEFAULT 'queued'::"public"."sms_status" NOT NULL,
    "error_code" "text",
    "error_message" "text",
    "sent_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "read_at" timestamp with time zone,
    "sent_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sms_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_opt_ins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "phone_number" "text" NOT NULL,
    "opted_in" boolean DEFAULT false NOT NULL,
    "opted_in_at" timestamp with time zone,
    "opted_out_at" timestamp with time zone,
    "source" "text" DEFAULT 'manual'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sms_opt_ins_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['owner'::"text", 'vendor'::"text", 'board_member'::"text", 'tenant'::"text"])))
);


ALTER TABLE "public"."sms_opt_ins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."soft_delete_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid",
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "archived_by" "uuid",
    "reason" "text",
    "prior_state" "jsonb" NOT NULL,
    "archived_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."soft_delete_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."soft_delete_log" IS 'Captures every archived_at flip. Enables undo and forensic analysis. Portfolio admins see their own portfolio only.';



CREATE TABLE IF NOT EXISTS "public"."statement_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "association_id" "uuid" NOT NULL,
    "batch_name" "text" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "delivery_channel" "text" DEFAULT 'email'::"text",
    "total_owners" integer DEFAULT 0,
    "generated_count" integer DEFAULT 0,
    "sent_count" integer DEFAULT 0,
    "failed_count" integer DEFAULT 0,
    "status" "text" DEFAULT 'draft'::"text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "statement_batches_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'generating'::"text", 'generated'::"text", 'sending'::"text", 'sent'::"text", 'partial'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."statement_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."statements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "association_id" "uuid" NOT NULL,
    "period_month" integer NOT NULL,
    "period_year" integer NOT NULL,
    "opening_balance" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_charges" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_payments" numeric(12,2) DEFAULT 0 NOT NULL,
    "closing_balance" numeric(12,2) DEFAULT 0 NOT NULL,
    "pdf_path" "text",
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "emailed_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "statements_period_month_check" CHECK ((("period_month" >= 1) AND ("period_month" <= 12))),
    CONSTRAINT "statements_period_year_check" CHECK ((("period_year" >= 2000) AND ("period_year" <= 2100)))
);


ALTER TABLE "public"."statements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subscription_id" "uuid" NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "from_tier" "public"."portfolio_tier",
    "to_tier" "public"."portfolio_tier",
    "from_status" "public"."subscription_status",
    "to_status" "public"."subscription_status",
    "actor_user_id" "uuid",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subscription_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "tier" "public"."portfolio_tier" DEFAULT 'foundation'::"public"."portfolio_tier" NOT NULL,
    "status" "public"."subscription_status" DEFAULT 'trialing'::"public"."subscription_status" NOT NULL,
    "seats_included" integer DEFAULT 5 NOT NULL,
    "seats_used" integer DEFAULT 0 NOT NULL,
    "associations_limit" integer,
    "units_limit" integer,
    "billing_email" "text",
    "price_monthly_cents" integer,
    "price_per_seat_cents" integer,
    "currency" "text" DEFAULT 'usd'::"text" NOT NULL,
    "trial_ends_at" timestamp with time zone,
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "canceled_at" timestamp with time zone,
    "cancel_at_period_end" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "subscriptions_associations_limit_check" CHECK ((("associations_limit" IS NULL) OR ("associations_limit" >= 1))),
    CONSTRAINT "subscriptions_seats_included_check" CHECK (("seats_included" >= 1)),
    CONSTRAINT "subscriptions_seats_used_check" CHECK (("seats_used" >= 0)),
    CONSTRAINT "subscriptions_units_limit_check" CHECK ((("units_limit" IS NULL) OR ("units_limit" >= 1)))
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


COMMENT ON TABLE "public"."subscriptions" IS 'One subscription per portfolio. Platform operators write; portfolio admins read-only.';



CREATE TABLE IF NOT EXISTS "public"."superadmin_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid",
    "note_type" "text" DEFAULT 'general'::"text",
    "content" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."superadmin_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."survey_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "survey_id" "uuid" NOT NULL,
    "work_order_id" "uuid",
    "submitted_by_owner_id" "uuid",
    "submitted_by_name" "text",
    "submitted_by_email" "text",
    "rating" smallint,
    "answers" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "comments" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "survey_responses_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."survey_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."surveys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "survey_type" "public"."survey_type" DEFAULT 'general'::"public"."survey_type" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "questions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "surveys_name_check" CHECK ((("length"("name") >= 1) AND ("length"("name") <= 200)))
);


ALTER TABLE "public"."surveys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tag_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "entity_type" "public"."tag_entity_type" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tag_assignments" OWNER TO "postgres";


COMMENT ON TABLE "public"."tag_assignments" IS 'Polymorphic: entity_type determines which table entity_id points at.';



CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tags_name_check" CHECK ((("length"("name") >= 1) AND ("length"("name") <= 100)))
);


ALTER TABLE "public"."tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenancies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "tenant_name" "text" NOT NULL,
    "tenant_email" "text",
    "tenant_phone" "text",
    "lease_start" "date" NOT NULL,
    "lease_end" "date",
    "rent_amount" numeric(10,2),
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tenancies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "association_id" "uuid",
    "unit_id" "uuid" NOT NULL,
    "owner_id" "uuid",
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "lease_start" "date",
    "lease_end" "date",
    "lease_document_url" "text",
    "insurance_document_url" "text",
    "emergency_contact_name" "text",
    "emergency_contact_phone" "text",
    "notes" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "insurance_expiration" "date",
    "insurance_policy_number" "text",
    CONSTRAINT "tenants_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'ended'::"text"])))
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_attachments" (
    "id" integer NOT NULL,
    "ticketId" integer NOT NULL,
    "companyId" integer NOT NULL,
    "uploadedById" integer NOT NULL,
    "fileName" character varying(255) NOT NULL,
    "fileKey" character varying(512) NOT NULL,
    "fileUrl" "text" NOT NULL,
    "mimeType" character varying(100) NOT NULL,
    "fileSize" integer NOT NULL,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ticket_attachments" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."ticket_attachments_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ticket_attachments_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."ticket_attachments_id_seq" OWNED BY "public"."ticket_attachments"."id";



CREATE TABLE IF NOT EXISTS "public"."ticket_comments" (
    "id" integer NOT NULL,
    "ticketId" integer NOT NULL,
    "authorId" integer NOT NULL,
    "content" "text" NOT NULL,
    "isInternal" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ticket_comments" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."ticket_comments_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ticket_comments_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."ticket_comments_id_seq" OWNED BY "public"."ticket_comments"."id";



CREATE TABLE IF NOT EXISTS "public"."tickets" (
    "id" integer NOT NULL,
    "propertyId" integer NOT NULL,
    "companyId" integer NOT NULL,
    "title" character varying(255) NOT NULL,
    "description" "text",
    "category" "public"."ticket_category" DEFAULT 'other'::"public"."ticket_category" NOT NULL,
    "priority" "public"."ticket_priority" DEFAULT 'medium'::"public"."ticket_priority" NOT NULL,
    "status" "public"."ticket_status" DEFAULT 'open'::"public"."ticket_status" NOT NULL,
    "reportedById" integer,
    "assignedToId" integer,
    "unitNumber" character varying(20),
    "source" "public"."ticket_source" DEFAULT 'manager'::"public"."ticket_source" NOT NULL,
    "sourceEmailId" integer,
    "dueDate" timestamp without time zone,
    "resolvedAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tickets" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tickets_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tickets_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tickets_id_seq" OWNED BY "public"."tickets"."id";



CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" integer NOT NULL,
    "propertyId" integer NOT NULL,
    "transactionType" "public"."transaction_type" NOT NULL,
    "date" timestamp without time zone NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "glAccountId" integer,
    "cashAccountId" integer,
    "vendorId" integer,
    "ownerId" integer,
    "referenceNumber" character varying(128),
    "description" "text",
    "status" "public"."transaction_status" DEFAULT 'pending'::"public"."transaction_status" NOT NULL,
    "manusAutoCreated" boolean DEFAULT false,
    "createdBy" integer,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."transactions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."transactions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."transactions_id_seq" OWNED BY "public"."transactions"."id";



CREATE TABLE IF NOT EXISTS "public"."unit_amenities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "amenity_tag_id" "uuid",
    "name" "text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."unit_amenities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."unit_pets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "owner_id" "uuid",
    "tenant_id" "uuid",
    "pet_type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "breed" "text",
    "notes" "text",
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."unit_pets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usage_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "period_year" integer NOT NULL,
    "period_month" smallint NOT NULL,
    "staff_count" integer DEFAULT 0 NOT NULL,
    "owner_count" integer DEFAULT 0 NOT NULL,
    "association_count" integer DEFAULT 0 NOT NULL,
    "unit_count" integer DEFAULT 0 NOT NULL,
    "work_orders_created" integer DEFAULT 0 NOT NULL,
    "service_requests_created" integer DEFAULT 0 NOT NULL,
    "bills_posted" integer DEFAULT 0 NOT NULL,
    "payments_received" integer DEFAULT 0 NOT NULL,
    "emails_sent" integer DEFAULT 0 NOT NULL,
    "sms_sent" integer DEFAULT 0 NOT NULL,
    "api_calls" integer DEFAULT 0 NOT NULL,
    "storage_bytes" bigint DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "usage_metrics_period_month_check" CHECK ((("period_month" >= 1) AND ("period_month" <= 12))),
    CONSTRAINT "usage_metrics_period_year_check" CHECK ((("period_year" >= 2000) AND ("period_year" <= 2100)))
);


ALTER TABLE "public"."usage_metrics" OWNER TO "postgres";


COMMENT ON TABLE "public"."usage_metrics" IS 'Per-portfolio monthly counters for billing, capacity planning, and trend analysis. Populated by a monthly aggregator job.';



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "is_system" boolean DEFAULT false NOT NULL,
    "gl_account_permissions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "profile_access" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_roles_name_check" CHECK ((("length"("name") >= 1) AND ("length"("name") <= 100)))
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_user_id" "uuid" NOT NULL,
    "portfolio_id" "uuid",
    "ip_address" "text",
    "user_agent" "text",
    "device_fingerprint" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_active_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "ended_reason" "text",
    CONSTRAINT "user_sessions_ended_reason_check" CHECK (("ended_reason" = ANY (ARRAY['logout'::"text", 'timeout'::"text", 'revoked'::"text", 'expired'::"text", 'session_limit'::"text", 'password_change'::"text"])))
);


ALTER TABLE "public"."user_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_sessions" IS 'Per-user session log with last_active + ended_reason. Populated by auth hook; revoked rows indicate forced logout.';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" integer NOT NULL,
    "openId" character varying(64) NOT NULL,
    "name" "text",
    "email" character varying(320),
    "loginMethod" character varying(64),
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "portierRole" "public"."portier_role" DEFAULT 'user'::"public"."portier_role",
    "companyId" integer,
    "avatarUrl" "text",
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "lastSignedIn" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."users_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."users_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."users_id_seq" OWNED BY "public"."users"."id";



CREATE OR REPLACE VIEW "public"."v_charge_balances" WITH ("security_invoker"='true') AS
 SELECT "id" AS "charge_id",
    "unit_id",
    "assessment_period_id",
    "charge_type",
    "description",
    "amount" AS "charged_amount",
    COALESCE(( SELECT "sum"("payment_applications"."amount_applied") AS "sum"
           FROM "public"."payment_applications"
          WHERE ("payment_applications"."charge_id" = "c"."id")), (0)::numeric) AS "applied_amount",
    ("amount" - COALESCE(( SELECT "sum"("payment_applications"."amount_applied") AS "sum"
           FROM "public"."payment_applications"
          WHERE ("payment_applications"."charge_id" = "c"."id")), (0)::numeric)) AS "balance_due",
    "due_date",
        CASE
            WHEN (("amount" - COALESCE(( SELECT "sum"("payment_applications"."amount_applied") AS "sum"
               FROM "public"."payment_applications"
              WHERE ("payment_applications"."charge_id" = "c"."id")), (0)::numeric)) <= (0)::numeric) THEN 'paid'::"text"
            WHEN (COALESCE(( SELECT "sum"("payment_applications"."amount_applied") AS "sum"
               FROM "public"."payment_applications"
              WHERE ("payment_applications"."charge_id" = "c"."id")), (0)::numeric) = (0)::numeric) THEN 'outstanding'::"text"
            ELSE 'partial'::"text"
        END AS "payment_status",
        CASE
            WHEN (("due_date" < CURRENT_DATE) AND (("amount" - COALESCE(( SELECT "sum"("payment_applications"."amount_applied") AS "sum"
               FROM "public"."payment_applications"
              WHERE ("payment_applications"."charge_id" = "c"."id")), (0)::numeric)) > (0)::numeric)) THEN true
            ELSE false
        END AS "is_past_due"
   FROM "public"."charges" "c";


ALTER VIEW "public"."v_charge_balances" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_charge_balances" IS 'Per-charge balance = charged - sum(payment_applications.amount_applied). This is the live status of every charge.';



CREATE OR REPLACE VIEW "public"."v_charges_by_category" WITH ("security_invoker"='true') AS
 SELECT "a"."portfolio_id",
    "a"."id" AS "association_id",
    "a"."name" AS "association_name",
    "cc"."id" AS "category_id",
    "cc"."name" AS "category_name",
    "cc"."code" AS "category_code",
    "cc"."is_assessment",
    "cc"."is_fee",
    ("date_trunc"('month'::"text", ("c"."due_date")::timestamp with time zone))::"date" AS "period_month",
    "count"(*) AS "charge_count",
    "sum"("c"."amount") AS "total_charged",
    "sum"(COALESCE(( SELECT "sum"("payment_applications"."amount_applied") AS "sum"
           FROM "public"."payment_applications"
          WHERE ("payment_applications"."charge_id" = "c"."id")), (0)::numeric)) AS "total_applied",
    "sum"(("c"."amount" - COALESCE(( SELECT "sum"("payment_applications"."amount_applied") AS "sum"
           FROM "public"."payment_applications"
          WHERE ("payment_applications"."charge_id" = "c"."id")), (0)::numeric))) AS "outstanding_balance"
   FROM (((("public"."charges" "c"
     JOIN "public"."units" "u" ON (("u"."id" = "c"."unit_id")))
     JOIN "public"."buildings" "b" ON (("b"."id" = "u"."building_id")))
     JOIN "public"."associations" "a" ON (("a"."id" = "b"."association_id")))
     LEFT JOIN "public"."charge_categories" "cc" ON (("cc"."id" = "c"."charge_category_id")))
  GROUP BY "a"."portfolio_id", "a"."id", "a"."name", "cc"."id", "cc"."name", "cc"."code", "cc"."is_assessment", "cc"."is_fee", ("date_trunc"('month'::"text", ("c"."due_date")::timestamp with time zone));


ALTER VIEW "public"."v_charges_by_category" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_check_writing_queue" WITH ("security_invoker"='true') AS
 SELECT "pb"."id" AS "bill_id",
    "pb"."portfolio_id",
    "pb"."vendor_id",
    "v"."name" AS "vendor_name",
    "v"."address_street",
    "v"."address_city",
    "v"."address_state",
    "v"."address_zip",
    "pb"."association_id",
    "a"."name" AS "association_name",
    "pb"."amount",
    "pb"."bill_date",
    "pb"."due_date",
    "pb"."memo",
    "pb"."gl_account_id",
    "pb"."bank_account_id",
    (CURRENT_DATE - "pb"."due_date") AS "days_past_due"
   FROM (("public"."payable_bills" "pb"
     JOIN "public"."vendors" "v" ON (("v"."id" = "pb"."vendor_id")))
     LEFT JOIN "public"."associations" "a" ON (("a"."id" = "pb"."association_id")))
  WHERE (("pb"."archived_at" IS NULL) AND ("pb"."status" = 'approved'::"public"."payable_bill_status") AND ("pb"."paid_at" IS NULL) AND ("v"."payment_type" = 'check'::"public"."vendor_payment_type") AND (NOT "v"."is_auto_pay"))
  ORDER BY "pb"."due_date", "v"."name";


ALTER VIEW "public"."v_check_writing_queue" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_check_writing_queue" IS 'Bills awaiting check-writing: approved, unpaid, vendor pays by check, not auto-pay. Used by the weekly check run UI.';



CREATE TABLE IF NOT EXISTS "public"."violation_cases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "association_id" "uuid" NOT NULL,
    "reporter_name" "text" NOT NULL,
    "reporter_unit" "text",
    "reporter_contact" "text" NOT NULL,
    "reporter_is_owner" boolean DEFAULT false,
    "violator_name" "text",
    "violator_unit" "text",
    "house_rule_id" "uuid",
    "violation_type" "text" NOT NULL,
    "violation_description" "text" NOT NULL,
    "dates_times" "text",
    "witnesses" "text",
    "previously_reported" boolean DEFAULT false,
    "requested_action" "text" DEFAULT 'warning'::"text",
    "reporter_signature" "text" NOT NULL,
    "status" "text" DEFAULT 'reported'::"text",
    "reported_at" timestamp with time zone DEFAULT "now"(),
    "notice_sent_at" timestamp with time zone,
    "hearing_requested_at" timestamp with time zone,
    "hearing_date" timestamp with time zone,
    "hearing_location" "text",
    "hearing_type" "text" DEFAULT 'in_person'::"text",
    "determined_at" timestamp with time zone,
    "fine_amount" numeric(12,2),
    "fine_applied_at" timestamp with time zone,
    "determination_notes" "text",
    "determined_by" "uuid",
    "owner_contested" boolean DEFAULT false,
    "ack_share_info" boolean DEFAULT false,
    "ack_true_accurate" boolean DEFAULT false,
    "ack_may_contact" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "archived_at" timestamp with time zone,
    "ai_severity" "text",
    "ai_confidence" integer
);


ALTER TABLE "public"."violation_cases" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_company_health" AS
 WITH "assoc_health" AS (
         SELECT "a"."portfolio_id",
            "a"."id" AS "association_id",
            "a"."unit_count",
            "a"."status" AS "assoc_status",
            "count"(DISTINCT "wo"."id") FILTER (WHERE ("wo"."status" = ANY (ARRAY['new'::"public"."work_order_status", 'in_progress'::"public"."work_order_status", 'scheduled'::"public"."work_order_status"]))) AS "open_wos",
            "count"(DISTINCT "wo"."id") FILTER (WHERE (("wo"."status" = ANY (ARRAY['new'::"public"."work_order_status", 'in_progress'::"public"."work_order_status", 'scheduled'::"public"."work_order_status"])) AND ("wo"."scheduled_date" < CURRENT_DATE))) AS "overdue_wos",
            "count"(DISTINCT "vc"."id") FILTER (WHERE (("vc"."status" <> ALL (ARRAY['closed'::"text", 'violation_dismissed'::"text"])) AND ("vc"."archived_at" IS NULL))) AS "open_violations",
            COALESCE("avg"((EXTRACT(epoch FROM (("wo"."completed_date")::timestamp with time zone - "wo"."created_at")) / 3600.0)) FILTER (WHERE ("wo"."completed_date" IS NOT NULL)), (0)::numeric) AS "avg_response_hours"
           FROM (("public"."associations" "a"
             LEFT JOIN "public"."work_orders" "wo" ON ((("wo"."association_id" = "a"."id") AND ("wo"."archived_at" IS NULL))))
             LEFT JOIN "public"."violation_cases" "vc" ON (("vc"."association_id" = "a"."id")))
          WHERE ("a"."archived_at" IS NULL)
          GROUP BY "a"."portfolio_id", "a"."id", "a"."unit_count", "a"."status"
        )
 SELECT "p"."id" AS "portfolio_id",
    "count"(DISTINCT "ah"."association_id") AS "total_associations",
    COALESCE("sum"("ah"."unit_count"), (0)::bigint) AS "total_doors",
    "count"(DISTINCT "ah"."association_id") FILTER (WHERE (("ah"."open_wos" = 0) AND ("ah"."open_violations" = 0))) AS "healthy_count",
    "count"(DISTINCT "ah"."association_id") FILTER (WHERE ((("ah"."open_wos" >= 1) AND ("ah"."open_wos" <= 3)) OR (("ah"."open_violations" >= 1) AND ("ah"."open_violations" <= 2)))) AS "warning_count",
    "count"(DISTINCT "ah"."association_id") FILTER (WHERE (("ah"."open_wos" > 3) OR ("ah"."open_violations" > 2) OR ("ah"."overdue_wos" > 0))) AS "critical_count",
    COALESCE("sum"("ah"."open_wos"), (0)::numeric) AS "open_work_orders",
    COALESCE("sum"("ah"."overdue_wos"), (0)::numeric) AS "overdue_work_orders",
    COALESCE("sum"("ah"."open_violations"), (0)::numeric) AS "open_violations",
    COALESCE("avg"("ah"."avg_response_hours") FILTER (WHERE ("ah"."avg_response_hours" > (0)::numeric)), (0)::numeric) AS "avg_response_hours",
    COALESCE(( SELECT "sum"("mf"."delinquent_cents") AS "sum"
           FROM "public"."management_fees" "mf"
          WHERE (("mf"."portfolio_id" = "p"."id") AND ("mf"."month" = ("date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone))::"date"))), (0)::bigint) AS "delinquency_total_cents"
   FROM ("public"."portfolios" "p"
     LEFT JOIN "assoc_health" "ah" ON (("ah"."portfolio_id" = "p"."id")))
  WHERE "public"."can_access_portfolio"("p"."id")
  GROUP BY "p"."id";


ALTER VIEW "public"."v_company_health" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_company_metrics" AS
 SELECT "p"."id" AS "portfolio_id",
    'current_month'::"text" AS "period",
    COALESCE(( SELECT "sum"("mf"."collected_cents") AS "sum"
           FROM "public"."management_fees" "mf"
          WHERE (("mf"."portfolio_id" = "p"."id") AND ("mf"."month" = ("date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone))::"date"))), (0)::bigint) AS "total_revenue_cents",
    COALESCE(( SELECT "sum"("mf"."fee_amount_cents") AS "sum"
           FROM "public"."management_fees" "mf"
          WHERE (("mf"."portfolio_id" = "p"."id") AND ("mf"."month" = ("date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone))::"date"))), (0)::bigint) AS "management_fee_income_cents",
    COALESCE(( SELECT "count"(DISTINCT "am"."user_id") AS "count"
           FROM ("public"."association_managers" "am"
             JOIN "public"."associations" "a_1" ON (("a_1"."id" = "am"."association_id")))
          WHERE (("a_1"."portfolio_id" = "p"."id") AND ("a_1"."archived_at" IS NULL) AND ("am"."ended_at" IS NULL))), (0)::bigint) AS "active_managers",
    COALESCE("sum"("a"."unit_count"), (0)::bigint) AS "total_doors",
    COALESCE(( SELECT "bu"."doors_active"
           FROM "public"."billing_usage" "bu"
          WHERE (("bu"."portfolio_id" = "p"."id") AND ("bu"."status" = 'active'::"text"))
          ORDER BY "bu"."period_end" DESC
         LIMIT 1), 0) AS "doors_used",
    COALESCE(( SELECT "bu"."doors_limit"
           FROM "public"."billing_usage" "bu"
          WHERE (("bu"."portfolio_id" = "p"."id") AND ("bu"."status" = 'active'::"text"))
          ORDER BY "bu"."period_end" DESC
         LIMIT 1), 0) AS "doors_limit",
    COALESCE(( SELECT "bu"."status"
           FROM "public"."billing_usage" "bu"
          WHERE (("bu"."portfolio_id" = "p"."id") AND ("bu"."status" = 'active'::"text"))
          ORDER BY "bu"."period_end" DESC
         LIMIT 1), 'inactive'::"text") AS "subscription_status"
   FROM ("public"."portfolios" "p"
     LEFT JOIN "public"."associations" "a" ON ((("a"."portfolio_id" = "p"."id") AND ("a"."archived_at" IS NULL))))
  WHERE "public"."can_access_portfolio"("p"."id")
  GROUP BY "p"."id";


ALTER VIEW "public"."v_company_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendor_compliance" (
    "vendor_id" "uuid" NOT NULL,
    "workers_comp_expiration" "date",
    "general_liability_expiration" "date",
    "epa_certification_expiration" "date",
    "auto_insurance_expiration" "date",
    "state_license_expiration" "date",
    "contract_expiration" "date",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."vendor_compliance" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_insurance_expirations" WITH ("security_invoker"='true') AS
 SELECT "v"."portfolio_id",
    "v"."id" AS "vendor_id",
    "v"."name" AS "vendor_name",
    "vc"."workers_comp_expiration",
    "vc"."general_liability_expiration",
    "vc"."auto_insurance_expiration",
    "vc"."epa_certification_expiration",
    "vc"."state_license_expiration",
    LEAST("vc"."workers_comp_expiration", "vc"."general_liability_expiration", "vc"."auto_insurance_expiration", "vc"."epa_certification_expiration", "vc"."state_license_expiration", "vc"."contract_expiration") AS "soonest_expiration"
   FROM ("public"."vendors" "v"
     JOIN "public"."vendor_compliance" "vc" ON (("vc"."vendor_id" = "v"."id")))
  WHERE (("v"."archived_at" IS NULL) AND ((LEAST("vc"."workers_comp_expiration", "vc"."general_liability_expiration", "vc"."auto_insurance_expiration", "vc"."epa_certification_expiration", "vc"."state_license_expiration", "vc"."contract_expiration") >= CURRENT_DATE) AND (LEAST("vc"."workers_comp_expiration", "vc"."general_liability_expiration", "vc"."auto_insurance_expiration", "vc"."epa_certification_expiration", "vc"."state_license_expiration", "vc"."contract_expiration") <= (CURRENT_DATE + '60 days'::interval))));


ALTER VIEW "public"."v_insurance_expirations" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_dashboard_summary" WITH ("security_invoker"='true') AS
 SELECT "id" AS "portfolio_id",
    "company_name",
    "tier",
    "suspended_at",
    COALESCE(( SELECT (("count"(*))::numeric / (NULLIF("count"(*), 0))::numeric)
           FROM "public"."payments" "pm"
          WHERE (("pm"."payment_date" > (CURRENT_DATE - '30 days'::interval)) AND (EXISTS ( SELECT 1
                   FROM (("public"."units" "u"
                     JOIN "public"."buildings" "b" ON (("b"."id" = "u"."building_id")))
                     JOIN "public"."associations" "a" ON (("a"."id" = "b"."association_id")))
                  WHERE (("u"."id" = "pm"."unit_id") AND ("a"."portfolio_id" = "p"."id")))))), (0)::numeric) AS "recent_payment_count",
    ( SELECT "count"(*) AS "count"
           FROM "public"."owners" "o"
          WHERE (("o"."portfolio_id" = "p"."id") AND "o"."portal_activated")) AS "portal_activated_count",
    ( SELECT "count"(*) AS "count"
           FROM "public"."owners" "o"
          WHERE (("o"."portfolio_id" = "p"."id") AND (NOT "o"."portal_activated") AND ("o"."email" IS NOT NULL))) AS "portal_not_activated_count",
    ( SELECT "count"(*) AS "count"
           FROM "public"."owners" "o"
          WHERE (("o"."portfolio_id" = "p"."id") AND (("o"."email" IS NULL) OR ("o"."email" = ''::"text")))) AS "portal_no_email_count",
    ( SELECT "count"(*) AS "count"
           FROM ((("public"."charges" "c"
             JOIN "public"."units" "u" ON (("u"."id" = "c"."unit_id")))
             JOIN "public"."buildings" "b" ON (("b"."id" = "u"."building_id")))
             JOIN "public"."associations" "a" ON (("a"."id" = "b"."association_id")))
          WHERE (("a"."portfolio_id" = "p"."id") AND (("c"."due_date" >= (CURRENT_DATE - '30 days'::interval)) AND ("c"."due_date" <= (CURRENT_DATE - '1 day'::interval))) AND (("c"."amount" - COALESCE(( SELECT "sum"("payment_applications"."amount_applied") AS "sum"
                   FROM "public"."payment_applications"
                  WHERE ("payment_applications"."charge_id" = "c"."id")), (0)::numeric)) > (0)::numeric))) AS "delinquency_0_30",
    ( SELECT "count"(*) AS "count"
           FROM ((("public"."charges" "c"
             JOIN "public"."units" "u" ON (("u"."id" = "c"."unit_id")))
             JOIN "public"."buildings" "b" ON (("b"."id" = "u"."building_id")))
             JOIN "public"."associations" "a" ON (("a"."id" = "b"."association_id")))
          WHERE (("a"."portfolio_id" = "p"."id") AND (("c"."due_date" >= (CURRENT_DATE - '60 days'::interval)) AND ("c"."due_date" <= (CURRENT_DATE - '31 days'::interval))) AND (("c"."amount" - COALESCE(( SELECT "sum"("payment_applications"."amount_applied") AS "sum"
                   FROM "public"."payment_applications"
                  WHERE ("payment_applications"."charge_id" = "c"."id")), (0)::numeric)) > (0)::numeric))) AS "delinquency_31_60",
    ( SELECT "count"(*) AS "count"
           FROM ((("public"."charges" "c"
             JOIN "public"."units" "u" ON (("u"."id" = "c"."unit_id")))
             JOIN "public"."buildings" "b" ON (("b"."id" = "u"."building_id")))
             JOIN "public"."associations" "a" ON (("a"."id" = "b"."association_id")))
          WHERE (("a"."portfolio_id" = "p"."id") AND ("c"."due_date" < (CURRENT_DATE - '60 days'::interval)) AND (("c"."amount" - COALESCE(( SELECT "sum"("payment_applications"."amount_applied") AS "sum"
                   FROM "public"."payment_applications"
                  WHERE ("payment_applications"."charge_id" = "c"."id")), (0)::numeric)) > (0)::numeric))) AS "delinquency_61_plus",
    ( SELECT "count"(*) AS "count"
           FROM "public"."work_orders" "w"
          WHERE (("w"."portfolio_id" = "p"."id") AND ("w"."archived_at" IS NULL) AND ("w"."status" = 'new'::"public"."work_order_status"))) AS "wo_new",
    ( SELECT "count"(*) AS "count"
           FROM "public"."work_orders" "w"
          WHERE (("w"."portfolio_id" = "p"."id") AND ("w"."archived_at" IS NULL) AND ("w"."status" = 'assigned'::"public"."work_order_status"))) AS "wo_assigned",
    ( SELECT "count"(*) AS "count"
           FROM "public"."work_orders" "w"
          WHERE (("w"."portfolio_id" = "p"."id") AND ("w"."archived_at" IS NULL) AND ("w"."status" = 'scheduled'::"public"."work_order_status"))) AS "wo_scheduled",
    ( SELECT "count"(*) AS "count"
           FROM "public"."work_orders" "w"
          WHERE (("w"."portfolio_id" = "p"."id") AND ("w"."archived_at" IS NULL) AND ("w"."status" = 'in_progress'::"public"."work_order_status"))) AS "wo_in_progress",
    ( SELECT "count"(*) AS "count"
           FROM "public"."work_orders" "w"
          WHERE (("w"."portfolio_id" = "p"."id") AND ("w"."archived_at" IS NULL) AND ("w"."status" = 'completed'::"public"."work_order_status"))) AS "wo_completed",
    ( SELECT "count"(*) AS "count"
           FROM "public"."work_orders" "w"
          WHERE (("w"."portfolio_id" = "p"."id") AND ("w"."archived_at" IS NULL))) AS "wo_total",
    ( SELECT "count"(*) AS "count"
           FROM "public"."approval_requests" "ar"
          WHERE (("ar"."portfolio_id" = "p"."id") AND ("ar"."status" = 'pending'::"public"."approval_request_status"))) AS "pending_approvals",
    ( SELECT "count"(*) AS "count"
           FROM "public"."income_recertifications" "r"
          WHERE (("r"."portfolio_id" = "p"."id") AND ("r"."status" <> ALL (ARRAY['approved'::"public"."recert_status", 'rejected'::"public"."recert_status"])) AND ("r"."due_date" <= (CURRENT_DATE + '30 days'::interval)))) AS "upcoming_recerts",
    ( SELECT "count"(*) AS "count"
           FROM "public"."v_insurance_expirations" "ie"
          WHERE ("ie"."portfolio_id" = "p"."id")) AS "insurance_expirations_60d",
    ( SELECT "count"(*) AS "count"
           FROM "public"."data_diagnostics" "d"
          WHERE (("d"."portfolio_id" = "p"."id") AND ("d"."resolved_at" IS NULL))) AS "open_diagnostics",
    ( SELECT "count"(*) AS "count"
           FROM "public"."payable_bills" "pb"
          WHERE (("pb"."portfolio_id" = "p"."id") AND ("pb"."archived_at" IS NULL) AND ("pb"."status" = ANY (ARRAY['pending_approval'::"public"."payable_bill_status", 'approved'::"public"."payable_bill_status"])) AND ("pb"."paid_at" IS NULL))) AS "outstanding_bills",
        CASE
            WHEN (( SELECT "count"(*) AS "count"
               FROM (("public"."units" "u"
                 JOIN "public"."buildings" "b" ON (("b"."id" = "u"."building_id")))
                 JOIN "public"."associations" "a" ON (("a"."id" = "b"."association_id")))
              WHERE (("a"."portfolio_id" = "p"."id") AND ("u"."archived_at" IS NULL))) = 0) THEN (0)::numeric
            ELSE (((100.0 * (( SELECT "count"(*) AS "count"
               FROM ((("public"."occupancies" "occ"
                 JOIN "public"."units" "u" ON (("u"."id" = "occ"."unit_id")))
                 JOIN "public"."buildings" "b" ON (("b"."id" = "u"."building_id")))
                 JOIN "public"."associations" "a" ON (("a"."id" = "b"."association_id")))
              WHERE (("a"."portfolio_id" = "p"."id") AND ("occ"."status" = 'current'::"public"."occupancy_status"))))::numeric) / (NULLIF(( SELECT "count"(*) AS "count"
               FROM (("public"."units" "u"
                 JOIN "public"."buildings" "b" ON (("b"."id" = "u"."building_id")))
                 JOIN "public"."associations" "a" ON (("a"."id" = "b"."association_id")))
              WHERE (("a"."portfolio_id" = "p"."id") AND ("u"."archived_at" IS NULL))), 0))::numeric))::numeric(5,2)
        END AS "occupancy_pct"
   FROM "public"."portfolios" "p";


ALTER VIEW "public"."v_dashboard_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_dashboard_summary" IS 'One row per portfolio. Powers the main admin dashboard widgets. Security-invoker — respects caller''s RLS via underlying tables.';



CREATE OR REPLACE VIEW "public"."v_due_reminders" AS
 SELECT "ce"."id" AS "event_id",
    "ce"."portfolio_id",
    "ce"."association_id",
    "a"."name" AS "association_name",
    "ce"."title",
    "ce"."event_type",
    "ce"."calendar_scope",
    "ce"."start_datetime",
    "ce"."reminder_days_before",
    ("ce"."start_datetime" - (("ce"."reminder_days_before" || ' days'::"text"))::interval) AS "reminder_start",
    "ce"."location",
    "ce"."description"
   FROM ("public"."calendar_events" "ce"
     LEFT JOIN "public"."associations" "a" ON (("a"."id" = "ce"."association_id")))
  WHERE (("ce"."archived_at" IS NULL) AND ("ce"."reminder_days_before" IS NOT NULL) AND ("ce"."reminder_acknowledged_at" IS NULL) AND ("now"() >= ("ce"."start_datetime" - (("ce"."reminder_days_before" || ' days'::"text"))::interval)) AND ("now"() <= "ce"."start_datetime") AND "public"."can_access_portfolio"("ce"."portfolio_id"));


ALTER VIEW "public"."v_due_reminders" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_homeowner_ledgers" WITH ("security_invoker"='true') AS
 SELECT "o"."id" AS "owner_id",
    "o"."full_name" AS "owner_name",
    "o"."email",
    "a"."portfolio_id",
    "a"."id" AS "association_id",
    "a"."name" AS "association_name",
    "u"."id" AS "unit_id",
    "u"."unit_number",
    ( SELECT COALESCE("sum"("c"."amount"), (0)::numeric) AS "coalesce"
           FROM "public"."charges" "c"
          WHERE ("c"."unit_id" = "u"."id")) AS "lifetime_charges",
    ( SELECT COALESCE("sum"("p"."amount"), (0)::numeric) AS "coalesce"
           FROM "public"."payments" "p"
          WHERE ("p"."unit_id" = "u"."id")) AS "lifetime_payments",
    COALESCE("ub"."balance", (0)::numeric) AS "current_balance",
    ( SELECT "count"(*) AS "count"
           FROM "public"."charges" "c"
          WHERE (("c"."unit_id" = "u"."id") AND ("c"."due_date" < CURRENT_DATE) AND (("c"."amount" - COALESCE(( SELECT "sum"("payments"."amount") AS "sum"
                   FROM "public"."payments"
                  WHERE ("payments"."charge_id" = "c"."id")), (0)::numeric)) > (0)::numeric))) AS "open_past_due_count"
   FROM ((((("public"."owners" "o"
     JOIN "public"."occupancies" "occ" ON ((("occ"."owner_id" = "o"."id") AND ("occ"."status" = 'current'::"public"."occupancy_status"))))
     JOIN "public"."units" "u" ON (("u"."id" = "occ"."unit_id")))
     JOIN "public"."buildings" "b" ON (("b"."id" = "u"."building_id")))
     JOIN "public"."associations" "a" ON (("a"."id" = "b"."association_id")))
     LEFT JOIN "public"."unit_balances" "ub" ON (("ub"."unit_id" = "u"."id")))
  WHERE (("o"."archived_at" IS NULL) AND ("u"."archived_at" IS NULL));


ALTER VIEW "public"."v_homeowner_ledgers" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_manager_workload" AS
 SELECT "pr"."id" AS "manager_id",
    "pr"."full_name" AS "manager_name",
    "pr"."email" AS "manager_email",
    "count"(DISTINCT "am"."association_id") AS "assigned_associations",
    COALESCE("sum"("a"."unit_count"), (0)::bigint) AS "total_doors_managed",
    "count"(DISTINCT "wo"."id") FILTER (WHERE ("wo"."status" = ANY (ARRAY['new'::"public"."work_order_status", 'in_progress'::"public"."work_order_status", 'scheduled'::"public"."work_order_status"]))) AS "open_work_orders",
    "count"(DISTINCT "wo"."id") FILTER (WHERE (("wo"."status" = ANY (ARRAY['new'::"public"."work_order_status", 'in_progress'::"public"."work_order_status", 'scheduled'::"public"."work_order_status"])) AND ("wo"."scheduled_date" < CURRENT_DATE))) AS "overdue_work_orders",
    "count"(DISTINCT "vc"."id") FILTER (WHERE (("vc"."status" <> ALL (ARRAY['closed'::"text", 'violation_dismissed'::"text"])) AND ("vc"."archived_at" IS NULL))) AS "open_violations",
    ("count"(DISTINCT "ar"."id") FILTER (WHERE ("ar"."status" = ANY (ARRAY['submitted'::"text", 'under_review'::"text", 'more_info'::"text"]))))::integer AS "open_arch_reviews",
    NULL::timestamp with time zone AS "last_login"
   FROM ((((("public"."profiles" "pr"
     JOIN "public"."association_managers" "am" ON ((("am"."user_id" = "pr"."id") AND ("am"."ended_at" IS NULL))))
     JOIN "public"."associations" "a" ON ((("a"."id" = "am"."association_id") AND ("a"."archived_at" IS NULL))))
     LEFT JOIN "public"."work_orders" "wo" ON ((("wo"."association_id" = "a"."id") AND ("wo"."archived_at" IS NULL))))
     LEFT JOIN "public"."violation_cases" "vc" ON (("vc"."association_id" = "a"."id")))
     LEFT JOIN "public"."architectural_requests" "ar" ON (("ar"."association_id" = "a"."id")))
  WHERE ((("pr"."hoa_role" = ANY (ARRAY['manager'::"public"."hoa_role", 'company_admin'::"public"."hoa_role"])) OR (EXISTS ( SELECT 1
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."id" = "pr"."role_id") AND ("ur"."name" = ANY (ARRAY['President'::"text", 'Property Manager'::"text", 'Accountant'::"text"])))))) AND "public"."can_access_portfolio"("a"."portfolio_id"))
  GROUP BY "pr"."id", "pr"."full_name", "pr"."email";


ALTER VIEW "public"."v_manager_workload" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_pending_invitations" WITH ("security_invoker"='true') AS
 SELECT "inv"."id",
    "inv"."portfolio_id",
    "p"."company_name" AS "portfolio_name",
    "inv"."email",
    "inv"."hoa_role",
    "ur"."name" AS "role_name",
    "inv"."expires_at",
    "inv"."invited_by",
    "inv"."created_at",
    "inv"."message"
   FROM (("public"."user_invitations" "inv"
     JOIN "public"."portfolios" "p" ON (("p"."id" = "inv"."portfolio_id")))
     LEFT JOIN "public"."user_roles" "ur" ON (("ur"."id" = "inv"."role_id")))
  WHERE (("inv"."status" = 'pending'::"public"."invitation_status") AND ("inv"."expires_at" > "now"()));


ALTER VIEW "public"."v_pending_invitations" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_pending_invitations" IS 'Open invitations per portfolio. Inherits RLS from user_invitations.';



CREATE TABLE IF NOT EXISTS "public"."webhook_deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "endpoint_id" "uuid" NOT NULL,
    "event_type" "public"."webhook_event" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "status" "public"."webhook_delivery_status" DEFAULT 'pending'::"public"."webhook_delivery_status" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "next_attempt_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_attempt_at" timestamp with time zone,
    "succeeded_at" timestamp with time zone,
    "response_code" integer,
    "response_body" "text",
    "error_message" "text",
    "signature" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."webhook_deliveries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhook_endpoints" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "url" "text" NOT NULL,
    "signing_secret" "text" DEFAULT ("replace"(("gen_random_uuid"())::"text", '-'::"text", ''::"text") || "replace"(("gen_random_uuid"())::"text", '-'::"text", ''::"text")) NOT NULL,
    "events" "public"."webhook_event"[] DEFAULT '{}'::"public"."webhook_event"[] NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "failure_count" integer DEFAULT 0 NOT NULL,
    "disabled_until" timestamp with time zone,
    "last_success_at" timestamp with time zone,
    "last_failure_at" timestamp with time zone,
    "last_failure_message" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "webhook_endpoints_name_check" CHECK ((("length"("name") >= 1) AND ("length"("name") <= 200))),
    CONSTRAINT "webhook_endpoints_url_check" CHECK (("url" ~ '^https?://'::"text"))
);


ALTER TABLE "public"."webhook_endpoints" OWNER TO "postgres";


COMMENT ON TABLE "public"."webhook_endpoints" IS 'Portfolio-scoped outbound webhook URLs. signing_secret is used for HMAC-SHA256 signatures. After 10 consecutive failures, auto-disabled_until is set.';



CREATE OR REPLACE VIEW "public"."v_portfolio_health" WITH ("security_invoker"='true') AS
 SELECT "p"."id" AS "portfolio_id",
    "p"."company_name",
    "p"."tier",
    "p"."suspended_at",
    "s"."status" AS "subscription_status",
    "s"."seats_used",
    "s"."seats_included",
    ( SELECT "count"(*) AS "count"
           FROM "public"."associations" "a"
          WHERE (("a"."portfolio_id" = "p"."id") AND ("a"."archived_at" IS NULL))) AS "association_count",
    ( SELECT "count"(*) AS "count"
           FROM (("public"."units" "u"
             JOIN "public"."buildings" "b" ON (("b"."id" = "u"."building_id")))
             JOIN "public"."associations" "a" ON (("a"."id" = "b"."association_id")))
          WHERE (("a"."portfolio_id" = "p"."id") AND ("u"."archived_at" IS NULL))) AS "unit_count",
    ( SELECT "count"(*) AS "count"
           FROM "public"."user_invitations" "inv"
          WHERE (("inv"."portfolio_id" = "p"."id") AND ("inv"."status" = 'pending'::"public"."invitation_status"))) AS "pending_invitations",
    ( SELECT "count"(*) AS "count"
           FROM "public"."login_attempts" "la"
          WHERE (("la"."portfolio_id" = "p"."id") AND ("la"."at" > ("now"() - '24:00:00'::interval)) AND (NOT "la"."success"))) AS "failed_logins_24h",
    ( SELECT "count"(*) AS "count"
           FROM ("public"."webhook_deliveries" "wd"
             JOIN "public"."webhook_endpoints" "we" ON (("we"."id" = "wd"."endpoint_id")))
          WHERE (("we"."portfolio_id" = "p"."id") AND ("wd"."status" = 'abandoned'::"public"."webhook_delivery_status") AND ("wd"."created_at" > ("now"() - '7 days'::interval)))) AS "abandoned_webhooks_7d"
   FROM ("public"."portfolios" "p"
     LEFT JOIN "public"."subscriptions" "s" ON (("s"."portfolio_id" = "p"."id")));


ALTER VIEW "public"."v_portfolio_health" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_portfolio_health" IS 'One-row-per-portfolio health snapshot for the platform admin panel. Inherits RLS from underlying tables.';



CREATE OR REPLACE VIEW "public"."v_role_permissions" AS
 SELECT "role",
    "scope",
    "view_associations",
    "edit_associations",
    "view_financials",
    "edit_financials",
    "manage_owners",
    "create_work_orders",
    "send_notices",
    "invite_users",
    "assign_managers"
   FROM ( VALUES ('super_admin'::"text",'platform'::"text",true,true,true,true,true,true,true,true,true), ('company_admin'::"text",'company'::"text",true,true,true,true,true,true,true,true,true), ('accountant'::"text",'company'::"text",true,true,true,true,false,false,false,false,false), ('manager'::"text",'assigned_assocs'::"text",true,true,true,true,true,true,true,false,false), ('assistant_manager'::"text",'assigned_assocs'::"text",true,false,true,false,false,false,false,false,false), ('board_member'::"text",'own_assoc'::"text",true,false,true,false,false,false,false,false,false), ('owner'::"text",'own_unit'::"text",true,false,false,false,false,false,false,false,false), ('tenant'::"text",'own_unit'::"text",true,false,false,false,false,false,false,false,false)) "t"("role", "scope", "view_associations", "edit_associations", "view_financials", "edit_financials", "manage_owners", "create_work_orders", "send_notices", "invite_users", "assign_managers");


ALTER VIEW "public"."v_role_permissions" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_role_permissions" IS 'Reference matrix of role → permission. Used by the UI to show/hide buttons and by docs. Actual enforcement happens in RLS policies and route guards.';



CREATE OR REPLACE VIEW "public"."v_unapplied_credits" WITH ("security_invoker"='true') AS
 SELECT "id" AS "payment_id",
    "unit_id",
    "payment_date",
    "amount",
    COALESCE(( SELECT "sum"("payment_applications"."amount_applied") AS "sum"
           FROM "public"."payment_applications"
          WHERE ("payment_applications"."payment_id" = "p"."id")), (0)::numeric) AS "applied_amount",
    ("amount" - COALESCE(( SELECT "sum"("payment_applications"."amount_applied") AS "sum"
           FROM "public"."payment_applications"
          WHERE ("payment_applications"."payment_id" = "p"."id")), (0)::numeric)) AS "unapplied_amount"
   FROM "public"."payments" "p"
  WHERE (("amount" - COALESCE(( SELECT "sum"("payment_applications"."amount_applied") AS "sum"
           FROM "public"."payment_applications"
          WHERE ("payment_applications"."payment_id" = "p"."id")), (0)::numeric)) > 0.005);


ALTER VIEW "public"."v_unapplied_credits" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_unapplied_credits" IS 'Payments that still have an unapplied balance (homeowner credits / prepayments).';



CREATE OR REPLACE VIEW "public"."v_unit_account_summary" WITH ("security_invoker"='true') AS
 SELECT "u"."id" AS "unit_id",
    "u"."unit_number",
    "b"."association_id",
    "a"."portfolio_id",
    COALESCE(( SELECT "sum"("charges"."amount") AS "sum"
           FROM "public"."charges"
          WHERE ("charges"."unit_id" = "u"."id")), (0)::numeric) AS "total_charged",
    COALESCE(( SELECT "sum"("payments"."amount") AS "sum"
           FROM "public"."payments"
          WHERE ("payments"."unit_id" = "u"."id")), (0)::numeric) AS "total_paid",
    COALESCE(( SELECT "sum"("pa"."amount_applied") AS "sum"
           FROM ("public"."payment_applications" "pa"
             JOIN "public"."charges" "c" ON (("c"."id" = "pa"."charge_id")))
          WHERE ("c"."unit_id" = "u"."id")), (0)::numeric) AS "total_applied",
    COALESCE(( SELECT "sum"("vcb"."balance_due") AS "sum"
           FROM "public"."v_charge_balances" "vcb"
          WHERE (("vcb"."unit_id" = "u"."id") AND ("vcb"."balance_due" > (0)::numeric))), (0)::numeric) AS "outstanding_balance",
    COALESCE(( SELECT "sum"("vuc"."unapplied_amount") AS "sum"
           FROM "public"."v_unapplied_credits" "vuc"
          WHERE ("vuc"."unit_id" = "u"."id")), (0)::numeric) AS "unapplied_credit"
   FROM (("public"."units" "u"
     JOIN "public"."buildings" "b" ON (("b"."id" = "u"."building_id")))
     JOIN "public"."associations" "a" ON (("a"."id" = "b"."association_id")))
  WHERE ("u"."archived_at" IS NULL);


ALTER VIEW "public"."v_unit_account_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_unit_charge_schedule" AS
 SELECT "urc"."id" AS "recurring_charge_id",
    "urc"."unit_id",
    "u"."unit_number",
    "b"."association_id",
    "a"."name" AS "association_name",
    "a"."portfolio_id",
    "cc"."id" AS "charge_category_id",
    "cc"."name" AS "category_name",
    "cc"."code" AS "category_code",
    "cc"."charge_type",
    "cc"."is_assessment",
    "cc"."is_fee",
    "urc"."amount",
    "urc"."frequency",
    "urc"."start_date",
    "urc"."end_date",
    "urc"."next_post_date",
    "urc"."last_posted_at",
    "urc"."active",
    "urc"."memo",
    "urc"."identifier"
   FROM (((("public"."unit_recurring_charges" "urc"
     JOIN "public"."charge_categories" "cc" ON (("cc"."id" = "urc"."charge_category_id")))
     JOIN "public"."units" "u" ON (("u"."id" = "urc"."unit_id")))
     JOIN "public"."buildings" "b" ON (("b"."id" = "u"."building_id")))
     JOIN "public"."associations" "a" ON (("a"."id" = "b"."association_id")))
  WHERE "public"."can_access_portfolio"("a"."portfolio_id");


ALTER VIEW "public"."v_unit_charge_schedule" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_upcoming_expirations" AS
 SELECT "ip"."id",
    "ip"."owner_id",
    "ip"."association_id",
    "ip"."policy_number",
    "ip"."insurance_company",
    "ip"."coverage_amount",
    "ip"."liability_amount",
    "ip"."deductible_amount",
    "ip"."effective_date",
    "ip"."expiration_date",
    "ip"."certificate_file_url",
    "ip"."extracted_fields",
    "ip"."extraction_status",
    "ip"."status",
    "ip"."notes",
    "ip"."created_at",
    "ip"."updated_at",
    "ip"."archived_at",
    "o"."full_name" AS "owner_name",
    "o"."email" AS "owner_email",
    "a"."name" AS "association_name",
    ("ip"."expiration_date" - CURRENT_DATE) AS "days_remaining",
    "ip"."remind_owner",
    "ip"."remind_manager",
    "ip"."reminder_30_sent_at",
    "ip"."reminder_15_sent_at"
   FROM (("public"."insurance_policies" "ip"
     JOIN "public"."owners" "o" ON (("o"."id" = "ip"."owner_id")))
     LEFT JOIN "public"."associations" "a" ON (("a"."id" = "ip"."association_id")))
  WHERE (("ip"."archived_at" IS NULL) AND ("ip"."status" = ANY (ARRAY['active'::"text", 'expiring_soon'::"text"])) AND "public"."can_access_portfolio"("o"."portfolio_id"))
  ORDER BY "ip"."expiration_date";


ALTER VIEW "public"."v_upcoming_expirations" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_upcoming_maintenance" AS
 SELECT "mt"."id",
    "mt"."association_id",
    "mt"."template_id",
    "mt"."task_name",
    "mt"."category",
    "mt"."frequency",
    "mt"."custom_interval_days",
    "mt"."vendor_id",
    "mt"."assigned_staff_id",
    "mt"."reminder_days",
    "mt"."priority",
    "mt"."start_date",
    "mt"."end_date",
    "mt"."notes",
    "mt"."status",
    "mt"."last_completed_at",
    "mt"."next_due_date",
    "mt"."created_at",
    "mt"."updated_at",
    "mt"."archived_at",
    "a"."name" AS "association_name",
    "v"."name" AS "vendor_name",
    ("mt"."next_due_date" - CURRENT_DATE) AS "days_until_due"
   FROM (("public"."maintenance_tasks" "mt"
     JOIN "public"."associations" "a" ON (("a"."id" = "mt"."association_id")))
     LEFT JOIN "public"."vendors" "v" ON (("v"."id" = "mt"."vendor_id")))
  WHERE (("mt"."archived_at" IS NULL) AND ("mt"."status" = 'active'::"text") AND "public"."can_access_portfolio"("a"."portfolio_id"))
  ORDER BY "mt"."next_due_date";


ALTER VIEW "public"."v_upcoming_maintenance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."violation_followup_steps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "association_id" "uuid" NOT NULL,
    "step_order" integer DEFAULT 1 NOT NULL,
    "days_after_previous" integer DEFAULT 15 NOT NULL,
    "follow_up_name" "text" NOT NULL,
    "letter_template_id" "uuid",
    "delivery_methods" "text"[] DEFAULT '{email}'::"text"[],
    "fee" numeric,
    "gl_account_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_at" timestamp with time zone
);


ALTER TABLE "public"."violation_followup_steps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."violation_updates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "violation_id" "uuid" NOT NULL,
    "note" "text" NOT NULL,
    "new_status" "public"."violation_status",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "violation_updates_note_check" CHECK ((("length"("note") >= 1) AND ("length"("note") <= 2000)))
);


ALTER TABLE "public"."violation_updates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."violations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "association_id" "uuid" NOT NULL,
    "unit_id" "uuid",
    "owner_id" "uuid",
    "violation_type" "public"."violation_type" DEFAULT 'other'::"public"."violation_type" NOT NULL,
    "status" "public"."violation_status" DEFAULT 'open'::"public"."violation_status" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "date_observed" "date" DEFAULT CURRENT_DATE NOT NULL,
    "hearing_date" "date",
    "fine_amount" numeric(10,2),
    "fine_assessed_at" timestamp with time zone,
    "cured_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closed_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "due_date" "date",
    "reported_date" "date" DEFAULT CURRENT_DATE,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "governing_document_reference" "text",
    "notice_sent_at" timestamp with time zone,
    "cure_deadline" "date",
    "hearing_required" boolean DEFAULT false NOT NULL,
    "hearing_at" timestamp with time zone,
    "board_decision" "text",
    "dispute_status" "text",
    "owner_visible_history" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "communication_log" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "location_lat" double precision,
    "location_lng" double precision,
    "location_accuracy_m" double precision,
    CONSTRAINT "violations_description_check" CHECK (("length"("description") <= 4000)),
    CONSTRAINT "violations_fine_amount_check" CHECK (("fine_amount" >= (0)::numeric)),
    CONSTRAINT "violations_title_check" CHECK ((("length"("title") >= 2) AND ("length"("title") <= 200)))
);


ALTER TABLE "public"."violations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ballot_id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "choice" "text" NOT NULL,
    "weight" numeric(5,2) DEFAULT 1.00 NOT NULL,
    "cast_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_order_estimates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_order_id" "uuid" NOT NULL,
    "vendor_id" "uuid",
    "amount" numeric(14,2) NOT NULL,
    "notes" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "rejection_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "work_order_estimates_amount_check" CHECK (("amount" >= (0)::numeric))
);


ALTER TABLE "public"."work_order_estimates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_order_labor_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_order_id" "uuid" NOT NULL,
    "tech_id" "uuid",
    "tech_name" "text",
    "date_worked" "date" DEFAULT CURRENT_DATE NOT NULL,
    "hours" numeric(6,2) NOT NULL,
    "description" "text",
    "hourly_rate" numeric(12,2),
    "labor_cost" numeric(14,2) GENERATED ALWAYS AS ("round"(("hours" * COALESCE("hourly_rate", (0)::numeric)), 2)) STORED,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "work_order_labor_entries_hours_check" CHECK ((("hours" > (0)::numeric) AND ("hours" <= (24)::numeric)))
);


ALTER TABLE "public"."work_order_labor_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_order_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_order_id" "uuid" NOT NULL,
    "author_id" "uuid",
    "author_name" "text",
    "author_role" "text" DEFAULT 'staff'::"text" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "work_order_messages_author_role_check" CHECK (("author_role" = ANY (ARRAY['owner'::"text", 'staff'::"text", 'board'::"text", 'vendor'::"text"])))
);


ALTER TABLE "public"."work_order_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_order_updates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_order_id" "uuid" NOT NULL,
    "note" "text" NOT NULL,
    "new_status" "public"."work_order_status",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "work_order_updates_note_check" CHECK ((("length"("note") >= 1) AND ("length"("note") <= 2000)))
);


ALTER TABLE "public"."work_order_updates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workflows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "steps" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."workflows" OWNER TO "postgres";


ALTER TABLE ONLY "public"."companies" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."companies_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."diagnostic_flags" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."diagnostic_flags_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."email_connections" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."email_connections_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."email_threads" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."email_threads_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."invitations" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."invitations_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."journal_entry_lines" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."journal_entry_lines_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."meeting_action_items" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."meeting_action_items_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."owner_accounts" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."owner_accounts_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."owner_messages" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."owner_messages_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."owner_notification_prefs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."owner_notification_prefs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."owner_notifications" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."owner_notifications_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."payment_transactions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."payment_transactions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."properties" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."properties_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."property_assignments" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."property_assignments_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."property_documents" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."property_documents_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."recent_activity" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."recent_activity_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."schedule_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."schedule_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."ticket_attachments" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ticket_attachments_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."ticket_comments" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ticket_comments_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tickets" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tickets_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."transactions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."transactions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."users" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."users_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."accounting_periods"
    ADD CONSTRAINT "accounting_periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."accounting_periods"
    ADD CONSTRAINT "accounting_periods_portfolio_id_fiscal_year_period_month_key" UNIQUE ("portfolio_id", "fiscal_year", "period_month");



ALTER TABLE ONLY "public"."activity"
    ADD CONSTRAINT "activity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agenda_items"
    ADD CONSTRAINT "agenda_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_user_id_slug_key" UNIQUE ("user_id", "slug");



ALTER TABLE ONLY "public"."amenity_reservations"
    ADD CONSTRAINT "amenity_reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."amenity_tags"
    ADD CONSTRAINT "amenity_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_key_hash_key" UNIQUE ("key_hash");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."approval_decisions"
    ADD CONSTRAINT "approval_decisions_approval_request_id_decided_by_key" UNIQUE ("approval_request_id", "decided_by");



ALTER TABLE ONLY "public"."approval_decisions"
    ADD CONSTRAINT "approval_decisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."approval_requests"
    ADD CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."approval_votes"
    ADD CONSTRAINT "approval_votes_approval_request_id_board_member_id_key" UNIQUE ("approval_request_id", "board_member_id");



ALTER TABLE ONLY "public"."approval_votes"
    ADD CONSTRAINT "approval_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."architectural_request_messages"
    ADD CONSTRAINT "architectural_request_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."architectural_requests"
    ADD CONSTRAINT "architectural_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."architectural_review_settings"
    ADD CONSTRAINT "architectural_review_settings_pkey" PRIMARY KEY ("association_id");



ALTER TABLE ONLY "public"."assessment_periods"
    ADD CONSTRAINT "assessment_periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."association_additional_fees"
    ADD CONSTRAINT "association_additional_fees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."association_amenities"
    ADD CONSTRAINT "association_amenities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."association_assignments"
    ADD CONSTRAINT "association_assignments_association_id_manager_id_key" UNIQUE ("association_id", "manager_id");



ALTER TABLE ONLY "public"."association_assignments"
    ADD CONSTRAINT "association_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."association_attachments"
    ADD CONSTRAINT "association_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."association_keys"
    ADD CONSTRAINT "association_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."association_lease_template_settings"
    ADD CONSTRAINT "association_lease_template_settings_pkey" PRIMARY KEY ("association_id", "slot");



ALTER TABLE ONLY "public"."association_loans"
    ADD CONSTRAINT "association_loans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."association_managers"
    ADD CONSTRAINT "association_managers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."association_managers"
    ADD CONSTRAINT "association_managers_user_id_association_id_key" UNIQUE ("user_id", "association_id");



ALTER TABLE ONLY "public"."association_notes"
    ADD CONSTRAINT "association_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."association_renewal_options"
    ADD CONSTRAINT "association_renewal_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."associations"
    ADD CONSTRAINT "associations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_flow_runs"
    ADD CONSTRAINT "automation_flow_runs_flow_id_subject_type_subject_id_key" UNIQUE ("flow_id", "subject_type", "subject_id");



ALTER TABLE ONLY "public"."automation_flow_runs"
    ADD CONSTRAINT "automation_flow_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_flows"
    ADD CONSTRAINT "automation_flows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_tasks"
    ADD CONSTRAINT "automation_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."autopay_mandates"
    ADD CONSTRAINT "autopay_mandates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ballots"
    ADD CONSTRAINT "ballots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bank_account_owners"
    ADD CONSTRAINT "bank_account_owners_bank_account_id_owner_id_key" UNIQUE ("bank_account_id", "owner_id");



ALTER TABLE ONLY "public"."bank_account_owners"
    ADD CONSTRAINT "bank_account_owners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bank_adjustments"
    ADD CONSTRAINT "bank_adjustments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bank_reconciliation_items"
    ADD CONSTRAINT "bank_reconciliation_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bank_reconciliations"
    ADD CONSTRAINT "bank_reconciliations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bank_transfers"
    ADD CONSTRAINT "bank_transfers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_usage"
    ADD CONSTRAINT "billing_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."board_approval_settings"
    ADD CONSTRAINT "board_approval_settings_pkey" PRIMARY KEY ("association_id");



ALTER TABLE ONLY "public"."board_comments"
    ADD CONSTRAINT "board_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."board_members"
    ADD CONSTRAINT "board_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budget_lines"
    ADD CONSTRAINT "budget_lines_association_id_gl_account_id_fiscal_year_key" UNIQUE ("association_id", "gl_account_id", "fiscal_year");



ALTER TABLE ONLY "public"."budget_lines"
    ADD CONSTRAINT "budget_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."buildings"
    ADD CONSTRAINT "buildings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_event_reminders"
    ADD CONSTRAINT "calendar_event_reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."charge_categories"
    ADD CONSTRAINT "charge_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."charges"
    ADD CONSTRAINT "charges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."committee_members"
    ADD CONSTRAINT "committee_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."committees"
    ADD CONSTRAINT "committees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."communication_messages"
    ADD CONSTRAINT "communication_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."communication_triggers"
    ADD CONSTRAINT "communication_triggers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."communications_log"
    ADD CONSTRAINT "communications_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_slug_unique" UNIQUE ("slug");



ALTER TABLE ONLY "public"."company_settings"
    ADD CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_settings"
    ADD CONSTRAINT "company_settings_portfolio_id_key" UNIQUE ("portfolio_id");



ALTER TABLE ONLY "public"."data_diagnostics"
    ADD CONSTRAINT "data_diagnostics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."data_export_requests"
    ADD CONSTRAINT "data_export_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."depreciation_entries"
    ADD CONSTRAINT "depreciation_entries_fixed_asset_id_period_year_period_mont_key" UNIQUE ("fixed_asset_id", "period_year", "period_month");



ALTER TABLE ONLY "public"."depreciation_entries"
    ADD CONSTRAINT "depreciation_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."diagnostic_flags"
    ADD CONSTRAINT "diagnostic_flags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_requests"
    ADD CONSTRAINT "document_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_templates"
    ADD CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dues_increase_lines"
    ADD CONSTRAINT "dues_increase_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dues_increases"
    ADD CONSTRAINT "dues_increases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_connections"
    ADD CONSTRAINT "email_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_queue"
    ADD CONSTRAINT "email_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_threads"
    ADD CONSTRAINT "email_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feature_entitlements"
    ADD CONSTRAINT "feature_entitlements_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."feature_entitlements"
    ADD CONSTRAINT "feature_entitlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fixed_assets"
    ADD CONSTRAINT "fixed_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_templates"
    ADD CONSTRAINT "form_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gl_account_role_permissions"
    ADD CONSTRAINT "gl_account_role_permissions_gl_account_id_role_id_key" UNIQUE ("gl_account_id", "role_id");



ALTER TABLE ONLY "public"."gl_account_role_permissions"
    ADD CONSTRAINT "gl_account_role_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gl_accounts"
    ADD CONSTRAINT "gl_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gl_accounts"
    ADD CONSTRAINT "gl_accounts_portfolio_id_association_id_number_key" UNIQUE NULLS NOT DISTINCT ("portfolio_id", "association_id", "number");



ALTER TABLE ONLY "public"."house_rules"
    ADD CONSTRAINT "house_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."income_recertifications"
    ADD CONSTRAINT "income_recertifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inspection_items"
    ADD CONSTRAINT "inspection_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inspections"
    ADD CONSTRAINT "inspections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."insurance_policies"
    ADD CONSTRAINT "insurance_policies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_token_unique" UNIQUE ("token");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_entry_batches"
    ADD CONSTRAINT "journal_entry_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_entry_lines"
    ADD CONSTRAINT "journal_entry_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_lines"
    ADD CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."late_fee_assessments"
    ADD CONSTRAINT "late_fee_assessments_charge_id_key" UNIQUE ("charge_id");



ALTER TABLE ONLY "public"."late_fee_assessments"
    ADD CONSTRAINT "late_fee_assessments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_messages"
    ADD CONSTRAINT "lead_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lock_box_assignments"
    ADD CONSTRAINT "lock_box_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lock_boxes"
    ADD CONSTRAINT "lock_boxes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lockbox_batches"
    ADD CONSTRAINT "lockbox_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lockbox_items"
    ADD CONSTRAINT "lockbox_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."login_attempts"
    ADD CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."maintenance_task_history"
    ADD CONSTRAINT "maintenance_task_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."maintenance_tasks"
    ADD CONSTRAINT "maintenance_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."maintenance_template_groups"
    ADD CONSTRAINT "maintenance_template_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."maintenance_templates"
    ADD CONSTRAINT "maintenance_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."management_agreements"
    ADD CONSTRAINT "management_agreements_owner_id_key" UNIQUE ("owner_id");



ALTER TABLE ONLY "public"."management_agreements"
    ADD CONSTRAINT "management_agreements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."management_fee_policies"
    ADD CONSTRAINT "management_fee_policies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."management_fee_schedules"
    ADD CONSTRAINT "management_fee_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."management_fees"
    ADD CONSTRAINT "management_fees_association_id_month_key" UNIQUE ("association_id", "month");



ALTER TABLE ONLY "public"."management_fees"
    ADD CONSTRAINT "management_fees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_leads"
    ADD CONSTRAINT "marketing_leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meeting_action_items"
    ADD CONSTRAINT "meeting_action_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meeting_attendees"
    ADD CONSTRAINT "meeting_attendees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meeting_documents"
    ADD CONSTRAINT "meeting_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_templates"
    ADD CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notice_recipients"
    ADD CONSTRAINT "notice_recipients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notices"
    ADD CONSTRAINT "notices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."occupancies"
    ADD CONSTRAINT "occupancies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."owner_accounts"
    ADD CONSTRAINT "owner_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."owner_ach_status"
    ADD CONSTRAINT "owner_ach_status_owner_id_key" UNIQUE ("owner_id");



ALTER TABLE ONLY "public"."owner_ach_status"
    ADD CONSTRAINT "owner_ach_status_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."owner_attachments"
    ADD CONSTRAINT "owner_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."owner_financial_details"
    ADD CONSTRAINT "owner_financial_details_pkey" PRIMARY KEY ("owner_id");



ALTER TABLE ONLY "public"."owner_form_submissions"
    ADD CONSTRAINT "owner_form_submissions_owner_form_key" UNIQUE ("owner_id", "form_type");



ALTER TABLE ONLY "public"."owner_form_submissions"
    ADD CONSTRAINT "owner_form_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."owner_messages"
    ADD CONSTRAINT "owner_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."owner_notification_prefs"
    ADD CONSTRAINT "owner_notification_prefs_ownerId_unique" UNIQUE ("ownerId");



ALTER TABLE ONLY "public"."owner_notification_prefs"
    ADD CONSTRAINT "owner_notification_prefs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."owner_notifications"
    ADD CONSTRAINT "owner_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."owner_packet_settings"
    ADD CONSTRAINT "owner_packet_settings_pkey" PRIMARY KEY ("owner_id");



ALTER TABLE ONLY "public"."owner_packets"
    ADD CONSTRAINT "owner_packets_owner_id_key" UNIQUE ("owner_id");



ALTER TABLE ONLY "public"."owner_packets"
    ADD CONSTRAINT "owner_packets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."owner_payables"
    ADD CONSTRAINT "owner_payables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."owner_portal_invites"
    ADD CONSTRAINT "owner_portal_invites_owner_id_key" UNIQUE ("owner_id");



ALTER TABLE ONLY "public"."owner_portal_invites"
    ADD CONSTRAINT "owner_portal_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."owner_portal_invites"
    ADD CONSTRAINT "owner_portal_invites_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."owner_statements"
    ADD CONSTRAINT "owner_statements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."owner_vehicles"
    ADD CONSTRAINT "owner_vehicles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."owners"
    ADD CONSTRAINT "owners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parking_assignments"
    ADD CONSTRAINT "parking_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parking_spaces"
    ADD CONSTRAINT "parking_spaces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payable_bill_line_items"
    ADD CONSTRAINT "payable_bill_line_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payable_bills"
    ADD CONSTRAINT "payable_bills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_applications"
    ADD CONSTRAINT "payment_applications_payment_id_charge_id_key" UNIQUE ("payment_id", "charge_id");



ALTER TABLE ONLY "public"."payment_applications"
    ADD CONSTRAINT "payment_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_events"
    ADD CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_intents"
    ADD CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_processor_configs"
    ADD CONSTRAINT "payment_processor_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_processor_configs"
    ADD CONSTRAINT "payment_processor_configs_portfolio_id_processor_key" UNIQUE ("portfolio_id", "processor");



ALTER TABLE ONLY "public"."payment_transactions"
    ADD CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payout_batches"
    ADD CONSTRAINT "payout_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permission_audit_log"
    ADD CONSTRAINT "permission_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."phone_messages"
    ADD CONSTRAINT "phone_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plaid_items"
    ADD CONSTRAINT "plaid_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_impersonation_log"
    ADD CONSTRAINT "platform_impersonation_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_operators"
    ADD CONSTRAINT "platform_operators_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."platform_operators"
    ADD CONSTRAINT "platform_operators_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_requests"
    ADD CONSTRAINT "platform_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portfolio_settings"
    ADD CONSTRAINT "portfolio_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portfolio_settings"
    ADD CONSTRAINT "portfolio_settings_portfolio_id_key" UNIQUE ("portfolio_id");



ALTER TABLE ONLY "public"."portfolios"
    ADD CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."privacy_actions"
    ADD CONSTRAINT "privacy_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_assignments"
    ADD CONSTRAINT "property_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_documents"
    ADD CONSTRAINT "property_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_groups"
    ADD CONSTRAINT "property_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_availability"
    ADD CONSTRAINT "provider_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_services"
    ADD CONSTRAINT "provider_services_pkey" PRIMARY KEY ("provider_id", "service_id");



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_order_line_items"
    ADD CONSTRAINT "purchase_order_line_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recent_activity"
    ADD CONSTRAINT "recent_activity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receptionist_knowledge"
    ADD CONSTRAINT "receptionist_knowledge_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_bills"
    ADD CONSTRAINT "recurring_bills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_journal_entries"
    ADD CONSTRAINT "recurring_journal_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_work_orders"
    ADD CONSTRAINT "recurring_work_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reminder_settings"
    ADD CONSTRAINT "reminder_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reminder_settings"
    ADD CONSTRAINT "reminder_settings_portfolio_id_alert_type_key" UNIQUE ("portfolio_id", "alert_type");



ALTER TABLE ONLY "public"."report_definitions"
    ADD CONSTRAINT "report_definitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_definitions"
    ADD CONSTRAINT "report_definitions_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."report_runs"
    ADD CONSTRAINT "report_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_snapshots"
    ADD CONSTRAINT "report_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reserve_fund_settings"
    ADD CONSTRAINT "reserve_fund_settings_pkey" PRIMARY KEY ("association_id");



ALTER TABLE ONLY "public"."saved_report_views"
    ADD CONSTRAINT "saved_report_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_reports"
    ADD CONSTRAINT "saved_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule_events"
    ADD CONSTRAINT "schedule_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scheduled_reports"
    ADD CONSTRAINT "scheduled_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schema_migrations"
    ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version");



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."shares"
    ADD CONSTRAINT "shares_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shares"
    ADD CONSTRAINT "shares_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."sms_conversations"
    ADD CONSTRAINT "sms_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_messages"
    ADD CONSTRAINT "sms_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_opt_ins"
    ADD CONSTRAINT "sms_opt_ins_phone_number_portfolio_id_key" UNIQUE ("phone_number", "portfolio_id");



ALTER TABLE ONLY "public"."sms_opt_ins"
    ADD CONSTRAINT "sms_opt_ins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."soft_delete_log"
    ADD CONSTRAINT "soft_delete_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."statement_batches"
    ADD CONSTRAINT "statement_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."statements"
    ADD CONSTRAINT "statements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."statements"
    ADD CONSTRAINT "statements_unique_period" UNIQUE ("owner_id", "unit_id", "period_year", "period_month");



ALTER TABLE ONLY "public"."subscription_events"
    ADD CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_portfolio_id_key" UNIQUE ("portfolio_id");



ALTER TABLE ONLY "public"."superadmin_notes"
    ADD CONSTRAINT "superadmin_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."survey_responses"
    ADD CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."surveys"
    ADD CONSTRAINT "surveys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tag_assignments"
    ADD CONSTRAINT "tag_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tag_assignments"
    ADD CONSTRAINT "tag_assignments_tag_id_entity_type_entity_id_key" UNIQUE ("tag_id", "entity_type", "entity_id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_portfolio_id_name_key" UNIQUE ("portfolio_id", "name");



ALTER TABLE ONLY "public"."tenancies"
    ADD CONSTRAINT "tenancies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_attachments"
    ADD CONSTRAINT "ticket_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_comments"
    ADD CONSTRAINT "ticket_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."maintenance_templates"
    ADD CONSTRAINT "unique_template_name" UNIQUE ("name");



ALTER TABLE ONLY "public"."unit_amenities"
    ADD CONSTRAINT "unit_amenities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."unit_owners"
    ADD CONSTRAINT "unit_owners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."unit_pets"
    ADD CONSTRAINT "unit_pets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."unit_recurring_charges"
    ADD CONSTRAINT "unit_recurring_charges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."units"
    ADD CONSTRAINT "units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usage_metrics"
    ADD CONSTRAINT "usage_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usage_metrics"
    ADD CONSTRAINT "usage_metrics_portfolio_id_period_year_period_month_key" UNIQUE ("portfolio_id", "period_year", "period_month");



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_portfolio_id_name_key" UNIQUE NULLS NOT DISTINCT ("portfolio_id", "name");



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_openId_unique" UNIQUE ("openId");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendor_compliance"
    ADD CONSTRAINT "vendor_compliance_pkey" PRIMARY KEY ("vendor_id");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."violation_cases"
    ADD CONSTRAINT "violation_cases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."violation_followup_steps"
    ADD CONSTRAINT "violation_followup_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."violation_updates"
    ADD CONSTRAINT "violation_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."violations"
    ADD CONSTRAINT "violations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."votes"
    ADD CONSTRAINT "votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."votes"
    ADD CONSTRAINT "votes_unique_owner_ballot" UNIQUE ("ballot_id", "owner_id");



ALTER TABLE ONLY "public"."webhook_deliveries"
    ADD CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."webhook_endpoints"
    ADD CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_order_estimates"
    ADD CONSTRAINT "work_order_estimates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_order_labor_entries"
    ADD CONSTRAINT "work_order_labor_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_order_messages"
    ADD CONSTRAINT "work_order_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_order_updates"
    ADD CONSTRAINT "work_order_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workflows"
    ADD CONSTRAINT "workflows_pkey" PRIMARY KEY ("id");



CREATE INDEX "activity_action_idx" ON "public"."activity" USING "btree" ("action");



CREATE INDEX "activity_agent_idx" ON "public"."activity" USING "btree" ("agent");



CREATE INDEX "activity_user_created_idx" ON "public"."activity" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "agents_user_idx" ON "public"."agents" USING "btree" ("user_id");



CREATE INDEX "amenity_reservations_assoc_start_idx" ON "public"."amenity_reservations" USING "btree" ("association_id", "start_time");



CREATE INDEX "amenity_reservations_owner_idx" ON "public"."amenity_reservations" USING "btree" ("owner_id");



CREATE INDEX "ap_association_idx" ON "public"."assessment_periods" USING "btree" ("association_id");



CREATE INDEX "ap_status_idx" ON "public"."assessment_periods" USING "btree" ("status");



CREATE INDEX "approval_decisions_request_idx" ON "public"."approval_decisions" USING "btree" ("approval_request_id");



CREATE INDEX "approval_requests_due_date_idx" ON "public"."approval_requests" USING "btree" ("due_date");



CREATE INDEX "arch_req_messages_request_idx" ON "public"."architectural_request_messages" USING "btree" ("request_id", "created_at");



CREATE INDEX "architectural_requests_assoc_status_idx" ON "public"."architectural_requests" USING "btree" ("association_id", "status");



CREATE INDEX "architectural_requests_owner_idx" ON "public"."architectural_requests" USING "btree" ("owner_id");



CREATE INDEX "aro_assoc_idx" ON "public"."association_renewal_options" USING "btree" ("association_id", "sort_order");



CREATE INDEX "association_loans_assoc_idx" ON "public"."association_loans" USING "btree" ("association_id");



CREATE INDEX "associations_archived_idx" ON "public"."associations" USING "btree" ("archived_at");



CREATE INDEX "associations_created_by_idx" ON "public"."associations" USING "btree" ("created_by");



CREATE UNIQUE INDEX "associations_slug_key" ON "public"."associations" USING "btree" ("slug");



CREATE INDEX "automation_flow_runs_flow_fired_idx" ON "public"."automation_flow_runs" USING "btree" ("flow_id", "fired_at" DESC);



CREATE INDEX "automation_flows_association_idx" ON "public"."automation_flows" USING "btree" ("association_id");



CREATE INDEX "automation_flows_enabled_idx" ON "public"."automation_flows" USING "btree" ("enabled") WHERE "enabled";



CREATE INDEX "automation_flows_portfolio_idx" ON "public"."automation_flows" USING "btree" ("portfolio_id");



CREATE INDEX "buildings_active_idx" ON "public"."buildings" USING "btree" ("association_id");



CREATE INDEX "buildings_association_idx" ON "public"."buildings" USING "btree" ("association_id");



CREATE UNIQUE INDEX "buildings_unique_name_per_assoc" ON "public"."buildings" USING "btree" ("association_id", "name");



CREATE INDEX "charges_due_idx" ON "public"."charges" USING "btree" ("due_date");



CREATE INDEX "charges_period_idx" ON "public"."charges" USING "btree" ("assessment_period_id");



CREATE INDEX "charges_unit_idx" ON "public"."charges" USING "btree" ("unit_id");



CREATE INDEX "documents_entity_idx" ON "public"."documents" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "documents_expiry_idx" ON "public"."documents" USING "btree" ("expires_at");



CREATE INDEX "email_queue_assoc_idx" ON "public"."email_queue" USING "btree" ("association_id");



CREATE INDEX "email_queue_status_idx" ON "public"."email_queue" USING "btree" ("status");



CREATE INDEX "idx_acct_periods_portfolio" ON "public"."accounting_periods" USING "btree" ("portfolio_id", "fiscal_year" DESC, "period_month" DESC);



CREATE INDEX "idx_agreements_owner" ON "public"."management_agreements" USING "btree" ("owner_id");



CREATE INDEX "idx_amenity_tags_portfolio" ON "public"."amenity_tags" USING "btree" ("portfolio_id");



CREATE INDEX "idx_api_keys_expires" ON "public"."api_keys" USING "btree" ("expires_at") WHERE (("revoked_at" IS NULL) AND ("expires_at" IS NOT NULL));



CREATE INDEX "idx_api_keys_hash" ON "public"."api_keys" USING "btree" ("key_hash");



CREATE INDEX "idx_api_keys_portfolio_active" ON "public"."api_keys" USING "btree" ("portfolio_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "idx_api_keys_prefix" ON "public"."api_keys" USING "btree" ("prefix");



CREATE INDEX "idx_approval_requests_association" ON "public"."approval_requests" USING "btree" ("association_id") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_approval_requests_homeowner" ON "public"."approval_requests" USING "btree" ("owner_id");



CREATE INDEX "idx_approval_requests_portfolio" ON "public"."approval_requests" USING "btree" ("portfolio_id");



CREATE INDEX "idx_approval_requests_status" ON "public"."approval_requests" USING "btree" ("status") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_approval_requests_unit" ON "public"."approval_requests" USING "btree" ("unit_id");



CREATE INDEX "idx_approval_requests_vendor" ON "public"."approval_requests" USING "btree" ("vendor_id");



CREATE INDEX "idx_approval_votes_request" ON "public"."approval_votes" USING "btree" ("approval_request_id");



CREATE INDEX "idx_approval_votes_voter" ON "public"."approval_votes" USING "btree" ("voter_user_id");



CREATE INDEX "idx_assoc_amenities_association" ON "public"."association_amenities" USING "btree" ("association_id");



CREATE INDEX "idx_assoc_mgrs_association" ON "public"."association_managers" USING "btree" ("association_id");



CREATE INDEX "idx_assoc_mgrs_portfolio" ON "public"."association_managers" USING "btree" ("portfolio_id");



CREATE INDEX "idx_assoc_mgrs_user" ON "public"."association_managers" USING "btree" ("user_id");



CREATE INDEX "idx_association_attachments_assoc" ON "public"."association_attachments" USING "btree" ("association_id", "folder", "created_at" DESC) WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_association_attachments_association" ON "public"."association_attachments" USING "btree" ("association_id", "created_at" DESC) WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_association_attachments_owner_visible" ON "public"."association_attachments" USING "btree" ("association_id", "shared_with_owner", "created_at" DESC) WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_association_keys_assoc" ON "public"."association_keys" USING "btree" ("association_id") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_association_notes_assoc" ON "public"."association_notes" USING "btree" ("association_id", "created_at" DESC) WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_associations_group" ON "public"."associations" USING "btree" ("property_group_id");



CREATE INDEX "idx_associations_mgmt_fee" ON "public"."associations" USING "btree" ("management_fee_schedule_id");



CREATE INDEX "idx_associations_portfolio" ON "public"."associations" USING "btree" ("portfolio_id");



CREATE INDEX "idx_associations_primary_bank" ON "public"."associations" USING "btree" ("primary_bank_account_id");



CREATE UNIQUE INDEX "idx_associations_stripe_account" ON "public"."associations" USING "btree" ("stripe_account_id") WHERE ("stripe_account_id" IS NOT NULL);



CREATE INDEX "idx_audit_logs_created" ON "public"."audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_logs_entity" ON "public"."audit_logs" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_automation_tasks_due" ON "public"."automation_tasks" USING "btree" ("status", "due_at");



CREATE INDEX "idx_autopay_due" ON "public"."autopay_mandates" USING "btree" ("next_run_date") WHERE ("status" = 'active'::"public"."autopay_status");



CREATE INDEX "idx_autopay_owner" ON "public"."autopay_mandates" USING "btree" ("owner_id");



CREATE INDEX "idx_autopay_portfolio" ON "public"."autopay_mandates" USING "btree" ("portfolio_id");



CREATE INDEX "idx_autopay_status" ON "public"."autopay_mandates" USING "btree" ("status");



CREATE INDEX "idx_autopay_unit" ON "public"."autopay_mandates" USING "btree" ("unit_id");



CREATE INDEX "idx_availability_provider" ON "public"."provider_availability" USING "btree" ("provider_id");



CREATE INDEX "idx_ballots_assoc" ON "public"."ballots" USING "btree" ("association_id");



CREATE INDEX "idx_ballots_status" ON "public"."ballots" USING "btree" ("status");



CREATE INDEX "idx_bank_accounts_assoc_purpose" ON "public"."bank_accounts" USING "btree" ("association_id", "purpose");



CREATE INDEX "idx_bank_accounts_association" ON "public"."bank_accounts" USING "btree" ("association_id");



CREATE INDEX "idx_bank_accounts_gl" ON "public"."bank_accounts" USING "btree" ("gl_account_id");



CREATE INDEX "idx_bank_accounts_portfolio" ON "public"."bank_accounts" USING "btree" ("portfolio_id") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_bank_owners_bank" ON "public"."bank_account_owners" USING "btree" ("bank_account_id");



CREATE INDEX "idx_bank_reconciliation_items_recon" ON "public"."bank_reconciliation_items" USING "btree" ("reconciliation_id");



CREATE INDEX "idx_bank_reconciliations_account" ON "public"."bank_reconciliations" USING "btree" ("bank_account_id", "status");



CREATE INDEX "idx_bank_transfers_date" ON "public"."bank_transfers" USING "btree" ("transfer_date" DESC);



CREATE INDEX "idx_bank_transfers_from" ON "public"."bank_transfers" USING "btree" ("from_bank_account_id");



CREATE INDEX "idx_bank_transfers_journal" ON "public"."bank_transfers" USING "btree" ("journal_entry_id");



CREATE INDEX "idx_bank_transfers_portfolio" ON "public"."bank_transfers" USING "btree" ("portfolio_id");



CREATE INDEX "idx_bank_transfers_to" ON "public"."bank_transfers" USING "btree" ("to_bank_account_id");



CREATE INDEX "idx_bank_tx_date" ON "public"."bank_transactions" USING "btree" ("bank_account_id", "date" DESC);



CREATE UNIQUE INDEX "idx_bank_tx_plaid_id" ON "public"."bank_transactions" USING "btree" ("bank_account_id", "plaid_transaction_id");



CREATE INDEX "idx_bank_tx_unreviewed" ON "public"."bank_transactions" USING "btree" ("bank_account_id", "reviewed") WHERE ("reviewed" = false);



CREATE INDEX "idx_bill_line_items_association" ON "public"."payable_bill_line_items" USING "btree" ("association_id");



CREATE INDEX "idx_bill_line_items_bill" ON "public"."payable_bill_line_items" USING "btree" ("bill_id");



CREATE INDEX "idx_bill_line_items_gl" ON "public"."payable_bill_line_items" USING "btree" ("gl_account_id");



CREATE INDEX "idx_billing_usage_period" ON "public"."billing_usage" USING "btree" ("period_start", "period_end");



CREATE INDEX "idx_billing_usage_portfolio" ON "public"."billing_usage" USING "btree" ("portfolio_id");



CREATE INDEX "idx_billing_usage_subscription" ON "public"."billing_usage" USING "btree" ("subscription_id");



CREATE INDEX "idx_board_members_association" ON "public"."board_members" USING "btree" ("association_id") WHERE "active";



CREATE INDEX "idx_board_members_auth_user" ON "public"."board_members" USING "btree" ("auth_user_id") WHERE ("auth_user_id" IS NOT NULL);



CREATE INDEX "idx_bookings_lead" ON "public"."bookings" USING "btree" ("lead_id");



CREATE INDEX "idx_bookings_start" ON "public"."bookings" USING "btree" ("start_time");



CREATE INDEX "idx_bookings_status" ON "public"."bookings" USING "btree" ("status");



CREATE INDEX "idx_budget_lines_assoc_year" ON "public"."budget_lines" USING "btree" ("association_id", "fiscal_year");



CREATE INDEX "idx_budget_lines_gl" ON "public"."budget_lines" USING "btree" ("gl_account_id");



CREATE UNIQUE INDEX "idx_buildings_one_primary_per_association" ON "public"."buildings" USING "btree" ("association_id") WHERE (("is_primary" = true) AND ("archived_at" IS NULL));



CREATE INDEX "idx_calendar_event_reminders_due" ON "public"."calendar_event_reminders" USING "btree" ("status", "remind_at");



CREATE INDEX "idx_calendar_events_association" ON "public"."calendar_events" USING "btree" ("association_id") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_calendar_events_due_reminders" ON "public"."calendar_events" USING "btree" ("start_datetime", "reminder_days_before", "reminder_acknowledged_at") WHERE (("reminder_days_before" IS NOT NULL) AND ("reminder_acknowledged_at" IS NULL));



CREATE INDEX "idx_calendar_events_maintenance_task" ON "public"."calendar_events" USING "btree" ("maintenance_task_id");



CREATE INDEX "idx_calendar_events_pending_notify" ON "public"."calendar_events" USING "btree" ("notify_maintenance", "maintenance_notified_at") WHERE (("notify_maintenance" = true) AND ("maintenance_notified_at" IS NULL));



CREATE INDEX "idx_calendar_events_pending_sms" ON "public"."calendar_events" USING "btree" ("notify_sms", "sms_notified_at") WHERE (("notify_sms" = true) AND ("sms_notified_at" IS NULL));



CREATE INDEX "idx_calendar_events_portfolio" ON "public"."calendar_events" USING "btree" ("portfolio_id") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_calendar_events_start" ON "public"."calendar_events" USING "btree" ("start_datetime") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_calendar_events_type" ON "public"."calendar_events" USING "btree" ("event_type") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_charge_categories_association" ON "public"."charge_categories" USING "btree" ("association_id");



CREATE INDEX "idx_charge_categories_portfolio" ON "public"."charge_categories" USING "btree" ("portfolio_id") WHERE ("active" AND ("archived_at" IS NULL));



CREATE INDEX "idx_charges_category" ON "public"."charges" USING "btree" ("charge_category_id");



CREATE INDEX "idx_charges_gl_account" ON "public"."charges" USING "btree" ("gl_account_id");



CREATE INDEX "idx_comm_triggers_association" ON "public"."communication_triggers" USING "btree" ("association_id");



CREATE INDEX "idx_comm_triggers_event" ON "public"."communication_triggers" USING "btree" ("trigger_event") WHERE "active";



CREATE INDEX "idx_comm_triggers_portfolio" ON "public"."communication_triggers" USING "btree" ("portfolio_id") WHERE "active";



CREATE INDEX "idx_comm_triggers_template" ON "public"."communication_triggers" USING "btree" ("template_id");



CREATE INDEX "idx_committee_members_committee" ON "public"."committee_members" USING "btree" ("committee_id");



CREATE INDEX "idx_committee_members_owner" ON "public"."committee_members" USING "btree" ("owner_id");



CREATE INDEX "idx_committees_association" ON "public"."committees" USING "btree" ("association_id") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_communication_messages_association_created" ON "public"."communication_messages" USING "btree" ("association_id", "created_at" DESC);



CREATE INDEX "idx_communication_messages_status" ON "public"."communication_messages" USING "btree" ("status", "channel");



CREATE INDEX "idx_communications_log_channel" ON "public"."communications_log" USING "btree" ("channel");



CREATE INDEX "idx_communications_log_created" ON "public"."communications_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_communications_log_portfolio" ON "public"."communications_log" USING "btree" ("portfolio_id");



CREATE INDEX "idx_data_exports_portfolio" ON "public"."data_export_requests" USING "btree" ("portfolio_id", "created_at" DESC);



CREATE INDEX "idx_data_exports_status" ON "public"."data_export_requests" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['pending'::"public"."export_status", 'running'::"public"."export_status"]));



CREATE INDEX "idx_data_exports_subject" ON "public"."data_export_requests" USING "btree" ("subject_auth_user_id", "created_at" DESC);



CREATE INDEX "idx_depr_entries_asset" ON "public"."depreciation_entries" USING "btree" ("fixed_asset_id");



CREATE INDEX "idx_depr_entries_journal" ON "public"."depreciation_entries" USING "btree" ("journal_entry_id");



CREATE INDEX "idx_depr_entries_period" ON "public"."depreciation_entries" USING "btree" ("period_year", "period_month");



CREATE UNIQUE INDEX "idx_diagnostics_dedup" ON "public"."data_diagnostics" USING "btree" ("portfolio_id", "category", COALESCE("entity_id", '00000000-0000-0000-0000-000000000000'::"uuid"), "title") WHERE ("resolved_at" IS NULL);



CREATE INDEX "idx_diagnostics_entity" ON "public"."data_diagnostics" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_diagnostics_portfolio_cat" ON "public"."data_diagnostics" USING "btree" ("portfolio_id", "category") WHERE ("resolved_at" IS NULL);



CREATE INDEX "idx_doc_requests_owner" ON "public"."document_requests" USING "btree" ("owner_id") WHERE ("status" <> 'approved'::"public"."document_request_status");



CREATE INDEX "idx_doc_requests_portfolio" ON "public"."document_requests" USING "btree" ("portfolio_id");



CREATE INDEX "idx_doc_requests_status" ON "public"."document_requests" USING "btree" ("status");



CREATE INDEX "idx_doc_requests_vendor" ON "public"."document_requests" USING "btree" ("vendor_id") WHERE ("status" <> 'approved'::"public"."document_request_status");



CREATE INDEX "idx_doc_templates_category" ON "public"."document_templates" USING "btree" ("template_category") WHERE "active";



CREATE INDEX "idx_doc_templates_portfolio" ON "public"."document_templates" USING "btree" ("portfolio_id") WHERE "active";



CREATE INDEX "idx_dues_increases_association" ON "public"."dues_increases" USING "btree" ("association_id", "effective_date" DESC);



CREATE INDEX "idx_dues_increases_status" ON "public"."dues_increases" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['draft'::"public"."dues_increase_status", 'scheduled'::"public"."dues_increase_status"]));



CREATE INDEX "idx_dues_lines_increase" ON "public"."dues_increase_lines" USING "btree" ("dues_increase_id");



CREATE INDEX "idx_dues_lines_occupancy" ON "public"."dues_increase_lines" USING "btree" ("occupancy_id");



CREATE INDEX "idx_email_queue_notice" ON "public"."email_queue" USING "btree" ("notice_id");



CREATE INDEX "idx_email_queue_pending" ON "public"."email_queue" USING "btree" ("status", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_email_queue_template" ON "public"."email_queue" USING "btree" ("template_id");



CREATE INDEX "idx_estimates_vendor" ON "public"."work_order_estimates" USING "btree" ("vendor_id");



CREATE INDEX "idx_estimates_wo" ON "public"."work_order_estimates" USING "btree" ("work_order_id");



CREATE INDEX "idx_fixed_assets_association" ON "public"."fixed_assets" USING "btree" ("association_id") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_fixed_assets_gl" ON "public"."fixed_assets" USING "btree" ("gl_account_id");



CREATE INDEX "idx_fixed_assets_portfolio" ON "public"."fixed_assets" USING "btree" ("portfolio_id") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_fixed_assets_status" ON "public"."fixed_assets" USING "btree" ("status") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_fixed_assets_unit" ON "public"."fixed_assets" USING "btree" ("unit_id");



CREATE INDEX "idx_form_submissions_owner" ON "public"."owner_form_submissions" USING "btree" ("owner_id", "form_type");



CREATE INDEX "idx_form_templates_portfolio" ON "public"."form_templates" USING "btree" ("portfolio_id") WHERE "active";



CREATE INDEX "idx_gl_accounts_association" ON "public"."gl_accounts" USING "btree" ("association_id") WHERE "active";



CREATE INDEX "idx_gl_accounts_parent" ON "public"."gl_accounts" USING "btree" ("sub_account_of_id");



CREATE INDEX "idx_gl_accounts_portfolio" ON "public"."gl_accounts" USING "btree" ("portfolio_id") WHERE "active";



CREATE INDEX "idx_gl_accounts_type" ON "public"."gl_accounts" USING "btree" ("account_type");



CREATE INDEX "idx_gl_role_perms_gl" ON "public"."gl_account_role_permissions" USING "btree" ("gl_account_id");



CREATE INDEX "idx_gl_role_perms_role" ON "public"."gl_account_role_permissions" USING "btree" ("role_id");



CREATE INDEX "idx_inspection_items_inspection" ON "public"."inspection_items" USING "btree" ("inspection_id");



CREATE INDEX "idx_inspection_items_severity" ON "public"."inspection_items" USING "btree" ("severity") WHERE (NOT "resolved");



CREATE INDEX "idx_inspection_items_wo" ON "public"."inspection_items" USING "btree" ("work_order_id");



CREATE INDEX "idx_inspections_association" ON "public"."inspections" USING "btree" ("association_id") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_inspections_inspector_user" ON "public"."inspections" USING "btree" ("inspector_user_id");



CREATE INDEX "idx_inspections_inspector_vendor" ON "public"."inspections" USING "btree" ("inspector_vendor_id");



CREATE INDEX "idx_inspections_portfolio" ON "public"."inspections" USING "btree" ("portfolio_id");



CREATE INDEX "idx_inspections_scheduled" ON "public"."inspections" USING "btree" ("scheduled_date") WHERE (("status" = 'scheduled'::"public"."inspection_status") AND ("archived_at" IS NULL));



CREATE INDEX "idx_inspections_status" ON "public"."inspections" USING "btree" ("status") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_inspections_unit" ON "public"."inspections" USING "btree" ("unit_id");



CREATE INDEX "idx_insurance_policies_expiration" ON "public"."insurance_policies" USING "btree" ("expiration_date") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_invoices_portfolio" ON "public"."invoices" USING "btree" ("portfolio_id");



CREATE INDEX "idx_invoices_status" ON "public"."invoices" USING "btree" ("status");



CREATE INDEX "idx_invoices_subscription" ON "public"."invoices" USING "btree" ("subscription_id");



CREATE INDEX "idx_je_batches_portfolio" ON "public"."journal_entry_batches" USING "btree" ("portfolio_id", "created_at" DESC);



CREATE INDEX "idx_journal_entries_batch" ON "public"."journal_entries" USING "btree" ("batch_id");



CREATE INDEX "idx_journal_entries_portfolio_date" ON "public"."journal_entries" USING "btree" ("portfolio_id", "entry_date" DESC);



CREATE INDEX "idx_journal_entries_source" ON "public"."journal_entries" USING "btree" ("source_type", "source_id");



CREATE INDEX "idx_journal_lines_association" ON "public"."journal_lines" USING "btree" ("association_id");



CREATE INDEX "idx_journal_lines_entry" ON "public"."journal_lines" USING "btree" ("entry_id");



CREATE INDEX "idx_journal_lines_gl" ON "public"."journal_lines" USING "btree" ("gl_account_id");



CREATE INDEX "idx_labor_entries_date" ON "public"."work_order_labor_entries" USING "btree" ("date_worked" DESC);



CREATE INDEX "idx_labor_entries_tech" ON "public"."work_order_labor_entries" USING "btree" ("tech_id");



CREATE INDEX "idx_labor_entries_wo" ON "public"."work_order_labor_entries" USING "btree" ("work_order_id");



CREATE INDEX "idx_leads_created" ON "public"."leads" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_leads_email" ON "public"."leads" USING "btree" ("email") WHERE ("email" IS NOT NULL);



CREATE INDEX "idx_leads_status" ON "public"."leads" USING "btree" ("status");



CREATE INDEX "idx_lock_box_assignments_active" ON "public"."lock_box_assignments" USING "btree" ("lock_box_id") WHERE ("returned_at" IS NULL);



CREATE INDEX "idx_lock_box_assignments_lock_box" ON "public"."lock_box_assignments" USING "btree" ("lock_box_id");



CREATE INDEX "idx_lock_box_assignments_profile" ON "public"."lock_box_assignments" USING "btree" ("profile_id");



CREATE INDEX "idx_lock_box_assignments_vendor" ON "public"."lock_box_assignments" USING "btree" ("vendor_id");



CREATE INDEX "idx_lock_boxes_association" ON "public"."lock_boxes" USING "btree" ("association_id");



CREATE INDEX "idx_lock_boxes_building" ON "public"."lock_boxes" USING "btree" ("building_id");



CREATE INDEX "idx_lock_boxes_portfolio" ON "public"."lock_boxes" USING "btree" ("portfolio_id");



CREATE INDEX "idx_lock_boxes_status" ON "public"."lock_boxes" USING "btree" ("status");



CREATE INDEX "idx_lockbox_batches_portfolio" ON "public"."lockbox_batches" USING "btree" ("portfolio_id", "batch_date" DESC);



CREATE INDEX "idx_lockbox_batches_status" ON "public"."lockbox_batches" USING "btree" ("status");



CREATE INDEX "idx_lockbox_items_batch" ON "public"."lockbox_items" USING "btree" ("batch_id");



CREATE INDEX "idx_lockbox_items_payment" ON "public"."lockbox_items" USING "btree" ("payment_id");



CREATE INDEX "idx_lockbox_items_unit" ON "public"."lockbox_items" USING "btree" ("unit_id") WHERE (NOT "rejected");



CREATE INDEX "idx_login_attempts_email_at" ON "public"."login_attempts" USING "btree" ("lower"("email"), "at" DESC);



CREATE INDEX "idx_login_attempts_ip_failed" ON "public"."login_attempts" USING "btree" ("ip_address", "at" DESC) WHERE (NOT "success");



CREATE INDEX "idx_login_attempts_portfolio" ON "public"."login_attempts" USING "btree" ("portfolio_id", "at" DESC);



CREATE INDEX "idx_login_attempts_user_at" ON "public"."login_attempts" USING "btree" ("auth_user_id", "at" DESC);



CREATE INDEX "idx_management_fees_association" ON "public"."management_fees" USING "btree" ("association_id");



CREATE INDEX "idx_management_fees_month" ON "public"."management_fees" USING "btree" ("month");



CREATE INDEX "idx_management_fees_portfolio" ON "public"."management_fees" USING "btree" ("portfolio_id");



CREATE INDEX "idx_meeting_attendees_meeting" ON "public"."meeting_attendees" USING "btree" ("meeting_id");



CREATE INDEX "idx_meeting_attendees_owner" ON "public"."meeting_attendees" USING "btree" ("owner_id");



CREATE INDEX "idx_meetings_association" ON "public"."meetings" USING "btree" ("association_id");



CREATE INDEX "idx_meetings_portfolio" ON "public"."meetings" USING "btree" ("portfolio_id");



CREATE INDEX "idx_meetings_start_time" ON "public"."meetings" USING "btree" ("start_time" DESC);



CREATE INDEX "idx_meetings_status" ON "public"."meetings" USING "btree" ("status");



CREATE INDEX "idx_message_templates_channel" ON "public"."message_templates" USING "btree" ("channel");



CREATE INDEX "idx_message_templates_portfolio" ON "public"."message_templates" USING "btree" ("portfolio_id");



CREATE INDEX "idx_messages_lead" ON "public"."lead_messages" USING "btree" ("lead_id", "created_at");



CREATE INDEX "idx_mgmt_agreements_association" ON "public"."management_agreements" USING "btree" ("association_id");



CREATE INDEX "idx_mgmt_agreements_expiring" ON "public"."management_agreements" USING "btree" ("end_date") WHERE (("status" = 'active'::"public"."agreement_status") AND ("archived_at" IS NULL));



CREATE INDEX "idx_mgmt_agreements_owner" ON "public"."management_agreements" USING "btree" ("owner_id");



CREATE INDEX "idx_mgmt_agreements_portfolio" ON "public"."management_agreements" USING "btree" ("portfolio_id") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_mgmt_fee_policies_assoc" ON "public"."management_fee_policies" USING "btree" ("association_id", "effective_from" DESC);



CREATE INDEX "idx_mgmt_fee_portfolio" ON "public"."management_fee_schedules" USING "btree" ("portfolio_id") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_mt_association" ON "public"."maintenance_tasks" USING "btree" ("association_id");



CREATE INDEX "idx_mt_category" ON "public"."maintenance_tasks" USING "btree" ("category");



CREATE INDEX "idx_mt_next_due" ON "public"."maintenance_tasks" USING "btree" ("next_due_date") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_notice_recipients_notice" ON "public"."notice_recipients" USING "btree" ("notice_id");



CREATE INDEX "idx_notice_recipients_owner" ON "public"."notice_recipients" USING "btree" ("owner_id");



CREATE INDEX "idx_notices_association" ON "public"."notices" USING "btree" ("association_id");



CREATE INDEX "idx_notices_status" ON "public"."notices" USING "btree" ("status");



CREATE INDEX "idx_notices_template" ON "public"."notices" USING "btree" ("template_id");



CREATE INDEX "idx_notices_type" ON "public"."notices" USING "btree" ("notice_type");



CREATE INDEX "idx_occupancies_association" ON "public"."occupancies" USING "btree" ("association_id");



CREATE INDEX "idx_occupancies_owner" ON "public"."occupancies" USING "btree" ("owner_id");



CREATE INDEX "idx_occupancies_unit" ON "public"."occupancies" USING "btree" ("unit_id") WHERE ("status" = 'current'::"public"."occupancy_status");



CREATE INDEX "idx_owner_payables_association" ON "public"."owner_payables" USING "btree" ("association_id");



CREATE INDEX "idx_owner_payables_due_date" ON "public"."owner_payables" USING "btree" ("due_date");



CREATE INDEX "idx_owner_payables_owner" ON "public"."owner_payables" USING "btree" ("owner_id");



CREATE INDEX "idx_owner_payables_portfolio" ON "public"."owner_payables" USING "btree" ("portfolio_id");



CREATE INDEX "idx_owner_payables_status" ON "public"."owner_payables" USING "btree" ("status");



CREATE INDEX "idx_owner_statements_association" ON "public"."owner_statements" USING "btree" ("association_id");



CREATE INDEX "idx_owner_statements_batch" ON "public"."owner_statements" USING "btree" ("batch_id");



CREATE INDEX "idx_owner_statements_owner" ON "public"."owner_statements" USING "btree" ("owner_id");



CREATE INDEX "idx_owner_statements_period" ON "public"."owner_statements" USING "btree" ("period_start", "period_end");



CREATE UNIQUE INDEX "idx_owners_auth_user" ON "public"."owners" USING "btree" ("auth_user_id") WHERE ("auth_user_id" IS NOT NULL);



CREATE INDEX "idx_owners_portfolio" ON "public"."owners" USING "btree" ("portfolio_id");



CREATE INDEX "idx_packets_owner" ON "public"."owner_packets" USING "btree" ("owner_id");



CREATE INDEX "idx_payable_bills_association" ON "public"."payable_bills" USING "btree" ("association_id");



CREATE INDEX "idx_payable_bills_bank" ON "public"."payable_bills" USING "btree" ("bank_account_id");



CREATE INDEX "idx_payable_bills_due" ON "public"."payable_bills" USING "btree" ("due_date") WHERE (("archived_at" IS NULL) AND ("status" = ANY (ARRAY['approved'::"public"."payable_bill_status", 'pending_approval'::"public"."payable_bill_status"])));



CREATE INDEX "idx_payable_bills_gl" ON "public"."payable_bills" USING "btree" ("gl_account_id");



CREATE INDEX "idx_payable_bills_portfolio" ON "public"."payable_bills" USING "btree" ("portfolio_id");



CREATE INDEX "idx_payable_bills_status" ON "public"."payable_bills" USING "btree" ("status") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_payable_bills_vendor" ON "public"."payable_bills" USING "btree" ("vendor_id") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_payable_bills_work_order" ON "public"."payable_bills" USING "btree" ("work_order_id") WHERE ("work_order_id" IS NOT NULL);



CREATE INDEX "idx_payment_apps_applied" ON "public"."payment_applications" USING "btree" ("applied_at" DESC);



CREATE INDEX "idx_payment_apps_charge" ON "public"."payment_applications" USING "btree" ("charge_id");



CREATE INDEX "idx_payment_apps_payment" ON "public"."payment_applications" USING "btree" ("payment_id");



CREATE INDEX "idx_payment_events_intent" ON "public"."payment_events" USING "btree" ("payment_intent_id", "created_at");



CREATE INDEX "idx_payment_intents_owner" ON "public"."payment_intents" USING "btree" ("owner_id");



CREATE INDEX "idx_payment_intents_payout" ON "public"."payment_intents" USING "btree" ("processor_payout_id") WHERE ("processor_payout_id" IS NOT NULL);



CREATE INDEX "idx_payment_intents_portfolio" ON "public"."payment_intents" USING "btree" ("portfolio_id", "status");



CREATE UNIQUE INDEX "idx_payment_intents_session" ON "public"."payment_intents" USING "btree" ("processor_session_id") WHERE ("processor_session_id" IS NOT NULL);



CREATE INDEX "idx_payment_methods_owner" ON "public"."payment_methods" USING "btree" ("owner_id") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_payment_methods_portfolio" ON "public"."payment_methods" USING "btree" ("portfolio_id");



CREATE INDEX "idx_payments_bank_account" ON "public"."payments" USING "btree" ("bank_account_id");



CREATE INDEX "idx_payments_gl_account" ON "public"."payments" USING "btree" ("gl_account_id");



CREATE UNIQUE INDEX "idx_payout_batches_processor" ON "public"."payout_batches" USING "btree" ("processor", "processor_payout_id");



CREATE INDEX "idx_payout_batches_status" ON "public"."payout_batches" USING "btree" ("portfolio_id", "status");



CREATE INDEX "idx_perm_audit_action" ON "public"."permission_audit_log" USING "btree" ("action", "at" DESC);



CREATE INDEX "idx_perm_audit_actor" ON "public"."permission_audit_log" USING "btree" ("actor_user_id", "at" DESC);



CREATE INDEX "idx_perm_audit_portfolio" ON "public"."permission_audit_log" USING "btree" ("actor_portfolio_id", "at" DESC);



CREATE INDEX "idx_perm_audit_target" ON "public"."permission_audit_log" USING "btree" ("target_entity_type", "target_entity_id", "at" DESC);



CREATE INDEX "idx_platform_imp_operator" ON "public"."platform_impersonation_log" USING "btree" ("operator_id");



CREATE INDEX "idx_platform_imp_portfolio" ON "public"."platform_impersonation_log" USING "btree" ("impersonated_portfolio_id");



CREATE INDEX "idx_platform_imp_started_at" ON "public"."platform_impersonation_log" USING "btree" ("started_at" DESC);



CREATE INDEX "idx_platform_operators_active" ON "public"."platform_operators" USING "btree" ("auth_user_id") WHERE "active";



CREATE INDEX "idx_po_line_items_gl" ON "public"."purchase_order_line_items" USING "btree" ("gl_account_id");



CREATE INDEX "idx_po_line_items_po" ON "public"."purchase_order_line_items" USING "btree" ("purchase_order_id");



CREATE INDEX "idx_portal_invites_owner" ON "public"."owner_portal_invites" USING "btree" ("owner_id");



CREATE INDEX "idx_portal_invites_status" ON "public"."owner_portal_invites" USING "btree" ("status");



CREATE INDEX "idx_portfolios_suspended" ON "public"."portfolios" USING "btree" ("suspended_at") WHERE ("suspended_at" IS NOT NULL);



CREATE INDEX "idx_privacy_actions_deadline" ON "public"."privacy_actions" USING "btree" ("deadline") WHERE ("status" <> ALL (ARRAY['completed'::"public"."privacy_action_status", 'rejected'::"public"."privacy_action_status"]));



CREATE INDEX "idx_privacy_actions_portfolio" ON "public"."privacy_actions" USING "btree" ("portfolio_id", "created_at" DESC);



CREATE INDEX "idx_privacy_actions_subject" ON "public"."privacy_actions" USING "btree" ("lower"("subject_email"), "created_at" DESC);



CREATE INDEX "idx_privacy_actions_type" ON "public"."privacy_actions" USING "btree" ("action_type", "status");



CREATE INDEX "idx_processor_configs_portfolio" ON "public"."payment_processor_configs" USING "btree" ("portfolio_id") WHERE "is_active";



CREATE INDEX "idx_profiles_portfolio" ON "public"."profiles" USING "btree" ("portfolio_id");



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role_id");



CREATE INDEX "idx_property_groups_portfolio" ON "public"."property_groups" USING "btree" ("portfolio_id");



CREATE INDEX "idx_purchase_orders_association" ON "public"."purchase_orders" USING "btree" ("association_id") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_purchase_orders_portfolio" ON "public"."purchase_orders" USING "btree" ("portfolio_id");



CREATE INDEX "idx_purchase_orders_status" ON "public"."purchase_orders" USING "btree" ("status") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_purchase_orders_vendor" ON "public"."purchase_orders" USING "btree" ("vendor_id");



CREATE INDEX "idx_purchase_orders_work_order" ON "public"."purchase_orders" USING "btree" ("work_order_id");



CREATE INDEX "idx_recerts_due" ON "public"."income_recertifications" USING "btree" ("due_date") WHERE ("status" <> ALL (ARRAY['approved'::"public"."recert_status", 'rejected'::"public"."recert_status"]));



CREATE INDEX "idx_recerts_portfolio" ON "public"."income_recertifications" USING "btree" ("portfolio_id");



CREATE INDEX "idx_recerts_status" ON "public"."income_recertifications" USING "btree" ("status");



CREATE INDEX "idx_recerts_unit" ON "public"."income_recertifications" USING "btree" ("unit_id");



CREATE INDEX "idx_recurring_bills_next" ON "public"."recurring_bills" USING "btree" ("next_post_date") WHERE ("auto_generate" AND ("archived_at" IS NULL));



CREATE INDEX "idx_recurring_bills_portfolio" ON "public"."recurring_bills" USING "btree" ("portfolio_id") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_recurring_je_next" ON "public"."recurring_journal_entries" USING "btree" ("next_post_date") WHERE ("auto_generate" AND ("archived_at" IS NULL));



CREATE INDEX "idx_recurring_je_portfolio" ON "public"."recurring_journal_entries" USING "btree" ("portfolio_id") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_recurring_wo_association" ON "public"."recurring_work_orders" USING "btree" ("association_id") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_recurring_wo_gl" ON "public"."recurring_work_orders" USING "btree" ("gl_account_id");



CREATE INDEX "idx_recurring_wo_next_due" ON "public"."recurring_work_orders" USING "btree" ("next_due_date") WHERE ("auto_generate" AND ("archived_at" IS NULL));



CREATE INDEX "idx_recurring_wo_unit" ON "public"."recurring_work_orders" USING "btree" ("unit_id");



CREATE INDEX "idx_recurring_wo_vendor" ON "public"."recurring_work_orders" USING "btree" ("vendor_id");



CREATE INDEX "idx_recurring_work_orders_portfolio" ON "public"."recurring_work_orders" USING "btree" ("portfolio_id");



CREATE INDEX "idx_report_defs_category" ON "public"."report_definitions" USING "btree" ("category") WHERE "active";



CREATE INDEX "idx_report_defs_portfolio" ON "public"."report_definitions" USING "btree" ("portfolio_id") WHERE "active";



CREATE INDEX "idx_report_runs_definition" ON "public"."report_runs" USING "btree" ("definition_id");



CREATE INDEX "idx_report_runs_portfolio_created" ON "public"."report_runs" USING "btree" ("portfolio_id", "created_at" DESC);



CREATE INDEX "idx_report_runs_saved" ON "public"."report_runs" USING "btree" ("saved_report_id");



CREATE INDEX "idx_report_runs_scheduled" ON "public"."report_runs" USING "btree" ("scheduled_report_id");



CREATE INDEX "idx_report_runs_status" ON "public"."report_runs" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['queued'::"public"."report_run_status", 'running'::"public"."report_run_status"]));



CREATE INDEX "idx_report_snapshots_assoc" ON "public"."report_snapshots" USING "btree" ("association_id");



CREATE INDEX "idx_report_snapshots_definition" ON "public"."report_snapshots" USING "btree" ("definition_id");



CREATE INDEX "idx_report_snapshots_generated" ON "public"."report_snapshots" USING "btree" ("generated_at" DESC);



CREATE INDEX "idx_report_snapshots_run" ON "public"."report_snapshots" USING "btree" ("run_id");



CREATE INDEX "idx_report_snapshots_type" ON "public"."report_snapshots" USING "btree" ("report_type");



CREATE INDEX "idx_saved_reports_definition" ON "public"."saved_reports" USING "btree" ("definition_id");



CREATE INDEX "idx_saved_reports_pinned" ON "public"."saved_reports" USING "btree" ("portfolio_id") WHERE "pinned";



CREATE INDEX "idx_saved_reports_portfolio" ON "public"."saved_reports" USING "btree" ("portfolio_id");



CREATE INDEX "idx_saved_reports_user" ON "public"."saved_reports" USING "btree" ("user_id");



CREATE INDEX "idx_scheduled_reports_definition" ON "public"."scheduled_reports" USING "btree" ("definition_id");



CREATE INDEX "idx_scheduled_reports_next_run" ON "public"."scheduled_reports" USING "btree" ("next_run_at") WHERE ("active" AND ("archived_at" IS NULL));



CREATE INDEX "idx_scheduled_reports_portfolio" ON "public"."scheduled_reports" USING "btree" ("portfolio_id") WHERE ("active" AND ("archived_at" IS NULL));



CREATE INDEX "idx_scheduled_reports_saved" ON "public"."scheduled_reports" USING "btree" ("saved_report_id");



CREATE INDEX "idx_service_requests_association" ON "public"."service_requests" USING "btree" ("association_id") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_service_requests_homeowner" ON "public"."service_requests" USING "btree" ("homeowner_id");



CREATE INDEX "idx_service_requests_owner" ON "public"."service_requests" USING "btree" ("owner_id");



CREATE INDEX "idx_service_requests_portfolio" ON "public"."service_requests" USING "btree" ("portfolio_id");



CREATE INDEX "idx_service_requests_status" ON "public"."service_requests" USING "btree" ("status") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_service_requests_unit" ON "public"."service_requests" USING "btree" ("unit_id");



CREATE INDEX "idx_sms_conversations_association" ON "public"."sms_conversations" USING "btree" ("association_id");



CREATE INDEX "idx_sms_conversations_entity" ON "public"."sms_conversations" USING "btree" ("with_entity_type", "with_entity_id");



CREATE INDEX "idx_sms_conversations_last_msg" ON "public"."sms_conversations" USING "btree" ("last_message_at" DESC NULLS LAST) WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_sms_conversations_phone" ON "public"."sms_conversations" USING "btree" ("with_phone_number");



CREATE INDEX "idx_sms_conversations_portfolio" ON "public"."sms_conversations" USING "btree" ("portfolio_id") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_sms_messages_conversation" ON "public"."sms_messages" USING "btree" ("conversation_id", "created_at");



CREATE INDEX "idx_sms_messages_provider_id" ON "public"."sms_messages" USING "btree" ("provider_message_id");



CREATE INDEX "idx_sms_messages_status" ON "public"."sms_messages" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['queued'::"public"."sms_status", 'failed'::"public"."sms_status"]));



CREATE INDEX "idx_sms_opt_ins_entity" ON "public"."sms_opt_ins" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_sms_opt_ins_phone" ON "public"."sms_opt_ins" USING "btree" ("phone_number");



CREATE INDEX "idx_sms_opt_ins_portfolio" ON "public"."sms_opt_ins" USING "btree" ("portfolio_id");



CREATE INDEX "idx_soft_delete_actor" ON "public"."soft_delete_log" USING "btree" ("archived_by", "archived_at" DESC);



CREATE INDEX "idx_soft_delete_entity" ON "public"."soft_delete_log" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_soft_delete_portfolio" ON "public"."soft_delete_log" USING "btree" ("portfolio_id", "archived_at" DESC);



CREATE INDEX "idx_statement_batches_assoc" ON "public"."statement_batches" USING "btree" ("association_id");



CREATE INDEX "idx_statement_batches_status" ON "public"."statement_batches" USING "btree" ("status");



CREATE INDEX "idx_statements_assoc" ON "public"."statements" USING "btree" ("association_id");



CREATE INDEX "idx_statements_owner" ON "public"."statements" USING "btree" ("owner_id");



CREATE INDEX "idx_statements_period" ON "public"."statements" USING "btree" ("period_year", "period_month");



CREATE INDEX "idx_statements_unit" ON "public"."statements" USING "btree" ("unit_id");



CREATE INDEX "idx_sub_events_portfolio" ON "public"."subscription_events" USING "btree" ("portfolio_id", "at" DESC);



CREATE INDEX "idx_sub_events_subscription" ON "public"."subscription_events" USING "btree" ("subscription_id", "at" DESC);



CREATE INDEX "idx_subscriptions_status" ON "public"."subscriptions" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['past_due'::"public"."subscription_status", 'trialing'::"public"."subscription_status"]));



CREATE INDEX "idx_subscriptions_trial_ends" ON "public"."subscriptions" USING "btree" ("trial_ends_at") WHERE ("status" = 'trialing'::"public"."subscription_status");



CREATE INDEX "idx_survey_responses_owner" ON "public"."survey_responses" USING "btree" ("submitted_by_owner_id");



CREATE INDEX "idx_survey_responses_submitted" ON "public"."survey_responses" USING "btree" ("submitted_at" DESC);



CREATE INDEX "idx_survey_responses_survey" ON "public"."survey_responses" USING "btree" ("survey_id");



CREATE INDEX "idx_survey_responses_wo" ON "public"."survey_responses" USING "btree" ("work_order_id");



CREATE INDEX "idx_surveys_portfolio" ON "public"."surveys" USING "btree" ("portfolio_id") WHERE ("active" AND ("archived_at" IS NULL));



CREATE INDEX "idx_surveys_type" ON "public"."surveys" USING "btree" ("survey_type");



CREATE INDEX "idx_tag_assignments_entity" ON "public"."tag_assignments" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_tag_assignments_tag" ON "public"."tag_assignments" USING "btree" ("tag_id");



CREATE INDEX "idx_tags_portfolio" ON "public"."tags" USING "btree" ("portfolio_id");



CREATE INDEX "idx_templates_group" ON "public"."maintenance_templates" USING "btree" ("group_id");



CREATE INDEX "idx_unit_amenities_unit" ON "public"."unit_amenities" USING "btree" ("unit_id");



CREATE INDEX "idx_unit_recurring_charges_category" ON "public"."unit_recurring_charges" USING "btree" ("charge_category_id");



CREATE INDEX "idx_unit_recurring_charges_next" ON "public"."unit_recurring_charges" USING "btree" ("next_post_date") WHERE "active";



CREATE INDEX "idx_unit_recurring_charges_unit" ON "public"."unit_recurring_charges" USING "btree" ("unit_id") WHERE "active";



CREATE INDEX "idx_usage_metrics_portfolio_period" ON "public"."usage_metrics" USING "btree" ("portfolio_id", "period_year" DESC, "period_month" DESC);



CREATE INDEX "idx_user_invitations_email" ON "public"."user_invitations" USING "btree" ("lower"("email"));



CREATE INDEX "idx_user_invitations_email_lower" ON "public"."user_invitations" USING "btree" ("lower"("email"));



CREATE INDEX "idx_user_invitations_pending" ON "public"."user_invitations" USING "btree" ("portfolio_id", "status") WHERE ("status" = 'pending'::"public"."invitation_status");



CREATE INDEX "idx_user_invitations_portfolio" ON "public"."user_invitations" USING "btree" ("portfolio_id");



CREATE INDEX "idx_user_invitations_status" ON "public"."user_invitations" USING "btree" ("status");



CREATE INDEX "idx_user_roles_portfolio" ON "public"."user_roles" USING "btree" ("portfolio_id");



CREATE INDEX "idx_user_sessions_active" ON "public"."user_sessions" USING "btree" ("auth_user_id") WHERE ("ended_at" IS NULL);



CREATE INDEX "idx_user_sessions_portfolio" ON "public"."user_sessions" USING "btree" ("portfolio_id", "started_at" DESC);



CREATE INDEX "idx_user_sessions_user" ON "public"."user_sessions" USING "btree" ("auth_user_id", "started_at" DESC);



CREATE UNIQUE INDEX "idx_vendors_auth_user" ON "public"."vendors" USING "btree" ("auth_user_id") WHERE ("auth_user_id" IS NOT NULL);



CREATE INDEX "idx_vendors_auto_pay" ON "public"."vendors" USING "btree" ("portfolio_id") WHERE ("is_auto_pay" AND (NOT ("archived_at" IS NOT NULL)));



CREATE INDEX "idx_vendors_default_gl" ON "public"."vendors" USING "btree" ("default_gl_account_id") WHERE ("default_gl_account_id" IS NOT NULL);



CREATE INDEX "idx_vendors_name_trgm" ON "public"."vendors" USING "gin" ("name" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_vendors_portfolio" ON "public"."vendors" USING "btree" ("portfolio_id") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_vendors_trade" ON "public"."vendors" USING "btree" ("trade") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_vendors_utility" ON "public"."vendors" USING "btree" ("portfolio_id") WHERE "is_utility";



CREATE INDEX "idx_violation_followup_assoc" ON "public"."violation_followup_steps" USING "btree" ("association_id", "step_order") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_violation_updates_violation" ON "public"."violation_updates" USING "btree" ("violation_id");



CREATE INDEX "idx_violations_association" ON "public"."violations" USING "btree" ("association_id");



CREATE INDEX "idx_violations_due" ON "public"."violations" USING "btree" ("due_date") WHERE (("archived_at" IS NULL) AND ("status" <> 'closed'::"public"."violation_status"));



CREATE INDEX "idx_violations_owner" ON "public"."violations" USING "btree" ("owner_id");



CREATE INDEX "idx_violations_status" ON "public"."violations" USING "btree" ("status");



CREATE INDEX "idx_violations_unit" ON "public"."violations" USING "btree" ("unit_id");



CREATE INDEX "idx_votes_ballot" ON "public"."votes" USING "btree" ("ballot_id");



CREATE INDEX "idx_votes_owner" ON "public"."votes" USING "btree" ("owner_id");



CREATE INDEX "idx_votes_unit" ON "public"."votes" USING "btree" ("unit_id");



CREATE INDEX "idx_webhook_deliveries_endpoint" ON "public"."webhook_deliveries" USING "btree" ("endpoint_id", "created_at" DESC);



CREATE INDEX "idx_webhook_deliveries_pending" ON "public"."webhook_deliveries" USING "btree" ("next_attempt_at") WHERE ("status" = ANY (ARRAY['pending'::"public"."webhook_delivery_status", 'retrying'::"public"."webhook_delivery_status"]));



CREATE INDEX "idx_webhook_deliveries_status" ON "public"."webhook_deliveries" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_webhook_endpoints_events" ON "public"."webhook_endpoints" USING "gin" ("events");



CREATE INDEX "idx_webhook_endpoints_portfolio" ON "public"."webhook_endpoints" USING "btree" ("portfolio_id") WHERE "active";



CREATE INDEX "idx_wo_updates_order" ON "public"."work_order_updates" USING "btree" ("work_order_id");



CREATE INDEX "idx_work_orders_assignee" ON "public"."work_orders" USING "btree" ("assignee_id");



CREATE INDEX "idx_work_orders_association" ON "public"."work_orders" USING "btree" ("association_id");



CREATE INDEX "idx_work_orders_portfolio" ON "public"."work_orders" USING "btree" ("portfolio_id");



CREATE INDEX "idx_work_orders_priority" ON "public"."work_orders" USING "btree" ("priority");



CREATE INDEX "idx_work_orders_service_request" ON "public"."work_orders" USING "btree" ("service_request_id");



CREATE INDEX "idx_work_orders_status" ON "public"."work_orders" USING "btree" ("status");



CREATE INDEX "idx_work_orders_unit" ON "public"."work_orders" USING "btree" ("unit_id");



CREATE INDEX "idx_work_orders_vendor" ON "public"."work_orders" USING "btree" ("vendor_id") WHERE ("archived_at" IS NULL);



CREATE INDEX "late_fee_assessments_association_idx" ON "public"."late_fee_assessments" USING "btree" ("association_id");



CREATE INDEX "marketing_leads_created_at_idx" ON "public"."marketing_leads" USING "btree" ("created_at" DESC);



CREATE INDEX "marketing_leads_status_idx" ON "public"."marketing_leads" USING "btree" ("status");



CREATE INDEX "owner_attachments_owner_idx" ON "public"."owner_attachments" USING "btree" ("owner_id");



CREATE INDEX "owner_vehicles_owner_idx" ON "public"."owner_vehicles" USING "btree" ("owner_id");



CREATE INDEX "owners_active_idx" ON "public"."owners" USING "btree" ("id");



CREATE UNIQUE INDEX "parking_assignments_one_active_per_space" ON "public"."parking_assignments" USING "btree" ("parking_space_id") WHERE ("status" = 'active'::"text");



CREATE INDEX "parking_assignments_portfolio_idx" ON "public"."parking_assignments" USING "btree" ("portfolio_id");



CREATE INDEX "parking_assignments_space_idx" ON "public"."parking_assignments" USING "btree" ("parking_space_id");



CREATE INDEX "parking_assignments_unit_idx" ON "public"."parking_assignments" USING "btree" ("unit_id");



CREATE INDEX "parking_spaces_assoc_idx" ON "public"."parking_spaces" USING "btree" ("association_id");



CREATE INDEX "parking_spaces_portfolio_idx" ON "public"."parking_spaces" USING "btree" ("portfolio_id");



CREATE INDEX "payments_charge_idx" ON "public"."payments" USING "btree" ("charge_id");



CREATE INDEX "payments_date_idx" ON "public"."payments" USING "btree" ("payment_date");



CREATE UNIQUE INDEX "payments_stripe_reference_unique" ON "public"."payments" USING "btree" ("reference") WHERE ("reference" ~ '^pi_'::"text");



CREATE INDEX "payments_unit_idx" ON "public"."payments" USING "btree" ("unit_id");



CREATE UNIQUE INDEX "portfolios_custom_domain_key" ON "public"."portfolios" USING "btree" ("lower"("custom_domain")) WHERE ("custom_domain" IS NOT NULL);



CREATE UNIQUE INDEX "portfolios_slug_key" ON "public"."portfolios" USING "btree" ("slug") WHERE ("slug" IS NOT NULL);



CREATE INDEX "receptionist_knowledge_fts" ON "public"."receptionist_knowledge" USING "gin" ("to_tsvector"('"english"'::"regconfig", (("title" || ' '::"text") || "body")));



CREATE INDEX "saved_report_views_portfolio_idx" ON "public"."saved_report_views" USING "btree" ("portfolio_id");



CREATE INDEX "shares_slug_idx" ON "public"."shares" USING "btree" ("slug");



CREATE INDEX "shares_user_idx" ON "public"."shares" USING "btree" ("user_id");



CREATE INDEX "tenancies_active_idx" ON "public"."tenancies" USING "btree" ("unit_id");



CREATE INDEX "tenancies_unit_idx" ON "public"."tenancies" USING "btree" ("unit_id");



CREATE INDEX "tenants_owner_idx" ON "public"."tenants" USING "btree" ("owner_id");



CREATE INDEX "tenants_portfolio_idx" ON "public"."tenants" USING "btree" ("portfolio_id");



CREATE INDEX "tenants_unit_idx" ON "public"."tenants" USING "btree" ("unit_id");



CREATE UNIQUE INDEX "unit_owners_active_unique" ON "public"."unit_owners" USING "btree" ("unit_id", "owner_id");



CREATE INDEX "unit_owners_owner_idx" ON "public"."unit_owners" USING "btree" ("owner_id");



CREATE INDEX "unit_owners_unit_idx" ON "public"."unit_owners" USING "btree" ("unit_id");



CREATE INDEX "unit_pets_portfolio_idx" ON "public"."unit_pets" USING "btree" ("portfolio_id");



CREATE INDEX "unit_pets_unit_idx" ON "public"."unit_pets" USING "btree" ("unit_id");



CREATE INDEX "units_active_idx" ON "public"."units" USING "btree" ("building_id");



CREATE INDEX "units_building_idx" ON "public"."units" USING "btree" ("building_id");



CREATE UNIQUE INDEX "units_unique_number_per_building" ON "public"."units" USING "btree" ("building_id", "unit_number");



CREATE UNIQUE INDEX "uq_amenity_tags_portfolio_name" ON "public"."amenity_tags" USING "btree" ("portfolio_id", "lower"("name"));



CREATE UNIQUE INDEX "uq_assoc_amenities_name" ON "public"."association_amenities" USING "btree" ("association_id", "lower"("name"));



CREATE UNIQUE INDEX "uq_charge_categories_code" ON "public"."charge_categories" USING "btree" ("portfolio_id", "association_id", "lower"("code")) WHERE ("code" IS NOT NULL);



CREATE UNIQUE INDEX "uq_default_processor_per_portfolio" ON "public"."payment_processor_configs" USING "btree" ("portfolio_id") WHERE ("is_default" AND "is_active");



CREATE UNIQUE INDEX "uq_payment_method_default_per_owner" ON "public"."payment_methods" USING "btree" ("owner_id") WHERE ("is_default" AND ("archived_at" IS NULL));



CREATE UNIQUE INDEX "uq_unit_amenities_name" ON "public"."unit_amenities" USING "btree" ("unit_id", "lower"("name"));



CREATE INDEX "work_order_messages_wo_idx" ON "public"."work_order_messages" USING "btree" ("work_order_id", "created_at");



CREATE INDEX "workflows_user_idx" ON "public"."workflows" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "agents_touch" BEFORE UPDATE ON "public"."agents" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "marketing_leads_touch_updated_at" BEFORE UPDATE ON "public"."marketing_leads" FOR EACH ROW EXECUTE FUNCTION "public"."_marketing_leads_touch_updated_at"();



CREATE OR REPLACE TRIGGER "profiles_touch" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "set_lock_box_assignments_updated_at" BEFORE UPDATE ON "public"."lock_box_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_lock_boxes_updated_at" BEFORE UPDATE ON "public"."lock_boxes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_acct_periods_updated" BEFORE UPDATE ON "public"."accounting_periods" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_amenity_reservations_updated_at" BEFORE UPDATE ON "public"."amenity_reservations" FOR EACH ROW EXECUTE FUNCTION "public"."amenity_reservations_touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_api_keys_updated" BEFORE UPDATE ON "public"."api_keys" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_approval_requests_updated" BEFORE UPDATE ON "public"."approval_requests" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_architectural_requests_updated_at" BEFORE UPDATE ON "public"."architectural_requests" FOR EACH ROW EXECUTE FUNCTION "public"."architectural_requests_touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_associations_set_slug" BEFORE INSERT OR UPDATE OF "name", "slug" ON "public"."associations" FOR EACH ROW EXECUTE FUNCTION "public"."associations_set_slug"();



CREATE OR REPLACE TRIGGER "trg_auto_apply_credit" AFTER INSERT ON "public"."charges" FOR EACH ROW EXECUTE FUNCTION "public"."auto_apply_credit_on_new_charge"();



CREATE OR REPLACE TRIGGER "trg_auto_apply_payment" AFTER INSERT ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."auto_apply_new_payment"();



CREATE OR REPLACE TRIGGER "trg_auto_seed_charge_categories" AFTER INSERT ON "public"."portfolios" FOR EACH ROW EXECUTE FUNCTION "public"."trg_seed_standard_charge_categories"();



CREATE OR REPLACE TRIGGER "trg_automation_flows_updated_at" BEFORE UPDATE ON "public"."automation_flows" FOR EACH ROW EXECUTE FUNCTION "public"."automation_flows_touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_autopay_updated" BEFORE UPDATE ON "public"."autopay_mandates" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_bank_accounts_updated" BEFORE UPDATE ON "public"."bank_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_bank_reconciliation_complete" AFTER UPDATE ON "public"."bank_reconciliations" FOR EACH ROW EXECUTE FUNCTION "public"."update_bank_account_reconciliation_date"();



CREATE OR REPLACE TRIGGER "trg_bank_transfers_updated" BEFORE UPDATE ON "public"."bank_transfers" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_bill_line_items_updated" BEFORE UPDATE ON "public"."payable_bill_line_items" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_board_members_updated" BEFORE UPDATE ON "public"."board_members" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_budget_lines_updated" BEFORE UPDATE ON "public"."budget_lines" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_calendar_events_updated" BEFORE UPDATE ON "public"."calendar_events" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_calendar_maintenance_notify" AFTER INSERT OR UPDATE OF "notify_maintenance", "maintenance_instructions" ON "public"."calendar_events" FOR EACH ROW EXECUTE FUNCTION "public"."dispatch_calendar_maintenance_notify"();



CREATE OR REPLACE TRIGGER "trg_calendar_sms_notify" AFTER INSERT OR UPDATE OF "notify_sms", "maintenance_instructions" ON "public"."calendar_events" FOR EACH ROW EXECUTE FUNCTION "public"."dispatch_calendar_sms_notify"();



CREATE OR REPLACE TRIGGER "trg_charge_categories_updated" BEFORE UPDATE ON "public"."charge_categories" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_check_portfolio_suspended" BEFORE INSERT OR UPDATE OF "portfolio_id" ON "public"."profiles" FOR EACH ROW WHEN (("new"."portfolio_id" IS NOT NULL)) EXECUTE FUNCTION "public"."check_portfolio_not_suspended"();



CREATE OR REPLACE TRIGGER "trg_check_seat_limit" BEFORE INSERT OR UPDATE OF "portfolio_id", "hoa_role" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."check_seat_limit"();



CREATE OR REPLACE TRIGGER "trg_comm_triggers_updated" BEFORE UPDATE ON "public"."communication_triggers" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_committees_updated" BEFORE UPDATE ON "public"."committees" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_data_exports_updated" BEFORE UPDATE ON "public"."data_export_requests" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_dispatch_bill" AFTER INSERT OR UPDATE ON "public"."payable_bills" FOR EACH ROW EXECUTE FUNCTION "public"."dispatch_bill_webhook"();



CREATE OR REPLACE TRIGGER "trg_dispatch_charge_created" AFTER INSERT ON "public"."charges" FOR EACH ROW EXECUTE FUNCTION "public"."dispatch_charge_webhook"();



CREATE OR REPLACE TRIGGER "trg_dispatch_charge_update" AFTER UPDATE ON "public"."charges" FOR EACH ROW EXECUTE FUNCTION "public"."dispatch_charge_status_webhook"();



CREATE OR REPLACE TRIGGER "trg_dispatch_inspection" AFTER UPDATE OF "status" ON "public"."inspections" FOR EACH ROW EXECUTE FUNCTION "public"."dispatch_inspection_webhook"();



CREATE OR REPLACE TRIGGER "trg_dispatch_notice" AFTER UPDATE OF "status" ON "public"."notices" FOR EACH ROW EXECUTE FUNCTION "public"."dispatch_notice_webhook"();



CREATE OR REPLACE TRIGGER "trg_dispatch_owner" AFTER INSERT OR UPDATE ON "public"."owners" FOR EACH ROW EXECUTE FUNCTION "public"."dispatch_owner_webhook"();



CREATE OR REPLACE TRIGGER "trg_dispatch_payment_received" AFTER INSERT ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."dispatch_payment_webhook"();



CREATE OR REPLACE TRIGGER "trg_dispatch_sr" AFTER INSERT OR UPDATE ON "public"."service_requests" FOR EACH ROW EXECUTE FUNCTION "public"."dispatch_sr_webhook"();



CREATE OR REPLACE TRIGGER "trg_dispatch_statement" AFTER INSERT ON "public"."statements" FOR EACH ROW EXECUTE FUNCTION "public"."dispatch_statement_webhook"();



CREATE OR REPLACE TRIGGER "trg_dispatch_violation" AFTER INSERT OR UPDATE ON "public"."violations" FOR EACH ROW EXECUTE FUNCTION "public"."dispatch_violation_webhook"();



CREATE OR REPLACE TRIGGER "trg_dispatch_wo_created" AFTER INSERT ON "public"."work_orders" FOR EACH ROW EXECUTE FUNCTION "public"."dispatch_wo_created_webhook"();



CREATE OR REPLACE TRIGGER "trg_dispatch_wo_status" AFTER UPDATE OF "status" ON "public"."work_orders" FOR EACH ROW EXECUTE FUNCTION "public"."dispatch_wo_status_webhook"();



CREATE OR REPLACE TRIGGER "trg_doc_requests_updated" BEFORE UPDATE ON "public"."document_requests" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_doc_templates_set_portfolio" BEFORE INSERT ON "public"."document_templates" FOR EACH ROW EXECUTE FUNCTION "public"."set_document_template_portfolio_id"();



CREATE OR REPLACE TRIGGER "trg_doc_templates_updated" BEFORE UPDATE ON "public"."document_templates" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_dues_increases_updated" BEFORE UPDATE ON "public"."dues_increases" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_ensure_bank_accounts" AFTER INSERT ON "public"."associations" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_operating_and_reserve_accounts"();



CREATE OR REPLACE TRIGGER "trg_estimates_updated" BEFORE UPDATE ON "public"."work_order_estimates" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_fixed_assets_updated" BEFORE UPDATE ON "public"."fixed_assets" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_form_templates_updated" BEFORE UPDATE ON "public"."form_templates" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_generate_portfolio_slug" BEFORE INSERT ON "public"."portfolios" FOR EACH ROW EXECUTE FUNCTION "public"."generate_portfolio_slug"();



CREATE OR REPLACE TRIGGER "trg_gl_accounts_updated" BEFORE UPDATE ON "public"."gl_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_gl_role_perms_updated" BEFORE UPDATE ON "public"."gl_account_role_permissions" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_guard_closed_period" BEFORE INSERT OR UPDATE ON "public"."journal_entries" FOR EACH ROW EXECUTE FUNCTION "public"."guard_closed_period_on_je"();



CREATE OR REPLACE TRIGGER "trg_guard_cross_fund_transfer" BEFORE INSERT OR UPDATE ON "public"."bank_transfers" FOR EACH ROW EXECUTE FUNCTION "public"."guard_cross_fund_transfer"();



CREATE OR REPLACE TRIGGER "trg_guard_profile_privileges" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."guard_profile_privilege_changes"();



CREATE OR REPLACE TRIGGER "trg_inspection_items_updated" BEFORE UPDATE ON "public"."inspection_items" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_inspections_updated" BEFORE UPDATE ON "public"."inspections" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_je_batches_updated" BEFORE UPDATE ON "public"."journal_entry_batches" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_journal_entries_updated" BEFORE UPDATE ON "public"."journal_entries" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_journal_entries_validate_balance" BEFORE INSERT OR UPDATE ON "public"."journal_entries" FOR EACH ROW EXECUTE FUNCTION "public"."validate_journal_entry_balance"();



CREATE OR REPLACE TRIGGER "trg_labor_entries_updated" BEFORE UPDATE ON "public"."work_order_labor_entries" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_lockbox_batches_updated" BEFORE UPDATE ON "public"."lockbox_batches" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_log_invitation" AFTER INSERT OR UPDATE ON "public"."user_invitations" FOR EACH ROW EXECUTE FUNCTION "public"."log_invitation_event"();



CREATE OR REPLACE TRIGGER "trg_log_platform_operator" AFTER INSERT OR DELETE OR UPDATE ON "public"."platform_operators" FOR EACH ROW EXECUTE FUNCTION "public"."log_platform_operator_change"();



CREATE OR REPLACE TRIGGER "trg_log_profile_privilege" AFTER UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."log_profile_privilege_change"();



CREATE OR REPLACE TRIGGER "trg_log_soft_delete" AFTER UPDATE OF "archived_at" ON "public"."approval_requests" FOR EACH ROW WHEN ((("new"."archived_at" IS NOT NULL) AND ("old"."archived_at" IS NULL))) EXECUTE FUNCTION "public"."log_soft_delete"();



CREATE OR REPLACE TRIGGER "trg_log_soft_delete" AFTER UPDATE OF "archived_at" ON "public"."associations" FOR EACH ROW WHEN ((("new"."archived_at" IS NOT NULL) AND ("old"."archived_at" IS NULL))) EXECUTE FUNCTION "public"."log_soft_delete"();



CREATE OR REPLACE TRIGGER "trg_log_soft_delete" AFTER UPDATE OF "archived_at" ON "public"."bank_accounts" FOR EACH ROW WHEN ((("new"."archived_at" IS NOT NULL) AND ("old"."archived_at" IS NULL))) EXECUTE FUNCTION "public"."log_soft_delete"();



CREATE OR REPLACE TRIGGER "trg_log_soft_delete" AFTER UPDATE OF "archived_at" ON "public"."buildings" FOR EACH ROW WHEN ((("new"."archived_at" IS NOT NULL) AND ("old"."archived_at" IS NULL))) EXECUTE FUNCTION "public"."log_soft_delete"();



CREATE OR REPLACE TRIGGER "trg_log_soft_delete" AFTER UPDATE OF "archived_at" ON "public"."calendar_events" FOR EACH ROW WHEN ((("new"."archived_at" IS NOT NULL) AND ("old"."archived_at" IS NULL))) EXECUTE FUNCTION "public"."log_soft_delete"();



CREATE OR REPLACE TRIGGER "trg_log_soft_delete" AFTER UPDATE OF "archived_at" ON "public"."committees" FOR EACH ROW WHEN ((("new"."archived_at" IS NOT NULL) AND ("old"."archived_at" IS NULL))) EXECUTE FUNCTION "public"."log_soft_delete"();



CREATE OR REPLACE TRIGGER "trg_log_soft_delete" AFTER UPDATE OF "archived_at" ON "public"."document_templates" FOR EACH ROW WHEN ((("new"."archived_at" IS NOT NULL) AND ("old"."archived_at" IS NULL))) EXECUTE FUNCTION "public"."log_soft_delete"();



CREATE OR REPLACE TRIGGER "trg_log_soft_delete" AFTER UPDATE OF "archived_at" ON "public"."fixed_assets" FOR EACH ROW WHEN ((("new"."archived_at" IS NOT NULL) AND ("old"."archived_at" IS NULL))) EXECUTE FUNCTION "public"."log_soft_delete"();



CREATE OR REPLACE TRIGGER "trg_log_soft_delete" AFTER UPDATE OF "archived_at" ON "public"."form_templates" FOR EACH ROW WHEN ((("new"."archived_at" IS NOT NULL) AND ("old"."archived_at" IS NULL))) EXECUTE FUNCTION "public"."log_soft_delete"();



CREATE OR REPLACE TRIGGER "trg_log_soft_delete" AFTER UPDATE OF "archived_at" ON "public"."inspections" FOR EACH ROW WHEN ((("new"."archived_at" IS NOT NULL) AND ("old"."archived_at" IS NULL))) EXECUTE FUNCTION "public"."log_soft_delete"();



CREATE OR REPLACE TRIGGER "trg_log_soft_delete" AFTER UPDATE OF "archived_at" ON "public"."management_fee_schedules" FOR EACH ROW WHEN ((("new"."archived_at" IS NOT NULL) AND ("old"."archived_at" IS NULL))) EXECUTE FUNCTION "public"."log_soft_delete"();



CREATE OR REPLACE TRIGGER "trg_log_soft_delete" AFTER UPDATE OF "archived_at" ON "public"."notices" FOR EACH ROW WHEN ((("new"."archived_at" IS NOT NULL) AND ("old"."archived_at" IS NULL))) EXECUTE FUNCTION "public"."log_soft_delete"();



CREATE OR REPLACE TRIGGER "trg_log_soft_delete" AFTER UPDATE OF "archived_at" ON "public"."owners" FOR EACH ROW WHEN ((("new"."archived_at" IS NOT NULL) AND ("old"."archived_at" IS NULL))) EXECUTE FUNCTION "public"."log_soft_delete"();



CREATE OR REPLACE TRIGGER "trg_log_soft_delete" AFTER UPDATE OF "archived_at" ON "public"."payable_bills" FOR EACH ROW WHEN ((("new"."archived_at" IS NOT NULL) AND ("old"."archived_at" IS NULL))) EXECUTE FUNCTION "public"."log_soft_delete"();



CREATE OR REPLACE TRIGGER "trg_log_soft_delete" AFTER UPDATE OF "archived_at" ON "public"."portfolios" FOR EACH ROW WHEN ((("new"."archived_at" IS NOT NULL) AND ("old"."archived_at" IS NULL))) EXECUTE FUNCTION "public"."log_soft_delete"();



CREATE OR REPLACE TRIGGER "trg_log_soft_delete" AFTER UPDATE OF "archived_at" ON "public"."purchase_orders" FOR EACH ROW WHEN ((("new"."archived_at" IS NOT NULL) AND ("old"."archived_at" IS NULL))) EXECUTE FUNCTION "public"."log_soft_delete"();



CREATE OR REPLACE TRIGGER "trg_log_soft_delete" AFTER UPDATE OF "archived_at" ON "public"."recurring_work_orders" FOR EACH ROW WHEN ((("new"."archived_at" IS NOT NULL) AND ("old"."archived_at" IS NULL))) EXECUTE FUNCTION "public"."log_soft_delete"();



CREATE OR REPLACE TRIGGER "trg_log_soft_delete" AFTER UPDATE OF "archived_at" ON "public"."surveys" FOR EACH ROW WHEN ((("new"."archived_at" IS NOT NULL) AND ("old"."archived_at" IS NULL))) EXECUTE FUNCTION "public"."log_soft_delete"();



CREATE OR REPLACE TRIGGER "trg_log_soft_delete" AFTER UPDATE OF "archived_at" ON "public"."tenancies" FOR EACH ROW WHEN ((("new"."archived_at" IS NOT NULL) AND ("old"."archived_at" IS NULL))) EXECUTE FUNCTION "public"."log_soft_delete"();



CREATE OR REPLACE TRIGGER "trg_log_soft_delete" AFTER UPDATE OF "archived_at" ON "public"."units" FOR EACH ROW WHEN ((("new"."archived_at" IS NOT NULL) AND ("old"."archived_at" IS NULL))) EXECUTE FUNCTION "public"."log_soft_delete"();



CREATE OR REPLACE TRIGGER "trg_log_soft_delete" AFTER UPDATE OF "archived_at" ON "public"."vendors" FOR EACH ROW WHEN ((("new"."archived_at" IS NOT NULL) AND ("old"."archived_at" IS NULL))) EXECUTE FUNCTION "public"."log_soft_delete"();



CREATE OR REPLACE TRIGGER "trg_log_soft_delete" AFTER UPDATE OF "archived_at" ON "public"."violations" FOR EACH ROW WHEN ((("new"."archived_at" IS NOT NULL) AND ("old"."archived_at" IS NULL))) EXECUTE FUNCTION "public"."log_soft_delete"();



CREATE OR REPLACE TRIGGER "trg_log_soft_delete" AFTER UPDATE OF "archived_at" ON "public"."work_orders" FOR EACH ROW WHEN ((("new"."archived_at" IS NOT NULL) AND ("old"."archived_at" IS NULL))) EXECUTE FUNCTION "public"."log_soft_delete"();



CREATE OR REPLACE TRIGGER "trg_log_subscription" AFTER INSERT OR UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."log_subscription_change"();



CREATE OR REPLACE TRIGGER "trg_log_user_role" AFTER INSERT OR DELETE OR UPDATE ON "public"."user_roles" FOR EACH ROW EXECUTE FUNCTION "public"."log_user_role_change"();



CREATE OR REPLACE TRIGGER "trg_meetings_updated_at" BEFORE UPDATE ON "public"."meetings" FOR EACH ROW EXECUTE FUNCTION "public"."update_meetings_updated_at"();



CREATE OR REPLACE TRIGGER "trg_message_templates_updated_at" BEFORE UPDATE ON "public"."message_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_mgmt_agreements_updated" BEFORE UPDATE ON "public"."management_agreements" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_mgmt_fee_updated" BEFORE UPDATE ON "public"."management_fee_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_notices_updated_at" BEFORE UPDATE ON "public"."notices" FOR EACH ROW EXECUTE FUNCTION "public"."update_work_order_timestamp"();



CREATE OR REPLACE TRIGGER "trg_occupancies_updated" BEFORE UPDATE ON "public"."occupancies" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_ofd_audit" AFTER INSERT OR UPDATE ON "public"."owner_financial_details" FOR EACH ROW EXECUTE FUNCTION "public"."log_owner_audit"();



CREATE OR REPLACE TRIGGER "trg_owner_payable_number" BEFORE INSERT ON "public"."owner_payables" FOR EACH ROW WHEN (("new"."payable_number" IS NULL)) EXECUTE FUNCTION "public"."generate_owner_payable_number"();



CREATE OR REPLACE TRIGGER "trg_owner_payables_updated_at" BEFORE UPDATE ON "public"."owner_payables" FOR EACH ROW EXECUTE FUNCTION "public"."update_owner_payables_updated_at"();



CREATE OR REPLACE TRIGGER "trg_owners_audit" AFTER UPDATE ON "public"."owners" FOR EACH ROW EXECUTE FUNCTION "public"."log_owner_audit"();



CREATE OR REPLACE TRIGGER "trg_payable_bills_updated" BEFORE UPDATE ON "public"."payable_bills" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_payment_methods_updated" BEFORE UPDATE ON "public"."payment_methods" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_plaid_items_updated_at" BEFORE UPDATE ON "public"."plaid_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_plaid_items_updated_at"();



CREATE OR REPLACE TRIGGER "trg_platform_operators_updated" BEFORE UPDATE ON "public"."platform_operators" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_po_line_items_updated" BEFORE UPDATE ON "public"."purchase_order_line_items" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_portfolios_updated" BEFORE UPDATE ON "public"."portfolios" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_post_assessment_charges" AFTER UPDATE OF "status" ON "public"."assessment_periods" FOR EACH ROW EXECUTE FUNCTION "public"."post_assessment_charges"();



CREATE OR REPLACE TRIGGER "trg_privacy_actions_updated" BEFORE UPDATE ON "public"."privacy_actions" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_processor_configs_updated" BEFORE UPDATE ON "public"."payment_processor_configs" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_property_groups_updated" BEFORE UPDATE ON "public"."property_groups" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_purchase_orders_updated" BEFORE UPDATE ON "public"."purchase_orders" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_queue_invitation_email" AFTER INSERT ON "public"."user_invitations" FOR EACH ROW EXECUTE FUNCTION "public"."queue_invitation_email"();



CREATE OR REPLACE TRIGGER "trg_recerts_updated" BEFORE UPDATE ON "public"."income_recertifications" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_recount_seats" AFTER INSERT OR DELETE OR UPDATE OF "portfolio_id", "hoa_role" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."recount_seats_used"();



CREATE OR REPLACE TRIGGER "trg_recurring_bills_updated" BEFORE UPDATE ON "public"."recurring_bills" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_recurring_je_updated" BEFORE UPDATE ON "public"."recurring_journal_entries" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_recurring_wo_updated" BEFORE UPDATE ON "public"."recurring_work_orders" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_report_defs_updated" BEFORE UPDATE ON "public"."report_definitions" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_report_runs_bump_saved" AFTER INSERT OR UPDATE OF "status" ON "public"."report_runs" FOR EACH ROW WHEN (("new"."status" = 'succeeded'::"public"."report_run_status")) EXECUTE FUNCTION "public"."bump_saved_report_on_run"();



CREATE OR REPLACE TRIGGER "trg_report_runs_updated" BEFORE UPDATE ON "public"."report_runs" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_saved_reports_updated" BEFORE UPDATE ON "public"."saved_reports" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_scheduled_reports_updated" BEFORE UPDATE ON "public"."scheduled_reports" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_service_requests_updated" BEFORE UPDATE ON "public"."service_requests" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sms_conversations_updated" BEFORE UPDATE ON "public"."sms_conversations" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sms_messages_sync_conversation" AFTER INSERT ON "public"."sms_messages" FOR EACH ROW EXECUTE FUNCTION "public"."sync_sms_conversation_on_message"();



CREATE OR REPLACE TRIGGER "trg_sms_messages_updated" BEFORE UPDATE ON "public"."sms_messages" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sms_opt_ins_updated_at" BEFORE UPDATE ON "public"."sms_opt_ins" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_subscriptions_updated" BEFORE UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_surveys_updated" BEFORE UPDATE ON "public"."surveys" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sync_association_unit_count" AFTER INSERT OR DELETE OR UPDATE OF "building_id" ON "public"."units" FOR EACH ROW EXECUTE FUNCTION "public"."sync_association_unit_count"();



CREATE OR REPLACE TRIGGER "trg_sync_portfolio_tier" AFTER INSERT OR UPDATE OF "tier" ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."sync_portfolio_tier_from_subscription"();



CREATE OR REPLACE TRIGGER "trg_tags_updated" BEFORE UPDATE ON "public"."tags" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_tally_approval_vote" AFTER INSERT OR UPDATE ON "public"."approval_votes" FOR EACH ROW EXECUTE FUNCTION "public"."tally_approval_vote"();



CREATE OR REPLACE TRIGGER "trg_unit_recurring_charges_updated" BEFORE UPDATE ON "public"."unit_recurring_charges" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_usage_metrics_updated" BEFORE UPDATE ON "public"."usage_metrics" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_user_invitations_updated" BEFORE UPDATE ON "public"."user_invitations" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_user_roles_updated" BEFORE UPDATE ON "public"."user_roles" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_validate_invitation_domain" BEFORE INSERT ON "public"."user_invitations" FOR EACH ROW EXECUTE FUNCTION "public"."validate_invitation_email_domain"();



CREATE OR REPLACE TRIGGER "trg_vendor_compliance_updated" BEFORE UPDATE ON "public"."vendor_compliance" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_vendors_updated" BEFORE UPDATE ON "public"."vendors" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_violation_updated" BEFORE UPDATE ON "public"."violations" FOR EACH ROW EXECUTE FUNCTION "public"."touch_violation_updated"();



CREATE OR REPLACE TRIGGER "trg_webhook_deliveries_updated" BEFORE UPDATE ON "public"."webhook_deliveries" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_webhook_endpoints_updated" BEFORE UPDATE ON "public"."webhook_endpoints" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_work_orders_updated_at" BEFORE UPDATE ON "public"."work_orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_work_order_timestamp"();



CREATE OR REPLACE TRIGGER "update_bookings_updated_at" BEFORE UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_leads_updated_at" BEFORE UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_provider_availability_updated_at" BEFORE UPDATE ON "public"."provider_availability" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_providers_updated_at" BEFORE UPDATE ON "public"."providers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_services_updated_at" BEFORE UPDATE ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "workflows_touch" BEFORE UPDATE ON "public"."workflows" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



ALTER TABLE ONLY "public"."accounting_periods"
    ADD CONSTRAINT "accounting_periods_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."accounting_periods"
    ADD CONSTRAINT "accounting_periods_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."accounting_periods"
    ADD CONSTRAINT "accounting_periods_reopened_by_fkey" FOREIGN KEY ("reopened_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activity"
    ADD CONSTRAINT "activity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agenda_items"
    ADD CONSTRAINT "agenda_items_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."amenity_reservations"
    ADD CONSTRAINT "amenity_reservations_amenity_id_fkey" FOREIGN KEY ("amenity_id") REFERENCES "public"."association_amenities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."amenity_reservations"
    ADD CONSTRAINT "amenity_reservations_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."amenity_reservations"
    ADD CONSTRAINT "amenity_reservations_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."amenity_tags"
    ADD CONSTRAINT "amenity_tags_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."approval_decisions"
    ADD CONSTRAINT "approval_decisions_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "public"."approval_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approval_decisions"
    ADD CONSTRAINT "approval_decisions_board_member_id_fkey" FOREIGN KEY ("board_member_id") REFERENCES "public"."board_members"("id");



ALTER TABLE ONLY "public"."approval_requests"
    ADD CONSTRAINT "approval_requests_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approval_requests"
    ADD CONSTRAINT "approval_requests_decision_by_fkey" FOREIGN KEY ("decision_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."approval_requests"
    ADD CONSTRAINT "approval_requests_homeowner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."approval_requests"
    ADD CONSTRAINT "approval_requests_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approval_requests"
    ADD CONSTRAINT "approval_requests_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."approval_requests"
    ADD CONSTRAINT "approval_requests_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."approval_votes"
    ADD CONSTRAINT "approval_votes_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "public"."approval_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approval_votes"
    ADD CONSTRAINT "approval_votes_board_member_id_fkey" FOREIGN KEY ("board_member_id") REFERENCES "public"."board_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."approval_votes"
    ADD CONSTRAINT "approval_votes_voter_user_id_fkey" FOREIGN KEY ("voter_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."architectural_request_messages"
    ADD CONSTRAINT "architectural_request_messages_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."architectural_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."architectural_requests"
    ADD CONSTRAINT "architectural_requests_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."architectural_requests"
    ADD CONSTRAINT "architectural_requests_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."architectural_requests"
    ADD CONSTRAINT "architectural_requests_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."architectural_requests"
    ADD CONSTRAINT "architectural_requests_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."architectural_review_settings"
    ADD CONSTRAINT "architectural_review_settings_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."architectural_review_settings"
    ADD CONSTRAINT "architectural_review_settings_default_committee_id_fkey" FOREIGN KEY ("default_committee_id") REFERENCES "public"."committees"("id");



ALTER TABLE ONLY "public"."assessment_periods"
    ADD CONSTRAINT "assessment_periods_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assessment_periods"
    ADD CONSTRAINT "assessment_periods_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."association_additional_fees"
    ADD CONSTRAINT "association_additional_fees_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."association_additional_fees"
    ADD CONSTRAINT "association_additional_fees_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "public"."gl_accounts"("id");



ALTER TABLE ONLY "public"."association_amenities"
    ADD CONSTRAINT "association_amenities_amenity_tag_id_fkey" FOREIGN KEY ("amenity_tag_id") REFERENCES "public"."amenity_tags"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."association_amenities"
    ADD CONSTRAINT "association_amenities_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."association_assignments"
    ADD CONSTRAINT "association_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."association_assignments"
    ADD CONSTRAINT "association_assignments_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."association_assignments"
    ADD CONSTRAINT "association_assignments_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."association_assignments"
    ADD CONSTRAINT "association_assignments_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."association_attachments"
    ADD CONSTRAINT "association_attachments_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."association_keys"
    ADD CONSTRAINT "association_keys_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."association_lease_template_settings"
    ADD CONSTRAINT "association_lease_template_settings_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."association_lease_template_settings"
    ADD CONSTRAINT "association_lease_template_settings_primary_template_id_fkey" FOREIGN KEY ("primary_template_id") REFERENCES "public"."document_templates"("id");



ALTER TABLE ONLY "public"."association_loans"
    ADD CONSTRAINT "association_loans_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."association_loans"
    ADD CONSTRAINT "association_loans_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "public"."gl_accounts"("id");



ALTER TABLE ONLY "public"."association_loans"
    ADD CONSTRAINT "association_loans_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."association_managers"
    ADD CONSTRAINT "association_managers_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."association_managers"
    ADD CONSTRAINT "association_managers_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."association_managers"
    ADD CONSTRAINT "association_managers_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."association_managers"
    ADD CONSTRAINT "association_managers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."association_notes"
    ADD CONSTRAINT "association_notes_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."association_renewal_options"
    ADD CONSTRAINT "association_renewal_options_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."associations"
    ADD CONSTRAINT "associations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."associations"
    ADD CONSTRAINT "associations_default_renewal_letter_template_id_fkey" FOREIGN KEY ("default_renewal_letter_template_id") REFERENCES "public"."document_templates"("id");



ALTER TABLE ONLY "public"."associations"
    ADD CONSTRAINT "associations_interest_income_gl_account_id_fkey" FOREIGN KEY ("interest_income_gl_account_id") REFERENCES "public"."gl_accounts"("id");



ALTER TABLE ONLY "public"."associations"
    ADD CONSTRAINT "associations_management_fee_schedule_id_fkey" FOREIGN KEY ("management_fee_schedule_id") REFERENCES "public"."management_fee_schedules"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."associations"
    ADD CONSTRAINT "associations_operating_bank_account_id_fkey" FOREIGN KEY ("operating_bank_account_id") REFERENCES "public"."bank_accounts"("id");



ALTER TABLE ONLY "public"."associations"
    ADD CONSTRAINT "associations_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."associations"
    ADD CONSTRAINT "associations_primary_bank_account_id_fkey" FOREIGN KEY ("primary_bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."associations"
    ADD CONSTRAINT "associations_property_group_id_fkey" FOREIGN KEY ("property_group_id") REFERENCES "public"."property_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."associations"
    ADD CONSTRAINT "associations_reserve_bank_account_id_fkey" FOREIGN KEY ("reserve_bank_account_id") REFERENCES "public"."bank_accounts"("id");



ALTER TABLE ONLY "public"."associations"
    ADD CONSTRAINT "associations_site_manager_user_id_fkey" FOREIGN KEY ("site_manager_user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."automation_flow_runs"
    ADD CONSTRAINT "automation_flow_runs_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "public"."automation_flows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automation_flows"
    ADD CONSTRAINT "automation_flows_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automation_flows"
    ADD CONSTRAINT "automation_flows_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automation_tasks"
    ADD CONSTRAINT "automation_tasks_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."autopay_mandates"
    ADD CONSTRAINT "autopay_mandates_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."autopay_mandates"
    ADD CONSTRAINT "autopay_mandates_canceled_by_fkey" FOREIGN KEY ("canceled_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."autopay_mandates"
    ADD CONSTRAINT "autopay_mandates_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."autopay_mandates"
    ADD CONSTRAINT "autopay_mandates_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."autopay_mandates"
    ADD CONSTRAINT "autopay_mandates_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."autopay_mandates"
    ADD CONSTRAINT "autopay_mandates_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ballots"
    ADD CONSTRAINT "ballots_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ballots"
    ADD CONSTRAINT "ballots_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."bank_account_owners"
    ADD CONSTRAINT "bank_account_owners_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bank_account_owners"
    ADD CONSTRAINT "bank_account_owners_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bank_adjustments"
    ADD CONSTRAINT "bank_adjustments_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id");



ALTER TABLE ONLY "public"."bank_reconciliation_items"
    ADD CONSTRAINT "bank_reconciliation_items_journal_line_id_fkey" FOREIGN KEY ("journal_line_id") REFERENCES "public"."journal_lines"("id");



ALTER TABLE ONLY "public"."bank_reconciliation_items"
    ADD CONSTRAINT "bank_reconciliation_items_reconciliation_id_fkey" FOREIGN KEY ("reconciliation_id") REFERENCES "public"."bank_reconciliations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bank_reconciliations"
    ADD CONSTRAINT "bank_reconciliations_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id");



ALTER TABLE ONLY "public"."bank_reconciliations"
    ADD CONSTRAINT "bank_reconciliations_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."bank_reconciliations"
    ADD CONSTRAINT "bank_reconciliations_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id");



ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "public"."gl_accounts"("id");



ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_plaid_item_id_fkey" FOREIGN KEY ("plaid_item_id") REFERENCES "public"."plaid_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bank_transfers"
    ADD CONSTRAINT "bank_transfers_authorized_by_fkey" FOREIGN KEY ("authorized_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."bank_transfers"
    ADD CONSTRAINT "bank_transfers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bank_transfers"
    ADD CONSTRAINT "bank_transfers_from_bank_account_id_fkey" FOREIGN KEY ("from_bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."bank_transfers"
    ADD CONSTRAINT "bank_transfers_journal_entry_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bank_transfers"
    ADD CONSTRAINT "bank_transfers_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bank_transfers"
    ADD CONSTRAINT "bank_transfers_to_bank_account_id_fkey" FOREIGN KEY ("to_bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."billing_usage"
    ADD CONSTRAINT "billing_usage_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_usage"
    ADD CONSTRAINT "billing_usage_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."board_approval_settings"
    ADD CONSTRAINT "board_approval_settings_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."board_comments"
    ADD CONSTRAINT "board_comments_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id");



ALTER TABLE ONLY "public"."board_comments"
    ADD CONSTRAINT "board_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."board_comments"
    ADD CONSTRAINT "board_comments_violation_id_fkey" FOREIGN KEY ("violation_id") REFERENCES "public"."violations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."board_members"
    ADD CONSTRAINT "board_members_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."board_members"
    ADD CONSTRAINT "board_members_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."board_members"
    ADD CONSTRAINT "board_members_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."budget_lines"
    ADD CONSTRAINT "budget_lines_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budget_lines"
    ADD CONSTRAINT "budget_lines_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."buildings"
    ADD CONSTRAINT "buildings_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_event_reminders"
    ADD CONSTRAINT "calendar_event_reminders_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_event_reminders"
    ADD CONSTRAINT "calendar_event_reminders_communication_message_id_fkey" FOREIGN KEY ("communication_message_id") REFERENCES "public"."communication_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_maintenance_task_id_fkey" FOREIGN KEY ("maintenance_task_id") REFERENCES "public"."maintenance_tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_reminder_acknowledged_by_fkey" FOREIGN KEY ("reminder_acknowledged_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."charge_categories"
    ADD CONSTRAINT "charge_categories_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."charge_categories"
    ADD CONSTRAINT "charge_categories_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."charge_categories"
    ADD CONSTRAINT "charge_categories_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."charge_categories"
    ADD CONSTRAINT "charge_categories_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."charges"
    ADD CONSTRAINT "charges_assessment_period_id_fkey" FOREIGN KEY ("assessment_period_id") REFERENCES "public"."assessment_periods"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."charges"
    ADD CONSTRAINT "charges_charge_category_id_fkey" FOREIGN KEY ("charge_category_id") REFERENCES "public"."charge_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."charges"
    ADD CONSTRAINT "charges_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."charges"
    ADD CONSTRAINT "charges_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."charges"
    ADD CONSTRAINT "charges_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."committee_members"
    ADD CONSTRAINT "committee_members_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."committee_members"
    ADD CONSTRAINT "committee_members_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."committees"
    ADD CONSTRAINT "committees_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."communication_messages"
    ADD CONSTRAINT "communication_messages_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."communication_triggers"
    ADD CONSTRAINT "communication_triggers_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."communication_triggers"
    ADD CONSTRAINT "communication_triggers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."communication_triggers"
    ADD CONSTRAINT "communication_triggers_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."communication_triggers"
    ADD CONSTRAINT "communication_triggers_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."document_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."communications_log"
    ADD CONSTRAINT "communications_log_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."communications_log"
    ADD CONSTRAINT "communications_log_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."communications_log"
    ADD CONSTRAINT "communications_log_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_settings"
    ADD CONSTRAINT "company_settings_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."data_diagnostics"
    ADD CONSTRAINT "data_diagnostics_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."data_diagnostics"
    ADD CONSTRAINT "data_diagnostics_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."data_export_requests"
    ADD CONSTRAINT "data_export_requests_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."data_export_requests"
    ADD CONSTRAINT "data_export_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."data_export_requests"
    ADD CONSTRAINT "data_export_requests_subject_auth_user_id_fkey" FOREIGN KEY ("subject_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."depreciation_entries"
    ADD CONSTRAINT "depreciation_entries_fixed_asset_id_fkey" FOREIGN KEY ("fixed_asset_id") REFERENCES "public"."fixed_assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."depreciation_entries"
    ADD CONSTRAINT "depreciation_entries_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."document_requests"
    ADD CONSTRAINT "document_requests_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_requests"
    ADD CONSTRAINT "document_requests_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_requests"
    ADD CONSTRAINT "document_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."document_requests"
    ADD CONSTRAINT "document_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."document_requests"
    ADD CONSTRAINT "document_requests_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_templates"
    ADD CONSTRAINT "document_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."document_templates"
    ADD CONSTRAINT "document_templates_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."dues_increase_lines"
    ADD CONSTRAINT "dues_increase_lines_dues_increase_id_fkey" FOREIGN KEY ("dues_increase_id") REFERENCES "public"."dues_increases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dues_increase_lines"
    ADD CONSTRAINT "dues_increase_lines_occupancy_id_fkey" FOREIGN KEY ("occupancy_id") REFERENCES "public"."occupancies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dues_increase_lines"
    ADD CONSTRAINT "dues_increase_lines_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dues_increases"
    ADD CONSTRAINT "dues_increases_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dues_increases"
    ADD CONSTRAINT "dues_increases_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dues_increases"
    ADD CONSTRAINT "dues_increases_letter_template_id_fkey" FOREIGN KEY ("letter_template_id") REFERENCES "public"."document_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dues_increases"
    ADD CONSTRAINT "dues_increases_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dues_increases"
    ADD CONSTRAINT "dues_increases_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_queue"
    ADD CONSTRAINT "email_queue_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id");



ALTER TABLE ONLY "public"."email_queue"
    ADD CONSTRAINT "email_queue_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "public"."notices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_queue"
    ADD CONSTRAINT "email_queue_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id");



ALTER TABLE ONLY "public"."email_queue"
    ADD CONSTRAINT "email_queue_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."email_queue"
    ADD CONSTRAINT "email_queue_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."document_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fixed_assets"
    ADD CONSTRAINT "fixed_assets_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fixed_assets"
    ADD CONSTRAINT "fixed_assets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fixed_assets"
    ADD CONSTRAINT "fixed_assets_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fixed_assets"
    ADD CONSTRAINT "fixed_assets_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fixed_assets"
    ADD CONSTRAINT "fixed_assets_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."form_templates"
    ADD CONSTRAINT "form_templates_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gl_account_role_permissions"
    ADD CONSTRAINT "gl_account_role_permissions_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gl_account_role_permissions"
    ADD CONSTRAINT "gl_account_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."user_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gl_accounts"
    ADD CONSTRAINT "gl_accounts_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gl_accounts"
    ADD CONSTRAINT "gl_accounts_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gl_accounts"
    ADD CONSTRAINT "gl_accounts_sub_account_of_id_fkey" FOREIGN KEY ("sub_account_of_id") REFERENCES "public"."gl_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."house_rules"
    ADD CONSTRAINT "house_rules_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."income_recertifications"
    ADD CONSTRAINT "income_recertifications_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."income_recertifications"
    ADD CONSTRAINT "income_recertifications_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."income_recertifications"
    ADD CONSTRAINT "income_recertifications_occupancy_id_fkey" FOREIGN KEY ("occupancy_id") REFERENCES "public"."occupancies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."income_recertifications"
    ADD CONSTRAINT "income_recertifications_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."income_recertifications"
    ADD CONSTRAINT "income_recertifications_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."income_recertifications"
    ADD CONSTRAINT "income_recertifications_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inspection_items"
    ADD CONSTRAINT "inspection_items_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inspection_items"
    ADD CONSTRAINT "inspection_items_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inspections"
    ADD CONSTRAINT "inspections_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inspections"
    ADD CONSTRAINT "inspections_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inspections"
    ADD CONSTRAINT "inspections_inspector_user_id_fkey" FOREIGN KEY ("inspector_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inspections"
    ADD CONSTRAINT "inspections_inspector_vendor_id_fkey" FOREIGN KEY ("inspector_vendor_id") REFERENCES "public"."vendors"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inspections"
    ADD CONSTRAINT "inspections_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inspections"
    ADD CONSTRAINT "inspections_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."insurance_policies"
    ADD CONSTRAINT "insurance_policies_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id");



ALTER TABLE ONLY "public"."insurance_policies"
    ADD CONSTRAINT "insurance_policies_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_billing_usage_id_fkey" FOREIGN KEY ("billing_usage_id") REFERENCES "public"."billing_usage"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."journal_entry_batches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_entry_batches"
    ADD CONSTRAINT "journal_entry_batches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."journal_entry_batches"
    ADD CONSTRAINT "journal_entry_batches_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_entry_batches"
    ADD CONSTRAINT "journal_entry_batches_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."journal_lines"
    ADD CONSTRAINT "journal_lines_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."journal_lines"
    ADD CONSTRAINT "journal_lines_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_lines"
    ADD CONSTRAINT "journal_lines_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."late_fee_assessments"
    ADD CONSTRAINT "late_fee_assessments_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."late_fee_assessments"
    ADD CONSTRAINT "late_fee_assessments_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "public"."charges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."late_fee_assessments"
    ADD CONSTRAINT "late_fee_assessments_fee_charge_id_fkey" FOREIGN KEY ("fee_charge_id") REFERENCES "public"."charges"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lead_messages"
    ADD CONSTRAINT "lead_messages_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lock_box_assignments"
    ADD CONSTRAINT "lock_box_assignments_lock_box_id_fkey" FOREIGN KEY ("lock_box_id") REFERENCES "public"."lock_boxes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lock_box_assignments"
    ADD CONSTRAINT "lock_box_assignments_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id");



ALTER TABLE ONLY "public"."lock_box_assignments"
    ADD CONSTRAINT "lock_box_assignments_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."lock_box_assignments"
    ADD CONSTRAINT "lock_box_assignments_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id");



ALTER TABLE ONLY "public"."lock_boxes"
    ADD CONSTRAINT "lock_boxes_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id");



ALTER TABLE ONLY "public"."lock_boxes"
    ADD CONSTRAINT "lock_boxes_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id");



ALTER TABLE ONLY "public"."lock_boxes"
    ADD CONSTRAINT "lock_boxes_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id");



ALTER TABLE ONLY "public"."lock_boxes"
    ADD CONSTRAINT "lock_boxes_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."lockbox_batches"
    ADD CONSTRAINT "lockbox_batches_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lockbox_batches"
    ADD CONSTRAINT "lockbox_batches_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lockbox_items"
    ADD CONSTRAINT "lockbox_items_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lockbox_items"
    ADD CONSTRAINT "lockbox_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."lockbox_batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lockbox_items"
    ADD CONSTRAINT "lockbox_items_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lockbox_items"
    ADD CONSTRAINT "lockbox_items_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lockbox_items"
    ADD CONSTRAINT "lockbox_items_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lockbox_items"
    ADD CONSTRAINT "lockbox_items_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."login_attempts"
    ADD CONSTRAINT "login_attempts_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."login_attempts"
    ADD CONSTRAINT "login_attempts_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."maintenance_task_history"
    ADD CONSTRAINT "maintenance_task_history_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."maintenance_task_history"
    ADD CONSTRAINT "maintenance_task_history_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."maintenance_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."maintenance_task_history"
    ADD CONSTRAINT "maintenance_task_history_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id");



ALTER TABLE ONLY "public"."maintenance_tasks"
    ADD CONSTRAINT "maintenance_tasks_assigned_staff_id_fkey" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."maintenance_tasks"
    ADD CONSTRAINT "maintenance_tasks_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."maintenance_tasks"
    ADD CONSTRAINT "maintenance_tasks_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."maintenance_templates"("id");



ALTER TABLE ONLY "public"."maintenance_tasks"
    ADD CONSTRAINT "maintenance_tasks_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id");



ALTER TABLE ONLY "public"."maintenance_template_groups"
    ADD CONSTRAINT "maintenance_template_groups_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."maintenance_templates"
    ADD CONSTRAINT "maintenance_templates_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."maintenance_template_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."management_agreements"
    ADD CONSTRAINT "management_agreements_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."management_agreements"
    ADD CONSTRAINT "management_agreements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."management_agreements"
    ADD CONSTRAINT "management_agreements_management_fee_schedule_id_fkey" FOREIGN KEY ("management_fee_schedule_id") REFERENCES "public"."management_fee_schedules"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."management_agreements"
    ADD CONSTRAINT "management_agreements_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."management_agreements"
    ADD CONSTRAINT "management_agreements_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."management_agreements"
    ADD CONSTRAINT "management_agreements_signed_by_manager_fkey" FOREIGN KEY ("signed_by_manager") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."management_fee_policies"
    ADD CONSTRAINT "management_fee_policies_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."management_fee_schedules"
    ADD CONSTRAINT "management_fee_schedules_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."management_fees"
    ADD CONSTRAINT "management_fees_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."management_fees"
    ADD CONSTRAINT "management_fees_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketing_leads"
    ADD CONSTRAINT "marketing_leads_converted_portfolio_id_fkey" FOREIGN KEY ("converted_portfolio_id") REFERENCES "public"."portfolios"("id");



ALTER TABLE ONLY "public"."meeting_attendees"
    ADD CONSTRAINT "meeting_attendees_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_attendees"
    ADD CONSTRAINT "meeting_attendees_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meeting_documents"
    ADD CONSTRAINT "meeting_documents_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_documents"
    ADD CONSTRAINT "meeting_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_templates"
    ADD CONSTRAINT "message_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."message_templates"
    ADD CONSTRAINT "message_templates_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id");



ALTER TABLE ONLY "public"."notice_recipients"
    ADD CONSTRAINT "notice_recipients_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "public"."notices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notice_recipients"
    ADD CONSTRAINT "notice_recipients_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notices"
    ADD CONSTRAINT "notices_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notices"
    ADD CONSTRAINT "notices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."notices"
    ADD CONSTRAINT "notices_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."document_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."occupancies"
    ADD CONSTRAINT "occupancies_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."occupancies"
    ADD CONSTRAINT "occupancies_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."occupancies"
    ADD CONSTRAINT "occupancies_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."owner_ach_status"
    ADD CONSTRAINT "owner_ach_status_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."owner_attachments"
    ADD CONSTRAINT "owner_attachments_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."owner_attachments"
    ADD CONSTRAINT "owner_attachments_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."owner_attachments"
    ADD CONSTRAINT "owner_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."owner_financial_details"
    ADD CONSTRAINT "owner_financial_details_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."owner_financial_details"
    ADD CONSTRAINT "owner_financial_details_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."owner_financial_details"
    ADD CONSTRAINT "owner_financial_details_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."owner_form_submissions"
    ADD CONSTRAINT "owner_form_submissions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."owner_form_submissions"
    ADD CONSTRAINT "owner_form_submissions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."owner_packet_settings"
    ADD CONSTRAINT "owner_packet_settings_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."owner_packet_settings"
    ADD CONSTRAINT "owner_packet_settings_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."owner_packet_settings"
    ADD CONSTRAINT "owner_packet_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."owner_packets"
    ADD CONSTRAINT "owner_packets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."owner_payables"
    ADD CONSTRAINT "owner_payables_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."owner_payables"
    ADD CONSTRAINT "owner_payables_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id");



ALTER TABLE ONLY "public"."owner_payables"
    ADD CONSTRAINT "owner_payables_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id");



ALTER TABLE ONLY "public"."owner_payables"
    ADD CONSTRAINT "owner_payables_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."owner_payables"
    ADD CONSTRAINT "owner_payables_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "public"."gl_accounts"("id");



ALTER TABLE ONLY "public"."owner_payables"
    ADD CONSTRAINT "owner_payables_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id");



ALTER TABLE ONLY "public"."owner_payables"
    ADD CONSTRAINT "owner_payables_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id");



ALTER TABLE ONLY "public"."owner_portal_invites"
    ADD CONSTRAINT "owner_portal_invites_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."owner_statements"
    ADD CONSTRAINT "owner_statements_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."owner_statements"
    ADD CONSTRAINT "owner_statements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."owner_statements"
    ADD CONSTRAINT "owner_statements_occupancy_id_fkey" FOREIGN KEY ("occupancy_id") REFERENCES "public"."occupancies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."owner_statements"
    ADD CONSTRAINT "owner_statements_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."owner_statements"
    ADD CONSTRAINT "owner_statements_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."owner_vehicles"
    ADD CONSTRAINT "owner_vehicles_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."owner_vehicles"
    ADD CONSTRAINT "owner_vehicles_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."owners"
    ADD CONSTRAINT "owners_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."owners"
    ADD CONSTRAINT "owners_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."owners"
    ADD CONSTRAINT "owners_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."parking_assignments"
    ADD CONSTRAINT "parking_assignments_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."parking_assignments"
    ADD CONSTRAINT "parking_assignments_parking_space_id_fkey" FOREIGN KEY ("parking_space_id") REFERENCES "public"."parking_spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parking_assignments"
    ADD CONSTRAINT "parking_assignments_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parking_assignments"
    ADD CONSTRAINT "parking_assignments_recurring_charge_id_fkey" FOREIGN KEY ("recurring_charge_id") REFERENCES "public"."unit_recurring_charges"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."parking_assignments"
    ADD CONSTRAINT "parking_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."parking_assignments"
    ADD CONSTRAINT "parking_assignments_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."parking_spaces"
    ADD CONSTRAINT "parking_spaces_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parking_spaces"
    ADD CONSTRAINT "parking_spaces_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payable_bill_line_items"
    ADD CONSTRAINT "payable_bill_line_items_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payable_bill_line_items"
    ADD CONSTRAINT "payable_bill_line_items_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "public"."payable_bills"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payable_bill_line_items"
    ADD CONSTRAINT "payable_bill_line_items_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payable_bills"
    ADD CONSTRAINT "payable_bills_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payable_bills"
    ADD CONSTRAINT "payable_bills_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payable_bills"
    ADD CONSTRAINT "payable_bills_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payable_bills"
    ADD CONSTRAINT "payable_bills_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payable_bills"
    ADD CONSTRAINT "payable_bills_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payable_bills"
    ADD CONSTRAINT "payable_bills_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payable_bills"
    ADD CONSTRAINT "payable_bills_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payable_bills"
    ADD CONSTRAINT "payable_bills_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payment_applications"
    ADD CONSTRAINT "payment_applications_applied_by_fkey" FOREIGN KEY ("applied_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payment_applications"
    ADD CONSTRAINT "payment_applications_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "public"."charges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_applications"
    ADD CONSTRAINT "payment_applications_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_events"
    ADD CONSTRAINT "payment_events_payment_intent_id_fkey" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_intents"
    ADD CONSTRAINT "payment_intents_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id");



ALTER TABLE ONLY "public"."payment_intents"
    ADD CONSTRAINT "payment_intents_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id");



ALTER TABLE ONLY "public"."payment_intents"
    ADD CONSTRAINT "payment_intents_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id");



ALTER TABLE ONLY "public"."payment_intents"
    ADD CONSTRAINT "payment_intents_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id");



ALTER TABLE ONLY "public"."payment_intents"
    ADD CONSTRAINT "payment_intents_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_processor_configs"
    ADD CONSTRAINT "payment_processor_configs_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "public"."charges"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payout_batches"
    ADD CONSTRAINT "payout_batches_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id");



ALTER TABLE ONLY "public"."payout_batches"
    ADD CONSTRAINT "payout_batches_bank_transaction_id_fkey" FOREIGN KEY ("bank_transaction_id") REFERENCES "public"."bank_transactions"("id");



ALTER TABLE ONLY "public"."payout_batches"
    ADD CONSTRAINT "payout_batches_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id");



ALTER TABLE ONLY "public"."permission_audit_log"
    ADD CONSTRAINT "permission_audit_log_actor_portfolio_id_fkey" FOREIGN KEY ("actor_portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."permission_audit_log"
    ADD CONSTRAINT "permission_audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."plaid_items"
    ADD CONSTRAINT "plaid_items_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."platform_impersonation_log"
    ADD CONSTRAINT "platform_impersonation_log_impersonated_portfolio_id_fkey" FOREIGN KEY ("impersonated_portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."platform_impersonation_log"
    ADD CONSTRAINT "platform_impersonation_log_impersonated_user_id_fkey" FOREIGN KEY ("impersonated_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."platform_impersonation_log"
    ADD CONSTRAINT "platform_impersonation_log_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."platform_operators"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."platform_operators"
    ADD CONSTRAINT "platform_operators_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_operators"
    ADD CONSTRAINT "platform_operators_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."platform_requests"
    ADD CONSTRAINT "platform_requests_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_requests"
    ADD CONSTRAINT "platform_requests_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."portfolio_settings"
    ADD CONSTRAINT "portfolio_settings_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portfolios"
    ADD CONSTRAINT "portfolios_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."privacy_actions"
    ADD CONSTRAINT "privacy_actions_handler_user_id_fkey" FOREIGN KEY ("handler_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."privacy_actions"
    ADD CONSTRAINT "privacy_actions_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."privacy_actions"
    ADD CONSTRAINT "privacy_actions_subject_auth_user_id_fkey" FOREIGN KEY ("subject_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."privacy_actions"
    ADD CONSTRAINT "privacy_actions_subject_owner_id_fkey" FOREIGN KEY ("subject_owner_id") REFERENCES "public"."owners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."user_roles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."property_groups"
    ADD CONSTRAINT "property_groups_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_availability"
    ADD CONSTRAINT "provider_availability_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_services"
    ADD CONSTRAINT "provider_services_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_services"
    ADD CONSTRAINT "provider_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_order_line_items"
    ADD CONSTRAINT "purchase_order_line_items_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."purchase_order_line_items"
    ADD CONSTRAINT "purchase_order_line_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recurring_bills"
    ADD CONSTRAINT "recurring_bills_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recurring_bills"
    ADD CONSTRAINT "recurring_bills_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recurring_bills"
    ADD CONSTRAINT "recurring_bills_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recurring_bills"
    ADD CONSTRAINT "recurring_bills_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recurring_bills"
    ADD CONSTRAINT "recurring_bills_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_bills"
    ADD CONSTRAINT "recurring_bills_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."recurring_journal_entries"
    ADD CONSTRAINT "recurring_journal_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recurring_journal_entries"
    ADD CONSTRAINT "recurring_journal_entries_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_work_orders"
    ADD CONSTRAINT "recurring_work_orders_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_work_orders"
    ADD CONSTRAINT "recurring_work_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recurring_work_orders"
    ADD CONSTRAINT "recurring_work_orders_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recurring_work_orders"
    ADD CONSTRAINT "recurring_work_orders_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_work_orders"
    ADD CONSTRAINT "recurring_work_orders_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recurring_work_orders"
    ADD CONSTRAINT "recurring_work_orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reminder_settings"
    ADD CONSTRAINT "reminder_settings_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_definitions"
    ADD CONSTRAINT "report_definitions_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_runs"
    ADD CONSTRAINT "report_runs_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "public"."report_definitions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."report_runs"
    ADD CONSTRAINT "report_runs_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_runs"
    ADD CONSTRAINT "report_runs_saved_report_id_fkey" FOREIGN KEY ("saved_report_id") REFERENCES "public"."saved_reports"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."report_runs"
    ADD CONSTRAINT "report_runs_scheduled_report_id_fkey" FOREIGN KEY ("scheduled_report_id") REFERENCES "public"."scheduled_reports"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."report_runs"
    ADD CONSTRAINT "report_runs_triggered_by_fkey" FOREIGN KEY ("triggered_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."report_snapshots"
    ADD CONSTRAINT "report_snapshots_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_snapshots"
    ADD CONSTRAINT "report_snapshots_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "public"."report_definitions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."report_snapshots"
    ADD CONSTRAINT "report_snapshots_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."report_snapshots"
    ADD CONSTRAINT "report_snapshots_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."report_runs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reserve_fund_settings"
    ADD CONSTRAINT "reserve_fund_settings_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reserve_fund_settings"
    ADD CONSTRAINT "reserve_fund_settings_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reserve_fund_settings"
    ADD CONSTRAINT "reserve_fund_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."saved_reports"
    ADD CONSTRAINT "saved_reports_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "public"."report_definitions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_reports"
    ADD CONSTRAINT "saved_reports_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_reports"
    ADD CONSTRAINT "saved_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scheduled_reports"
    ADD CONSTRAINT "scheduled_reports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scheduled_reports"
    ADD CONSTRAINT "scheduled_reports_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "public"."report_definitions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scheduled_reports"
    ADD CONSTRAINT "scheduled_reports_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scheduled_reports"
    ADD CONSTRAINT "scheduled_reports_saved_report_id_fkey" FOREIGN KEY ("saved_report_id") REFERENCES "public"."saved_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_homeowner_id_fkey" FOREIGN KEY ("homeowner_id") REFERENCES "public"."owners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shares"
    ADD CONSTRAINT "shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sms_conversations"
    ADD CONSTRAINT "sms_conversations_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sms_conversations"
    ADD CONSTRAINT "sms_conversations_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sms_messages"
    ADD CONSTRAINT "sms_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."sms_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sms_messages"
    ADD CONSTRAINT "sms_messages_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sms_opt_ins"
    ADD CONSTRAINT "sms_opt_ins_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id");



ALTER TABLE ONLY "public"."soft_delete_log"
    ADD CONSTRAINT "soft_delete_log_archived_by_fkey" FOREIGN KEY ("archived_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."soft_delete_log"
    ADD CONSTRAINT "soft_delete_log_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."statement_batches"
    ADD CONSTRAINT "statement_batches_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."statement_batches"
    ADD CONSTRAINT "statement_batches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."statements"
    ADD CONSTRAINT "statements_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."statements"
    ADD CONSTRAINT "statements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."statements"
    ADD CONSTRAINT "statements_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."statements"
    ADD CONSTRAINT "statements_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscription_events"
    ADD CONSTRAINT "subscription_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."subscription_events"
    ADD CONSTRAINT "subscription_events_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscription_events"
    ADD CONSTRAINT "subscription_events_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."superadmin_notes"
    ADD CONSTRAINT "superadmin_notes_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id");



ALTER TABLE ONLY "public"."survey_responses"
    ADD CONSTRAINT "survey_responses_submitted_by_owner_id_fkey" FOREIGN KEY ("submitted_by_owner_id") REFERENCES "public"."owners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."survey_responses"
    ADD CONSTRAINT "survey_responses_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."survey_responses"
    ADD CONSTRAINT "survey_responses_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."surveys"
    ADD CONSTRAINT "surveys_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."surveys"
    ADD CONSTRAINT "surveys_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tag_assignments"
    ADD CONSTRAINT "tag_assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tag_assignments"
    ADD CONSTRAINT "tag_assignments_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenancies"
    ADD CONSTRAINT "tenancies_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unit_amenities"
    ADD CONSTRAINT "unit_amenities_amenity_tag_id_fkey" FOREIGN KEY ("amenity_tag_id") REFERENCES "public"."amenity_tags"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."unit_amenities"
    ADD CONSTRAINT "unit_amenities_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unit_owners"
    ADD CONSTRAINT "unit_owners_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unit_owners"
    ADD CONSTRAINT "unit_owners_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unit_pets"
    ADD CONSTRAINT "unit_pets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."unit_pets"
    ADD CONSTRAINT "unit_pets_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unit_pets"
    ADD CONSTRAINT "unit_pets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."unit_pets"
    ADD CONSTRAINT "unit_pets_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unit_recurring_charges"
    ADD CONSTRAINT "unit_recurring_charges_charge_category_id_fkey" FOREIGN KEY ("charge_category_id") REFERENCES "public"."charge_categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."unit_recurring_charges"
    ADD CONSTRAINT "unit_recurring_charges_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."unit_recurring_charges"
    ADD CONSTRAINT "unit_recurring_charges_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."units"
    ADD CONSTRAINT "units_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usage_metrics"
    ADD CONSTRAINT "usage_metrics_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id");



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."user_roles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vendor_compliance"
    ADD CONSTRAINT "vendor_compliance_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_ach_activated_by_fkey" FOREIGN KEY ("ach_activated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_ach_verified_by_fkey" FOREIGN KEY ("ach_verified_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_default_gl_account_id_fkey" FOREIGN KEY ("default_gl_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."violation_cases"
    ADD CONSTRAINT "violation_cases_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."violation_cases"
    ADD CONSTRAINT "violation_cases_determined_by_fkey" FOREIGN KEY ("determined_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."violation_cases"
    ADD CONSTRAINT "violation_cases_house_rule_id_fkey" FOREIGN KEY ("house_rule_id") REFERENCES "public"."house_rules"("id");



ALTER TABLE ONLY "public"."violation_followup_steps"
    ADD CONSTRAINT "violation_followup_steps_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."violation_followup_steps"
    ADD CONSTRAINT "violation_followup_steps_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "public"."gl_accounts"("id");



ALTER TABLE ONLY "public"."violation_followup_steps"
    ADD CONSTRAINT "violation_followup_steps_letter_template_id_fkey" FOREIGN KEY ("letter_template_id") REFERENCES "public"."document_templates"("id");



ALTER TABLE ONLY "public"."violation_updates"
    ADD CONSTRAINT "violation_updates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."violation_updates"
    ADD CONSTRAINT "violation_updates_violation_id_fkey" FOREIGN KEY ("violation_id") REFERENCES "public"."violations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."violations"
    ADD CONSTRAINT "violations_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."violations"
    ADD CONSTRAINT "violations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."violations"
    ADD CONSTRAINT "violations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."violations"
    ADD CONSTRAINT "violations_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."votes"
    ADD CONSTRAINT "votes_ballot_id_fkey" FOREIGN KEY ("ballot_id") REFERENCES "public"."ballots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."votes"
    ADD CONSTRAINT "votes_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."votes"
    ADD CONSTRAINT "votes_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."webhook_deliveries"
    ADD CONSTRAINT "webhook_deliveries_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."webhook_endpoints"
    ADD CONSTRAINT "webhook_endpoints_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."webhook_endpoints"
    ADD CONSTRAINT "webhook_endpoints_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_order_estimates"
    ADD CONSTRAINT "work_order_estimates_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_order_estimates"
    ADD CONSTRAINT "work_order_estimates_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_order_estimates"
    ADD CONSTRAINT "work_order_estimates_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_order_labor_entries"
    ADD CONSTRAINT "work_order_labor_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_order_labor_entries"
    ADD CONSTRAINT "work_order_labor_entries_tech_id_fkey" FOREIGN KEY ("tech_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_order_labor_entries"
    ADD CONSTRAINT "work_order_labor_entries_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_order_messages"
    ADD CONSTRAINT "work_order_messages_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_order_updates"
    ADD CONSTRAINT "work_order_updates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."work_order_updates"
    ADD CONSTRAINT "work_order_updates_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."workflows"
    ADD CONSTRAINT "workflows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Anyone can read templates" ON "public"."maintenance_templates" FOR SELECT USING (true);



CREATE POLICY "Anyone read rules" ON "public"."house_rules" FOR SELECT USING (true);



CREATE POLICY "Company admins can insert billing usage" ON "public"."billing_usage" FOR INSERT WITH CHECK (("public"."is_company_admin"() AND (( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = "portfolio_id")));



CREATE POLICY "Company admins can insert communications log" ON "public"."communications_log" FOR INSERT WITH CHECK (("public"."is_company_admin"() AND (( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = "portfolio_id")));



CREATE POLICY "Company admins can insert invoices" ON "public"."invoices" FOR INSERT WITH CHECK (("public"."is_company_admin"() AND (( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = "portfolio_id")));



CREATE POLICY "Company admins can insert management fees" ON "public"."management_fees" FOR INSERT WITH CHECK (("public"."is_company_admin"() AND (( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = "portfolio_id")));



CREATE POLICY "Company admins can insert portfolio settings" ON "public"."portfolio_settings" FOR INSERT WITH CHECK ((("public"."is_company_admin"() AND (( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = "portfolio_id")) OR "public"."is_platform_operator"()));



CREATE POLICY "Company admins can select billing usage" ON "public"."billing_usage" FOR SELECT USING (("public"."is_company_admin"() AND (( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = "portfolio_id")));



CREATE POLICY "Company admins can select communications log" ON "public"."communications_log" FOR SELECT USING (("public"."is_company_admin"() AND (( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = "portfolio_id")));



CREATE POLICY "Company admins can select invoices" ON "public"."invoices" FOR SELECT USING (("public"."is_company_admin"() AND (( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = "portfolio_id")));



CREATE POLICY "Company admins can select management fees" ON "public"."management_fees" FOR SELECT USING (("public"."is_company_admin"() AND (( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = "portfolio_id")));



CREATE POLICY "Company admins can select portfolio settings" ON "public"."portfolio_settings" FOR SELECT USING ((("public"."is_company_admin"() AND (( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = "portfolio_id")) OR "public"."is_platform_operator"()));



CREATE POLICY "Company admins can update billing usage" ON "public"."billing_usage" FOR UPDATE USING (("public"."is_company_admin"() AND (( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = "portfolio_id")));



CREATE POLICY "Company admins can update invoices" ON "public"."invoices" FOR UPDATE USING (("public"."is_company_admin"() AND (( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = "portfolio_id")));



CREATE POLICY "Company admins can update management fees" ON "public"."management_fees" FOR UPDATE USING (("public"."is_company_admin"() AND (( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = "portfolio_id")));



CREATE POLICY "Company admins can update portfolio settings" ON "public"."portfolio_settings" FOR UPDATE USING ((("public"."is_company_admin"() AND (( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = "portfolio_id")) OR "public"."is_platform_operator"())) WITH CHECK ((("public"."is_company_admin"() AND (( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = "portfolio_id")) OR "public"."is_platform_operator"()));



CREATE POLICY "Owners can view own" ON "public"."insurance_policies" FOR SELECT USING (("owner_id" IN ( SELECT "owners"."id"
   FROM "public"."owners"
  WHERE ("owners"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Owners read own agreements" ON "public"."management_agreements" FOR SELECT USING (("owner_id" IN ( SELECT "owners"."id"
   FROM "public"."owners"
  WHERE ("owners"."email" = "auth"."email"()))));



CREATE POLICY "Owners read own forms" ON "public"."owner_form_submissions" FOR SELECT USING (("owner_id" IN ( SELECT "owners"."id"
   FROM "public"."owners"
  WHERE ("owners"."email" = "auth"."email"()))));



CREATE POLICY "Owners read own packet" ON "public"."owner_packets" FOR SELECT USING (("owner_id" IN ( SELECT "owners"."id"
   FROM "public"."owners"
  WHERE ("owners"."email" = "auth"."email"()))));



CREATE POLICY "Platform operators can delete portfolio settings" ON "public"."portfolio_settings" FOR DELETE USING ("public"."is_platform_operator"());



CREATE POLICY "Platform operators can insert portfolio settings" ON "public"."portfolio_settings" FOR INSERT WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "Staff can insert invitations" ON "public"."user_invitations" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = ("auth"."uid"())::"text"));



CREATE POLICY "Staff can manage insurance" ON "public"."insurance_policies" USING (("public"."is_any_staff"() OR "public"."is_company_admin"() OR "public"."is_platform_operator"()));



CREATE POLICY "Staff can view their portfolio invitations" ON "public"."user_invitations" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."portfolio_id" = "user_invitations"."portfolio_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."platform_operators" "po"
  WHERE (("po"."auth_user_id" = "auth"."uid"()) AND ("po"."active" = true))))));



CREATE POLICY "Staff manage ACH status" ON "public"."owner_ach_status" USING (("public"."is_staff"() OR "public"."is_platform_operator"()));



CREATE POLICY "Staff manage agreements" ON "public"."management_agreements" USING (("public"."is_staff"() OR "public"."is_platform_operator"()));



CREATE POLICY "Staff manage cases" ON "public"."violation_cases" USING (("public"."is_any_staff"() OR "public"."is_company_admin"() OR "public"."is_platform_operator"()));



CREATE POLICY "Staff manage form submissions" ON "public"."owner_form_submissions" USING (("public"."is_staff"() OR "public"."is_platform_operator"()));



CREATE POLICY "Staff manage history" ON "public"."maintenance_task_history" USING (("public"."is_any_staff"() OR "public"."is_company_admin"() OR "public"."is_platform_operator"()));



CREATE POLICY "Staff manage packets" ON "public"."owner_packets" USING (("public"."is_staff"() OR "public"."is_platform_operator"()));



CREATE POLICY "Staff manage portal invites" ON "public"."owner_portal_invites" USING (("public"."is_staff"() OR "public"."is_platform_operator"()));



CREATE POLICY "Staff manage rules" ON "public"."house_rules" USING (("public"."is_any_staff"() OR "public"."is_company_admin"() OR "public"."is_platform_operator"()));



CREATE POLICY "Staff manage tasks" ON "public"."maintenance_tasks" USING (("public"."is_any_staff"() OR "public"."is_company_admin"() OR "public"."is_platform_operator"()));



CREATE POLICY "Staff read audit logs" ON "public"."audit_logs" FOR SELECT USING (("public"."is_staff"() OR "public"."is_platform_operator"()));



CREATE POLICY "System insert audit logs" ON "public"."audit_logs" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."accounting_periods" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "acct_periods_finance" ON "public"."accounting_periods" TO "authenticated" USING ("public"."can_manage_finance"("portfolio_id")) WITH CHECK ("public"."can_manage_finance"("portfolio_id"));



ALTER TABLE "public"."activity" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activity_insert_own" ON "public"."activity" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "activity_select_own" ON "public"."activity" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."agenda_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agenda_items_board_read" ON "public"."agenda_items" FOR SELECT USING (("public"."is_board_user"() AND (EXISTS ( SELECT 1
   FROM "public"."meetings" "m"
  WHERE (("m"."id" = "agenda_items"."meeting_id") AND ("m"."association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids")))))));



ALTER TABLE "public"."agents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agents_owner_all" ON "public"."agents" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "al_staff_all" ON "public"."association_loans" USING ((("public"."is_any_staff"() OR "public"."is_company_admin"()) AND "public"."can_access_portfolio"("portfolio_id"))) WITH CHECK ((("public"."is_any_staff"() OR "public"."is_company_admin"()) AND "public"."can_access_portfolio"("portfolio_id")));



CREATE POLICY "alts_select" ON "public"."association_lease_template_settings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."associations" "a"
  WHERE (("a"."id" = "association_lease_template_settings"."association_id") AND (("a"."portfolio_id" = "public"."current_portfolio_id"()) OR "public"."is_platform_operator"())))));



CREATE POLICY "alts_write" ON "public"."association_lease_template_settings" USING (((EXISTS ( SELECT 1
   FROM "public"."associations" "a"
  WHERE (("a"."id" = "association_lease_template_settings"."association_id") AND ("a"."portfolio_id" = "public"."current_portfolio_id"())))) AND "public"."is_full_access_staff"()));



CREATE POLICY "am_delete_admins" ON "public"."association_managers" FOR DELETE TO "authenticated" USING (("public"."is_platform_operator"() OR ("public"."is_company_admin"() AND ("portfolio_id" IN ( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "am_insert_admins" ON "public"."association_managers" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_platform_operator"() OR ("public"."is_company_admin"() AND ("portfolio_id" IN ( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "am_select_visible" ON "public"."association_managers" FOR SELECT TO "authenticated" USING (("public"."is_platform_operator"() OR ("public"."is_company_admin"() AND ("portfolio_id" IN ( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "am_update_admins" ON "public"."association_managers" FOR UPDATE TO "authenticated" USING (("public"."is_platform_operator"() OR ("public"."is_company_admin"() AND ("portfolio_id" IN ( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))))) WITH CHECK (("public"."is_platform_operator"() OR ("public"."is_company_admin"() AND ("portfolio_id" IN ( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "amenity_res_board_select" ON "public"."amenity_reservations" FOR SELECT USING (("association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids")));



CREATE POLICY "amenity_res_operator_all" ON "public"."amenity_reservations" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "amenity_res_resident_cancel" ON "public"."amenity_reservations" FOR UPDATE USING ((("owner_id" = "public"."current_owner_id"()) AND ("status" = ANY (ARRAY['pending'::"text", 'approved'::"text"])))) WITH CHECK ((("owner_id" = "public"."current_owner_id"()) AND ("status" = 'cancelled'::"text")));



CREATE POLICY "amenity_res_resident_insert" ON "public"."amenity_reservations" FOR INSERT WITH CHECK (("public"."is_portal_resident"() AND ("owner_id" = "public"."current_owner_id"()) AND ("association_id" IN ( SELECT "public"."current_resident_association_ids"() AS "current_resident_association_ids")) AND ("status" = 'pending'::"text")));



CREATE POLICY "amenity_res_resident_select" ON "public"."amenity_reservations" FOR SELECT USING (("owner_id" = "public"."current_owner_id"()));



CREATE POLICY "amenity_res_staff_all" ON "public"."amenity_reservations" USING ("public"."can_access_association"("association_id")) WITH CHECK ("public"."can_access_association"("association_id"));



ALTER TABLE "public"."amenity_reservations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."amenity_tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "amenity_tags_staff" ON "public"."amenity_tags" TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id")) WITH CHECK ("public"."can_access_portfolio"("portfolio_id"));



ALTER TABLE "public"."api_keys" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "api_keys_admin_all" ON "public"."api_keys" TO "authenticated" USING ("public"."can_admin_portfolio"("portfolio_id")) WITH CHECK (("public"."can_admin_portfolio"("portfolio_id") AND "public"."has_entitlement"("portfolio_id", 'api_keys'::"text")));



CREATE POLICY "api_keys_platform_all" ON "public"."api_keys" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



ALTER TABLE "public"."approval_decisions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "approval_decisions_board_insert" ON "public"."approval_decisions" FOR INSERT WITH CHECK ((("decided_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."approval_requests" "r"
  WHERE (("r"."id" = "approval_decisions"."approval_request_id") AND ("r"."association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids")))))));



CREATE POLICY "approval_decisions_board_update" ON "public"."approval_decisions" FOR UPDATE USING ((("decided_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."approval_requests" "r"
  WHERE (("r"."id" = "approval_decisions"."approval_request_id") AND ("r"."association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))))))) WITH CHECK ((("decided_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."approval_requests" "r"
  WHERE (("r"."id" = "approval_decisions"."approval_request_id") AND ("r"."association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids")))))));



CREATE POLICY "approval_decisions_select" ON "public"."approval_decisions" FOR SELECT USING (("public"."is_platform_operator"() OR (EXISTS ( SELECT 1
   FROM "public"."approval_requests" "r"
  WHERE (("r"."id" = "approval_decisions"."approval_request_id") AND ("public"."can_access_portfolio"("r"."portfolio_id") OR ("public"."is_board_user"() AND ("r"."association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids")))))))));



ALTER TABLE "public"."approval_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "approval_requests_board_read" ON "public"."approval_requests" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND ("association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))));



CREATE POLICY "approval_requests_resident_insert" ON "public"."approval_requests" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_portal_resident"() AND ("owner_id" = "public"."current_owner_id"())));



CREATE POLICY "approval_requests_resident_read" ON "public"."approval_requests" FOR SELECT TO "authenticated" USING (("public"."is_portal_resident"() AND (("owner_id" = "public"."current_owner_id"()) OR ("unit_id" IN ( SELECT "public"."current_resident_unit_ids"() AS "current_resident_unit_ids")))));



CREATE POLICY "approval_requests_staff_all" ON "public"."approval_requests" TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id")) WITH CHECK ("public"."can_access_portfolio"("portfolio_id"));



CREATE POLICY "approval_requests_vendor_read" ON "public"."approval_requests" FOR SELECT TO "authenticated" USING (("vendor_id" = "public"."current_vendor_id"()));



ALTER TABLE "public"."approval_votes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "approval_votes_board_cast" ON "public"."approval_votes" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_board_user"() AND ("voter_user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."approval_requests" "ar"
     JOIN "public"."board_members" "bm" ON ((("bm"."auth_user_id" = "auth"."uid"()) AND "bm"."active")))
  WHERE (("ar"."id" = "approval_votes"."approval_request_id") AND ("ar"."association_id" = "bm"."association_id") AND ("ar"."status" = 'pending'::"public"."approval_request_status"))))));



CREATE POLICY "approval_votes_platform_all" ON "public"."approval_votes" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "approval_votes_staff_read" ON "public"."approval_votes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."approval_requests" "ar"
  WHERE (("ar"."id" = "approval_votes"."approval_request_id") AND "public"."can_access_portfolio"("ar"."portfolio_id")))));



CREATE POLICY "arch_msg_board_insert" ON "public"."architectural_request_messages" FOR INSERT WITH CHECK ((("author_role" = 'board'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."architectural_requests" "r"
  WHERE (("r"."id" = "architectural_request_messages"."request_id") AND ("r"."association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids")))))));



CREATE POLICY "arch_msg_board_select" ON "public"."architectural_request_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."architectural_requests" "r"
  WHERE (("r"."id" = "architectural_request_messages"."request_id") AND ("r"."association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))))));



CREATE POLICY "arch_msg_operator_all" ON "public"."architectural_request_messages" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "arch_msg_resident_insert" ON "public"."architectural_request_messages" FOR INSERT WITH CHECK ((("author_role" = 'owner'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."architectural_requests" "r"
  WHERE (("r"."id" = "architectural_request_messages"."request_id") AND ("r"."owner_id" = "public"."current_owner_id"()))))));



CREATE POLICY "arch_msg_resident_select" ON "public"."architectural_request_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."architectural_requests" "r"
  WHERE (("r"."id" = "architectural_request_messages"."request_id") AND ("r"."owner_id" = "public"."current_owner_id"())))));



CREATE POLICY "arch_msg_staff_all" ON "public"."architectural_request_messages" USING ((EXISTS ( SELECT 1
   FROM "public"."architectural_requests" "r"
  WHERE (("r"."id" = "architectural_request_messages"."request_id") AND "public"."can_access_association"("r"."association_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."architectural_requests" "r"
  WHERE (("r"."id" = "architectural_request_messages"."request_id") AND "public"."can_access_association"("r"."association_id")))));



CREATE POLICY "arch_req_board_select" ON "public"."architectural_requests" FOR SELECT USING (("association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids")));



CREATE POLICY "arch_req_operator_all" ON "public"."architectural_requests" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "arch_req_resident_insert" ON "public"."architectural_requests" FOR INSERT WITH CHECK (("public"."is_portal_resident"() AND ("owner_id" = "public"."current_owner_id"()) AND ("association_id" IN ( SELECT "public"."current_resident_association_ids"() AS "current_resident_association_ids")) AND ("status" = 'submitted'::"text")));



CREATE POLICY "arch_req_resident_select" ON "public"."architectural_requests" FOR SELECT USING (("owner_id" = "public"."current_owner_id"()));



CREATE POLICY "arch_req_resident_withdraw" ON "public"."architectural_requests" FOR UPDATE USING ((("owner_id" = "public"."current_owner_id"()) AND ("status" = ANY (ARRAY['submitted'::"text", 'under_review'::"text", 'more_info'::"text"])))) WITH CHECK ((("owner_id" = "public"."current_owner_id"()) AND ("status" = 'withdrawn'::"text")));



CREATE POLICY "arch_req_staff_all" ON "public"."architectural_requests" USING ("public"."can_access_association"("association_id")) WITH CHECK ("public"."can_access_association"("association_id"));



CREATE POLICY "arch_settings_select" ON "public"."architectural_review_settings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."associations" "a"
  WHERE (("a"."id" = "architectural_review_settings"."association_id") AND (("a"."portfolio_id" = "public"."current_portfolio_id"()) OR "public"."is_platform_operator"())))));



CREATE POLICY "arch_settings_write" ON "public"."architectural_review_settings" USING (((EXISTS ( SELECT 1
   FROM "public"."associations" "a"
  WHERE (("a"."id" = "architectural_review_settings"."association_id") AND ("a"."portfolio_id" = "public"."current_portfolio_id"())))) AND "public"."is_full_access_staff"()));



ALTER TABLE "public"."architectural_request_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."architectural_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."architectural_review_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "aro_select" ON "public"."association_renewal_options" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."associations" "a"
  WHERE (("a"."id" = "association_renewal_options"."association_id") AND (("a"."portfolio_id" = "public"."current_portfolio_id"()) OR "public"."is_platform_operator"())))));



CREATE POLICY "aro_write" ON "public"."association_renewal_options" USING (((EXISTS ( SELECT 1
   FROM "public"."associations" "a"
  WHERE (("a"."id" = "association_renewal_options"."association_id") AND ("a"."portfolio_id" = "public"."current_portfolio_id"())))) AND "public"."is_full_access_staff"()));



ALTER TABLE "public"."assessment_periods" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "assessment_periods_board_read" ON "public"."assessment_periods" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND ("association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))));



CREATE POLICY "assessment_periods_finance_all" ON "public"."assessment_periods" TO "authenticated" USING (("public"."is_platform_operator"() OR ("public"."is_finance_staff"() AND "public"."can_access_association"("association_id")))) WITH CHECK (("public"."is_platform_operator"() OR ("public"."is_finance_staff"() AND "public"."can_access_association"("association_id"))));



CREATE POLICY "assessment_periods_resident_read" ON "public"."assessment_periods" FOR SELECT TO "authenticated" USING (("public"."is_portal_resident"() AND ("association_id" IN ( SELECT "public"."current_resident_association_ids"() AS "current_resident_association_ids"))));



CREATE POLICY "assoc_amenities_staff" ON "public"."association_amenities" TO "authenticated" USING ("public"."can_access_association"("association_id")) WITH CHECK ("public"."can_access_association"("association_id"));



ALTER TABLE "public"."association_additional_fees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."association_amenities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."association_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."association_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."association_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."association_lease_template_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."association_loans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."association_managers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."association_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."association_renewal_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."associations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "associations_board_read" ON "public"."associations" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND ("id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))));



CREATE POLICY "associations_resident_read" ON "public"."associations" FOR SELECT TO "authenticated" USING (("public"."is_portal_resident"() AND ("id" IN ( SELECT "public"."current_resident_association_ids"() AS "current_resident_association_ids"))));



CREATE POLICY "associations_select" ON "public"."associations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."portfolio_id" = "associations"."portfolio_id")))));



CREATE POLICY "associations_staff_all" ON "public"."associations" TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id")) WITH CHECK ("public"."can_access_portfolio"("portfolio_id"));



CREATE POLICY "associations_vendor_read" ON "public"."associations" FOR SELECT TO "authenticated" USING ((("public"."current_vendor_id"() IS NOT NULL) AND ("id" IN ( SELECT "wo"."association_id"
   FROM "public"."work_orders" "wo"
  WHERE (("wo"."vendor_id" = "public"."current_vendor_id"()) AND ("wo"."association_id" IS NOT NULL))))));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."automation_flow_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "automation_flow_runs_operator_all" ON "public"."automation_flow_runs" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "automation_flow_runs_staff_all" ON "public"."automation_flow_runs" USING ((EXISTS ( SELECT 1
   FROM "public"."automation_flows" "f"
  WHERE (("f"."id" = "automation_flow_runs"."flow_id") AND "public"."can_access_portfolio"("f"."portfolio_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."automation_flows" "f"
  WHERE (("f"."id" = "automation_flow_runs"."flow_id") AND "public"."can_access_portfolio"("f"."portfolio_id")))));



ALTER TABLE "public"."automation_flows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "automation_flows_operator_all" ON "public"."automation_flows" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "automation_flows_staff_all" ON "public"."automation_flows" USING ("public"."can_access_portfolio"("portfolio_id")) WITH CHECK ("public"."can_access_portfolio"("portfolio_id"));



ALTER TABLE "public"."automation_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "autopay_finance_all" ON "public"."autopay_mandates" TO "authenticated" USING ("public"."can_manage_finance"("portfolio_id")) WITH CHECK ("public"."can_manage_finance"("portfolio_id"));



ALTER TABLE "public"."autopay_mandates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "autopay_owner_self" ON "public"."autopay_mandates" TO "authenticated" USING (("owner_id" = "public"."current_owner_id"())) WITH CHECK (("owner_id" = "public"."current_owner_id"()));



CREATE POLICY "autopay_staff" ON "public"."autopay_mandates" FOR SELECT TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id"));



CREATE POLICY "badj_finance_all" ON "public"."bank_adjustments" USING (("public"."is_platform_operator"() OR (EXISTS ( SELECT 1
   FROM "public"."bank_accounts" "ba"
  WHERE (("ba"."id" = "bank_adjustments"."bank_account_id") AND "public"."can_manage_finance"("ba"."portfolio_id")))))) WITH CHECK (("public"."is_platform_operator"() OR (EXISTS ( SELECT 1
   FROM "public"."bank_accounts" "ba"
  WHERE (("ba"."id" = "bank_adjustments"."bank_account_id") AND "public"."can_manage_finance"("ba"."portfolio_id"))))));



ALTER TABLE "public"."ballots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ballots_board_read" ON "public"."ballots" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND ("association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))));



CREATE POLICY "ballots_resident_read" ON "public"."ballots" FOR SELECT TO "authenticated" USING (("public"."is_portal_resident"() AND ("status" = ANY (ARRAY['open'::"text", 'closed'::"text"])) AND ("association_id" IN ( SELECT "public"."current_resident_association_ids"() AS "current_resident_association_ids"))));



CREATE POLICY "ballots_staff_all" ON "public"."ballots" TO "authenticated" USING ("public"."can_access_association"("association_id")) WITH CHECK ("public"."can_access_association"("association_id"));



ALTER TABLE "public"."bank_account_owners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bank_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bank_accounts_board_read" ON "public"."bank_accounts" FOR SELECT TO "authenticated" USING (("association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids")));



CREATE POLICY "bank_accounts_finance_all" ON "public"."bank_accounts" TO "authenticated" USING ("public"."can_manage_finance"("portfolio_id")) WITH CHECK ("public"."can_manage_finance"("portfolio_id"));



CREATE POLICY "bank_accounts_platform_all" ON "public"."bank_accounts" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



ALTER TABLE "public"."bank_adjustments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bank_owners_finance_all" ON "public"."bank_account_owners" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."bank_accounts" "b"
  WHERE (("b"."id" = "bank_account_owners"."bank_account_id") AND "public"."can_manage_finance"("b"."portfolio_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."bank_accounts" "b"
  WHERE (("b"."id" = "bank_account_owners"."bank_account_id") AND "public"."can_manage_finance"("b"."portfolio_id")))));



ALTER TABLE "public"."bank_reconciliation_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bank_reconciliation_items_finance_all" ON "public"."bank_reconciliation_items" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."bank_reconciliations" "br"
  WHERE (("br"."id" = "bank_reconciliation_items"."reconciliation_id") AND "public"."can_manage_finance"("br"."portfolio_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."bank_reconciliations" "br"
  WHERE (("br"."id" = "bank_reconciliation_items"."reconciliation_id") AND "public"."can_manage_finance"("br"."portfolio_id")))));



CREATE POLICY "bank_reconciliation_items_platform_all" ON "public"."bank_reconciliation_items" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



ALTER TABLE "public"."bank_reconciliations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bank_reconciliations_finance_all" ON "public"."bank_reconciliations" TO "authenticated" USING ("public"."can_manage_finance"("portfolio_id")) WITH CHECK ("public"."can_manage_finance"("portfolio_id"));



CREATE POLICY "bank_reconciliations_platform_all" ON "public"."bank_reconciliations" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



ALTER TABLE "public"."bank_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bank_transactions_finance_all" ON "public"."bank_transactions" TO "authenticated" USING ("public"."can_manage_finance"("portfolio_id")) WITH CHECK ("public"."can_manage_finance"("portfolio_id"));



CREATE POLICY "bank_transactions_platform_all" ON "public"."bank_transactions" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



ALTER TABLE "public"."bank_transfers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bank_transfers_finance_all" ON "public"."bank_transfers" TO "authenticated" USING ("public"."can_manage_finance"("portfolio_id")) WITH CHECK ("public"."can_manage_finance"("portfolio_id"));



CREATE POLICY "bank_transfers_platform_all" ON "public"."bank_transfers" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "bill_line_items_finance_all" ON "public"."payable_bill_line_items" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."payable_bills" "b"
  WHERE (("b"."id" = "payable_bill_line_items"."bill_id") AND "public"."can_manage_finance"("b"."portfolio_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."payable_bills" "b"
  WHERE (("b"."id" = "payable_bill_line_items"."bill_id") AND "public"."can_manage_finance"("b"."portfolio_id")))));



ALTER TABLE "public"."billing_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."board_approval_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "board_approval_settings_select" ON "public"."board_approval_settings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."associations" "a"
  WHERE (("a"."id" = "board_approval_settings"."association_id") AND (("a"."portfolio_id" = "public"."current_portfolio_id"()) OR "public"."is_platform_operator"())))));



CREATE POLICY "board_approval_settings_write" ON "public"."board_approval_settings" USING (((EXISTS ( SELECT 1
   FROM "public"."associations" "a"
  WHERE (("a"."id" = "board_approval_settings"."association_id") AND ("a"."portfolio_id" = "public"."current_portfolio_id"())))) AND "public"."is_full_access_staff"()));



ALTER TABLE "public"."board_comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "board_delete_own_comments" ON "public"."board_comments" FOR DELETE USING (("author_id" = "auth"."uid"()));



CREATE POLICY "board_insert_comments" ON "public"."board_comments" FOR INSERT WITH CHECK (("author_id" = "auth"."uid"()));



ALTER TABLE "public"."board_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "board_members_board_read" ON "public"."board_members" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND ("association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))));



CREATE POLICY "board_members_resident_read" ON "public"."board_members" FOR SELECT TO "authenticated" USING (("public"."is_portal_resident"() AND ("association_id" IN ( SELECT "public"."current_resident_association_ids"() AS "current_resident_association_ids"))));



CREATE POLICY "board_members_staff_all" ON "public"."board_members" TO "authenticated" USING ("public"."can_access_association"("association_id")) WITH CHECK ("public"."can_access_association"("association_id"));



CREATE POLICY "board_update_own_comments" ON "public"."board_comments" FOR UPDATE USING (("author_id" = "auth"."uid"()));



CREATE POLICY "board_view_comments" ON "public"."board_comments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."board_members"
  WHERE (("board_members"."auth_user_id" = "auth"."uid"()) AND ("board_members"."active" = true) AND ("board_members"."association_id" = "board_comments"."association_id")))));



ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."budget_lines" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "budget_lines_board_read" ON "public"."budget_lines" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND ("association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))));



CREATE POLICY "budget_lines_delete" ON "public"."budget_lines" FOR DELETE TO "authenticated" USING (("public"."is_staff"() AND (EXISTS ( SELECT 1
   FROM "public"."associations" "a"
  WHERE (("a"."id" = "budget_lines"."association_id") AND ("a"."portfolio_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'portfolio_id'::"text"))::"uuid"))))));



CREATE POLICY "budget_lines_finance_all" ON "public"."budget_lines" TO "authenticated" USING ((("public"."can_access_association"("association_id") AND "public"."is_finance_staff"()) OR "public"."is_platform_operator"())) WITH CHECK ((("public"."can_access_association"("association_id") AND "public"."is_finance_staff"()) OR "public"."is_platform_operator"()));



CREATE POLICY "budget_lines_insert" ON "public"."budget_lines" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_staff"() AND (EXISTS ( SELECT 1
   FROM "public"."associations" "a"
  WHERE (("a"."id" = "budget_lines"."association_id") AND ("a"."portfolio_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'portfolio_id'::"text"))::"uuid"))))));



CREATE POLICY "budget_lines_platform_all" ON "public"."budget_lines" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "budget_lines_select" ON "public"."budget_lines" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."associations" "a"
  WHERE (("a"."id" = "budget_lines"."association_id") AND ("a"."portfolio_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'portfolio_id'::"text"))::"uuid")))));



CREATE POLICY "budget_lines_update" ON "public"."budget_lines" FOR UPDATE TO "authenticated" USING (("public"."is_staff"() AND (EXISTS ( SELECT 1
   FROM "public"."associations" "a"
  WHERE (("a"."id" = "budget_lines"."association_id") AND ("a"."portfolio_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'portfolio_id'::"text"))::"uuid")))))) WITH CHECK (true);



ALTER TABLE "public"."buildings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "buildings_board_read" ON "public"."buildings" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND ("association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))));



CREATE POLICY "buildings_resident_read" ON "public"."buildings" FOR SELECT TO "authenticated" USING (("public"."is_portal_resident"() AND ("association_id" IN ( SELECT "public"."current_resident_association_ids"() AS "current_resident_association_ids"))));



CREATE POLICY "buildings_staff_all" ON "public"."buildings" TO "authenticated" USING ("public"."can_access_association"("association_id")) WITH CHECK ("public"."can_access_association"("association_id"));



ALTER TABLE "public"."calendar_event_reminders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calendar_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "calendar_events_board_read" ON "public"."calendar_events" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND (("association_id" IS NULL) OR ("association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids")))));



CREATE POLICY "calendar_events_resident_read" ON "public"."calendar_events" FOR SELECT TO "authenticated" USING (("public"."is_portal_resident"() AND (("association_id" IS NULL) OR ("association_id" IN ( SELECT "public"."current_resident_association_ids"() AS "current_resident_association_ids")))));



CREATE POLICY "calendar_events_staff_all" ON "public"."calendar_events" TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id")) WITH CHECK ("public"."can_access_portfolio"("portfolio_id"));



CREATE POLICY "calendar_events_vendor_read" ON "public"."calendar_events" FOR SELECT TO "authenticated" USING (("vendor_id" = "public"."current_vendor_id"()));



ALTER TABLE "public"."charge_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "charge_categories_board_read" ON "public"."charge_categories" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND "active"));



CREATE POLICY "charge_categories_finance_all" ON "public"."charge_categories" TO "authenticated" USING ("public"."can_manage_finance"("portfolio_id")) WITH CHECK ("public"."can_manage_finance"("portfolio_id"));



CREATE POLICY "charge_categories_resident_read" ON "public"."charge_categories" FOR SELECT TO "authenticated" USING (("public"."is_portal_resident"() AND "active"));



CREATE POLICY "charge_categories_staff_read" ON "public"."charge_categories" FOR SELECT TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id"));



ALTER TABLE "public"."charges" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "charges_board_read" ON "public"."charges" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND ("unit_id" IN ( SELECT "u"."id"
   FROM ("public"."units" "u"
     JOIN "public"."buildings" "b" ON (("b"."id" = "u"."building_id")))
  WHERE ("b"."association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))))));



CREATE POLICY "charges_finance_all" ON "public"."charges" TO "authenticated" USING (("public"."is_platform_operator"() OR ("public"."is_finance_staff"() AND "public"."can_access_unit"("unit_id")))) WITH CHECK (("public"."is_platform_operator"() OR ("public"."is_finance_staff"() AND "public"."can_access_unit"("unit_id"))));



CREATE POLICY "charges_resident_read" ON "public"."charges" FOR SELECT TO "authenticated" USING (("public"."is_portal_resident"() AND ("unit_id" IN ( SELECT "public"."current_resident_unit_ids"() AS "current_resident_unit_ids"))));



CREATE POLICY "comm_triggers_admin_all" ON "public"."communication_triggers" TO "authenticated" USING ("public"."can_admin_portfolio"("portfolio_id")) WITH CHECK ("public"."can_admin_portfolio"("portfolio_id"));



CREATE POLICY "comm_triggers_staff_read" ON "public"."communication_triggers" FOR SELECT TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id"));



ALTER TABLE "public"."committee_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "committee_members_staff_all" ON "public"."committee_members" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."committees" "c"
  WHERE (("c"."id" = "committee_members"."committee_id") AND "public"."can_access_association"("c"."association_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."committees" "c"
  WHERE (("c"."id" = "committee_members"."committee_id") AND "public"."can_access_association"("c"."association_id")))));



ALTER TABLE "public"."committees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "committees_resident_read" ON "public"."committees" FOR SELECT TO "authenticated" USING ((("public"."is_portal_resident"() OR "public"."is_board_user"()) AND ("association_id" IN ( SELECT "public"."current_resident_association_ids"() AS "current_resident_association_ids"
UNION
 SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))));



CREATE POLICY "committees_staff_all" ON "public"."committees" TO "authenticated" USING ("public"."can_access_association"("association_id")) WITH CHECK ("public"."can_access_association"("association_id"));



ALTER TABLE "public"."communication_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."communication_triggers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."communications_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "communications_resident_read" ON "public"."communications_log" FOR SELECT USING (("public"."is_portal_resident"() AND (("sender_id" = "public"."current_owner_id"()) OR (("channel" = 'announcement'::"text") AND ("association_id" IN ( SELECT "public"."current_resident_association_ids"() AS "current_resident_association_ids"))))));



ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_admin_all" ON "public"."association_assignments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."hoa_role" = 'company_admin'::"public"."hoa_role") AND ("p"."portfolio_id" = "association_assignments"."portfolio_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."hoa_role" = 'company_admin'::"public"."hoa_role") AND ("p"."portfolio_id" = "association_assignments"."portfolio_id")))));



ALTER TABLE "public"."company_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."data_diagnostics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."data_export_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "data_exports_admin_portfolio" ON "public"."data_export_requests" TO "authenticated" USING (("public"."can_admin_portfolio"("portfolio_id") AND "public"."has_entitlement"("portfolio_id", 'data_export'::"text"))) WITH CHECK (("public"."can_admin_portfolio"("portfolio_id") AND "public"."has_entitlement"("portfolio_id", 'data_export'::"text")));



CREATE POLICY "data_exports_platform_all" ON "public"."data_export_requests" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "data_exports_subject_read" ON "public"."data_export_requests" FOR SELECT TO "authenticated" USING (("subject_auth_user_id" = "auth"."uid"()));



CREATE POLICY "depr_entries_finance_all" ON "public"."depreciation_entries" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."fixed_assets" "a"
  WHERE (("a"."id" = "depreciation_entries"."fixed_asset_id") AND "public"."can_manage_finance"("a"."portfolio_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."fixed_assets" "a"
  WHERE (("a"."id" = "depreciation_entries"."fixed_asset_id") AND "public"."can_manage_finance"("a"."portfolio_id")))));



ALTER TABLE "public"."depreciation_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."diagnostic_flags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "diagnostics_admin_write" ON "public"."data_diagnostics" TO "authenticated" USING ("public"."can_admin_portfolio"("portfolio_id")) WITH CHECK ("public"."can_admin_portfolio"("portfolio_id"));



CREATE POLICY "diagnostics_staff_read" ON "public"."data_diagnostics" FOR SELECT TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id"));



CREATE POLICY "doc_requests_staff" ON "public"."document_requests" TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id")) WITH CHECK ("public"."can_access_portfolio"("portfolio_id"));



CREATE POLICY "doc_requests_vendor_self" ON "public"."document_requests" TO "authenticated" USING (("vendor_id" = "public"."current_vendor_id"())) WITH CHECK (("vendor_id" = "public"."current_vendor_id"()));



CREATE POLICY "doc_templates_platform_all" ON "public"."document_templates" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "doc_templates_staff_all" ON "public"."document_templates" TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id")) WITH CHECK ("public"."can_access_portfolio"("portfolio_id"));



ALTER TABLE "public"."document_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "documents_board_read" ON "public"."documents" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND ("entity_type" = 'association'::"text") AND ("entity_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))));



CREATE POLICY "documents_resident_read" ON "public"."documents" FOR SELECT TO "authenticated" USING (("public"."is_portal_resident"() AND ((("entity_type" = 'unit'::"text") AND ("entity_id" IN ( SELECT "public"."current_resident_unit_ids"() AS "current_resident_unit_ids"))) OR (("entity_type" = 'owner'::"text") AND ("entity_id" = "public"."current_owner_id"())) OR (("entity_type" = 'association'::"text") AND ("entity_id" IN ( SELECT "public"."current_resident_association_ids"() AS "current_resident_association_ids"))))));



CREATE POLICY "documents_staff_all" ON "public"."documents" TO "authenticated" USING (("public"."is_any_staff"() OR "public"."is_company_admin"())) WITH CHECK (("public"."is_any_staff"() OR "public"."is_company_admin"()));



ALTER TABLE "public"."dues_increase_lines" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dues_increase_lines_finance" ON "public"."dues_increase_lines" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."dues_increases" "di"
  WHERE (("di"."id" = "dues_increase_lines"."dues_increase_id") AND "public"."can_manage_finance"("di"."portfolio_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."dues_increases" "di"
  WHERE (("di"."id" = "dues_increase_lines"."dues_increase_id") AND "public"."can_manage_finance"("di"."portfolio_id")))));



ALTER TABLE "public"."dues_increases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dues_increases_finance" ON "public"."dues_increases" TO "authenticated" USING ("public"."can_manage_finance"("portfolio_id")) WITH CHECK ("public"."can_manage_finance"("portfolio_id"));



ALTER TABLE "public"."email_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_queue" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "email_queue_staff_all" ON "public"."email_queue" TO "authenticated" USING (("public"."is_platform_operator"() OR ("association_id" IS NULL) OR "public"."can_access_association"("association_id"))) WITH CHECK (("public"."is_platform_operator"() OR ("association_id" IS NULL) OR "public"."can_access_association"("association_id")));



ALTER TABLE "public"."email_threads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "estimates_staff_all" ON "public"."work_order_estimates" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."work_orders" "w"
  WHERE (("w"."id" = "work_order_estimates"."work_order_id") AND "public"."can_access_association"("w"."association_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."work_orders" "w"
  WHERE (("w"."id" = "work_order_estimates"."work_order_id") AND "public"."can_access_association"("w"."association_id")))));



CREATE POLICY "estimates_vendor_rw" ON "public"."work_order_estimates" TO "authenticated" USING (("vendor_id" = "public"."current_vendor_id"())) WITH CHECK (("vendor_id" = "public"."current_vendor_id"()));



ALTER TABLE "public"."feature_entitlements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feature_entitlements_platform_write" ON "public"."feature_entitlements" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "feature_entitlements_read" ON "public"."feature_entitlements" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."fixed_assets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fixed_assets_board_read" ON "public"."fixed_assets" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND (("association_id" IS NULL) OR ("association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids")))));



CREATE POLICY "fixed_assets_finance_all" ON "public"."fixed_assets" TO "authenticated" USING ("public"."can_manage_finance"("portfolio_id")) WITH CHECK ("public"."can_manage_finance"("portfolio_id"));



ALTER TABLE "public"."form_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "form_templates_staff_all" ON "public"."form_templates" TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id")) WITH CHECK ("public"."can_access_portfolio"("portfolio_id"));



ALTER TABLE "public"."gl_account_role_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gl_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gl_accounts_board_read" ON "public"."gl_accounts" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND (("association_id" IS NULL) OR ("association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids")))));



CREATE POLICY "gl_accounts_finance_all" ON "public"."gl_accounts" TO "authenticated" USING ("public"."can_manage_finance"("portfolio_id")) WITH CHECK ("public"."can_manage_finance"("portfolio_id"));



CREATE POLICY "gl_accounts_platform_all" ON "public"."gl_accounts" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "gl_role_perms_admin_all" ON "public"."gl_account_role_permissions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."gl_accounts" "g"
  WHERE (("g"."id" = "gl_account_role_permissions"."gl_account_id") AND "public"."can_admin_portfolio"("g"."portfolio_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."gl_accounts" "g"
  WHERE (("g"."id" = "gl_account_role_permissions"."gl_account_id") AND "public"."can_admin_portfolio"("g"."portfolio_id")))));



CREATE POLICY "gl_role_perms_staff_read" ON "public"."gl_account_role_permissions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."gl_accounts" "g"
  WHERE (("g"."id" = "gl_account_role_permissions"."gl_account_id") AND "public"."can_access_portfolio"("g"."portfolio_id")))));



ALTER TABLE "public"."house_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."income_recertifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inspection_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inspection_items_staff_all" ON "public"."inspection_items" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."inspections" "i"
  WHERE (("i"."id" = "inspection_items"."inspection_id") AND "public"."can_access_portfolio"("i"."portfolio_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."inspections" "i"
  WHERE (("i"."id" = "inspection_items"."inspection_id") AND "public"."can_access_portfolio"("i"."portfolio_id")))));



CREATE POLICY "inspection_items_vendor_rw" ON "public"."inspection_items" TO "authenticated" USING (("inspection_id" IN ( SELECT "inspections"."id"
   FROM "public"."inspections"
  WHERE ("inspections"."inspector_vendor_id" = "public"."current_vendor_id"())))) WITH CHECK (("inspection_id" IN ( SELECT "inspections"."id"
   FROM "public"."inspections"
  WHERE ("inspections"."inspector_vendor_id" = "public"."current_vendor_id"()))));



ALTER TABLE "public"."inspections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inspections_board_read" ON "public"."inspections" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND ("association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))));



CREATE POLICY "inspections_resident_read" ON "public"."inspections" FOR SELECT TO "authenticated" USING (("public"."is_portal_resident"() AND ("unit_id" IN ( SELECT "public"."current_resident_unit_ids"() AS "current_resident_unit_ids"))));



CREATE POLICY "inspections_staff_all" ON "public"."inspections" TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id")) WITH CHECK ("public"."can_access_portfolio"("portfolio_id"));



CREATE POLICY "inspections_vendor_rw" ON "public"."inspections" TO "authenticated" USING (("inspector_vendor_id" = "public"."current_vendor_id"())) WITH CHECK (("inspector_vendor_id" = "public"."current_vendor_id"()));



ALTER TABLE "public"."insurance_policies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insurance_policies_board_read" ON "public"."insurance_policies" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND ("association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))));



CREATE POLICY "insurance_resident_insert" ON "public"."insurance_policies" FOR INSERT WITH CHECK (("public"."is_portal_resident"() AND ("owner_id" = "public"."current_owner_id"())));



CREATE POLICY "insurance_resident_update" ON "public"."insurance_policies" FOR UPDATE USING (("public"."is_portal_resident"() AND ("owner_id" = "public"."current_owner_id"()))) WITH CHECK (("public"."is_portal_resident"() AND ("owner_id" = "public"."current_owner_id"())));



CREATE POLICY "inv_staff_all" ON "public"."inventory_items" USING (("public"."is_any_staff"() OR "public"."is_company_admin"() OR "public"."is_platform_operator"())) WITH CHECK (("public"."is_any_staff"() OR "public"."is_company_admin"() OR "public"."is_platform_operator"()));



ALTER TABLE "public"."inventory_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoices_platform_all" ON "public"."invoices" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "je_batches_finance" ON "public"."journal_entry_batches" TO "authenticated" USING ("public"."can_manage_finance"("portfolio_id")) WITH CHECK ("public"."can_manage_finance"("portfolio_id"));



ALTER TABLE "public"."journal_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "journal_entries_board_read" ON "public"."journal_entries" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND ("portfolio_id" IN ( SELECT "a"."portfolio_id"
   FROM "public"."associations" "a"
  WHERE ("a"."id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))))));



CREATE POLICY "journal_entries_finance_all" ON "public"."journal_entries" TO "authenticated" USING ("public"."can_manage_finance"("portfolio_id")) WITH CHECK ("public"."can_manage_finance"("portfolio_id"));



CREATE POLICY "journal_entries_platform_all" ON "public"."journal_entries" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



ALTER TABLE "public"."journal_entry_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."journal_entry_lines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."journal_lines" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "journal_lines_board_read" ON "public"."journal_lines" FOR SELECT TO "authenticated" USING (("association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids")));



CREATE POLICY "journal_lines_finance_all" ON "public"."journal_lines" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."journal_entries" "je"
  WHERE (("je"."id" = "journal_lines"."entry_id") AND "public"."can_manage_finance"("je"."portfolio_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."journal_entries" "je"
  WHERE (("je"."id" = "journal_lines"."entry_id") AND "public"."can_manage_finance"("je"."portfolio_id")))));



CREATE POLICY "labor_entries_staff_all" ON "public"."work_order_labor_entries" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."work_orders" "w"
  WHERE (("w"."id" = "work_order_labor_entries"."work_order_id") AND "public"."can_access_association"("w"."association_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."work_orders" "w"
  WHERE (("w"."id" = "work_order_labor_entries"."work_order_id") AND "public"."can_access_association"("w"."association_id")))));



CREATE POLICY "labor_entries_vendor_rw" ON "public"."work_order_labor_entries" TO "authenticated" USING (("work_order_id" IN ( SELECT "work_orders"."id"
   FROM "public"."work_orders"
  WHERE ("work_orders"."vendor_id" = "public"."current_vendor_id"())))) WITH CHECK (("work_order_id" IN ( SELECT "work_orders"."id"
   FROM "public"."work_orders"
  WHERE ("work_orders"."vendor_id" = "public"."current_vendor_id"()))));



ALTER TABLE "public"."late_fee_assessments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "late_fee_assessments_resident_read" ON "public"."late_fee_assessments" FOR SELECT USING (("public"."is_portal_resident"() AND (EXISTS ( SELECT 1
   FROM "public"."charges" "c"
  WHERE (("c"."id" = "late_fee_assessments"."charge_id") AND ("c"."unit_id" IN ( SELECT "public"."current_resident_unit_ids"() AS "current_resident_unit_ids")))))));



CREATE POLICY "late_fee_assessments_staff_all" ON "public"."late_fee_assessments" USING ((EXISTS ( SELECT 1
   FROM "public"."associations" "a"
  WHERE (("a"."id" = "late_fee_assessments"."association_id") AND "public"."can_access_portfolio"("a"."portfolio_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."associations" "a"
  WHERE (("a"."id" = "late_fee_assessments"."association_id") AND "public"."can_access_portfolio"("a"."portfolio_id")))));



ALTER TABLE "public"."lead_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lock_box_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lock_box_assignments_platform_all" ON "public"."lock_box_assignments" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "lock_box_assignments_portfolio_delete" ON "public"."lock_box_assignments" FOR DELETE TO "authenticated" USING (("portfolio_id" IN ( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "lock_box_assignments_portfolio_insert" ON "public"."lock_box_assignments" FOR INSERT TO "authenticated" WITH CHECK (("portfolio_id" IN ( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "lock_box_assignments_portfolio_select" ON "public"."lock_box_assignments" FOR SELECT TO "authenticated" USING (("portfolio_id" IN ( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "lock_box_assignments_portfolio_update" ON "public"."lock_box_assignments" FOR UPDATE TO "authenticated" USING (("portfolio_id" IN ( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("portfolio_id" IN ( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



ALTER TABLE "public"."lock_boxes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lock_boxes_platform_all" ON "public"."lock_boxes" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "lock_boxes_portfolio_delete" ON "public"."lock_boxes" FOR DELETE TO "authenticated" USING (("portfolio_id" IN ( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "lock_boxes_portfolio_insert" ON "public"."lock_boxes" FOR INSERT TO "authenticated" WITH CHECK (("portfolio_id" IN ( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "lock_boxes_portfolio_select" ON "public"."lock_boxes" FOR SELECT TO "authenticated" USING (("portfolio_id" IN ( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "lock_boxes_portfolio_update" ON "public"."lock_boxes" FOR UPDATE TO "authenticated" USING (("portfolio_id" IN ( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) WITH CHECK (("portfolio_id" IN ( SELECT "profiles"."portfolio_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



ALTER TABLE "public"."lockbox_batches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lockbox_batches_finance" ON "public"."lockbox_batches" TO "authenticated" USING ("public"."can_manage_finance"("portfolio_id")) WITH CHECK ("public"."can_manage_finance"("portfolio_id"));



ALTER TABLE "public"."lockbox_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lockbox_items_finance" ON "public"."lockbox_items" TO "authenticated" USING ("public"."can_manage_finance"("portfolio_id")) WITH CHECK ("public"."can_manage_finance"("portfolio_id"));



ALTER TABLE "public"."login_attempts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "login_attempts_admin_own_portfolio" ON "public"."login_attempts" FOR SELECT TO "authenticated" USING (("public"."is_full_access_staff"() AND ("portfolio_id" = "public"."current_portfolio_id"())));



CREATE POLICY "login_attempts_platform_all" ON "public"."login_attempts" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "login_attempts_self_read" ON "public"."login_attempts" FOR SELECT TO "authenticated" USING (("auth_user_id" = "auth"."uid"()));



ALTER TABLE "public"."maintenance_task_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."maintenance_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "maintenance_tasks_board_read" ON "public"."maintenance_tasks" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND ("association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))));



CREATE POLICY "maintenance_tasks_resident_read" ON "public"."maintenance_tasks" FOR SELECT USING (("public"."is_portal_resident"() AND ("association_id" IN ( SELECT "public"."current_resident_association_ids"() AS "current_resident_association_ids"))));



CREATE POLICY "maintenance_tasks_vendor_read" ON "public"."maintenance_tasks" FOR SELECT TO "authenticated" USING (("vendor_id" = "public"."current_vendor_id"()));



ALTER TABLE "public"."maintenance_template_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."maintenance_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."management_agreements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."management_fee_policies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."management_fee_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."management_fees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "manager_read_own" ON "public"."association_assignments" FOR SELECT TO "authenticated" USING (("manager_id" = "auth"."uid"()));



ALTER TABLE "public"."marketing_leads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketing_leads_anon_insert" ON "public"."marketing_leads" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "marketing_leads_platform_read" ON "public"."marketing_leads" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."platform_operators" "po"
  WHERE (("po"."auth_user_id" = "auth"."uid"()) AND ("po"."active" = true)))));



CREATE POLICY "marketing_leads_platform_write" ON "public"."marketing_leads" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."platform_operators" "po"
  WHERE (("po"."auth_user_id" = "auth"."uid"()) AND ("po"."active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."platform_operators" "po"
  WHERE (("po"."auth_user_id" = "auth"."uid"()) AND ("po"."active" = true)))));



ALTER TABLE "public"."meeting_action_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meeting_attendees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "meeting_attendees_board_select" ON "public"."meeting_attendees" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."meetings" "m"
  WHERE (("m"."id" = "meeting_attendees"."meeting_id") AND ("m"."association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))))));



CREATE POLICY "meeting_attendees_platform_all" ON "public"."meeting_attendees" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "meeting_attendees_staff_delete" ON "public"."meeting_attendees" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."meetings" "m"
  WHERE (("m"."id" = "meeting_attendees"."meeting_id") AND "public"."can_access_portfolio"("m"."portfolio_id")))));



CREATE POLICY "meeting_attendees_staff_insert" ON "public"."meeting_attendees" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."meetings" "m"
  WHERE (("m"."id" = "meeting_attendees"."meeting_id") AND "public"."can_access_portfolio"("m"."portfolio_id")))));



CREATE POLICY "meeting_attendees_staff_select" ON "public"."meeting_attendees" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."meetings" "m"
  WHERE (("m"."id" = "meeting_attendees"."meeting_id") AND "public"."can_access_portfolio"("m"."portfolio_id")))));



CREATE POLICY "meeting_attendees_staff_update" ON "public"."meeting_attendees" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."meetings" "m"
  WHERE (("m"."id" = "meeting_attendees"."meeting_id") AND "public"."can_access_portfolio"("m"."portfolio_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."meetings" "m"
  WHERE (("m"."id" = "meeting_attendees"."meeting_id") AND "public"."can_access_portfolio"("m"."portfolio_id")))));



ALTER TABLE "public"."meeting_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "meeting_documents_board_read" ON "public"."meeting_documents" FOR SELECT USING (("public"."is_board_user"() AND (EXISTS ( SELECT 1
   FROM "public"."meetings" "m"
  WHERE (("m"."id" = "meeting_documents"."meeting_id") AND ("m"."association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids")))))));



ALTER TABLE "public"."meetings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "meetings_board_select" ON "public"."meetings" FOR SELECT TO "authenticated" USING (("association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids")));



CREATE POLICY "meetings_platform_all" ON "public"."meetings" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "meetings_portal_resident_read" ON "public"."meetings" FOR SELECT USING (("public"."is_portal_resident"() AND ("association_id" IN ( SELECT "public"."current_resident_association_ids"() AS "current_resident_association_ids")) AND ("archived_at" IS NULL) AND (("status" = ANY (ARRAY['scheduled'::"public"."meeting_status", 'in_progress'::"public"."meeting_status"])) OR (("status" = 'completed'::"public"."meeting_status") AND ("minutes" IS NOT NULL)))));



CREATE POLICY "meetings_staff_delete" ON "public"."meetings" FOR DELETE TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id"));



CREATE POLICY "meetings_staff_insert" ON "public"."meetings" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_access_portfolio"("portfolio_id"));



CREATE POLICY "meetings_staff_select" ON "public"."meetings" FOR SELECT TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id"));



CREATE POLICY "meetings_staff_update" ON "public"."meetings" FOR UPDATE TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id")) WITH CHECK ("public"."can_access_portfolio"("portfolio_id"));



ALTER TABLE "public"."message_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "message_templates_platform_all" ON "public"."message_templates" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "message_templates_staff" ON "public"."message_templates" TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id")) WITH CHECK ("public"."can_access_portfolio"("portfolio_id"));



CREATE POLICY "mgmt_agreements_admin" ON "public"."management_agreements" TO "authenticated" USING ("public"."can_admin_portfolio"("portfolio_id")) WITH CHECK ("public"."can_admin_portfolio"("portfolio_id"));



CREATE POLICY "mgmt_agreements_staff_read" ON "public"."management_agreements" FOR SELECT TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id"));



CREATE POLICY "mgmt_fee_admin_all" ON "public"."management_fee_schedules" TO "authenticated" USING ("public"."can_admin_portfolio"("portfolio_id")) WITH CHECK ("public"."can_admin_portfolio"("portfolio_id"));



CREATE POLICY "mgmt_fee_finance_read" ON "public"."management_fee_schedules" FOR SELECT TO "authenticated" USING ("public"."can_manage_finance"("portfolio_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."approval_requests" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."architectural_review_settings" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."assessment_periods" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."association_additional_fees" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."association_amenities" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."association_assignments" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."association_attachments" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."association_keys" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."association_lease_template_settings" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."association_managers" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."association_notes" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."association_renewal_options" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."associations" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."automation_tasks" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."autopay_mandates" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."ballots" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."bank_accounts" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."board_approval_settings" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."board_comments" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."board_members" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."budget_lines" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."buildings" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."calendar_event_reminders" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."calendar_events" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."charge_categories" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."committees" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."communication_messages" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."communication_triggers" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."communications_log" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."dues_increases" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."email_queue" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."fixed_assets" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."gl_accounts" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."house_rules" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."income_recertifications" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."inspections" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."insurance_policies" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."journal_lines" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."lock_boxes" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."lockbox_items" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."maintenance_tasks" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."management_agreements" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."management_fee_policies" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."management_fees" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."meetings" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."notices" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."occupancies" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."owner_payables" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."owner_statements" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."parking_spaces" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."payable_bill_line_items" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."payable_bills" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."purchase_orders" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."recurring_bills" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."recurring_work_orders" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."report_snapshots" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."service_requests" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."sms_conversations" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."statement_batches" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."statements" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."tenants" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."units" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"(( SELECT "b"."association_id"
   FROM "public"."buildings" "b"
  WHERE ("b"."id" = "units"."building_id"))));



CREATE POLICY "mgr_assoc_scope" ON "public"."user_invitations" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."violation_cases" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."violation_followup_steps" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."violations" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mgr_assoc_scope" ON "public"."work_orders" AS RESTRICTIVE TO "authenticated" USING ("public"."can_view_association_row"("association_id"));



CREATE POLICY "mt_read" ON "public"."maintenance_templates" FOR SELECT USING (("is_system" OR "public"."is_platform_operator"() OR (EXISTS ( SELECT 1
   FROM "public"."maintenance_template_groups" "g"
  WHERE (("g"."id" = "maintenance_templates"."group_id") AND "public"."can_access_portfolio"("g"."portfolio_id"))))));



CREATE POLICY "mt_write" ON "public"."maintenance_templates" USING (("public"."is_platform_operator"() OR ("public"."is_any_staff"() AND (EXISTS ( SELECT 1
   FROM "public"."maintenance_template_groups" "g"
  WHERE (("g"."id" = "maintenance_templates"."group_id") AND "public"."can_access_portfolio"("g"."portfolio_id"))))))) WITH CHECK (("public"."is_platform_operator"() OR ("public"."is_any_staff"() AND (EXISTS ( SELECT 1
   FROM "public"."maintenance_template_groups" "g"
  WHERE (("g"."id" = "maintenance_templates"."group_id") AND "public"."can_access_portfolio"("g"."portfolio_id")))))));



CREATE POLICY "mtg_staff_all" ON "public"."maintenance_template_groups" USING (("public"."can_access_portfolio"("portfolio_id") OR "public"."is_platform_operator"())) WITH CHECK (("public"."can_access_portfolio"("portfolio_id") OR "public"."is_platform_operator"()));



ALTER TABLE "public"."notice_recipients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notice_recipients_resident_read" ON "public"."notice_recipients" FOR SELECT TO "authenticated" USING (("public"."is_portal_resident"() AND ("owner_id" = "public"."current_owner_id"())));



CREATE POLICY "notice_recipients_staff_all" ON "public"."notice_recipients" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."notices" "n"
  WHERE (("n"."id" = "notice_recipients"."notice_id") AND "public"."can_access_association"("n"."association_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."notices" "n"
  WHERE (("n"."id" = "notice_recipients"."notice_id") AND "public"."can_access_association"("n"."association_id")))));



ALTER TABLE "public"."notices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notices_board_read" ON "public"."notices" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND ("association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids")) AND ("status" <> 'draft'::"public"."notice_status")));



CREATE POLICY "notices_resident_read" ON "public"."notices" FOR SELECT TO "authenticated" USING (("public"."is_portal_resident"() AND ("status" = 'sent'::"public"."notice_status") AND (("association_id" IN ( SELECT "public"."current_resident_association_ids"() AS "current_resident_association_ids")) OR "public"."is_notice_recipient"("id"))));



CREATE POLICY "notices_staff_all" ON "public"."notices" TO "authenticated" USING ("public"."can_access_association"("association_id")) WITH CHECK ("public"."can_access_association"("association_id"));



CREATE POLICY "oa_staff_all" ON "public"."owner_attachments" USING ((("public"."is_any_staff"() OR "public"."is_company_admin"()) AND "public"."can_access_portfolio"("portfolio_id"))) WITH CHECK ((("public"."is_any_staff"() OR "public"."is_company_admin"()) AND "public"."can_access_portfolio"("portfolio_id")));



ALTER TABLE "public"."occupancies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "occupancies_board_read" ON "public"."occupancies" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND ("association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))));



CREATE POLICY "occupancies_self_read" ON "public"."occupancies" FOR SELECT TO "authenticated" USING (("public"."is_portal_resident"() AND ("owner_id" = "public"."current_owner_id"())));



CREATE POLICY "occupancies_self_update" ON "public"."occupancies" FOR UPDATE USING (("public"."is_portal_resident"() AND ("owner_id" = "public"."current_owner_id"()) AND ("status" = 'current'::"public"."occupancy_status"))) WITH CHECK (("public"."is_portal_resident"() AND ("owner_id" = "public"."current_owner_id"())));



CREATE POLICY "occupancies_staff_all" ON "public"."occupancies" TO "authenticated" USING ("public"."can_access_association"("association_id")) WITH CHECK ("public"."can_access_association"("association_id"));



CREATE POLICY "ofd_finance_all" ON "public"."owner_financial_details" USING (("public"."can_manage_finance"("portfolio_id") OR "public"."is_platform_operator"())) WITH CHECK (("public"."can_manage_finance"("portfolio_id") OR "public"."is_platform_operator"()));



CREATE POLICY "operator_all_agenda" ON "public"."agenda_items" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "operator_all_board_comments" ON "public"."board_comments" USING ((EXISTS ( SELECT 1
   FROM "public"."platform_operators"
  WHERE (("platform_operators"."auth_user_id" = "auth"."uid"()) AND ("platform_operators"."active" = true)))));



CREATE POLICY "operator_all_docs" ON "public"."meeting_documents" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "ops_staff_all" ON "public"."owner_packet_settings" USING ((("public"."is_any_staff"() OR "public"."is_company_admin"()) AND "public"."can_access_portfolio"("portfolio_id"))) WITH CHECK ((("public"."is_any_staff"() OR "public"."is_company_admin"()) AND "public"."can_access_portfolio"("portfolio_id")));



CREATE POLICY "ov_staff_all" ON "public"."owner_vehicles" USING ((("public"."is_any_staff"() OR "public"."is_company_admin"()) AND "public"."can_access_portfolio"("portfolio_id"))) WITH CHECK ((("public"."is_any_staff"() OR "public"."is_company_admin"()) AND "public"."can_access_portfolio"("portfolio_id")));



ALTER TABLE "public"."owner_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."owner_ach_status" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."owner_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."owner_financial_details" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."owner_form_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."owner_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."owner_notification_prefs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."owner_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."owner_packet_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."owner_packets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."owner_payables" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "owner_payables_delete" ON "public"."owner_payables" FOR DELETE TO "authenticated" USING ((("public"."is_staff"() AND (EXISTS ( SELECT 1
   FROM "public"."portfolios" "p"
  WHERE (("p"."id" = "owner_payables"."portfolio_id") AND ("p"."id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'portfolio_id'::"text"))::"uuid"))))) OR "public"."is_platform_operator"()));



CREATE POLICY "owner_payables_insert" ON "public"."owner_payables" FOR INSERT TO "authenticated" WITH CHECK ((("public"."is_staff"() AND (EXISTS ( SELECT 1
   FROM "public"."portfolios" "p"
  WHERE (("p"."id" = "owner_payables"."portfolio_id") AND ("p"."id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'portfolio_id'::"text"))::"uuid"))))) OR "public"."is_platform_operator"()));



CREATE POLICY "owner_payables_platform_all" ON "public"."owner_payables" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "owner_payables_select" ON "public"."owner_payables" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."portfolios" "p"
  WHERE (("p"."id" = "owner_payables"."portfolio_id") AND ("p"."id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'portfolio_id'::"text"))::"uuid")))) OR "public"."is_platform_operator"()));



CREATE POLICY "owner_payables_update" ON "public"."owner_payables" FOR UPDATE TO "authenticated" USING ((("public"."is_staff"() AND (EXISTS ( SELECT 1
   FROM "public"."portfolios" "p"
  WHERE (("p"."id" = "owner_payables"."portfolio_id") AND ("p"."id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'portfolio_id'::"text"))::"uuid"))))) OR "public"."is_platform_operator"())) WITH CHECK (true);



ALTER TABLE "public"."owner_portal_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."owner_statements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "owner_statements_platform_all" ON "public"."owner_statements" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "owner_statements_staff_insert" ON "public"."owner_statements" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_manage_finance"(( SELECT "associations"."portfolio_id"
   FROM "public"."associations"
  WHERE ("associations"."id" = "owner_statements"."association_id"))));



CREATE POLICY "owner_statements_staff_select" ON "public"."owner_statements" FOR SELECT TO "authenticated" USING ("public"."can_manage_finance"(( SELECT "associations"."portfolio_id"
   FROM "public"."associations"
  WHERE ("associations"."id" = "owner_statements"."association_id"))));



ALTER TABLE "public"."owner_vehicles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."owners" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "owners can read shared association attachments" ON "public"."association_attachments" FOR SELECT TO "authenticated" USING (("shared_with_owner" AND ("archived_at" IS NULL) AND (EXISTS ( SELECT 1
   FROM ("public"."owners" "o"
     JOIN "public"."occupancies" "occ" ON (("occ"."owner_id" = "o"."id")))
  WHERE (("o"."auth_user_id" = "auth"."uid"()) AND ("occ"."association_id" = "association_attachments"."association_id") AND ("occ"."status" = 'current'::"public"."occupancy_status"))))));



CREATE POLICY "owners_board_read" ON "public"."owners" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND ((EXISTS ( SELECT 1
   FROM (("public"."unit_owners" "uo"
     JOIN "public"."units" "u" ON (("u"."id" = "uo"."unit_id")))
     JOIN "public"."buildings" "b" ON (("b"."id" = "u"."building_id")))
  WHERE (("uo"."owner_id" = "owners"."id") AND ("b"."association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))))) OR (EXISTS ( SELECT 1
   FROM "public"."occupancies" "o"
  WHERE (("o"."owner_id" = "owners"."id") AND ("o"."association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))))))));



CREATE POLICY "owners_self_read" ON "public"."owners" FOR SELECT TO "authenticated" USING (("public"."is_portal_resident"() AND ("id" = "public"."current_owner_id"())));



CREATE POLICY "owners_self_update" ON "public"."owners" FOR UPDATE TO "authenticated" USING (("public"."is_portal_resident"() AND ("id" = "public"."current_owner_id"()))) WITH CHECK (("public"."is_portal_resident"() AND ("id" = "public"."current_owner_id"())));



CREATE POLICY "owners_staff_all" ON "public"."owners" TO "authenticated" USING (("public"."is_platform_operator"() OR (("public"."is_any_staff"() OR "public"."is_company_admin"()) AND (("portfolio_id" IS NULL) OR ("portfolio_id" = "public"."current_portfolio_id"()))))) WITH CHECK (("public"."is_platform_operator"() OR (("public"."is_any_staff"() OR "public"."is_company_admin"()) AND (("portfolio_id" IS NULL) OR ("portfolio_id" = "public"."current_portfolio_id"())))));



ALTER TABLE "public"."parking_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "parking_assignments_resident_read" ON "public"."parking_assignments" FOR SELECT TO "authenticated" USING (("public"."is_portal_resident"() AND (("owner_id" = "public"."current_owner_id"()) OR ("unit_id" IN ( SELECT "public"."current_resident_unit_ids"() AS "current_resident_unit_ids")))));



CREATE POLICY "parking_assignments_staff_all" ON "public"."parking_assignments" TO "authenticated" USING (("public"."can_access_portfolio"("portfolio_id") OR "public"."is_platform_operator"())) WITH CHECK (("public"."can_access_portfolio"("portfolio_id") OR "public"."is_platform_operator"()));



ALTER TABLE "public"."parking_spaces" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "parking_spaces_resident_read" ON "public"."parking_spaces" FOR SELECT TO "authenticated" USING (("public"."is_portal_resident"() AND ("association_id" IN ( SELECT "public"."current_resident_association_ids"() AS "current_resident_association_ids"))));



CREATE POLICY "parking_spaces_staff_all" ON "public"."parking_spaces" TO "authenticated" USING (("public"."can_access_portfolio"("portfolio_id") OR "public"."is_platform_operator"())) WITH CHECK (("public"."can_access_portfolio"("portfolio_id") OR "public"."is_platform_operator"()));



ALTER TABLE "public"."payable_bill_line_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payable_bills" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payable_bills_board_read" ON "public"."payable_bills" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND ("association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))));



CREATE POLICY "payable_bills_finance_all" ON "public"."payable_bills" TO "authenticated" USING ("public"."can_manage_finance"("portfolio_id")) WITH CHECK ("public"."can_manage_finance"("portfolio_id"));



CREATE POLICY "payable_bills_platform_all" ON "public"."payable_bills" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "payable_bills_vendor_read" ON "public"."payable_bills" FOR SELECT TO "authenticated" USING (("vendor_id" = "public"."current_vendor_id"()));



ALTER TABLE "public"."payment_applications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_apps_finance" ON "public"."payment_applications" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."payments" "p"
  WHERE (("p"."id" = "payment_applications"."payment_id") AND (EXISTS ( SELECT 1
           FROM (("public"."units" "u"
             JOIN "public"."buildings" "b" ON (("b"."id" = "u"."building_id")))
             JOIN "public"."associations" "a" ON (("a"."id" = "b"."association_id")))
          WHERE (("u"."id" = "p"."unit_id") AND "public"."can_manage_finance"("a"."portfolio_id")))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."payments" "p"
  WHERE (("p"."id" = "payment_applications"."payment_id") AND (EXISTS ( SELECT 1
           FROM (("public"."units" "u"
             JOIN "public"."buildings" "b" ON (("b"."id" = "u"."building_id")))
             JOIN "public"."associations" "a" ON (("a"."id" = "b"."association_id")))
          WHERE (("u"."id" = "p"."unit_id") AND "public"."can_manage_finance"("a"."portfolio_id"))))))));



CREATE POLICY "payment_apps_resident_read" ON "public"."payment_applications" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."payments" "p"
  WHERE (("p"."id" = "payment_applications"."payment_id") AND ("p"."unit_id" IN ( SELECT "public"."current_resident_unit_ids"() AS "current_resident_unit_ids"))))));



ALTER TABLE "public"."payment_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_events_finance_read" ON "public"."payment_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."payment_intents" "pi"
  WHERE (("pi"."id" = "payment_events"."payment_intent_id") AND ("public"."is_platform_operator"() OR "public"."can_manage_finance"("pi"."portfolio_id"))))));



CREATE POLICY "payment_events_owner_read" ON "public"."payment_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."payment_intents" "pi"
  WHERE (("pi"."id" = "payment_events"."payment_intent_id") AND "public"."is_portal_resident"() AND ("pi"."owner_id" = "public"."current_owner_id"())))));



ALTER TABLE "public"."payment_intents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_intents_finance_all" ON "public"."payment_intents" TO "authenticated" USING (("public"."is_platform_operator"() OR "public"."can_manage_finance"("portfolio_id"))) WITH CHECK (("public"."is_platform_operator"() OR "public"."can_manage_finance"("portfolio_id")));



CREATE POLICY "payment_intents_owner_read" ON "public"."payment_intents" FOR SELECT TO "authenticated" USING (("public"."is_portal_resident"() AND ("owner_id" = "public"."current_owner_id"())));



ALTER TABLE "public"."payment_methods" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_methods_finance_write" ON "public"."payment_methods" TO "authenticated" USING ("public"."can_manage_finance"("portfolio_id")) WITH CHECK ("public"."can_manage_finance"("portfolio_id"));



CREATE POLICY "payment_methods_owner_self" ON "public"."payment_methods" TO "authenticated" USING (("owner_id" = "public"."current_owner_id"())) WITH CHECK (("owner_id" = "public"."current_owner_id"()));



CREATE POLICY "payment_methods_staff" ON "public"."payment_methods" FOR SELECT TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id"));



ALTER TABLE "public"."payment_processor_configs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_board_read" ON "public"."payments" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND ("unit_id" IN ( SELECT "u"."id"
   FROM ("public"."units" "u"
     JOIN "public"."buildings" "b" ON (("b"."id" = "u"."building_id")))
  WHERE ("b"."association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))))));



CREATE POLICY "payments_finance_all" ON "public"."payments" TO "authenticated" USING (("public"."is_platform_operator"() OR ("public"."is_finance_staff"() AND "public"."can_access_unit"("unit_id")))) WITH CHECK (("public"."is_platform_operator"() OR ("public"."is_finance_staff"() AND "public"."can_access_unit"("unit_id"))));



CREATE POLICY "payments_resident_read" ON "public"."payments" FOR SELECT TO "authenticated" USING (("public"."is_portal_resident"() AND ("unit_id" IN ( SELECT "public"."current_resident_unit_ids"() AS "current_resident_unit_ids"))));



ALTER TABLE "public"."payout_batches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payout_batches_finance_all" ON "public"."payout_batches" TO "authenticated" USING (("public"."is_platform_operator"() OR "public"."can_manage_finance"("portfolio_id"))) WITH CHECK (("public"."is_platform_operator"() OR "public"."can_manage_finance"("portfolio_id")));



CREATE POLICY "perm_audit_admin_own_portfolio" ON "public"."permission_audit_log" FOR SELECT TO "authenticated" USING (("public"."is_full_access_staff"() AND ("actor_portfolio_id" = "public"."current_portfolio_id"())));



CREATE POLICY "perm_audit_platform_all" ON "public"."permission_audit_log" FOR SELECT TO "authenticated" USING ("public"."is_platform_operator"());



ALTER TABLE "public"."permission_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."phone_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "phone_messages_operator_all" ON "public"."phone_messages" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



ALTER TABLE "public"."plaid_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plaid_items_finance_all" ON "public"."plaid_items" TO "authenticated" USING ("public"."can_manage_finance"("portfolio_id")) WITH CHECK ("public"."can_manage_finance"("portfolio_id"));



CREATE POLICY "plaid_items_platform_all" ON "public"."plaid_items" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "platform_imp_insert_operators" ON "public"."platform_impersonation_log" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "platform_imp_select_operators" ON "public"."platform_impersonation_log" FOR SELECT TO "authenticated" USING ("public"."is_platform_operator"());



CREATE POLICY "platform_imp_update_operators" ON "public"."platform_impersonation_log" FOR UPDATE TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



ALTER TABLE "public"."platform_impersonation_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_operators" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_operators_operator_all" ON "public"."platform_operators" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "platform_operators_self_read" ON "public"."platform_operators" FOR SELECT TO "authenticated" USING (("auth_user_id" = "auth"."uid"()));



ALTER TABLE "public"."platform_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "po_line_items_staff_all" ON "public"."purchase_order_line_items" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."purchase_orders" "p"
  WHERE (("p"."id" = "purchase_order_line_items"."purchase_order_id") AND "public"."can_access_portfolio"("p"."portfolio_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."purchase_orders" "p"
  WHERE (("p"."id" = "purchase_order_line_items"."purchase_order_id") AND "public"."can_access_portfolio"("p"."portfolio_id")))));



CREATE POLICY "po_line_items_vendor_read" ON "public"."purchase_order_line_items" FOR SELECT TO "authenticated" USING (("purchase_order_id" IN ( SELECT "purchase_orders"."id"
   FROM "public"."purchase_orders"
  WHERE ("purchase_orders"."vendor_id" = "public"."current_vendor_id"()))));



ALTER TABLE "public"."portfolio_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."portfolios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "portfolios_admin_own" ON "public"."portfolios" TO "authenticated" USING (("public"."is_full_access_staff"() AND ("id" = "public"."current_portfolio_id"()))) WITH CHECK (("public"."is_full_access_staff"() AND ("id" = "public"."current_portfolio_id"())));



CREATE POLICY "portfolios_platform_all" ON "public"."portfolios" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "portfolios_staff_read" ON "public"."portfolios" FOR SELECT TO "authenticated" USING ((("public"."is_any_staff"() OR "public"."is_company_admin"()) AND ("id" = "public"."current_portfolio_id"())));



ALTER TABLE "public"."privacy_actions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "privacy_actions_admin_portfolio" ON "public"."privacy_actions" TO "authenticated" USING ("public"."can_admin_portfolio"("portfolio_id")) WITH CHECK ("public"."can_admin_portfolio"("portfolio_id"));



CREATE POLICY "privacy_actions_platform_all" ON "public"."privacy_actions" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "privacy_actions_subject_read" ON "public"."privacy_actions" FOR SELECT TO "authenticated" USING (("subject_auth_user_id" = "auth"."uid"()));



CREATE POLICY "processor_configs_admin" ON "public"."payment_processor_configs" TO "authenticated" USING ("public"."can_admin_portfolio"("portfolio_id")) WITH CHECK ("public"."can_admin_portfolio"("portfolio_id"));



CREATE POLICY "processor_configs_staff_read" ON "public"."payment_processor_configs" FOR SELECT TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_admin_in_portfolio" ON "public"."profiles" TO "authenticated" USING (("public"."is_full_access_staff"() AND ("portfolio_id" = "public"."current_portfolio_id"()))) WITH CHECK (("public"."is_full_access_staff"() AND ("portfolio_id" = "public"."current_portfolio_id"())));



CREATE POLICY "profiles_platform_all" ON "public"."profiles" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "profiles_select" ON "public"."profiles" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_staff_directory_read" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("public"."is_any_staff"() OR "public"."is_company_admin"()) AND ("portfolio_id" IS NOT NULL) AND ("portfolio_id" = "public"."current_portfolio_id"())));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."properties" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."property_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."property_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."property_groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "property_groups_admin_all" ON "public"."property_groups" TO "authenticated" USING ("public"."can_admin_portfolio"("portfolio_id")) WITH CHECK ("public"."can_admin_portfolio"("portfolio_id"));



CREATE POLICY "property_groups_staff_read" ON "public"."property_groups" FOR SELECT TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id"));



ALTER TABLE "public"."provider_availability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_order_line_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "purchase_orders_staff_all" ON "public"."purchase_orders" TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id")) WITH CHECK ("public"."can_access_portfolio"("portfolio_id"));



CREATE POLICY "purchase_orders_vendor_read" ON "public"."purchase_orders" FOR SELECT TO "authenticated" USING (("vendor_id" = "public"."current_vendor_id"()));



ALTER TABLE "public"."recent_activity" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."receptionist_knowledge" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "receptionist_knowledge_operator_all" ON "public"."receptionist_knowledge" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "recerts_staff_all" ON "public"."income_recertifications" TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id")) WITH CHECK ("public"."can_access_portfolio"("portfolio_id"));



ALTER TABLE "public"."recurring_bills" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recurring_bills_finance" ON "public"."recurring_bills" TO "authenticated" USING ("public"."can_manage_finance"("portfolio_id")) WITH CHECK ("public"."can_manage_finance"("portfolio_id"));



CREATE POLICY "recurring_je_finance" ON "public"."recurring_journal_entries" TO "authenticated" USING ("public"."can_manage_finance"("portfolio_id")) WITH CHECK ("public"."can_manage_finance"("portfolio_id"));



ALTER TABLE "public"."recurring_journal_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recurring_wo_staff_all" ON "public"."recurring_work_orders" TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id")) WITH CHECK ("public"."can_access_portfolio"("portfolio_id"));



ALTER TABLE "public"."recurring_work_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reminder_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reminder_settings_staff_all" ON "public"."reminder_settings" TO "authenticated" USING (("public"."can_access_portfolio"("portfolio_id") OR "public"."is_platform_operator"())) WITH CHECK (("public"."can_access_portfolio"("portfolio_id") OR "public"."is_platform_operator"()));



ALTER TABLE "public"."report_definitions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "report_defs_admin_all" ON "public"."report_definitions" TO "authenticated" USING (("public"."is_platform_operator"() OR ("public"."is_full_access_staff"() AND ("portfolio_id" IS NOT NULL) AND ("portfolio_id" = "public"."current_portfolio_id"())))) WITH CHECK (("public"."is_platform_operator"() OR ("public"."is_full_access_staff"() AND ("portfolio_id" IS NOT NULL) AND ("portfolio_id" = "public"."current_portfolio_id"()))));



CREATE POLICY "report_defs_authenticated_read" ON "public"."report_definitions" FOR SELECT TO "authenticated" USING (("is_system" OR ("portfolio_id" IS NULL) OR "public"."can_access_portfolio"("portfolio_id")));



ALTER TABLE "public"."report_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "report_runs_staff_all" ON "public"."report_runs" TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id")) WITH CHECK ("public"."can_access_portfolio"("portfolio_id"));



ALTER TABLE "public"."report_snapshots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "report_snapshots_board_read" ON "public"."report_snapshots" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND ("association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))));



CREATE POLICY "report_snapshots_staff_all" ON "public"."report_snapshots" TO "authenticated" USING ("public"."can_access_association"("association_id")) WITH CHECK ("public"."can_access_association"("association_id"));



ALTER TABLE "public"."reserve_fund_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rfs_staff_all" ON "public"."reserve_fund_settings" USING ((("public"."is_any_staff"() OR "public"."is_company_admin"()) AND "public"."can_access_portfolio"("portfolio_id"))) WITH CHECK ((("public"."is_any_staff"() OR "public"."is_company_admin"()) AND "public"."can_access_portfolio"("portfolio_id")));



ALTER TABLE "public"."saved_report_views" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "saved_report_views_staff_all" ON "public"."saved_report_views" USING (("public"."is_platform_operator"() OR ("public"."is_any_staff"() AND "public"."can_access_portfolio"("portfolio_id")))) WITH CHECK (("public"."is_platform_operator"() OR ("public"."is_any_staff"() AND "public"."can_access_portfolio"("portfolio_id"))));



ALTER TABLE "public"."saved_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "saved_reports_own" ON "public"."saved_reports" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "saved_reports_staff_all" ON "public"."saved_reports" TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id")) WITH CHECK ("public"."can_access_portfolio"("portfolio_id"));



ALTER TABLE "public"."schedule_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scheduled_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "scheduled_reports_staff_all" ON "public"."scheduled_reports" TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id")) WITH CHECK ("public"."can_access_portfolio"("portfolio_id"));



ALTER TABLE "public"."schema_migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_requests_board_read" ON "public"."service_requests" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND ("association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))));



CREATE POLICY "service_requests_resident_cancel" ON "public"."service_requests" FOR UPDATE USING (("public"."is_portal_resident"() AND (("homeowner_id" = "public"."current_owner_id"()) OR ("owner_id" = "public"."current_owner_id"())) AND ("status" = 'open'::"public"."service_request_status"))) WITH CHECK (("public"."is_portal_resident"() AND (("homeowner_id" = "public"."current_owner_id"()) OR ("owner_id" = "public"."current_owner_id"())) AND ("status" = 'cancelled'::"public"."service_request_status")));



CREATE POLICY "service_requests_resident_insert" ON "public"."service_requests" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_portal_resident"() AND ("homeowner_id" = "public"."current_owner_id"()) AND ("unit_id" IN ( SELECT "public"."current_resident_unit_ids"() AS "current_resident_unit_ids"))));



CREATE POLICY "service_requests_resident_read" ON "public"."service_requests" FOR SELECT TO "authenticated" USING (("public"."is_portal_resident"() AND (("homeowner_id" = "public"."current_owner_id"()) OR ("unit_id" IN ( SELECT "public"."current_resident_unit_ids"() AS "current_resident_unit_ids")))));



CREATE POLICY "service_requests_staff_all" ON "public"."service_requests" TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id")) WITH CHECK ("public"."can_access_portfolio"("portfolio_id"));



ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shares" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "shares_owner_all" ON "public"."shares" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "shares_public_read" ON "public"."shares" FOR SELECT USING ((("expires_at" IS NULL) OR ("expires_at" > "now"())));



ALTER TABLE "public"."sms_conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sms_conversations_staff_all" ON "public"."sms_conversations" TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id")) WITH CHECK ("public"."can_access_portfolio"("portfolio_id"));



ALTER TABLE "public"."sms_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sms_messages_staff_all" ON "public"."sms_messages" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."sms_conversations" "c"
  WHERE (("c"."id" = "sms_messages"."conversation_id") AND "public"."can_access_portfolio"("c"."portfolio_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."sms_conversations" "c"
  WHERE (("c"."id" = "sms_messages"."conversation_id") AND "public"."can_access_portfolio"("c"."portfolio_id")))));



ALTER TABLE "public"."sms_opt_ins" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sms_opt_ins_platform_all" ON "public"."sms_opt_ins" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "sms_opt_ins_staff" ON "public"."sms_opt_ins" TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id")) WITH CHECK ("public"."can_access_portfolio"("portfolio_id"));



ALTER TABLE "public"."soft_delete_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "soft_delete_log_admin_read" ON "public"."soft_delete_log" FOR SELECT TO "authenticated" USING (("public"."is_full_access_staff"() AND ("portfolio_id" = "public"."current_portfolio_id"())));



CREATE POLICY "soft_delete_log_platform_all" ON "public"."soft_delete_log" FOR SELECT TO "authenticated" USING ("public"."is_platform_operator"());



CREATE POLICY "staff can manage association attachments" ON "public"."association_attachments" TO "authenticated" USING (("public"."is_full_access_staff"() AND (EXISTS ( SELECT 1
   FROM "public"."associations" "a"
  WHERE (("a"."id" = "association_attachments"."association_id") AND (("a"."portfolio_id" = "public"."current_portfolio_id"()) OR "public"."is_platform_operator"())))))) WITH CHECK (("public"."is_full_access_staff"() AND (EXISTS ( SELECT 1
   FROM "public"."associations" "a"
  WHERE (("a"."id" = "association_attachments"."association_id") AND (("a"."portfolio_id" = "public"."current_portfolio_id"()) OR "public"."is_platform_operator"()))))));



CREATE POLICY "staff can manage automation tasks" ON "public"."automation_tasks" USING ((("association_id" IS NULL) OR "public"."can_access_association"("association_id"))) WITH CHECK ((("association_id" IS NULL) OR "public"."can_access_association"("association_id")));



CREATE POLICY "staff can manage calendar reminders" ON "public"."calendar_event_reminders" USING ((("association_id" IS NULL) OR "public"."can_access_association"("association_id"))) WITH CHECK ((("association_id" IS NULL) OR "public"."can_access_association"("association_id")));



CREATE POLICY "staff can manage communication messages" ON "public"."communication_messages" USING ((("association_id" IS NULL) OR "public"."can_access_association"("association_id"))) WITH CHECK ((("association_id" IS NULL) OR "public"."can_access_association"("association_id")));



CREATE POLICY "staff can read association attachments" ON "public"."association_attachments" FOR SELECT TO "authenticated" USING ((("public"."is_staff"() OR "public"."is_platform_operator"()) AND (EXISTS ( SELECT 1
   FROM "public"."associations" "a"
  WHERE (("a"."id" = "association_attachments"."association_id") AND (("a"."portfolio_id" = "public"."current_portfolio_id"()) OR "public"."is_platform_operator"()))))));



CREATE POLICY "staff can read automation tasks" ON "public"."automation_tasks" FOR SELECT USING ((("association_id" IS NULL) OR "public"."can_access_association"("association_id")));



CREATE POLICY "staff can read calendar reminders" ON "public"."calendar_event_reminders" FOR SELECT USING ((("association_id" IS NULL) OR "public"."can_access_association"("association_id")));



CREATE POLICY "staff can read communication messages" ON "public"."communication_messages" FOR SELECT USING ((("association_id" IS NULL) OR "public"."can_access_association"("association_id")));



CREATE POLICY "staff_board_comments" ON "public"."board_comments" USING (((EXISTS ( SELECT 1
   FROM "public"."associations" "a"
  WHERE (("a"."id" = "board_comments"."association_id") AND ("a"."portfolio_id" = "public"."current_portfolio_id"())))) AND "public"."is_full_access_staff"()));



ALTER TABLE "public"."statement_batches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "statement_batches_platform_all" ON "public"."statement_batches" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "statement_batches_staff_insert" ON "public"."statement_batches" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_manage_finance"(( SELECT "associations"."portfolio_id"
   FROM "public"."associations"
  WHERE ("associations"."id" = "statement_batches"."association_id"))));



CREATE POLICY "statement_batches_staff_select" ON "public"."statement_batches" FOR SELECT TO "authenticated" USING ("public"."can_manage_finance"(( SELECT "associations"."portfolio_id"
   FROM "public"."associations"
  WHERE ("associations"."id" = "statement_batches"."association_id"))));



ALTER TABLE "public"."statements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "statements_board_read" ON "public"."statements" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND ("association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))));



CREATE POLICY "statements_finance_all" ON "public"."statements" TO "authenticated" USING (("public"."is_platform_operator"() OR ("public"."is_finance_staff"() AND "public"."can_access_association"("association_id")))) WITH CHECK (("public"."is_platform_operator"() OR ("public"."is_finance_staff"() AND "public"."can_access_association"("association_id"))));



CREATE POLICY "statements_resident_read" ON "public"."statements" FOR SELECT TO "authenticated" USING (("public"."is_portal_resident"() AND (("owner_id" = "public"."current_owner_id"()) OR ("unit_id" IN ( SELECT "public"."current_resident_unit_ids"() AS "current_resident_unit_ids")))));



CREATE POLICY "sub_events_admin_read" ON "public"."subscription_events" FOR SELECT TO "authenticated" USING ("public"."can_admin_portfolio"("portfolio_id"));



CREATE POLICY "sub_events_platform_all" ON "public"."subscription_events" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



ALTER TABLE "public"."subscription_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscriptions_admin_read" ON "public"."subscriptions" FOR SELECT TO "authenticated" USING ("public"."can_admin_portfolio"("portfolio_id"));



CREATE POLICY "subscriptions_platform_all" ON "public"."subscriptions" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



ALTER TABLE "public"."superadmin_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."survey_responses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "survey_responses_resident_insert" ON "public"."survey_responses" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_portal_resident"() AND ("submitted_by_owner_id" = "public"."current_owner_id"())));



CREATE POLICY "survey_responses_resident_read" ON "public"."survey_responses" FOR SELECT TO "authenticated" USING (("public"."is_portal_resident"() AND ("submitted_by_owner_id" = "public"."current_owner_id"())));



CREATE POLICY "survey_responses_staff_all" ON "public"."survey_responses" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."surveys" "s"
  WHERE (("s"."id" = "survey_responses"."survey_id") AND "public"."can_access_portfolio"("s"."portfolio_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."surveys" "s"
  WHERE (("s"."id" = "survey_responses"."survey_id") AND "public"."can_access_portfolio"("s"."portfolio_id")))));



ALTER TABLE "public"."surveys" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "surveys_resident_read" ON "public"."surveys" FOR SELECT TO "authenticated" USING (("public"."is_portal_resident"() AND "active"));



CREATE POLICY "surveys_staff_all" ON "public"."surveys" TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id")) WITH CHECK ("public"."can_access_portfolio"("portfolio_id"));



ALTER TABLE "public"."tag_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tag_assignments_staff_all" ON "public"."tag_assignments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."tags" "t"
  WHERE (("t"."id" = "tag_assignments"."tag_id") AND "public"."can_access_portfolio"("t"."portfolio_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tags" "t"
  WHERE (("t"."id" = "tag_assignments"."tag_id") AND "public"."can_access_portfolio"("t"."portfolio_id")))));



ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tags_staff_all" ON "public"."tags" TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id")) WITH CHECK ("public"."can_access_portfolio"("portfolio_id"));



ALTER TABLE "public"."tenancies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenancies_resident_read" ON "public"."tenancies" FOR SELECT TO "authenticated" USING (("public"."is_portal_resident"() AND ("unit_id" IN ( SELECT "public"."current_resident_unit_ids"() AS "current_resident_unit_ids"))));



CREATE POLICY "tenancies_staff_all" ON "public"."tenancies" TO "authenticated" USING ("public"."can_access_unit"("unit_id")) WITH CHECK ("public"."can_access_unit"("unit_id"));



ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenants_board_read" ON "public"."tenants" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND ("association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))));



CREATE POLICY "tenants_staff_all" ON "public"."tenants" TO "authenticated" USING (("public"."can_access_portfolio"("portfolio_id") OR "public"."is_platform_operator"())) WITH CHECK (("public"."can_access_portfolio"("portfolio_id") OR "public"."is_platform_operator"()));



ALTER TABLE "public"."ticket_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ticket_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tickets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."unit_amenities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "unit_amenities_staff" ON "public"."unit_amenities" TO "authenticated" USING ("public"."can_access_unit"("unit_id")) WITH CHECK ("public"."can_access_unit"("unit_id"));



ALTER TABLE "public"."unit_owners" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "unit_owners_board_read" ON "public"."unit_owners" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND ("unit_id" IN ( SELECT "u"."id"
   FROM ("public"."units" "u"
     JOIN "public"."buildings" "b" ON (("b"."id" = "u"."building_id")))
  WHERE ("b"."association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))))));



CREATE POLICY "unit_owners_staff_all" ON "public"."unit_owners" TO "authenticated" USING ("public"."can_access_unit"("unit_id")) WITH CHECK ("public"."can_access_unit"("unit_id"));



ALTER TABLE "public"."unit_pets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "unit_pets_resident_read" ON "public"."unit_pets" FOR SELECT TO "authenticated" USING (("public"."is_portal_resident"() AND (("owner_id" = "public"."current_owner_id"()) OR ("unit_id" IN ( SELECT "public"."current_resident_unit_ids"() AS "current_resident_unit_ids")))));



CREATE POLICY "unit_pets_staff_all" ON "public"."unit_pets" TO "authenticated" USING (("public"."can_access_portfolio"("portfolio_id") OR "public"."is_platform_operator"())) WITH CHECK (("public"."can_access_portfolio"("portfolio_id") OR "public"."is_platform_operator"()));



ALTER TABLE "public"."unit_recurring_charges" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "unit_recurring_charges_finance" ON "public"."unit_recurring_charges" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."units" "u"
     JOIN "public"."buildings" "b" ON (("b"."id" = "u"."building_id")))
     JOIN "public"."associations" "a" ON (("a"."id" = "b"."association_id")))
  WHERE (("u"."id" = "unit_recurring_charges"."unit_id") AND "public"."can_manage_finance"("a"."portfolio_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."units" "u"
     JOIN "public"."buildings" "b" ON (("b"."id" = "u"."building_id")))
     JOIN "public"."associations" "a" ON (("a"."id" = "b"."association_id")))
  WHERE (("u"."id" = "unit_recurring_charges"."unit_id") AND "public"."can_manage_finance"("a"."portfolio_id")))));



CREATE POLICY "unit_recurring_charges_resident_read" ON "public"."unit_recurring_charges" FOR SELECT TO "authenticated" USING (("unit_id" IN ( SELECT "public"."current_resident_unit_ids"() AS "current_resident_unit_ids")));



CREATE POLICY "unit_recurring_charges_staff_read" ON "public"."unit_recurring_charges" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."units" "u"
     JOIN "public"."buildings" "b" ON (("b"."id" = "u"."building_id")))
  WHERE (("u"."id" = "unit_recurring_charges"."unit_id") AND "public"."can_access_association"("b"."association_id")))));



ALTER TABLE "public"."units" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "units_board_read" ON "public"."units" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND ("building_id" IN ( SELECT "b"."id"
   FROM "public"."buildings" "b"
  WHERE ("b"."association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))))));



CREATE POLICY "units_resident_read" ON "public"."units" FOR SELECT TO "authenticated" USING (("public"."is_portal_resident"() AND ("id" IN ( SELECT "public"."current_resident_unit_ids"() AS "current_resident_unit_ids"))));



CREATE POLICY "units_staff_all" ON "public"."units" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."buildings" "b"
  WHERE (("b"."id" = "units"."building_id") AND "public"."can_access_association"("b"."association_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."buildings" "b"
  WHERE (("b"."id" = "units"."building_id") AND "public"."can_access_association"("b"."association_id")))));



CREATE POLICY "units_vendor_read" ON "public"."units" FOR SELECT TO "authenticated" USING ((("public"."current_vendor_id"() IS NOT NULL) AND ("id" IN ( SELECT "wo"."unit_id"
   FROM "public"."work_orders" "wo"
  WHERE (("wo"."vendor_id" = "public"."current_vendor_id"()) AND ("wo"."unit_id" IS NOT NULL))))));



ALTER TABLE "public"."usage_metrics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "usage_metrics_admin_read" ON "public"."usage_metrics" FOR SELECT TO "authenticated" USING ("public"."can_admin_portfolio"("portfolio_id"));



CREATE POLICY "usage_metrics_platform_all" ON "public"."usage_metrics" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



ALTER TABLE "public"."user_invitations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_invitations_admin_all" ON "public"."user_invitations" TO "authenticated" USING ("public"."can_admin_portfolio"("portfolio_id")) WITH CHECK ("public"."can_admin_portfolio"("portfolio_id"));



CREATE POLICY "user_invitations_platform_all" ON "public"."user_invitations" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_roles_admin_all" ON "public"."user_roles" TO "authenticated" USING (("public"."is_platform_operator"() OR ("public"."is_full_access_staff"() AND ("portfolio_id" = "public"."current_portfolio_id"())))) WITH CHECK (("public"."is_platform_operator"() OR ("public"."is_full_access_staff"() AND ("portfolio_id" = "public"."current_portfolio_id"()))));



CREATE POLICY "user_roles_authenticated_read" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."user_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_sessions_admin_own_portfolio" ON "public"."user_sessions" FOR SELECT TO "authenticated" USING (("public"."is_full_access_staff"() AND ("portfolio_id" = "public"."current_portfolio_id"())));



CREATE POLICY "user_sessions_platform_all" ON "public"."user_sessions" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "user_sessions_self" ON "public"."user_sessions" TO "authenticated" USING (("auth_user_id" = "auth"."uid"())) WITH CHECK (("auth_user_id" = "auth"."uid"()));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vendor_compliance" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vendor_compliance_self_insert" ON "public"."vendor_compliance" FOR INSERT TO "authenticated" WITH CHECK (("vendor_id" = "public"."current_vendor_id"()));



CREATE POLICY "vendor_compliance_self_read" ON "public"."vendor_compliance" FOR SELECT TO "authenticated" USING (("vendor_id" = "public"."current_vendor_id"()));



CREATE POLICY "vendor_compliance_self_update" ON "public"."vendor_compliance" FOR UPDATE TO "authenticated" USING (("vendor_id" = "public"."current_vendor_id"())) WITH CHECK (("vendor_id" = "public"."current_vendor_id"()));



CREATE POLICY "vendor_compliance_staff_all" ON "public"."vendor_compliance" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendors" "v"
  WHERE (("v"."id" = "vendor_compliance"."vendor_id") AND "public"."can_access_portfolio"("v"."portfolio_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vendors" "v"
  WHERE (("v"."id" = "vendor_compliance"."vendor_id") AND "public"."can_access_portfolio"("v"."portfolio_id")))));



ALTER TABLE "public"."vendors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vendors_board_read" ON "public"."vendors" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND (EXISTS ( SELECT 1
   FROM "public"."work_orders" "wo"
  WHERE (("wo"."vendor_id" = "vendors"."id") AND ("wo"."association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids")))))));



CREATE POLICY "vendors_self_read" ON "public"."vendors" FOR SELECT TO "authenticated" USING (("id" = "public"."current_vendor_id"()));



CREATE POLICY "vendors_self_update" ON "public"."vendors" FOR UPDATE TO "authenticated" USING (("id" = "public"."current_vendor_id"())) WITH CHECK (("id" = "public"."current_vendor_id"()));



CREATE POLICY "vendors_staff_all" ON "public"."vendors" TO "authenticated" USING ("public"."can_access_portfolio"("portfolio_id")) WITH CHECK ("public"."can_access_portfolio"("portfolio_id"));



ALTER TABLE "public"."violation_cases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."violation_followup_steps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."violation_updates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "violation_updates_staff_all" ON "public"."violation_updates" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."violations" "v"
  WHERE (("v"."id" = "violation_updates"."violation_id") AND "public"."can_access_association"("v"."association_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."violations" "v"
  WHERE (("v"."id" = "violation_updates"."violation_id") AND "public"."can_access_association"("v"."association_id")))));



ALTER TABLE "public"."violations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "violations_board_read" ON "public"."violations" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND ("association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))));



CREATE POLICY "violations_portal_resident_report" ON "public"."violations" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_portal_resident"() AND ("association_id" IN ( SELECT "public"."current_resident_association_ids"() AS "current_resident_association_ids")) AND ("status" = 'open'::"public"."violation_status")));



CREATE POLICY "violations_resident_read" ON "public"."violations" FOR SELECT TO "authenticated" USING (("public"."is_portal_resident"() AND (("owner_id" = "public"."current_owner_id"()) OR ("unit_id" IN ( SELECT "public"."current_resident_unit_ids"() AS "current_resident_unit_ids")))));



CREATE POLICY "violations_staff_all" ON "public"."violations" TO "authenticated" USING ("public"."can_access_association"("association_id")) WITH CHECK ("public"."can_access_association"("association_id"));



ALTER TABLE "public"."votes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "votes_resident_insert" ON "public"."votes" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_portal_resident"() AND ("owner_id" = "public"."current_owner_id"())));



CREATE POLICY "votes_resident_read" ON "public"."votes" FOR SELECT TO "authenticated" USING (("public"."is_portal_resident"() AND ("owner_id" = "public"."current_owner_id"())));



CREATE POLICY "votes_staff_all" ON "public"."votes" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."ballots" "b"
  WHERE (("b"."id" = "votes"."ballot_id") AND "public"."can_access_association"("b"."association_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."ballots" "b"
  WHERE (("b"."id" = "votes"."ballot_id") AND "public"."can_access_association"("b"."association_id")))));



ALTER TABLE "public"."webhook_deliveries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "webhook_deliveries_admin_read" ON "public"."webhook_deliveries" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."webhook_endpoints" "we"
  WHERE (("we"."id" = "webhook_deliveries"."endpoint_id") AND "public"."can_admin_portfolio"("we"."portfolio_id")))));



CREATE POLICY "webhook_deliveries_platform_all" ON "public"."webhook_deliveries" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



ALTER TABLE "public"."webhook_endpoints" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "webhook_endpoints_admin_all" ON "public"."webhook_endpoints" TO "authenticated" USING ("public"."can_admin_portfolio"("portfolio_id")) WITH CHECK (("public"."can_admin_portfolio"("portfolio_id") AND "public"."has_entitlement"("portfolio_id", 'webhooks'::"text")));



CREATE POLICY "webhook_endpoints_platform_all" ON "public"."webhook_endpoints" TO "authenticated" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "wo_msg_board_insert" ON "public"."work_order_messages" FOR INSERT WITH CHECK ((("author_role" = 'board'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."work_orders" "wo"
  WHERE (("wo"."id" = "work_order_messages"."work_order_id") AND ("wo"."association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids")))))));



CREATE POLICY "wo_msg_board_select" ON "public"."work_order_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."work_orders" "wo"
  WHERE (("wo"."id" = "work_order_messages"."work_order_id") AND ("wo"."association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))))));



CREATE POLICY "wo_msg_operator_all" ON "public"."work_order_messages" USING ("public"."is_platform_operator"()) WITH CHECK ("public"."is_platform_operator"());



CREATE POLICY "wo_msg_resident_insert" ON "public"."work_order_messages" FOR INSERT WITH CHECK ((("author_role" = 'owner'::"text") AND "public"."is_portal_resident"() AND (EXISTS ( SELECT 1
   FROM "public"."work_orders" "wo"
  WHERE (("wo"."id" = "work_order_messages"."work_order_id") AND ("wo"."unit_id" IN ( SELECT "public"."current_resident_unit_ids"() AS "current_resident_unit_ids")))))));



CREATE POLICY "wo_msg_resident_select" ON "public"."work_order_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."work_orders" "wo"
  WHERE (("wo"."id" = "work_order_messages"."work_order_id") AND ("wo"."unit_id" IN ( SELECT "public"."current_resident_unit_ids"() AS "current_resident_unit_ids"))))));



CREATE POLICY "wo_msg_staff_all" ON "public"."work_order_messages" USING (("public"."is_any_staff"() AND (EXISTS ( SELECT 1
   FROM "public"."work_orders" "wo"
  WHERE ("wo"."id" = "work_order_messages"."work_order_id"))))) WITH CHECK (("public"."is_any_staff"() AND (EXISTS ( SELECT 1
   FROM "public"."work_orders" "wo"
  WHERE ("wo"."id" = "work_order_messages"."work_order_id")))));



CREATE POLICY "wo_msg_vendor_insert" ON "public"."work_order_messages" FOR INSERT WITH CHECK ((("author_role" = 'vendor'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."work_orders" "wo"
  WHERE (("wo"."id" = "work_order_messages"."work_order_id") AND ("wo"."vendor_id" = "public"."current_vendor_id"()))))));



CREATE POLICY "wo_msg_vendor_select" ON "public"."work_order_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."work_orders" "wo"
  WHERE (("wo"."id" = "work_order_messages"."work_order_id") AND ("wo"."vendor_id" = "public"."current_vendor_id"())))));



CREATE POLICY "wo_updates_staff_all" ON "public"."work_order_updates" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."work_orders" "w"
  WHERE (("w"."id" = "work_order_updates"."work_order_id") AND "public"."can_access_association"("w"."association_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."work_orders" "w"
  WHERE (("w"."id" = "work_order_updates"."work_order_id") AND "public"."can_access_association"("w"."association_id")))));



CREATE POLICY "wo_updates_vendor_rw" ON "public"."work_order_updates" TO "authenticated" USING (("work_order_id" IN ( SELECT "work_orders"."id"
   FROM "public"."work_orders"
  WHERE ("work_orders"."vendor_id" = "public"."current_vendor_id"())))) WITH CHECK (("work_order_id" IN ( SELECT "work_orders"."id"
   FROM "public"."work_orders"
  WHERE ("work_orders"."vendor_id" = "public"."current_vendor_id"()))));



ALTER TABLE "public"."work_order_estimates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_order_labor_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_order_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_order_updates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "work_orders_board_read" ON "public"."work_orders" FOR SELECT TO "authenticated" USING (("public"."is_board_user"() AND ("association_id" IN ( SELECT "public"."current_board_association_ids"() AS "current_board_association_ids"))));



CREATE POLICY "work_orders_resident_read" ON "public"."work_orders" FOR SELECT TO "authenticated" USING (("public"."is_portal_resident"() AND ("unit_id" IN ( SELECT "public"."current_resident_unit_ids"() AS "current_resident_unit_ids"))));



CREATE POLICY "work_orders_staff_all" ON "public"."work_orders" TO "authenticated" USING ("public"."can_access_association"("association_id")) WITH CHECK ("public"."can_access_association"("association_id"));



CREATE POLICY "work_orders_vendor_read" ON "public"."work_orders" FOR SELECT TO "authenticated" USING (("vendor_id" = "public"."current_vendor_id"()));



CREATE POLICY "work_orders_vendor_update" ON "public"."work_orders" FOR UPDATE TO "authenticated" USING (("vendor_id" = "public"."current_vendor_id"())) WITH CHECK (("vendor_id" = "public"."current_vendor_id"()));



ALTER TABLE "public"."workflows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workflows_owner_all" ON "public"."workflows" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";












GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";








































































































































































































































































REVOKE ALL ON FUNCTION "public"."_marketing_leads_touch_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_marketing_leads_touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_invitation"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_invitation"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_invitation"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."aggregate_usage_metrics"("p_year" integer, "p_month" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."aggregate_usage_metrics"("p_year" integer, "p_month" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."aggregate_usage_metrics"("p_year" integer, "p_month" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."alert_overdue_bills"() TO "anon";
GRANT ALL ON FUNCTION "public"."alert_overdue_bills"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."alert_overdue_bills"() TO "service_role";



GRANT ALL ON FUNCTION "public"."amenity_reservations_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."amenity_reservations_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."amenity_reservations_touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."anonymize_owner"("p_owner_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."anonymize_owner"("p_owner_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."anonymize_owner"("p_owner_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."app_portal_url"() TO "anon";
GRANT ALL ON FUNCTION "public"."app_portal_url"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."app_portal_url"() TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_late_fees"() TO "anon";
GRANT ALL ON FUNCTION "public"."apply_late_fees"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_late_fees"() TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_payment"("p_payment_id" "uuid", "p_strategy" "text", "p_charge_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."apply_payment"("p_payment_id" "uuid", "p_strategy" "text", "p_charge_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_payment"("p_payment_id" "uuid", "p_strategy" "text", "p_charge_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_pending_invitation"() TO "anon";
GRANT ALL ON FUNCTION "public"."apply_pending_invitation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_pending_invitation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."architectural_requests_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."architectural_requests_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."architectural_requests_touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."assemble_vendor_1099_data"("p_portfolio_id" "uuid", "p_tax_year" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."assemble_vendor_1099_data"("p_portfolio_id" "uuid", "p_tax_year" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."assemble_vendor_1099_data"("p_portfolio_id" "uuid", "p_tax_year" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."assess_late_fee"("p_charge_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assess_late_fee"("p_charge_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_role"("p_profile_id" "uuid", "p_role_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_role"("p_profile_id" "uuid", "p_role_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_role"("p_profile_id" "uuid", "p_role_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."association_operating_account"("p_assoc_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."association_operating_account"("p_assoc_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."association_operating_account"("p_assoc_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."association_reserve_account"("p_assoc_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."association_reserve_account"("p_assoc_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."association_reserve_account"("p_assoc_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."associations_set_slug"() TO "anon";
GRANT ALL ON FUNCTION "public"."associations_set_slug"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."associations_set_slug"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_apply_credit_on_new_charge"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_apply_credit_on_new_charge"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_apply_credit_on_new_charge"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_apply_new_payment"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_apply_new_payment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_apply_new_payment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_link_portal_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_link_portal_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_link_portal_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."automation_flows_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."automation_flows_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."automation_flows_touch_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."platform_operators" TO "anon";
GRANT ALL ON TABLE "public"."platform_operators" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_operators" TO "service_role";



GRANT ALL ON FUNCTION "public"."bootstrap_platform_admin"("p_auth_user_id" "uuid", "p_full_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bootstrap_platform_admin"("p_auth_user_id" "uuid", "p_full_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bootstrap_platform_admin"("p_auth_user_id" "uuid", "p_full_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_create_charges"("p_charges" "jsonb", "p_charge_category_id" "uuid", "p_due_date" "date", "p_description" "text", "p_gl_account_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_create_charges"("p_charges" "jsonb", "p_charge_category_id" "uuid", "p_due_date" "date", "p_description" "text", "p_gl_account_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_create_charges"("p_charges" "jsonb", "p_charge_category_id" "uuid", "p_due_date" "date", "p_description" "text", "p_gl_account_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_create_recurring_charges"("p_subscriptions" "jsonb", "p_charge_category_id" "uuid", "p_frequency" "text", "p_start_date" "date", "p_memo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_create_recurring_charges"("p_subscriptions" "jsonb", "p_charge_category_id" "uuid", "p_frequency" "text", "p_start_date" "date", "p_memo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_create_recurring_charges"("p_subscriptions" "jsonb", "p_charge_category_id" "uuid", "p_frequency" "text", "p_start_date" "date", "p_memo" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_queue_reports"("p_association_ids" "uuid"[], "p_report_slugs" "text"[], "p_scope" "text", "p_date_start" "date", "p_date_end" "date", "p_output_format" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_queue_reports"("p_association_ids" "uuid"[], "p_report_slugs" "text"[], "p_scope" "text", "p_date_start" "date", "p_date_end" "date", "p_output_format" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_queue_reports"("p_association_ids" "uuid"[], "p_report_slugs" "text"[], "p_scope" "text", "p_date_start" "date", "p_date_end" "date", "p_output_format" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_update_statement_settings"("p_association_ids" "uuid"[], "p_settings" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_update_statement_settings"("p_association_ids" "uuid"[], "p_settings" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_update_statement_settings"("p_association_ids" "uuid"[], "p_settings" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."bump_saved_report_on_run"() TO "anon";
GRANT ALL ON FUNCTION "public"."bump_saved_report_on_run"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."bump_saved_report_on_run"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calc_next_maintenance_due"("p_frequency" "text", "p_custom_interval_days" integer, "p_from_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."calc_next_maintenance_due"("p_frequency" "text", "p_custom_interval_days" integer, "p_from_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calc_next_maintenance_due"("p_frequency" "text", "p_custom_interval_days" integer, "p_from_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_convenience_fee"("p_portfolio_id" "uuid", "p_amount_cents" bigint, "p_method" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_convenience_fee"("p_portfolio_id" "uuid", "p_amount_cents" bigint, "p_method" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_convenience_fee"("p_portfolio_id" "uuid", "p_amount_cents" bigint, "p_method" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_meeting_quorum"("p_meeting_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_meeting_quorum"("p_meeting_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_meeting_quorum"("p_meeting_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_association"("a_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_association"("a_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_association"("a_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_association_mvp"("a_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_association_mvp"("a_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_association_mvp"("a_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_portfolio"("p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_portfolio"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_portfolio"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_unit"("u_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_unit"("u_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_unit"("u_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_admin_portfolio"("p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_admin_portfolio"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_admin_portfolio"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_edit_association_mvp"("a_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_edit_association_mvp"("a_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_edit_association_mvp"("a_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_manage_finance"("p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_finance"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_finance"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_read_gl"("gl_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_read_gl"("gl_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_read_gl"("gl_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_view_association_row"("p_assoc" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_view_association_row"("p_assoc" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_association_row"("p_assoc" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."autopay_mandates" TO "anon";
GRANT ALL ON TABLE "public"."autopay_mandates" TO "authenticated";
GRANT ALL ON TABLE "public"."autopay_mandates" TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_autopay"("p_mandate_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_autopay"("p_mandate_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_autopay"("p_mandate_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cast_board_approval"("p_request_id" "uuid", "p_decision" "text", "p_signature" "text", "p_comment" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cast_board_approval"("p_request_id" "uuid", "p_decision" "text", "p_signature" "text", "p_comment" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cast_board_approval"("p_request_id" "uuid", "p_decision" "text", "p_signature" "text", "p_comment" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_insurance_expirations"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_insurance_expirations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_insurance_expirations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_portfolio_not_suspended"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_portfolio_not_suspended"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_portfolio_not_suspended"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_seat_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_seat_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_seat_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."confirm_owner_invitation"("p_invitation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."confirm_owner_invitation"("p_invitation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_owner_invitation"("p_invitation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_api_key"("p_portfolio_id" "uuid", "p_name" "text", "p_scopes" "text"[], "p_expires_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_api_key"("p_portfolio_id" "uuid", "p_name" "text", "p_scopes" "text"[], "p_expires_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_api_key"("p_portfolio_id" "uuid", "p_name" "text", "p_scopes" "text"[], "p_expires_days" integer) TO "service_role";



GRANT ALL ON TABLE "public"."user_invitations" TO "anon";
GRANT ALL ON TABLE "public"."user_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."user_invitations" TO "service_role";



GRANT ALL ON FUNCTION "public"."create_invitation"("p_portfolio_id" "uuid", "p_email" "text", "p_hoa_role" "public"."hoa_role", "p_role_id" "uuid", "p_message" "text", "p_expires_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_invitation"("p_portfolio_id" "uuid", "p_email" "text", "p_hoa_role" "public"."hoa_role", "p_role_id" "uuid", "p_message" "text", "p_expires_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_invitation"("p_portfolio_id" "uuid", "p_email" "text", "p_hoa_role" "public"."hoa_role", "p_role_id" "uuid", "p_message" "text", "p_expires_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."current_board_association_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_board_association_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_board_association_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_owner_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_owner_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_owner_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_portfolio_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_portfolio_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_portfolio_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_resident_association_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_resident_association_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_resident_association_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_resident_unit_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_resident_unit_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_resident_unit_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_role_name"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_role_name"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_role_name"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_vendor_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_vendor_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_vendor_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_budget_line"("p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_budget_line"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_budget_line"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."dispatch_bill_webhook"() TO "anon";
GRANT ALL ON FUNCTION "public"."dispatch_bill_webhook"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dispatch_bill_webhook"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dispatch_calendar_maintenance_notify"() TO "anon";
GRANT ALL ON FUNCTION "public"."dispatch_calendar_maintenance_notify"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dispatch_calendar_maintenance_notify"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dispatch_calendar_sms_notify"() TO "anon";
GRANT ALL ON FUNCTION "public"."dispatch_calendar_sms_notify"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dispatch_calendar_sms_notify"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dispatch_charge_status_webhook"() TO "anon";
GRANT ALL ON FUNCTION "public"."dispatch_charge_status_webhook"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dispatch_charge_status_webhook"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dispatch_charge_webhook"() TO "anon";
GRANT ALL ON FUNCTION "public"."dispatch_charge_webhook"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dispatch_charge_webhook"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dispatch_inspection_webhook"() TO "anon";
GRANT ALL ON FUNCTION "public"."dispatch_inspection_webhook"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dispatch_inspection_webhook"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dispatch_notice_webhook"() TO "anon";
GRANT ALL ON FUNCTION "public"."dispatch_notice_webhook"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dispatch_notice_webhook"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dispatch_owner_webhook"() TO "anon";
GRANT ALL ON FUNCTION "public"."dispatch_owner_webhook"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dispatch_owner_webhook"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dispatch_payment_intent_webhook"() TO "anon";
GRANT ALL ON FUNCTION "public"."dispatch_payment_intent_webhook"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dispatch_payment_intent_webhook"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dispatch_payment_webhook"() TO "anon";
GRANT ALL ON FUNCTION "public"."dispatch_payment_webhook"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dispatch_payment_webhook"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dispatch_sr_webhook"() TO "anon";
GRANT ALL ON FUNCTION "public"."dispatch_sr_webhook"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dispatch_sr_webhook"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dispatch_statement_webhook"() TO "anon";
GRANT ALL ON FUNCTION "public"."dispatch_statement_webhook"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dispatch_statement_webhook"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dispatch_violation_webhook"() TO "anon";
GRANT ALL ON FUNCTION "public"."dispatch_violation_webhook"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dispatch_violation_webhook"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dispatch_webhook"("p_portfolio_id" "uuid", "p_event" "public"."webhook_event", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."dispatch_webhook"("p_portfolio_id" "uuid", "p_event" "public"."webhook_event", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dispatch_webhook"("p_portfolio_id" "uuid", "p_event" "public"."webhook_event", "p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."dispatch_wo_created_webhook"() TO "anon";
GRANT ALL ON FUNCTION "public"."dispatch_wo_created_webhook"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dispatch_wo_created_webhook"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dispatch_wo_status_webhook"() TO "anon";
GRANT ALL ON FUNCTION "public"."dispatch_wo_status_webhook"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dispatch_wo_status_webhook"() TO "service_role";



GRANT ALL ON FUNCTION "public"."effective_late_fee_amount"("p_association_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."effective_late_fee_amount"("p_association_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."effective_late_fee_amount"("p_association_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."effective_late_fee_grace_days"("p_association_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."effective_late_fee_grace_days"("p_association_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."effective_late_fee_grace_days"("p_association_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."effective_nsf_fee_amount"("p_association_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."effective_nsf_fee_amount"("p_association_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."effective_nsf_fee_amount"("p_association_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_scheduled_reports"() TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_scheduled_reports"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_scheduled_reports"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enroll_autopay"("p_unit_id" "uuid", "p_payment_method_id" "uuid", "p_authorized_max_cents" integer, "p_frequency" "public"."autopay_frequency") TO "anon";
GRANT ALL ON FUNCTION "public"."enroll_autopay"("p_unit_id" "uuid", "p_payment_method_id" "uuid", "p_authorized_max_cents" integer, "p_frequency" "public"."autopay_frequency") TO "authenticated";
GRANT ALL ON FUNCTION "public"."enroll_autopay"("p_unit_id" "uuid", "p_payment_method_id" "uuid", "p_authorized_max_cents" integer, "p_frequency" "public"."autopay_frequency") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_operating_and_reserve_accounts"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_operating_and_reserve_accounts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_operating_and_reserve_accounts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_invite_token"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invite_token"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invite_token"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_monthly_statements"("p_year" integer, "p_month" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."generate_monthly_statements"("p_year" integer, "p_month" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_monthly_statements"("p_year" integer, "p_month" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_owner_payable_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_owner_payable_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_owner_payable_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_owner_statements"("p_association_id" "uuid", "p_period_start" "date", "p_period_end" "date", "p_delivery_channel" "text", "p_batch_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_owner_statements"("p_association_id" "uuid", "p_period_start" "date", "p_period_end" "date", "p_delivery_channel" "text", "p_batch_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_owner_statements"("p_association_id" "uuid", "p_period_start" "date", "p_period_end" "date", "p_delivery_channel" "text", "p_batch_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_portfolio_slug"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_portfolio_slug"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_portfolio_slug"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_recurring_bills"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_recurring_bills"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_recurring_bills"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_recurring_journal_entries"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_recurring_journal_entries"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_recurring_journal_entries"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_recurring_work_orders"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_recurring_work_orders"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_recurring_work_orders"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_budget_vs_actuals"("p_association_id" "uuid", "p_fiscal_year" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_budget_vs_actuals"("p_association_id" "uuid", "p_fiscal_year" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_budget_vs_actuals"("p_association_id" "uuid", "p_fiscal_year" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_charge_categories_for_portfolio"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_charge_categories_for_portfolio"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_charge_categories_for_portfolio"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_meeting_financial_snapshot"("p_association_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_meeting_financial_snapshot"("p_association_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_meeting_financial_snapshot"("p_association_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_vault_secret"("p_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_vault_secret"("p_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_closed_period_on_je"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_closed_period_on_je"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_closed_period_on_je"() TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_cross_fund_transfer"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_cross_fund_transfer"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_cross_fund_transfer"() TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_profile_privilege_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_profile_privilege_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_profile_privilege_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_entitlement"("p_portfolio_id" "uuid", "p_feature_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_entitlement"("p_portfolio_id" "uuid", "p_feature_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_entitlement"("p_portfolio_id" "uuid", "p_feature_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("role_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("role_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("role_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."invite_board_member"("p_email" "text", "p_full_name" "text", "p_association_id" "uuid", "p_board_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."invite_board_member"("p_email" "text", "p_full_name" "text", "p_association_id" "uuid", "p_board_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invite_board_member"("p_email" "text", "p_full_name" "text", "p_association_id" "uuid", "p_board_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."invite_company_admin"("p_email" "text", "p_full_name" "text", "p_company_name" "text", "p_portfolio_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."invite_company_admin"("p_email" "text", "p_full_name" "text", "p_company_name" "text", "p_portfolio_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invite_company_admin"("p_email" "text", "p_full_name" "text", "p_company_name" "text", "p_portfolio_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."invite_homeowner"("p_portfolio_id" "uuid", "p_owner_id" "uuid", "p_email" "text", "p_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."invite_homeowner"("p_portfolio_id" "uuid", "p_owner_id" "uuid", "p_email" "text", "p_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invite_homeowner"("p_portfolio_id" "uuid", "p_owner_id" "uuid", "p_email" "text", "p_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."invite_owner"("p_email" "text", "p_full_name" "text", "p_association_id" "uuid", "p_unit_number" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."invite_owner"("p_email" "text", "p_full_name" "text", "p_association_id" "uuid", "p_unit_number" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invite_owner"("p_email" "text", "p_full_name" "text", "p_association_id" "uuid", "p_unit_number" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."invite_property_manager"("p_email" "text", "p_full_name" "text", "p_unit_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."invite_property_manager"("p_email" "text", "p_full_name" "text", "p_unit_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."invite_property_manager"("p_email" "text", "p_full_name" "text", "p_unit_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."invite_staff"("p_email" "text", "p_full_name" "text", "p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."invite_staff"("p_email" "text", "p_full_name" "text", "p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invite_staff"("p_email" "text", "p_full_name" "text", "p_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."invite_staff"("p_portfolio_id" "uuid", "p_email" "text", "p_role_name" "text", "p_message" "text", "p_expires_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."invite_staff"("p_portfolio_id" "uuid", "p_email" "text", "p_role_name" "text", "p_message" "text", "p_expires_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."invite_staff"("p_portfolio_id" "uuid", "p_email" "text", "p_role_name" "text", "p_message" "text", "p_expires_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."invite_vendor"("p_name" "text", "p_email" "text", "p_trade" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."invite_vendor"("p_name" "text", "p_email" "text", "p_trade" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invite_vendor"("p_name" "text", "p_email" "text", "p_trade" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."invite_vendor"("p_portfolio_id" "uuid", "p_vendor_id" "uuid", "p_email" "text", "p_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."invite_vendor"("p_portfolio_id" "uuid", "p_vendor_id" "uuid", "p_email" "text", "p_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invite_vendor"("p_portfolio_id" "uuid", "p_vendor_id" "uuid", "p_email" "text", "p_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."invoke_edge_function"("fn_name" "text", "body" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."invoke_edge_function"("fn_name" "text", "body" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invoke_edge_function"("fn_name" "text", "body" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_accountant"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_accountant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_accountant"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_any_staff"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_any_staff"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_any_staff"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_assistant_manager"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_assistant_manager"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_assistant_manager"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_board_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_board_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_board_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_company_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_company_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_company_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_finance_staff"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_finance_staff"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_finance_staff"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_full_access_staff"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_full_access_staff"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_full_access_staff"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_manager"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_manager"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_manager"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_notice_recipient"("p_notice_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_notice_recipient"("p_notice_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_platform_operator"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_platform_operator"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_platform_operator"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_platform_operator_safe"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_platform_operator_safe"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_platform_operator_safe"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_portal_resident"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_portal_resident"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_portal_resident"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_staff"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_staff"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_staff"() TO "service_role";



GRANT ALL ON FUNCTION "public"."list_budget_lines"("p_association_id" "uuid", "p_fiscal_year" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."list_budget_lines"("p_association_id" "uuid", "p_fiscal_year" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_budget_lines"("p_association_id" "uuid", "p_fiscal_year" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."list_company_invitations"() TO "anon";
GRANT ALL ON FUNCTION "public"."list_company_invitations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_company_invitations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_audit_event"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_audit_event"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_audit_event"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_invitation_event"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_invitation_event"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_invitation_event"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_owner_audit"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_owner_audit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_owner_audit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_platform_operator_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_platform_operator_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_platform_operator_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_profile_privilege_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_profile_privilege_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_profile_privilege_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_soft_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_soft_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_soft_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_subscription_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_subscription_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_subscription_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_user_role_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_user_role_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_user_role_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."manager_is_scoped"() TO "anon";
GRANT ALL ON FUNCTION "public"."manager_is_scoped"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."manager_is_scoped"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_webhook_delivery"("p_delivery_id" "uuid", "p_success" boolean, "p_response_code" integer, "p_response_body" "text", "p_error_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_webhook_delivery"("p_delivery_id" "uuid", "p_success" boolean, "p_response_code" integer, "p_response_body" "text", "p_error_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_webhook_delivery"("p_delivery_id" "uuid", "p_success" boolean, "p_response_code" integer, "p_response_body" "text", "p_error_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."me"() TO "anon";
GRANT ALL ON FUNCTION "public"."me"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."me"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."platform_create_company"("p_company_name" "text", "p_admin_email" "text", "p_admin_full_name" "text", "p_message" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."platform_create_company"("p_company_name" "text", "p_admin_email" "text", "p_admin_full_name" "text", "p_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."platform_create_company"("p_company_name" "text", "p_admin_email" "text", "p_admin_full_name" "text", "p_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."platform_create_company"("p_company_name" "text", "p_admin_email" "text", "p_admin_full_name" "text", "p_message" "text") TO "service_role";



GRANT ALL ON TABLE "public"."charges" TO "anon";
GRANT ALL ON TABLE "public"."charges" TO "authenticated";
GRANT ALL ON TABLE "public"."charges" TO "service_role";



GRANT ALL ON FUNCTION "public"."post_ad_hoc_charge"("p_unit_id" "uuid", "p_charge_category_id" "uuid", "p_amount" numeric, "p_description" "text", "p_due_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."post_ad_hoc_charge"("p_unit_id" "uuid", "p_charge_category_id" "uuid", "p_amount" numeric, "p_description" "text", "p_due_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."post_ad_hoc_charge"("p_unit_id" "uuid", "p_charge_category_id" "uuid", "p_amount" numeric, "p_description" "text", "p_due_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."post_assessment_charges"() TO "anon";
GRANT ALL ON FUNCTION "public"."post_assessment_charges"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."post_assessment_charges"() TO "service_role";



GRANT ALL ON FUNCTION "public"."post_dues_increase"("p_dues_increase_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."post_dues_increase"("p_dues_increase_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."post_dues_increase"("p_dues_increase_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."post_nsf_fee"("p_payment_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."post_nsf_fee"("p_payment_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."post_nsf_fee"("p_payment_id" "uuid", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."post_stripe_ledger_payment"("p_intent_id" "uuid", "p_method" "text", "p_processor_payment_intent_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."post_stripe_ledger_payment"("p_intent_id" "uuid", "p_method" "text", "p_processor_payment_intent_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."post_unit_recurring_charges"() TO "anon";
GRANT ALL ON FUNCTION "public"."post_unit_recurring_charges"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."post_unit_recurring_charges"() TO "service_role";



GRANT ALL ON FUNCTION "public"."provision_portfolio"("p_company_name" "text", "p_first_admin_email" "text", "p_first_admin_name" "text", "p_tier" "public"."portfolio_tier", "p_seats" integer, "p_trial_days" integer, "p_allowed_email_domains" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."provision_portfolio"("p_company_name" "text", "p_first_admin_email" "text", "p_first_admin_name" "text", "p_tier" "public"."portfolio_tier", "p_seats" integer, "p_trial_days" integer, "p_allowed_email_domains" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."provision_portfolio"("p_company_name" "text", "p_first_admin_email" "text", "p_first_admin_name" "text", "p_tier" "public"."portfolio_tier", "p_seats" integer, "p_trial_days" integer, "p_allowed_email_domains" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."queue_calendar_sms"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."queue_calendar_sms"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."queue_calendar_sms"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."queue_invitation_email"() TO "anon";
GRANT ALL ON FUNCTION "public"."queue_invitation_email"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."queue_invitation_email"() TO "service_role";



GRANT ALL ON FUNCTION "public"."queue_payment_reminders"() TO "anon";
GRANT ALL ON FUNCTION "public"."queue_payment_reminders"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."queue_payment_reminders"() TO "service_role";



GRANT ALL ON TABLE "public"."report_runs" TO "anon";
GRANT ALL ON TABLE "public"."report_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."report_runs" TO "service_role";



GRANT ALL ON FUNCTION "public"."queue_report_run"("p_definition_id" "uuid", "p_parameters" "jsonb", "p_saved_report_id" "uuid", "p_output_format" "public"."report_format") TO "anon";
GRANT ALL ON FUNCTION "public"."queue_report_run"("p_definition_id" "uuid", "p_parameters" "jsonb", "p_saved_report_id" "uuid", "p_output_format" "public"."report_format") TO "authenticated";
GRANT ALL ON FUNCTION "public"."queue_report_run"("p_definition_id" "uuid", "p_parameters" "jsonb", "p_saved_report_id" "uuid", "p_output_format" "public"."report_format") TO "service_role";



GRANT ALL ON TABLE "public"."portfolios" TO "anon";
GRANT ALL ON TABLE "public"."portfolios" TO "authenticated";
GRANT ALL ON TABLE "public"."portfolios" TO "service_role";



GRANT ALL ON FUNCTION "public"."reactivate_portfolio"("p_portfolio_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reactivate_portfolio"("p_portfolio_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reactivate_portfolio"("p_portfolio_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."recent_failed_attempts"("p_email" "text", "p_window_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."recent_failed_attempts"("p_email" "text", "p_window_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."recent_failed_attempts"("p_email" "text", "p_window_minutes" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."receptionist_knowledge_search"("q" "text", "max_rows" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."receptionist_knowledge_search"("q" "text", "max_rows" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."receptionist_knowledge_search"("q" "text", "max_rows" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."record_check_run"("p_bank_account_id" "uuid", "p_bill_ids" "uuid"[], "p_starting_check_number" integer, "p_payment_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."record_check_run"("p_bank_account_id" "uuid", "p_bill_ids" "uuid"[], "p_starting_check_number" integer, "p_payment_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_check_run"("p_bank_account_id" "uuid", "p_bill_ids" "uuid"[], "p_starting_check_number" integer, "p_payment_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_login_attempt"("p_email" "text", "p_auth_user_id" "uuid", "p_success" boolean, "p_ip_address" "text", "p_user_agent" "text", "p_failure_reason" "text", "p_mfa_used" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."record_login_attempt"("p_email" "text", "p_auth_user_id" "uuid", "p_success" boolean, "p_ip_address" "text", "p_user_agent" "text", "p_failure_reason" "text", "p_mfa_used" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_login_attempt"("p_email" "text", "p_auth_user_id" "uuid", "p_success" boolean, "p_ip_address" "text", "p_user_agent" "text", "p_failure_reason" "text", "p_mfa_used" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."record_meeting_attendance"("p_meeting_id" "uuid", "p_attendee_name" "text", "p_owner_id" "uuid", "p_attendee_role" "text", "p_signature_data" "text", "p_voting_eligible" boolean, "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."record_meeting_attendance"("p_meeting_id" "uuid", "p_attendee_name" "text", "p_owner_id" "uuid", "p_attendee_role" "text", "p_signature_data" "text", "p_voting_eligible" boolean, "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_meeting_attendance"("p_meeting_id" "uuid", "p_attendee_name" "text", "p_owner_id" "uuid", "p_attendee_role" "text", "p_signature_data" "text", "p_voting_eligible" boolean, "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."recount_seats_used"() TO "anon";
GRANT ALL ON FUNCTION "public"."recount_seats_used"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recount_seats_used"() TO "service_role";



GRANT ALL ON FUNCTION "public"."relink_all_portal_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."relink_all_portal_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."relink_all_portal_users"() TO "service_role";



GRANT ALL ON FUNCTION "public"."relink_portal_user_on_email_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."relink_portal_user_on_email_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."relink_portal_user_on_email_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_staff_member"("p_profile_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_staff_member"("p_profile_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_staff_member"("p_profile_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."render_invitation_email"("inv" "public"."user_invitations") TO "anon";
GRANT ALL ON FUNCTION "public"."render_invitation_email"("inv" "public"."user_invitations") TO "authenticated";
GRANT ALL ON FUNCTION "public"."render_invitation_email"("inv" "public"."user_invitations") TO "service_role";



GRANT ALL ON FUNCTION "public"."reorder_agenda_items"("p_meeting_id" integer, "p_item_ids" integer[]) TO "anon";
GRANT ALL ON FUNCTION "public"."reorder_agenda_items"("p_meeting_id" integer, "p_item_ids" integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_agenda_items"("p_meeting_id" integer, "p_item_ids" integer[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."report_data_delinquency"("p_portfolio_id" "uuid", "p_params" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."report_data_delinquency"("p_portfolio_id" "uuid", "p_params" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."report_data_delinquency"("p_portfolio_id" "uuid", "p_params" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."report_data_dispatch"("p_portfolio_id" "uuid", "p_slug" "text", "p_params" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."report_data_dispatch"("p_portfolio_id" "uuid", "p_slug" "text", "p_params" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."report_data_dispatch"("p_portfolio_id" "uuid", "p_slug" "text", "p_params" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."report_data_homeowner_ledger"("p_portfolio_id" "uuid", "p_params" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."report_data_homeowner_ledger"("p_portfolio_id" "uuid", "p_params" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."report_data_homeowner_ledger"("p_portfolio_id" "uuid", "p_params" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."report_data_open_work_orders"("p_portfolio_id" "uuid", "p_params" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."report_data_open_work_orders"("p_portfolio_id" "uuid", "p_params" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."report_data_open_work_orders"("p_portfolio_id" "uuid", "p_params" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."report_data_property_directory"("p_portfolio_id" "uuid", "p_params" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."report_data_property_directory"("p_portfolio_id" "uuid", "p_params" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."report_data_property_directory"("p_portfolio_id" "uuid", "p_params" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."report_data_vendor_1099"("p_portfolio_id" "uuid", "p_params" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."report_data_vendor_1099"("p_portfolio_id" "uuid", "p_params" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."report_data_vendor_1099"("p_portfolio_id" "uuid", "p_params" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."report_data_vendor_directory"("p_portfolio_id" "uuid", "p_params" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."report_data_vendor_directory"("p_portfolio_id" "uuid", "p_params" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."report_data_vendor_directory"("p_portfolio_id" "uuid", "p_params" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."report_data_violation_log"("p_portfolio_id" "uuid", "p_params" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."report_data_violation_log"("p_portfolio_id" "uuid", "p_params" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."report_data_violation_log"("p_portfolio_id" "uuid", "p_params" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."report_data_work_orders"("p_portfolio_id" "uuid", "p_params" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."report_data_work_orders"("p_portfolio_id" "uuid", "p_params" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."report_data_work_orders"("p_portfolio_id" "uuid", "p_params" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."data_export_requests" TO "anon";
GRANT ALL ON TABLE "public"."data_export_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."data_export_requests" TO "service_role";



GRANT ALL ON FUNCTION "public"."request_data_export"("p_portfolio_id" "uuid", "p_scope" "public"."export_scope", "p_format" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."request_data_export"("p_portfolio_id" "uuid", "p_scope" "public"."export_scope", "p_format" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_data_export"("p_portfolio_id" "uuid", "p_scope" "public"."export_scope", "p_format" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."resend_invitation"("p_invitation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."resend_invitation"("p_invitation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resend_invitation"("p_invitation_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."resolve_portfolio_for_host"("p_host" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolve_portfolio_for_host"("p_host" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_portfolio_for_host"("p_host" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."revoke_invitation"("p_invitation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_invitation"("p_invitation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_invitation"("p_invitation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rotate_api_key"("p_api_key_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rotate_api_key"("p_api_key_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rotate_api_key"("p_api_key_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."run_autopay_mandates"() TO "anon";
GRANT ALL ON FUNCTION "public"."run_autopay_mandates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."run_autopay_mandates"() TO "service_role";



GRANT ALL ON FUNCTION "public"."scan_data_diagnostics"("p_portfolio_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."scan_data_diagnostics"("p_portfolio_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."scan_data_diagnostics"("p_portfolio_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."scan_financial_diagnostics"("p_portfolio_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."scan_financial_diagnostics"("p_portfolio_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."scan_financial_diagnostics"("p_portfolio_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_standard_charge_categories"("p_portfolio_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."seed_standard_charge_categories"("p_portfolio_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_standard_charge_categories"("p_portfolio_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."select_payment_processor"("p_portfolio_id" "uuid", "p_method" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."select_payment_processor"("p_portfolio_id" "uuid", "p_method" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."select_payment_processor"("p_portfolio_id" "uuid", "p_method" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_document_template_portfolio_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_document_template_portfolio_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_document_template_portfolio_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."setup_edge_function_secrets"("p_project_url" "text", "p_service_role_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."setup_edge_function_secrets"("p_project_url" "text", "p_service_role_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."setup_edge_function_secrets"("p_project_url" "text", "p_service_role_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."slugify_association_name"("p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."slugify_association_name"("p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."slugify_association_name"("p_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."stage_owner_activation"("p_owner_id" "uuid", "p_subject" "text", "p_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."stage_owner_activation"("p_owner_id" "uuid", "p_subject" "text", "p_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."stage_owner_activation"("p_owner_id" "uuid", "p_subject" "text", "p_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."stage_owner_form"("p_owner_id" "uuid", "p_template" "text", "p_subject" "text", "p_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."stage_owner_form"("p_owner_id" "uuid", "p_template" "text", "p_subject" "text", "p_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."stage_owner_form"("p_owner_id" "uuid", "p_template" "text", "p_subject" "text", "p_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."subscribe_association_to_charge"("p_association_id" "uuid", "p_charge_category_id" "uuid", "p_amount" numeric, "p_frequency" "public"."recurring_frequency") TO "anon";
GRANT ALL ON FUNCTION "public"."subscribe_association_to_charge"("p_association_id" "uuid", "p_charge_category_id" "uuid", "p_amount" numeric, "p_frequency" "public"."recurring_frequency") TO "authenticated";
GRANT ALL ON FUNCTION "public"."subscribe_association_to_charge"("p_association_id" "uuid", "p_charge_category_id" "uuid", "p_amount" numeric, "p_frequency" "public"."recurring_frequency") TO "service_role";



GRANT ALL ON TABLE "public"."unit_recurring_charges" TO "anon";
GRANT ALL ON TABLE "public"."unit_recurring_charges" TO "authenticated";
GRANT ALL ON TABLE "public"."unit_recurring_charges" TO "service_role";



GRANT ALL ON FUNCTION "public"."subscribe_unit_to_charge"("p_unit_id" "uuid", "p_charge_category_id" "uuid", "p_amount" numeric, "p_frequency" "public"."recurring_frequency", "p_start_date" "date", "p_memo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."subscribe_unit_to_charge"("p_unit_id" "uuid", "p_charge_category_id" "uuid", "p_amount" numeric, "p_frequency" "public"."recurring_frequency", "p_start_date" "date", "p_memo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."subscribe_unit_to_charge"("p_unit_id" "uuid", "p_charge_category_id" "uuid", "p_amount" numeric, "p_frequency" "public"."recurring_frequency", "p_start_date" "date", "p_memo" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."subscribe_unit_to_charge"("p_unit_id" "uuid", "p_charge_category_id" "uuid", "p_amount" numeric, "p_frequency" "public"."recurring_frequency", "p_start_date" "date", "p_memo" "text", "p_identifier" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."subscribe_unit_to_charge"("p_unit_id" "uuid", "p_charge_category_id" "uuid", "p_amount" numeric, "p_frequency" "public"."recurring_frequency", "p_start_date" "date", "p_memo" "text", "p_identifier" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."subscribe_unit_to_charge"("p_unit_id" "uuid", "p_charge_category_id" "uuid", "p_amount" numeric, "p_frequency" "public"."recurring_frequency", "p_start_date" "date", "p_memo" "text", "p_identifier" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."suspend_portfolio"("p_portfolio_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."suspend_portfolio"("p_portfolio_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."suspend_portfolio"("p_portfolio_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_association_unit_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_association_unit_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_association_unit_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_portfolio_tier_from_subscription"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_portfolio_tier_from_subscription"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_portfolio_tier_from_subscription"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_sms_conversation_on_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_sms_conversation_on_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_sms_conversation_on_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tally_approval_vote"() TO "anon";
GRANT ALL ON FUNCTION "public"."tally_approval_vote"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tally_approval_vote"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tenant_branding"("p_host" "text", "p_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."tenant_branding"("p_host" "text", "p_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."tenant_branding"("p_host" "text", "p_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_violation_updated"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_violation_updated"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_violation_updated"() TO "service_role";



GRANT ALL ON FUNCTION "public"."transfer_user_to_portfolio"("p_profile_id" "uuid", "p_new_portfolio_id" "uuid", "p_new_role_id" "uuid", "p_new_hoa_role" "public"."hoa_role") TO "anon";
GRANT ALL ON FUNCTION "public"."transfer_user_to_portfolio"("p_profile_id" "uuid", "p_new_portfolio_id" "uuid", "p_new_role_id" "uuid", "p_new_hoa_role" "public"."hoa_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transfer_user_to_portfolio"("p_profile_id" "uuid", "p_new_portfolio_id" "uuid", "p_new_role_id" "uuid", "p_new_hoa_role" "public"."hoa_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_seed_standard_charge_categories"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_seed_standard_charge_categories"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_seed_standard_charge_categories"() TO "service_role";



GRANT ALL ON FUNCTION "public"."unapply_payment"("p_payment_id" "uuid", "p_charge_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."unapply_payment"("p_payment_id" "uuid", "p_charge_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unapply_payment"("p_payment_id" "uuid", "p_charge_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_bank_account_reconciliation_date"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_bank_account_reconciliation_date"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_bank_account_reconciliation_date"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_meetings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_meetings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_meetings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_owner_payables_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_owner_payables_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_owner_payables_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_payment_intent_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_payment_intent_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_payment_intent_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_plaid_items_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_plaid_items_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_plaid_items_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_work_order_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_work_order_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_work_order_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_budget_line"("p_id" "uuid", "p_association_id" "uuid", "p_gl_account_id" "uuid", "p_fiscal_year" integer, "p_monthly_amounts" numeric[], "p_category" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_budget_line"("p_id" "uuid", "p_association_id" "uuid", "p_gl_account_id" "uuid", "p_fiscal_year" integer, "p_monthly_amounts" numeric[], "p_category" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_budget_line"("p_id" "uuid", "p_association_id" "uuid", "p_gl_account_id" "uuid", "p_fiscal_year" integer, "p_monthly_amounts" numeric[], "p_category" "text", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_invitation_email_domain"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_invitation_email_domain"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_invitation_email_domain"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_journal_entry_balance"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_journal_entry_balance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_journal_entry_balance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_api_key"("p_raw_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_api_key"("p_raw_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_api_key"("p_raw_key" "text") TO "service_role";
























GRANT ALL ON TABLE "public"."accounting_periods" TO "anon";
GRANT ALL ON TABLE "public"."accounting_periods" TO "authenticated";
GRANT ALL ON TABLE "public"."accounting_periods" TO "service_role";



GRANT ALL ON TABLE "public"."activity" TO "anon";
GRANT ALL ON TABLE "public"."activity" TO "authenticated";
GRANT ALL ON TABLE "public"."activity" TO "service_role";



GRANT ALL ON TABLE "public"."associations" TO "anon";
GRANT ALL ON TABLE "public"."associations" TO "authenticated";
GRANT ALL ON TABLE "public"."associations" TO "service_role";



GRANT ALL ON TABLE "public"."buildings" TO "anon";
GRANT ALL ON TABLE "public"."buildings" TO "authenticated";
GRANT ALL ON TABLE "public"."buildings" TO "service_role";



GRANT ALL ON TABLE "public"."payment_applications" TO "anon";
GRANT ALL ON TABLE "public"."payment_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_applications" TO "service_role";



GRANT ALL ON TABLE "public"."units" TO "anon";
GRANT ALL ON TABLE "public"."units" TO "authenticated";
GRANT ALL ON TABLE "public"."units" TO "service_role";



GRANT ALL ON TABLE "public"."aged_receivables" TO "anon";
GRANT ALL ON TABLE "public"."aged_receivables" TO "authenticated";
GRANT ALL ON TABLE "public"."aged_receivables" TO "service_role";



GRANT ALL ON TABLE "public"."agenda_items" TO "anon";
GRANT ALL ON TABLE "public"."agenda_items" TO "authenticated";
GRANT ALL ON TABLE "public"."agenda_items" TO "service_role";



GRANT ALL ON TABLE "public"."agents" TO "anon";
GRANT ALL ON TABLE "public"."agents" TO "authenticated";
GRANT ALL ON TABLE "public"."agents" TO "service_role";



GRANT ALL ON TABLE "public"."amenity_reservations" TO "anon";
GRANT ALL ON TABLE "public"."amenity_reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."amenity_reservations" TO "service_role";



GRANT ALL ON TABLE "public"."amenity_tags" TO "anon";
GRANT ALL ON TABLE "public"."amenity_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."amenity_tags" TO "service_role";



GRANT ALL ON TABLE "public"."api_keys" TO "anon";
GRANT ALL ON TABLE "public"."api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."api_keys" TO "service_role";



GRANT ALL ON TABLE "public"."approval_decisions" TO "anon";
GRANT ALL ON TABLE "public"."approval_decisions" TO "authenticated";
GRANT ALL ON TABLE "public"."approval_decisions" TO "service_role";



GRANT ALL ON TABLE "public"."approval_requests" TO "anon";
GRANT ALL ON TABLE "public"."approval_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."approval_requests" TO "service_role";



GRANT ALL ON TABLE "public"."approval_votes" TO "anon";
GRANT ALL ON TABLE "public"."approval_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."approval_votes" TO "service_role";



GRANT ALL ON TABLE "public"."architectural_request_messages" TO "anon";
GRANT ALL ON TABLE "public"."architectural_request_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."architectural_request_messages" TO "service_role";



GRANT ALL ON TABLE "public"."architectural_requests" TO "anon";
GRANT ALL ON TABLE "public"."architectural_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."architectural_requests" TO "service_role";



GRANT ALL ON TABLE "public"."architectural_review_settings" TO "anon";
GRANT ALL ON TABLE "public"."architectural_review_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."architectural_review_settings" TO "service_role";



GRANT ALL ON TABLE "public"."assessment_periods" TO "anon";
GRANT ALL ON TABLE "public"."assessment_periods" TO "authenticated";
GRANT ALL ON TABLE "public"."assessment_periods" TO "service_role";



GRANT ALL ON TABLE "public"."association_additional_fees" TO "anon";
GRANT ALL ON TABLE "public"."association_additional_fees" TO "authenticated";
GRANT ALL ON TABLE "public"."association_additional_fees" TO "service_role";



GRANT ALL ON TABLE "public"."association_amenities" TO "anon";
GRANT ALL ON TABLE "public"."association_amenities" TO "authenticated";
GRANT ALL ON TABLE "public"."association_amenities" TO "service_role";



GRANT ALL ON TABLE "public"."association_assignments" TO "anon";
GRANT ALL ON TABLE "public"."association_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."association_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."association_attachments" TO "anon";
GRANT ALL ON TABLE "public"."association_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."association_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."association_keys" TO "anon";
GRANT ALL ON TABLE "public"."association_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."association_keys" TO "service_role";



GRANT ALL ON TABLE "public"."association_lease_template_settings" TO "anon";
GRANT ALL ON TABLE "public"."association_lease_template_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."association_lease_template_settings" TO "service_role";



GRANT ALL ON TABLE "public"."association_loans" TO "anon";
GRANT ALL ON TABLE "public"."association_loans" TO "authenticated";
GRANT ALL ON TABLE "public"."association_loans" TO "service_role";



GRANT ALL ON TABLE "public"."association_managers" TO "anon";
GRANT ALL ON TABLE "public"."association_managers" TO "authenticated";
GRANT ALL ON TABLE "public"."association_managers" TO "service_role";



GRANT ALL ON TABLE "public"."association_notes" TO "anon";
GRANT ALL ON TABLE "public"."association_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."association_notes" TO "service_role";



GRANT ALL ON TABLE "public"."association_ownership_totals" TO "anon";
GRANT ALL ON TABLE "public"."association_ownership_totals" TO "authenticated";
GRANT ALL ON TABLE "public"."association_ownership_totals" TO "service_role";



GRANT ALL ON TABLE "public"."association_renewal_options" TO "anon";
GRANT ALL ON TABLE "public"."association_renewal_options" TO "authenticated";
GRANT ALL ON TABLE "public"."association_renewal_options" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."automation_flow_runs" TO "anon";
GRANT ALL ON TABLE "public"."automation_flow_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_flow_runs" TO "service_role";



GRANT ALL ON TABLE "public"."automation_flows" TO "anon";
GRANT ALL ON TABLE "public"."automation_flows" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_flows" TO "service_role";



GRANT ALL ON TABLE "public"."automation_tasks" TO "anon";
GRANT ALL ON TABLE "public"."automation_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."ballots" TO "anon";
GRANT ALL ON TABLE "public"."ballots" TO "authenticated";
GRANT ALL ON TABLE "public"."ballots" TO "service_role";



GRANT ALL ON TABLE "public"."bank_account_owners" TO "anon";
GRANT ALL ON TABLE "public"."bank_account_owners" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_account_owners" TO "service_role";



GRANT ALL ON TABLE "public"."bank_accounts" TO "anon";
GRANT ALL ON TABLE "public"."bank_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."bank_adjustments" TO "anon";
GRANT ALL ON TABLE "public"."bank_adjustments" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_adjustments" TO "service_role";



GRANT ALL ON TABLE "public"."bank_reconciliation_items" TO "anon";
GRANT ALL ON TABLE "public"."bank_reconciliation_items" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_reconciliation_items" TO "service_role";



GRANT ALL ON TABLE "public"."bank_reconciliations" TO "anon";
GRANT ALL ON TABLE "public"."bank_reconciliations" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_reconciliations" TO "service_role";



GRANT ALL ON TABLE "public"."bank_transactions" TO "anon";
GRANT ALL ON TABLE "public"."bank_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."bank_transfers" TO "anon";
GRANT ALL ON TABLE "public"."bank_transfers" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_transfers" TO "service_role";



GRANT ALL ON TABLE "public"."billing_usage" TO "anon";
GRANT ALL ON TABLE "public"."billing_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_usage" TO "service_role";



GRANT ALL ON TABLE "public"."board_approval_settings" TO "anon";
GRANT ALL ON TABLE "public"."board_approval_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."board_approval_settings" TO "service_role";



GRANT ALL ON TABLE "public"."board_comments" TO "anon";
GRANT ALL ON TABLE "public"."board_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."board_comments" TO "service_role";



GRANT ALL ON TABLE "public"."board_members" TO "anon";
GRANT ALL ON TABLE "public"."board_members" TO "authenticated";
GRANT ALL ON TABLE "public"."board_members" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."budget_lines" TO "anon";
GRANT ALL ON TABLE "public"."budget_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."budget_lines" TO "service_role";



GRANT ALL ON TABLE "public"."budget_line_totals" TO "anon";
GRANT ALL ON TABLE "public"."budget_line_totals" TO "authenticated";
GRANT ALL ON TABLE "public"."budget_line_totals" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_event_reminders" TO "anon";
GRANT ALL ON TABLE "public"."calendar_event_reminders" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_event_reminders" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_events" TO "anon";
GRANT ALL ON TABLE "public"."calendar_events" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_events" TO "service_role";



GRANT ALL ON TABLE "public"."charge_categories" TO "anon";
GRANT ALL ON TABLE "public"."charge_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."charge_categories" TO "service_role";



GRANT ALL ON TABLE "public"."committee_members" TO "anon";
GRANT ALL ON TABLE "public"."committee_members" TO "authenticated";
GRANT ALL ON TABLE "public"."committee_members" TO "service_role";



GRANT ALL ON TABLE "public"."committees" TO "anon";
GRANT ALL ON TABLE "public"."committees" TO "authenticated";
GRANT ALL ON TABLE "public"."committees" TO "service_role";



GRANT ALL ON TABLE "public"."communication_messages" TO "anon";
GRANT ALL ON TABLE "public"."communication_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."communication_messages" TO "service_role";



GRANT ALL ON TABLE "public"."communication_triggers" TO "anon";
GRANT ALL ON TABLE "public"."communication_triggers" TO "authenticated";
GRANT ALL ON TABLE "public"."communication_triggers" TO "service_role";



GRANT ALL ON TABLE "public"."communications_log" TO "anon";
GRANT ALL ON TABLE "public"."communications_log" TO "authenticated";
GRANT ALL ON TABLE "public"."communications_log" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON SEQUENCE "public"."companies_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."companies_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."companies_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."company_settings" TO "anon";
GRANT ALL ON TABLE "public"."company_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."company_settings" TO "service_role";



GRANT ALL ON TABLE "public"."data_diagnostics" TO "anon";
GRANT ALL ON TABLE "public"."data_diagnostics" TO "authenticated";
GRANT ALL ON TABLE "public"."data_diagnostics" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."unit_balances" TO "anon";
GRANT ALL ON TABLE "public"."unit_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."unit_balances" TO "service_role";



GRANT ALL ON TABLE "public"."delinquent_units" TO "anon";
GRANT ALL ON TABLE "public"."delinquent_units" TO "authenticated";
GRANT ALL ON TABLE "public"."delinquent_units" TO "service_role";



GRANT ALL ON TABLE "public"."depreciation_entries" TO "anon";
GRANT ALL ON TABLE "public"."depreciation_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."depreciation_entries" TO "service_role";



GRANT ALL ON TABLE "public"."diagnostic_flags" TO "anon";
GRANT ALL ON TABLE "public"."diagnostic_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."diagnostic_flags" TO "service_role";



GRANT ALL ON SEQUENCE "public"."diagnostic_flags_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."diagnostic_flags_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."diagnostic_flags_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."document_requests" TO "anon";
GRANT ALL ON TABLE "public"."document_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."document_requests" TO "service_role";



GRANT ALL ON TABLE "public"."document_templates" TO "anon";
GRANT ALL ON TABLE "public"."document_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."document_templates" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."dues_increase_lines" TO "anon";
GRANT ALL ON TABLE "public"."dues_increase_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."dues_increase_lines" TO "service_role";



GRANT ALL ON TABLE "public"."dues_increases" TO "anon";
GRANT ALL ON TABLE "public"."dues_increases" TO "authenticated";
GRANT ALL ON TABLE "public"."dues_increases" TO "service_role";



GRANT ALL ON TABLE "public"."email_connections" TO "anon";
GRANT ALL ON TABLE "public"."email_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."email_connections" TO "service_role";



GRANT ALL ON SEQUENCE "public"."email_connections_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."email_connections_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."email_connections_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."email_queue" TO "anon";
GRANT ALL ON TABLE "public"."email_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."email_queue" TO "service_role";



GRANT ALL ON TABLE "public"."email_threads" TO "anon";
GRANT ALL ON TABLE "public"."email_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."email_threads" TO "service_role";



GRANT ALL ON SEQUENCE "public"."email_threads_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."email_threads_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."email_threads_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."feature_entitlements" TO "anon";
GRANT ALL ON TABLE "public"."feature_entitlements" TO "authenticated";
GRANT ALL ON TABLE "public"."feature_entitlements" TO "service_role";



GRANT ALL ON TABLE "public"."fixed_assets" TO "anon";
GRANT ALL ON TABLE "public"."fixed_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."fixed_assets" TO "service_role";



GRANT ALL ON TABLE "public"."form_templates" TO "anon";
GRANT ALL ON TABLE "public"."form_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."form_templates" TO "service_role";



GRANT ALL ON TABLE "public"."gl_account_role_permissions" TO "anon";
GRANT ALL ON TABLE "public"."gl_account_role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."gl_account_role_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."gl_accounts" TO "anon";
GRANT ALL ON TABLE "public"."gl_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."gl_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."house_rules" TO "anon";
GRANT ALL ON TABLE "public"."house_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."house_rules" TO "service_role";



GRANT ALL ON TABLE "public"."income_recertifications" TO "anon";
GRANT ALL ON TABLE "public"."income_recertifications" TO "authenticated";
GRANT ALL ON TABLE "public"."income_recertifications" TO "service_role";



GRANT ALL ON TABLE "public"."inspection_items" TO "anon";
GRANT ALL ON TABLE "public"."inspection_items" TO "authenticated";
GRANT ALL ON TABLE "public"."inspection_items" TO "service_role";



GRANT ALL ON TABLE "public"."inspections" TO "anon";
GRANT ALL ON TABLE "public"."inspections" TO "authenticated";
GRANT ALL ON TABLE "public"."inspections" TO "service_role";



GRANT ALL ON TABLE "public"."insurance_policies" TO "anon";
GRANT ALL ON TABLE "public"."insurance_policies" TO "authenticated";
GRANT ALL ON TABLE "public"."insurance_policies" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_items" TO "anon";
GRANT ALL ON TABLE "public"."inventory_items" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_items" TO "service_role";



GRANT ALL ON TABLE "public"."invitations" TO "anon";
GRANT ALL ON TABLE "public"."invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."invitations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."invitations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."invitations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."invitations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."journal_entries" TO "anon";
GRANT ALL ON TABLE "public"."journal_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_entries" TO "service_role";



GRANT ALL ON TABLE "public"."journal_entry_batches" TO "anon";
GRANT ALL ON TABLE "public"."journal_entry_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_entry_batches" TO "service_role";



GRANT ALL ON TABLE "public"."journal_entry_lines" TO "anon";
GRANT ALL ON TABLE "public"."journal_entry_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_entry_lines" TO "service_role";



GRANT ALL ON SEQUENCE "public"."journal_entry_lines_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."journal_entry_lines_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."journal_entry_lines_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."journal_lines" TO "anon";
GRANT ALL ON TABLE "public"."journal_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_lines" TO "service_role";



GRANT ALL ON TABLE "public"."late_fee_assessments" TO "anon";
GRANT ALL ON TABLE "public"."late_fee_assessments" TO "authenticated";
GRANT ALL ON TABLE "public"."late_fee_assessments" TO "service_role";



GRANT ALL ON TABLE "public"."lead_messages" TO "anon";
GRANT ALL ON TABLE "public"."lead_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_messages" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON TABLE "public"."lock_box_assignments" TO "anon";
GRANT ALL ON TABLE "public"."lock_box_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."lock_box_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."lock_boxes" TO "anon";
GRANT ALL ON TABLE "public"."lock_boxes" TO "authenticated";
GRANT ALL ON TABLE "public"."lock_boxes" TO "service_role";



GRANT ALL ON TABLE "public"."lockbox_batches" TO "anon";
GRANT ALL ON TABLE "public"."lockbox_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."lockbox_batches" TO "service_role";



GRANT ALL ON TABLE "public"."lockbox_items" TO "anon";
GRANT ALL ON TABLE "public"."lockbox_items" TO "authenticated";
GRANT ALL ON TABLE "public"."lockbox_items" TO "service_role";



GRANT ALL ON TABLE "public"."login_attempts" TO "anon";
GRANT ALL ON TABLE "public"."login_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."login_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."maintenance_task_history" TO "anon";
GRANT ALL ON TABLE "public"."maintenance_task_history" TO "authenticated";
GRANT ALL ON TABLE "public"."maintenance_task_history" TO "service_role";



GRANT ALL ON TABLE "public"."maintenance_tasks" TO "anon";
GRANT ALL ON TABLE "public"."maintenance_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."maintenance_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."maintenance_template_groups" TO "anon";
GRANT ALL ON TABLE "public"."maintenance_template_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."maintenance_template_groups" TO "service_role";



GRANT ALL ON TABLE "public"."maintenance_templates" TO "anon";
GRANT ALL ON TABLE "public"."maintenance_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."maintenance_templates" TO "service_role";



GRANT ALL ON TABLE "public"."management_agreements" TO "anon";
GRANT ALL ON TABLE "public"."management_agreements" TO "authenticated";
GRANT ALL ON TABLE "public"."management_agreements" TO "service_role";



GRANT ALL ON TABLE "public"."management_fee_policies" TO "anon";
GRANT ALL ON TABLE "public"."management_fee_policies" TO "authenticated";
GRANT ALL ON TABLE "public"."management_fee_policies" TO "service_role";



GRANT ALL ON TABLE "public"."management_fee_schedules" TO "anon";
GRANT ALL ON TABLE "public"."management_fee_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."management_fee_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."management_fees" TO "anon";
GRANT ALL ON TABLE "public"."management_fees" TO "authenticated";
GRANT ALL ON TABLE "public"."management_fees" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_leads" TO "anon";
GRANT ALL ON TABLE "public"."marketing_leads" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_leads" TO "service_role";



GRANT ALL ON TABLE "public"."meeting_action_items" TO "anon";
GRANT ALL ON TABLE "public"."meeting_action_items" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_action_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."meeting_action_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."meeting_action_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."meeting_action_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."meeting_attendees" TO "anon";
GRANT ALL ON TABLE "public"."meeting_attendees" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_attendees" TO "service_role";



GRANT ALL ON TABLE "public"."meeting_documents" TO "anon";
GRANT ALL ON TABLE "public"."meeting_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_documents" TO "service_role";



GRANT ALL ON TABLE "public"."meetings" TO "anon";
GRANT ALL ON TABLE "public"."meetings" TO "authenticated";
GRANT ALL ON TABLE "public"."meetings" TO "service_role";



GRANT ALL ON TABLE "public"."message_templates" TO "anon";
GRANT ALL ON TABLE "public"."message_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."message_templates" TO "service_role";



GRANT ALL ON TABLE "public"."monthly_income" TO "anon";
GRANT ALL ON TABLE "public"."monthly_income" TO "authenticated";
GRANT ALL ON TABLE "public"."monthly_income" TO "service_role";



GRANT ALL ON TABLE "public"."notice_recipients" TO "anon";
GRANT ALL ON TABLE "public"."notice_recipients" TO "authenticated";
GRANT ALL ON TABLE "public"."notice_recipients" TO "service_role";



GRANT ALL ON TABLE "public"."notices" TO "anon";
GRANT ALL ON TABLE "public"."notices" TO "authenticated";
GRANT ALL ON TABLE "public"."notices" TO "service_role";



GRANT ALL ON TABLE "public"."occupancies" TO "anon";
GRANT ALL ON TABLE "public"."occupancies" TO "authenticated";
GRANT ALL ON TABLE "public"."occupancies" TO "service_role";



GRANT ALL ON TABLE "public"."owner_accounts" TO "anon";
GRANT ALL ON TABLE "public"."owner_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."owner_accounts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."owner_accounts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."owner_accounts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."owner_accounts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."owner_ach_status" TO "anon";
GRANT ALL ON TABLE "public"."owner_ach_status" TO "authenticated";
GRANT ALL ON TABLE "public"."owner_ach_status" TO "service_role";



GRANT ALL ON TABLE "public"."owner_attachments" TO "anon";
GRANT ALL ON TABLE "public"."owner_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."owner_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."owner_financial_details" TO "anon";
GRANT ALL ON TABLE "public"."owner_financial_details" TO "authenticated";
GRANT ALL ON TABLE "public"."owner_financial_details" TO "service_role";



GRANT ALL ON TABLE "public"."owner_form_submissions" TO "anon";
GRANT ALL ON TABLE "public"."owner_form_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."owner_form_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."owner_messages" TO "anon";
GRANT ALL ON TABLE "public"."owner_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."owner_messages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."owner_messages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."owner_messages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."owner_messages_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."owner_notification_prefs" TO "anon";
GRANT ALL ON TABLE "public"."owner_notification_prefs" TO "authenticated";
GRANT ALL ON TABLE "public"."owner_notification_prefs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."owner_notification_prefs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."owner_notification_prefs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."owner_notification_prefs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."owner_notifications" TO "anon";
GRANT ALL ON TABLE "public"."owner_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."owner_notifications" TO "service_role";



GRANT ALL ON SEQUENCE "public"."owner_notifications_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."owner_notifications_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."owner_notifications_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."owner_packet_settings" TO "anon";
GRANT ALL ON TABLE "public"."owner_packet_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."owner_packet_settings" TO "service_role";



GRANT ALL ON TABLE "public"."owner_packets" TO "anon";
GRANT ALL ON TABLE "public"."owner_packets" TO "authenticated";
GRANT ALL ON TABLE "public"."owner_packets" TO "service_role";



GRANT ALL ON TABLE "public"."owner_payables" TO "anon";
GRANT ALL ON TABLE "public"."owner_payables" TO "authenticated";
GRANT ALL ON TABLE "public"."owner_payables" TO "service_role";



GRANT ALL ON TABLE "public"."owner_portal_invites" TO "anon";
GRANT ALL ON TABLE "public"."owner_portal_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."owner_portal_invites" TO "service_role";



GRANT ALL ON TABLE "public"."owner_statements" TO "anon";
GRANT ALL ON TABLE "public"."owner_statements" TO "authenticated";
GRANT ALL ON TABLE "public"."owner_statements" TO "service_role";



GRANT ALL ON TABLE "public"."owner_vehicles" TO "anon";
GRANT ALL ON TABLE "public"."owner_vehicles" TO "authenticated";
GRANT ALL ON TABLE "public"."owner_vehicles" TO "service_role";



GRANT ALL ON TABLE "public"."owners" TO "anon";
GRANT ALL ON TABLE "public"."owners" TO "authenticated";
GRANT ALL ON TABLE "public"."owners" TO "service_role";



GRANT ALL ON TABLE "public"."parking_assignments" TO "anon";
GRANT ALL ON TABLE "public"."parking_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."parking_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."parking_spaces" TO "anon";
GRANT ALL ON TABLE "public"."parking_spaces" TO "authenticated";
GRANT ALL ON TABLE "public"."parking_spaces" TO "service_role";



GRANT ALL ON TABLE "public"."payable_bill_line_items" TO "anon";
GRANT ALL ON TABLE "public"."payable_bill_line_items" TO "authenticated";
GRANT ALL ON TABLE "public"."payable_bill_line_items" TO "service_role";



GRANT ALL ON TABLE "public"."payable_bills" TO "anon";
GRANT ALL ON TABLE "public"."payable_bills" TO "authenticated";
GRANT ALL ON TABLE "public"."payable_bills" TO "service_role";



GRANT ALL ON TABLE "public"."vendors" TO "anon";
GRANT ALL ON TABLE "public"."vendors" TO "authenticated";
GRANT ALL ON TABLE "public"."vendors" TO "service_role";



GRANT ALL ON TABLE "public"."work_orders" TO "anon";
GRANT ALL ON TABLE "public"."work_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."work_orders" TO "service_role";



GRANT ALL ON TABLE "public"."payable_invoices_ledger" TO "anon";
GRANT ALL ON TABLE "public"."payable_invoices_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."payable_invoices_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."payment_events" TO "anon";
GRANT ALL ON TABLE "public"."payment_events" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_events" TO "service_role";



GRANT ALL ON TABLE "public"."payment_intents" TO "anon";
GRANT ALL ON TABLE "public"."payment_intents" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_intents" TO "service_role";



GRANT ALL ON TABLE "public"."payment_methods" TO "anon";
GRANT ALL ON TABLE "public"."payment_methods" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_methods" TO "service_role";



GRANT ALL ON TABLE "public"."payment_processor_configs" TO "anon";
GRANT ALL ON TABLE "public"."payment_processor_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_processor_configs" TO "service_role";



GRANT ALL ON TABLE "public"."payment_transactions" TO "anon";
GRANT ALL ON TABLE "public"."payment_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_transactions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."payment_transactions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."payment_transactions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."payment_transactions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."payout_batches" TO "anon";
GRANT ALL ON TABLE "public"."payout_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."payout_batches" TO "service_role";



GRANT ALL ON TABLE "public"."permission_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."permission_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."permission_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."phone_messages" TO "anon";
GRANT ALL ON TABLE "public"."phone_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."phone_messages" TO "service_role";



GRANT ALL ON TABLE "public"."plaid_items" TO "anon";
GRANT ALL ON TABLE "public"."plaid_items" TO "authenticated";
GRANT ALL ON TABLE "public"."plaid_items" TO "service_role";



GRANT ALL ON TABLE "public"."platform_impersonation_log" TO "anon";
GRANT ALL ON TABLE "public"."platform_impersonation_log" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_impersonation_log" TO "service_role";



GRANT ALL ON TABLE "public"."platform_requests" TO "anon";
GRANT ALL ON TABLE "public"."platform_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_requests" TO "service_role";



GRANT ALL ON TABLE "public"."portfolio_settings" TO "anon";
GRANT ALL ON TABLE "public"."portfolio_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."portfolio_settings" TO "service_role";



GRANT ALL ON TABLE "public"."privacy_actions" TO "anon";
GRANT ALL ON TABLE "public"."privacy_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."privacy_actions" TO "service_role";



GRANT ALL ON TABLE "public"."properties" TO "anon";
GRANT ALL ON TABLE "public"."properties" TO "authenticated";
GRANT ALL ON TABLE "public"."properties" TO "service_role";



GRANT ALL ON SEQUENCE "public"."properties_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."properties_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."properties_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."property_assignments" TO "anon";
GRANT ALL ON TABLE "public"."property_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."property_assignments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."property_assignments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."property_assignments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."property_assignments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."property_documents" TO "anon";
GRANT ALL ON TABLE "public"."property_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."property_documents" TO "service_role";



GRANT ALL ON SEQUENCE "public"."property_documents_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."property_documents_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."property_documents_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."property_groups" TO "anon";
GRANT ALL ON TABLE "public"."property_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."property_groups" TO "service_role";



GRANT ALL ON TABLE "public"."provider_availability" TO "anon";
GRANT ALL ON TABLE "public"."provider_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_availability" TO "service_role";



GRANT ALL ON TABLE "public"."provider_services" TO "anon";
GRANT ALL ON TABLE "public"."provider_services" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_services" TO "service_role";



GRANT ALL ON TABLE "public"."providers" TO "anon";
GRANT ALL ON TABLE "public"."providers" TO "authenticated";
GRANT ALL ON TABLE "public"."providers" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_order_line_items" TO "anon";
GRANT ALL ON TABLE "public"."purchase_order_line_items" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_order_line_items" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_orders" TO "anon";
GRANT ALL ON TABLE "public"."purchase_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_orders" TO "service_role";



GRANT ALL ON TABLE "public"."unit_owners" TO "anon";
GRANT ALL ON TABLE "public"."unit_owners" TO "authenticated";
GRANT ALL ON TABLE "public"."unit_owners" TO "service_role";



GRANT ALL ON TABLE "public"."receivable_payments_ledger" TO "anon";
GRANT ALL ON TABLE "public"."receivable_payments_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."receivable_payments_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."recent_activity" TO "anon";
GRANT ALL ON TABLE "public"."recent_activity" TO "authenticated";
GRANT ALL ON TABLE "public"."recent_activity" TO "service_role";



GRANT ALL ON SEQUENCE "public"."recent_activity_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."recent_activity_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."recent_activity_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."receptionist_knowledge" TO "anon";
GRANT ALL ON TABLE "public"."receptionist_knowledge" TO "authenticated";
GRANT ALL ON TABLE "public"."receptionist_knowledge" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_bills" TO "anon";
GRANT ALL ON TABLE "public"."recurring_bills" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_bills" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_journal_entries" TO "anon";
GRANT ALL ON TABLE "public"."recurring_journal_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_journal_entries" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_work_orders" TO "anon";
GRANT ALL ON TABLE "public"."recurring_work_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_work_orders" TO "service_role";



GRANT ALL ON TABLE "public"."reminder_settings" TO "anon";
GRANT ALL ON TABLE "public"."reminder_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."reminder_settings" TO "service_role";



GRANT ALL ON TABLE "public"."report_definitions" TO "anon";
GRANT ALL ON TABLE "public"."report_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."report_definitions" TO "service_role";



GRANT ALL ON TABLE "public"."report_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."report_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."report_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."reserve_fund_settings" TO "anon";
GRANT ALL ON TABLE "public"."reserve_fund_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."reserve_fund_settings" TO "service_role";



GRANT ALL ON TABLE "public"."saved_report_views" TO "anon";
GRANT ALL ON TABLE "public"."saved_report_views" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_report_views" TO "service_role";



GRANT ALL ON TABLE "public"."saved_reports" TO "anon";
GRANT ALL ON TABLE "public"."saved_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_reports" TO "service_role";



GRANT ALL ON TABLE "public"."schedule_events" TO "anon";
GRANT ALL ON TABLE "public"."schedule_events" TO "authenticated";
GRANT ALL ON TABLE "public"."schedule_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."schedule_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."schedule_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."schedule_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."scheduled_reports" TO "anon";
GRANT ALL ON TABLE "public"."scheduled_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."scheduled_reports" TO "service_role";



GRANT ALL ON TABLE "public"."schema_migrations" TO "anon";
GRANT ALL ON TABLE "public"."schema_migrations" TO "authenticated";
GRANT ALL ON TABLE "public"."schema_migrations" TO "service_role";



GRANT ALL ON TABLE "public"."service_requests" TO "anon";
GRANT ALL ON TABLE "public"."service_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."service_requests" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."shares" TO "anon";
GRANT ALL ON TABLE "public"."shares" TO "authenticated";
GRANT ALL ON TABLE "public"."shares" TO "service_role";



GRANT ALL ON TABLE "public"."sms_conversations" TO "anon";
GRANT ALL ON TABLE "public"."sms_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."sms_messages" TO "anon";
GRANT ALL ON TABLE "public"."sms_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_messages" TO "service_role";



GRANT ALL ON TABLE "public"."sms_opt_ins" TO "anon";
GRANT ALL ON TABLE "public"."sms_opt_ins" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_opt_ins" TO "service_role";



GRANT ALL ON TABLE "public"."soft_delete_log" TO "anon";
GRANT ALL ON TABLE "public"."soft_delete_log" TO "authenticated";
GRANT ALL ON TABLE "public"."soft_delete_log" TO "service_role";



GRANT ALL ON TABLE "public"."statement_batches" TO "anon";
GRANT ALL ON TABLE "public"."statement_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."statement_batches" TO "service_role";



GRANT ALL ON TABLE "public"."statements" TO "anon";
GRANT ALL ON TABLE "public"."statements" TO "authenticated";
GRANT ALL ON TABLE "public"."statements" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_events" TO "anon";
GRANT ALL ON TABLE "public"."subscription_events" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_events" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."superadmin_notes" TO "anon";
GRANT ALL ON TABLE "public"."superadmin_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."superadmin_notes" TO "service_role";



GRANT ALL ON TABLE "public"."survey_responses" TO "anon";
GRANT ALL ON TABLE "public"."survey_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."survey_responses" TO "service_role";



GRANT ALL ON TABLE "public"."surveys" TO "anon";
GRANT ALL ON TABLE "public"."surveys" TO "authenticated";
GRANT ALL ON TABLE "public"."surveys" TO "service_role";



GRANT ALL ON TABLE "public"."tag_assignments" TO "anon";
GRANT ALL ON TABLE "public"."tag_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."tag_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";



GRANT ALL ON TABLE "public"."tenancies" TO "anon";
GRANT ALL ON TABLE "public"."tenancies" TO "authenticated";
GRANT ALL ON TABLE "public"."tenancies" TO "service_role";



GRANT ALL ON TABLE "public"."tenants" TO "anon";
GRANT ALL ON TABLE "public"."tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."tenants" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_attachments" TO "anon";
GRANT ALL ON TABLE "public"."ticket_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_attachments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ticket_attachments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ticket_attachments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ticket_attachments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_comments" TO "anon";
GRANT ALL ON TABLE "public"."ticket_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_comments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ticket_comments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ticket_comments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ticket_comments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tickets" TO "anon";
GRANT ALL ON TABLE "public"."tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."tickets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tickets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tickets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tickets_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."transactions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."transactions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."transactions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."unit_amenities" TO "anon";
GRANT ALL ON TABLE "public"."unit_amenities" TO "authenticated";
GRANT ALL ON TABLE "public"."unit_amenities" TO "service_role";



GRANT ALL ON TABLE "public"."unit_pets" TO "anon";
GRANT ALL ON TABLE "public"."unit_pets" TO "authenticated";
GRANT ALL ON TABLE "public"."unit_pets" TO "service_role";



GRANT ALL ON TABLE "public"."usage_metrics" TO "anon";
GRANT ALL ON TABLE "public"."usage_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."usage_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_sessions" TO "anon";
GRANT ALL ON TABLE "public"."user_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON SEQUENCE "public"."users_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."users_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."users_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."v_charge_balances" TO "anon";
GRANT ALL ON TABLE "public"."v_charge_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."v_charge_balances" TO "service_role";



GRANT ALL ON TABLE "public"."v_charges_by_category" TO "anon";
GRANT ALL ON TABLE "public"."v_charges_by_category" TO "authenticated";
GRANT ALL ON TABLE "public"."v_charges_by_category" TO "service_role";



GRANT ALL ON TABLE "public"."v_check_writing_queue" TO "anon";
GRANT ALL ON TABLE "public"."v_check_writing_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."v_check_writing_queue" TO "service_role";



GRANT ALL ON TABLE "public"."violation_cases" TO "anon";
GRANT ALL ON TABLE "public"."violation_cases" TO "authenticated";
GRANT ALL ON TABLE "public"."violation_cases" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."v_company_health" TO "authenticated";
GRANT ALL ON TABLE "public"."v_company_health" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."v_company_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."v_company_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."vendor_compliance" TO "anon";
GRANT ALL ON TABLE "public"."vendor_compliance" TO "authenticated";
GRANT ALL ON TABLE "public"."vendor_compliance" TO "service_role";



GRANT ALL ON TABLE "public"."v_insurance_expirations" TO "anon";
GRANT ALL ON TABLE "public"."v_insurance_expirations" TO "authenticated";
GRANT ALL ON TABLE "public"."v_insurance_expirations" TO "service_role";



GRANT ALL ON TABLE "public"."v_dashboard_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_dashboard_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_dashboard_summary" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."v_due_reminders" TO "authenticated";
GRANT ALL ON TABLE "public"."v_due_reminders" TO "service_role";



GRANT ALL ON TABLE "public"."v_homeowner_ledgers" TO "anon";
GRANT ALL ON TABLE "public"."v_homeowner_ledgers" TO "authenticated";
GRANT ALL ON TABLE "public"."v_homeowner_ledgers" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."v_manager_workload" TO "authenticated";
GRANT ALL ON TABLE "public"."v_manager_workload" TO "service_role";



GRANT ALL ON TABLE "public"."v_pending_invitations" TO "anon";
GRANT ALL ON TABLE "public"."v_pending_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."v_pending_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_deliveries" TO "anon";
GRANT ALL ON TABLE "public"."webhook_deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_deliveries" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_endpoints" TO "anon";
GRANT ALL ON TABLE "public"."webhook_endpoints" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_endpoints" TO "service_role";



GRANT ALL ON TABLE "public"."v_portfolio_health" TO "anon";
GRANT ALL ON TABLE "public"."v_portfolio_health" TO "authenticated";
GRANT ALL ON TABLE "public"."v_portfolio_health" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."v_role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."v_role_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."v_unapplied_credits" TO "anon";
GRANT ALL ON TABLE "public"."v_unapplied_credits" TO "authenticated";
GRANT ALL ON TABLE "public"."v_unapplied_credits" TO "service_role";



GRANT ALL ON TABLE "public"."v_unit_account_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_unit_account_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_unit_account_summary" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."v_unit_charge_schedule" TO "authenticated";
GRANT ALL ON TABLE "public"."v_unit_charge_schedule" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."v_upcoming_expirations" TO "authenticated";
GRANT ALL ON TABLE "public"."v_upcoming_expirations" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."v_upcoming_maintenance" TO "authenticated";
GRANT ALL ON TABLE "public"."v_upcoming_maintenance" TO "service_role";



GRANT ALL ON TABLE "public"."violation_followup_steps" TO "anon";
GRANT ALL ON TABLE "public"."violation_followup_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."violation_followup_steps" TO "service_role";



GRANT ALL ON TABLE "public"."violation_updates" TO "anon";
GRANT ALL ON TABLE "public"."violation_updates" TO "authenticated";
GRANT ALL ON TABLE "public"."violation_updates" TO "service_role";



GRANT ALL ON TABLE "public"."violations" TO "anon";
GRANT ALL ON TABLE "public"."violations" TO "authenticated";
GRANT ALL ON TABLE "public"."violations" TO "service_role";



GRANT ALL ON TABLE "public"."votes" TO "anon";
GRANT ALL ON TABLE "public"."votes" TO "authenticated";
GRANT ALL ON TABLE "public"."votes" TO "service_role";



GRANT ALL ON TABLE "public"."work_order_estimates" TO "anon";
GRANT ALL ON TABLE "public"."work_order_estimates" TO "authenticated";
GRANT ALL ON TABLE "public"."work_order_estimates" TO "service_role";



GRANT ALL ON TABLE "public"."work_order_labor_entries" TO "anon";
GRANT ALL ON TABLE "public"."work_order_labor_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."work_order_labor_entries" TO "service_role";



GRANT ALL ON TABLE "public"."work_order_messages" TO "anon";
GRANT ALL ON TABLE "public"."work_order_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."work_order_messages" TO "service_role";



GRANT ALL ON TABLE "public"."work_order_updates" TO "anon";
GRANT ALL ON TABLE "public"."work_order_updates" TO "authenticated";
GRANT ALL ON TABLE "public"."work_order_updates" TO "service_role";



GRANT ALL ON TABLE "public"."workflows" TO "anon";
GRANT ALL ON TABLE "public"."workflows" TO "authenticated";
GRANT ALL ON TABLE "public"."workflows" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































