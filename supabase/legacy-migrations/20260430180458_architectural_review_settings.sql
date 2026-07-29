
CREATE TABLE IF NOT EXISTS architectural_review_settings (
  association_id uuid PRIMARY KEY REFERENCES associations(id) ON DELETE CASCADE,
  online_requests_disabled boolean NOT NULL DEFAULT false,
  default_committee_id uuid REFERENCES committees(id),
  default_approver_scope text NOT NULL DEFAULT 'all' CHECK (default_approver_scope IN ('all', 'select')),
  default_approver_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  default_voting_scheme voting_scheme NOT NULL DEFAULT 'majority_approval_required',
  default_percentage_required smallint,
  portal_homepage_html text,
  submission_form_html text,
  document_upload_html text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE architectural_review_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS arch_settings_select ON architectural_review_settings;
CREATE POLICY arch_settings_select ON architectural_review_settings FOR SELECT USING (
  EXISTS (SELECT 1 FROM associations a WHERE a.id = architectural_review_settings.association_id
          AND (a.portfolio_id = current_portfolio_id() OR is_platform_operator()))
);

DROP POLICY IF EXISTS arch_settings_write ON architectural_review_settings;
CREATE POLICY arch_settings_write ON architectural_review_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM associations a WHERE a.id = architectural_review_settings.association_id
          AND a.portfolio_id = current_portfolio_id())
  AND is_full_access_staff()
);
