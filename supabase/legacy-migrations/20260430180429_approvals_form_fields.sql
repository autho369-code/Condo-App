
DO $$ BEGIN
  CREATE TYPE voting_scheme AS ENUM (
    'majority_approval_required',
    'unanimous_approval_required',
    'any_one_approver',
    'percentage_required'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE approval_requests
  ADD COLUMN IF NOT EXISTS amount               numeric(12, 2),
  ADD COLUMN IF NOT EXISTS due_date             date,
  ADD COLUMN IF NOT EXISTS voting_scheme        voting_scheme NOT NULL DEFAULT 'majority_approval_required',
  ADD COLUMN IF NOT EXISTS signatures_required  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS board_member_ids     uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS percentage_required  smallint;

CREATE INDEX IF NOT EXISTS approval_requests_due_date_idx ON approval_requests(due_date);
