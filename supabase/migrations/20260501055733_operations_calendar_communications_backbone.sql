create extension if not exists pgcrypto;

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

do $$
begin
  create type public.communication_channel as enum ('email', 'sms', 'print', 'portal');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.communication_status as enum ('draft', 'queued', 'sent', 'failed', 'canceled');
exception
  when duplicate_object then null;
end $$;

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
