-- Statement Settings (page section near bottom of AppFolio's association detail)
ALTER TABLE public.associations
  ADD COLUMN IF NOT EXISTS use_enhanced_statement                         boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_current_and_upcoming_charges            boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_upcoming_in_amount_due                  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS upcoming_charges_timeframe                      text    NOT NULL DEFAULT 'next_month',
  ADD COLUMN IF NOT EXISTS include_current_message_on_statement            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS include_logo_on_statement                       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS charge_history_includes                         text    NOT NULL DEFAULT 'all_past_due_charges',
  ADD COLUMN IF NOT EXISTS include_payments_due_date                       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS include_payments_history_and_balance_forward    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_remaining_amount_for_past_due_charges      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS include_payment_coupon_on_statement             boolean NOT NULL DEFAULT false,

  -- Maintenance information extras not already captured
  ADD COLUMN IF NOT EXISTS disable_online_maintenance_requests             boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS maintenance_phone                               text,

  -- Terms & conditions for electronic document delivery
  ADD COLUMN IF NOT EXISTS electronic_doc_delivery_terms                   text,

  -- Violation follow-up communication settings
  ADD COLUMN IF NOT EXISTS violation_sender_name                           text,
  ADD COLUMN IF NOT EXISTS violation_sender_email_uses_logged_in_user      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS violation_sender_email                          text;

-- Keys tracked per association (master keys, fobs, etc.)
CREATE TABLE IF NOT EXISTS public.association_keys (
  id              uuid primary key default gen_random_uuid(),
  association_id  uuid not null references public.associations(id) on delete cascade,
  label           text not null,
  key_number      text,
  held_by         text,
  notes           text,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz
);
CREATE INDEX IF NOT EXISTS idx_association_keys_assoc ON public.association_keys (association_id) WHERE archived_at IS NULL;
ALTER TABLE public.association_keys ENABLE ROW LEVEL SECURITY;

-- Violation follow-up schedule rows (one row per step in the dunning cadence)
CREATE TABLE IF NOT EXISTS public.violation_followup_steps (
  id                   uuid primary key default gen_random_uuid(),
  association_id       uuid not null references public.associations(id) on delete cascade,
  step_order           int not null default 1,
  days_after_previous  int not null default 15,
  follow_up_name       text not null,
  letter_template_id   uuid references public.document_templates(id),
  delivery_methods     text[] default '{email}',
  fee                  numeric,
  gl_account_id        uuid references public.gl_accounts(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  archived_at          timestamptz
);
CREATE INDEX IF NOT EXISTS idx_violation_followup_assoc ON public.violation_followup_steps (association_id, step_order) WHERE archived_at IS NULL;
ALTER TABLE public.violation_followup_steps ENABLE ROW LEVEL SECURITY;

-- Association notes (internal notes with timestamps + author)
CREATE TABLE IF NOT EXISTS public.association_notes (
  id              uuid primary key default gen_random_uuid(),
  association_id  uuid not null references public.associations(id) on delete cascade,
  is_standard     boolean NOT NULL DEFAULT false,
  body            text    NOT NULL,
  created_by      uuid,
  created_at      timestamptz NOT NULL default now(),
  archived_at     timestamptz
);
CREATE INDEX IF NOT EXISTS idx_association_notes_assoc ON public.association_notes (association_id, created_at DESC) WHERE archived_at IS NULL;
ALTER TABLE public.association_notes ENABLE ROW LEVEL SECURITY;

-- Association photo / attachment folders (files live in storage; we track metadata)
CREATE TABLE IF NOT EXISTS public.association_attachments (
  id              uuid primary key default gen_random_uuid(),
  association_id  uuid not null references public.associations(id) on delete cascade,
  folder          text,
  file_name       text    NOT NULL,
  storage_path    text    NOT NULL,
  byte_size       bigint,
  content_type    text,
  uploaded_by     uuid,
  shared_with_homeowner boolean NOT NULL default false,
  created_at      timestamptz NOT NULL default now(),
  archived_at     timestamptz
);
CREATE INDEX IF NOT EXISTS idx_association_attachments_assoc ON public.association_attachments (association_id, folder, created_at DESC) WHERE archived_at IS NULL;
ALTER TABLE public.association_attachments ENABLE ROW LEVEL SECURITY;;
