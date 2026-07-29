-- =============================================================================
-- AppFolio buildout — Phase 4: Communication
--   • document_templates (letters, merge fields)
--   • form_templates (PDF forms)
--   • sms_conversations + sms_messages (texting inbox)
--   • communication_triggers (auto-communication rules)
--   • Extend notices with template_id
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enums
-- -----------------------------------------------------------------------------
create type public.template_category as enum (
  'association', 'owner', 'vendor', 'applicant', 'statement', 'generic'
);
create type public.communication_channel as enum ('email', 'sms', 'letter', 'portal');
create type public.sms_direction as enum ('inbound', 'outbound');
create type public.sms_status as enum ('queued', 'sent', 'delivered', 'failed', 'read', 'undelivered');

-- -----------------------------------------------------------------------------
-- 2. document_templates (letters)
-- -----------------------------------------------------------------------------
create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  letter_type text,
  template_category public.template_category not null default 'generic',
  subject text,
  body text not null,
  merge_variables jsonb not null default '[]'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index idx_doc_templates_portfolio on public.document_templates(portfolio_id) where active;
create index idx_doc_templates_category on public.document_templates(template_category) where active;
create trigger trg_doc_templates_updated before update on public.document_templates
  for each row execute function public.touch_updated_at();

alter table public.document_templates enable row level security;
create policy doc_templates_manager_all on public.document_templates
  for all to public using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- 3. form_templates (PDF form templates)
-- -----------------------------------------------------------------------------
create table public.form_templates (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  description text,
  form_type text,
  file_url text,
  field_definitions jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_form_templates_portfolio on public.form_templates(portfolio_id) where active;
create trigger trg_form_templates_updated before update on public.form_templates
  for each row execute function public.touch_updated_at();

alter table public.form_templates enable row level security;
create policy form_templates_manager_all on public.form_templates
  for all to public using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- 4. sms_conversations (texting inbox threads)
-- -----------------------------------------------------------------------------
create table public.sms_conversations (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid references public.associations(id) on delete set null,
  with_entity_type text,
  with_entity_id uuid,
  with_name text,
  with_phone_number text not null,
  our_phone_number text,
  last_message_at timestamptz,
  last_message_preview text,
  unread_count integer not null default 0 check (unread_count >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_sms_conversations_portfolio on public.sms_conversations(portfolio_id) where archived_at is null;
create index idx_sms_conversations_phone on public.sms_conversations(with_phone_number);
create index idx_sms_conversations_entity on public.sms_conversations(with_entity_type, with_entity_id);
create index idx_sms_conversations_last_msg on public.sms_conversations(last_message_at desc nulls last) where archived_at is null;
create trigger trg_sms_conversations_updated before update on public.sms_conversations
  for each row execute function public.touch_updated_at();

alter table public.sms_conversations enable row level security;
create policy sms_conversations_manager_all on public.sms_conversations
  for all to public using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- 5. sms_messages
-- -----------------------------------------------------------------------------
create table public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.sms_conversations(id) on delete cascade,
  direction public.sms_direction not null,
  body text,
  media_urls jsonb not null default '[]'::jsonb,
  from_number text not null,
  to_number text not null,
  provider text,
  provider_message_id text,
  status public.sms_status not null default 'queued',
  error_code text,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  sent_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_sms_messages_conversation on public.sms_messages(conversation_id, created_at);
create index idx_sms_messages_status on public.sms_messages(status) where status in ('queued','failed');
create index idx_sms_messages_provider_id on public.sms_messages(provider_message_id);
create trigger trg_sms_messages_updated before update on public.sms_messages
  for each row execute function public.touch_updated_at();

alter table public.sms_messages enable row level security;
create policy sms_messages_manager_all on public.sms_messages
  for all to public using (public.is_manager()) with check (public.is_manager());

-- Keep conversation metadata in sync when messages arrive
create or replace function public.sync_sms_conversation_on_message()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
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
create trigger trg_sms_messages_sync_conversation
  after insert on public.sms_messages
  for each row execute function public.sync_sms_conversation_on_message();

-- -----------------------------------------------------------------------------
-- 6. communication_triggers (auto-communication rules)
-- -----------------------------------------------------------------------------
create table public.communication_triggers (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid references public.associations(id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  description text,
  trigger_event text not null,
  delay_days integer not null default 0 check (delay_days >= 0),
  template_id uuid references public.document_templates(id) on delete set null,
  channel public.communication_channel not null default 'email',
  recipient_rule text,
  active boolean not null default true,
  last_fired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index idx_comm_triggers_portfolio on public.communication_triggers(portfolio_id) where active;
create index idx_comm_triggers_event on public.communication_triggers(trigger_event) where active;
create index idx_comm_triggers_template on public.communication_triggers(template_id);
create trigger trg_comm_triggers_updated before update on public.communication_triggers
  for each row execute function public.touch_updated_at();

alter table public.communication_triggers enable row level security;
create policy comm_triggers_manager_all on public.communication_triggers
  for all to public using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- 7. Extend notices with template_id
-- -----------------------------------------------------------------------------
alter table public.notices
  add column template_id uuid references public.document_templates(id) on delete set null,
  add column channel public.communication_channel not null default 'email';
create index idx_notices_template on public.notices(template_id);

-- Extend email_queue with template link for traceability
alter table public.email_queue
  add column template_id uuid references public.document_templates(id) on delete set null,
  add column notice_id uuid references public.notices(id) on delete set null;
create index idx_email_queue_template on public.email_queue(template_id);
create index idx_email_queue_notice on public.email_queue(notice_id);

-- -----------------------------------------------------------------------------
-- 8. Comments
-- -----------------------------------------------------------------------------
comment on table public.document_templates is 'Reusable letter/email templates with merge fields. See merge_variables for field metadata.';
comment on column public.document_templates.merge_variables is 'Array of {name, label, default} describing supported merge tags in body.';
comment on table public.sms_conversations is 'Threaded texting inbox — one row per thread. with_entity_type + with_entity_id point at owner/vendor/staff; phone_number is the authoritative matcher.';
comment on column public.communication_triggers.trigger_event is 'String-typed event name (e.g., payment_due, payment_late, work_order_completed). Application code fires triggers by matching this value.';
comment on column public.communication_triggers.recipient_rule is 'SQL expression or name referencing application logic that resolves who receives the communication.';
;
