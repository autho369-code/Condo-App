
ALTER TABLE board_members
  ADD COLUMN IF NOT EXISTS signature_on_file boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signature_url     text;
