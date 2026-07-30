
-- Enums
DO $$ BEGIN
  CREATE TYPE lease_generation_method AS ENUM ('appfolio_lease_templates', 'pdf_form_templates');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE rent_change_kind AS ENUM ('dollar_amount', 'percentage');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE lease_template_slot AS ENUM (
    'new_lease',
    'renewal',
    'renewal_month_to_month'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Gap 1, 2, 3, 4: extend associations
ALTER TABLE associations
  ADD COLUMN IF NOT EXISTS lease_fee_type    text CHECK (lease_fee_type   IN ('flat','percent')),
  ADD COLUMN IF NOT EXISTS lease_fee_pct     numeric(6, 3),
  ADD COLUMN IF NOT EXISTS lease_fee_amount  numeric(10, 2),
  ADD COLUMN IF NOT EXISTS renewal_fee_type  text CHECK (renewal_fee_type IN ('flat','percent')),
  ADD COLUMN IF NOT EXISTS renewal_fee_pct   numeric(6, 3),
  ADD COLUMN IF NOT EXISTS renewal_fee_amount numeric(10, 2),
  ADD COLUMN IF NOT EXISTS late_fee_grace_day_of_following_month smallint
    CHECK (late_fee_grace_day_of_following_month BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS site_manager_first_name text,
  ADD COLUMN IF NOT EXISTS site_manager_last_name  text,
  ADD COLUMN IF NOT EXISTS site_manager_user_id    uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS lease_generation_method lease_generation_method
    NOT NULL DEFAULT 'appfolio_lease_templates',
  ADD COLUMN IF NOT EXISTS rent_change_kind rent_change_kind NOT NULL DEFAULT 'dollar_amount',
  ADD COLUMN IF NOT EXISTS default_renewal_letter_template_id uuid REFERENCES document_templates(id);

-- Gap 5: lease template settings
CREATE TABLE IF NOT EXISTS association_lease_template_settings (
  association_id uuid NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  slot lease_template_slot NOT NULL,
  primary_template_id uuid REFERENCES document_templates(id),
  addenda_template_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  attachment_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (association_id, slot)
);

ALTER TABLE association_lease_template_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alts_select ON association_lease_template_settings;
CREATE POLICY alts_select ON association_lease_template_settings FOR SELECT USING (
  EXISTS (SELECT 1 FROM associations a WHERE a.id = association_lease_template_settings.association_id
          AND (a.portfolio_id = current_portfolio_id() OR is_platform_operator()))
);
DROP POLICY IF EXISTS alts_write ON association_lease_template_settings;
CREATE POLICY alts_write ON association_lease_template_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM associations a WHERE a.id = association_lease_template_settings.association_id
          AND a.portfolio_id = current_portfolio_id())
  AND is_full_access_staff()
);

-- Gap 6: renewal options grid
CREATE TABLE IF NOT EXISTS association_renewal_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  term_months smallint NOT NULL CHECK (term_months > 0),
  change_amount numeric(10, 2) NOT NULL DEFAULT 0,
  additional_fee numeric(10, 2) NOT NULL DEFAULT 0,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS aro_assoc_idx ON association_renewal_options(association_id, sort_order);

ALTER TABLE association_renewal_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aro_select ON association_renewal_options;
CREATE POLICY aro_select ON association_renewal_options FOR SELECT USING (
  EXISTS (SELECT 1 FROM associations a WHERE a.id = association_renewal_options.association_id
          AND (a.portfolio_id = current_portfolio_id() OR is_platform_operator()))
);
DROP POLICY IF EXISTS aro_write ON association_renewal_options;
CREATE POLICY aro_write ON association_renewal_options FOR ALL USING (
  EXISTS (SELECT 1 FROM associations a WHERE a.id = association_renewal_options.association_id
          AND a.portfolio_id = current_portfolio_id())
  AND is_full_access_staff()
);
