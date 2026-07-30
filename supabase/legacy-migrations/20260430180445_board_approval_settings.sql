
CREATE TABLE IF NOT EXISTS board_approval_settings (
  association_id uuid PRIMARY KEY REFERENCES associations(id) ON DELETE CASCADE,
  signatures_required boolean NOT NULL DEFAULT true,
  default_board_member_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  default_voting_scheme voting_scheme NOT NULL DEFAULT 'majority_approval_required',
  default_percentage_required smallint,
  sends_bills_to_board text NOT NULL DEFAULT 'never' CHECK (sends_bills_to_board IN ('never','always','over_threshold')),
  bills_threshold numeric(12, 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE board_approval_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS board_approval_settings_select ON board_approval_settings;
CREATE POLICY board_approval_settings_select ON board_approval_settings FOR SELECT USING (
  EXISTS (SELECT 1 FROM associations a WHERE a.id = board_approval_settings.association_id
          AND (a.portfolio_id = current_portfolio_id() OR is_platform_operator()))
);

DROP POLICY IF EXISTS board_approval_settings_write ON board_approval_settings;
CREATE POLICY board_approval_settings_write ON board_approval_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM associations a WHERE a.id = board_approval_settings.association_id
          AND a.portfolio_id = current_portfolio_id())
  AND is_full_access_staff()
);
