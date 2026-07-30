-- Missing columns visible on AppFolio's association detail page
ALTER TABLE public.associations
  ADD COLUMN IF NOT EXISTS description                           text,
  ADD COLUMN IF NOT EXISTS site_manager                          text,
  ADD COLUMN IF NOT EXISTS payment_frequency                     text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS homeowner_can_override_frequency      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS management_start_date                 date,
  ADD COLUMN IF NOT EXISTS management_end_date                   date,
  ADD COLUMN IF NOT EXISTS management_end_reason                 text,
  ADD COLUMN IF NOT EXISTS hide_calendar_in_portal               boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disable_contacts_editing_in_portal    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disable_renter_editing_in_portal      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS residents_check_fee_coverage_enabled  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS property_type                         text DEFAULT 'HOA',
  ADD COLUMN IF NOT EXISTS county                                text,
  ADD COLUMN IF NOT EXISTS amenities                             jsonb DEFAULT '[]'::jsonb,
  -- Interest info
  ADD COLUMN IF NOT EXISTS interest_grace_days                   integer DEFAULT 15,
  ADD COLUMN IF NOT EXISTS interest_post_day_of_month            integer DEFAULT 15,
  ADD COLUMN IF NOT EXISTS interest_grace_balance                numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS annual_interest_rate                  numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interest_income_gl_account_id         uuid REFERENCES public.gl_accounts(id);

-- Management fees policies (history of management fee amounts per association)
CREATE TABLE IF NOT EXISTS public.management_fee_policies (
  id              uuid primary key default gen_random_uuid(),
  association_id  uuid not null references public.associations(id) on delete cascade,
  effective_from  date not null,
  effective_to    date,
  fee_type        text not null default 'management_fee',
  amount          numeric not null,
  notes           text,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS idx_mgmt_fee_policies_assoc ON public.management_fee_policies (association_id, effective_from DESC);
ALTER TABLE public.management_fee_policies ENABLE ROW LEVEL SECURITY;

-- Additional fees (per-association add-ons like late fee income, interest income, etc.)
CREATE TABLE IF NOT EXISTS public.association_additional_fees (
  id              uuid primary key default gen_random_uuid(),
  association_id  uuid not null references public.associations(id) on delete cascade,
  gl_account_id   uuid references public.gl_accounts(id),
  label           text,
  percentage      numeric,
  amount          numeric,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
ALTER TABLE public.association_additional_fees ENABLE ROW LEVEL SECURITY;;
