-- Align the existing production schema with the current frontend flows.
--
-- This migration is intentionally additive/idempotent. It does not replay the
-- full schema export in corrected_schema_order_safe.sql because that file uses
-- clean-database CREATE TABLE statements and enum values that conflict with
-- the deployed frontend. Keep the frontend-facing values below in sync with:
-- - lib/operations/calendar.ts
-- - app/(app)/associations/[id]/amenities/page.tsx
-- - app/(app)/calendar/new/page.tsx

create extension if not exists pgcrypto;
do $$
begin
  create type public.amenity_pricing_mode as enum ('flat', 'hourly');
exception
  when duplicate_object then null;
end $$;
alter type public.amenity_pricing_mode add value if not exists 'flat';
alter type public.amenity_pricing_mode add value if not exists 'hourly';
do $$
begin
  create type public.amenity_reserve_method as enum ('email', 'platform_link');
exception
  when duplicate_object then null;
end $$;
alter type public.amenity_reserve_method add value if not exists 'email';
alter type public.amenity_reserve_method add value if not exists 'platform_link';
do $$
begin
  create type public.calendar_scope as enum ('daily', 'annual');
exception
  when duplicate_object then null;
end $$;
alter type public.calendar_scope add value if not exists 'daily';
alter type public.calendar_scope add value if not exists 'annual';
do $$
begin
  create type public.calendar_event_type as enum (
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
exception
  when duplicate_object then null;
end $$;
alter type public.calendar_event_type add value if not exists 'board_meeting';
alter type public.calendar_event_type add value if not exists 'annual_meeting_election';
alter type public.calendar_event_type add value if not exists 'vendor_service';
alter type public.calendar_event_type add value if not exists 'elevator_reservation';
alter type public.calendar_event_type add value if not exists 'move_in_move_out';
alter type public.calendar_event_type add value if not exists 'water_shutoff';
alter type public.calendar_event_type add value if not exists 'pest_control';
alter type public.calendar_event_type add value if not exists 'landscaping';
alter type public.calendar_event_type add value if not exists 'inspection';
alter type public.calendar_event_type add value if not exists 'insurance_expiration';
alter type public.calendar_event_type add value if not exists 'contract_renewal';
alter type public.calendar_event_type add value if not exists 'assessment_deadline';
alter type public.calendar_event_type add value if not exists 'custom_event';
-- calendar_events.event_type already exists in production as public.event_type.
-- Extend that enum as well so current form submissions do not fail at insert.
do $$
begin
  create type public.event_type as enum ('other');
exception
  when duplicate_object then null;
end $$;
alter type public.event_type add value if not exists 'board_meeting';
alter type public.event_type add value if not exists 'annual_meeting_election';
alter type public.event_type add value if not exists 'vendor_service';
alter type public.event_type add value if not exists 'elevator_reservation';
alter type public.event_type add value if not exists 'move_in_move_out';
alter type public.event_type add value if not exists 'water_shutoff';
alter type public.event_type add value if not exists 'pest_control';
alter type public.event_type add value if not exists 'landscaping';
alter type public.event_type add value if not exists 'inspection';
alter type public.event_type add value if not exists 'insurance_expiration';
alter type public.event_type add value if not exists 'contract_renewal';
alter type public.event_type add value if not exists 'assessment_deadline';
alter type public.event_type add value if not exists 'custom_event';
do $$
begin
  create type public.calendar_event_status as enum (
    'draft',
    'scheduled',
    'notice_sent',
    'reminder_sent',
    'completed',
    'canceled',
    'awaiting_confirmation',
    'failed_notification'
  );
exception
  when duplicate_object then null;
end $$;
alter type public.calendar_event_status add value if not exists 'draft';
alter type public.calendar_event_status add value if not exists 'scheduled';
alter type public.calendar_event_status add value if not exists 'notice_sent';
alter type public.calendar_event_status add value if not exists 'reminder_sent';
alter type public.calendar_event_status add value if not exists 'completed';
alter type public.calendar_event_status add value if not exists 'canceled';
alter type public.calendar_event_status add value if not exists 'awaiting_confirmation';
alter type public.calendar_event_status add value if not exists 'failed_notification';
do $$
begin
  create type public.communication_channel as enum ('email', 'sms', 'letter', 'portal');
exception
  when duplicate_object then null;
end $$;
alter type public.communication_channel add value if not exists 'email';
alter type public.communication_channel add value if not exists 'sms';
alter type public.communication_channel add value if not exists 'letter';
alter type public.communication_channel add value if not exists 'portal';
do $$
begin
  create type public.communication_status as enum ('draft', 'queued', 'sent', 'failed', 'canceled');
exception
  when duplicate_object then null;
end $$;
alter type public.communication_status add value if not exists 'draft';
alter type public.communication_status add value if not exists 'queued';
alter type public.communication_status add value if not exists 'sent';
alter type public.communication_status add value if not exists 'failed';
alter type public.communication_status add value if not exists 'canceled';
create table if not exists public.communication_messages (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid,
  association_id uuid references public.associations(id) on delete set null,
  calendar_event_id uuid,
  violation_id uuid,
  channel public.communication_channel not null default 'email',
  status public.communication_status not null default 'draft',
  recipient_group text not null default 'management_office',
  recipient_name text,
  recipient_email text,
  recipient_phone text,
  subject text,
  body text not null,
  provider_message_id text,
  error_message text,
  queued_at timestamptz,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.automation_tasks (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid,
  association_id uuid references public.associations(id) on delete set null,
  calendar_event_id uuid,
  violation_id uuid,
  task_type text not null,
  title text not null,
  description text,
  assigned_to uuid,
  due_at timestamptz,
  status text not null default 'open',
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.calendar_event_reminders (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid,
  association_id uuid references public.associations(id) on delete set null,
  calendar_event_id uuid,
  offset_minutes integer not null,
  remind_at timestamptz not null,
  recipient_group text not null,
  action text not null,
  status text not null default 'scheduled',
  communication_message_id uuid references public.communication_messages(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table if exists public.calendar_events
  add column if not exists building_id uuid,
  add column if not exists unit_id uuid,
  add column if not exists vendor_id uuid,
  add column if not exists owner_id uuid,
  add column if not exists resident_id uuid,
  add column if not exists internal_notes text,
  add column if not exists public_notice_text text,
  add column if not exists notification_recipients jsonb not null default '[]'::jsonb,
  add column if not exists reminder_rules jsonb not null default '[]'::jsonb,
  add column if not exists operations_status text not null default 'scheduled';
alter table if exists public.violations
  add column if not exists governing_document_reference text,
  add column if not exists notice_sent_at timestamptz,
  add column if not exists cure_deadline date,
  add column if not exists hearing_required boolean not null default false,
  add column if not exists hearing_at timestamptz,
  add column if not exists board_decision text,
  add column if not exists dispute_status text,
  add column if not exists owner_visible_history jsonb not null default '[]'::jsonb,
  add column if not exists communication_log jsonb not null default '[]'::jsonb;
update public.calendar_events
set notification_recipients = '[]'::jsonb
where notification_recipients is null;
update public.calendar_events
set reminder_rules = '[]'::jsonb
where reminder_rules is null;
update public.calendar_events
set operations_status = 'scheduled'
where operations_status is null;
alter table public.calendar_events
  alter column notification_recipients set default '[]'::jsonb,
  alter column notification_recipients set not null,
  alter column reminder_rules set default '[]'::jsonb,
  alter column reminder_rules set not null,
  alter column operations_status set default 'scheduled',
  alter column operations_status set not null;
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'association_amenities'
  ) then
    alter table public.association_amenities
      add column if not exists image_url text,
      add column if not exists description_html text,
      add column if not exists opens_at time,
      add column if not exists closes_at time,
      add column if not exists allow_reservations boolean not null default false,
      add column if not exists pricing_mode public.amenity_pricing_mode,
      add column if not exists price_amount numeric(10, 2),
      add column if not exists reserve_method public.amenity_reserve_method,
      add column if not exists reservation_email text,
      add column if not exists reservation_url text;
  end if;
end $$;
create index if not exists idx_communication_messages_association_created
  on public.communication_messages(association_id, created_at desc);
create index if not exists idx_communication_messages_status
  on public.communication_messages(status, channel);
create index if not exists idx_calendar_event_reminders_due
  on public.calendar_event_reminders(status, remind_at);
create index if not exists idx_automation_tasks_due
  on public.automation_tasks(status, due_at);
alter table public.communication_messages enable row level security;
alter table public.calendar_event_reminders enable row level security;
alter table public.automation_tasks enable row level security;
drop policy if exists "staff can read communication messages" on public.communication_messages;
create policy "staff can read communication messages"
  on public.communication_messages for select
  using (
    association_id is null
    or public.can_access_association(association_id)
  );
drop policy if exists "staff can manage communication messages" on public.communication_messages;
create policy "staff can manage communication messages"
  on public.communication_messages for all
  using (
    association_id is null
    or public.can_access_association(association_id)
  )
  with check (
    association_id is null
    or public.can_access_association(association_id)
  );
drop policy if exists "staff can read calendar reminders" on public.calendar_event_reminders;
create policy "staff can read calendar reminders"
  on public.calendar_event_reminders for select
  using (
    association_id is null
    or public.can_access_association(association_id)
  );
drop policy if exists "staff can manage calendar reminders" on public.calendar_event_reminders;
create policy "staff can manage calendar reminders"
  on public.calendar_event_reminders for all
  using (
    association_id is null
    or public.can_access_association(association_id)
  )
  with check (
    association_id is null
    or public.can_access_association(association_id)
  );
drop policy if exists "staff can read automation tasks" on public.automation_tasks;
create policy "staff can read automation tasks"
  on public.automation_tasks for select
  using (
    association_id is null
    or public.can_access_association(association_id)
  );
drop policy if exists "staff can manage automation tasks" on public.automation_tasks;
create policy "staff can manage automation tasks"
  on public.automation_tasks for all
  using (
    association_id is null
    or public.can_access_association(association_id)
  )
  with check (
    association_id is null
    or public.can_access_association(association_id)
  );
