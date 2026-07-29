-- Scope lets us distinguish the two calendars:
--   'daily'  — operational events (elevator, move, water shutoff, vendor work)
--   'annual' — preventive maintenance & inspections (fire pump, roof, elevator, etc.)
DO $$ BEGIN
  CREATE TYPE calendar_scope AS ENUM ('daily', 'annual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS calendar_scope calendar_scope NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS reminder_days_before     smallint
    CHECK (reminder_days_before IS NULL OR (reminder_days_before BETWEEN 1 AND 30)),
  ADD COLUMN IF NOT EXISTS reminder_triggered_at    timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_acknowledged_by uuid REFERENCES auth.users(id);

-- Index so the dashboard reminder query is cheap
CREATE INDEX IF NOT EXISTS idx_calendar_events_due_reminders
  ON public.calendar_events (start_datetime, reminder_days_before, reminder_acknowledged_at)
  WHERE reminder_days_before IS NOT NULL AND reminder_acknowledged_at IS NULL;

-- View: "due reminders" — events whose reminder window is open (start_datetime
-- minus reminder_days_before is <= now()) and manager hasn't dismissed yet.
CREATE OR REPLACE VIEW public.v_due_reminders AS
  SELECT
    ce.id                     AS event_id,
    ce.portfolio_id,
    ce.association_id,
    a.name                    AS association_name,
    ce.title,
    ce.event_type,
    ce.calendar_scope,
    ce.start_datetime,
    ce.reminder_days_before,
    (ce.start_datetime - (ce.reminder_days_before || ' days')::interval) AS reminder_start,
    ce.location,
    ce.description
  FROM public.calendar_events ce
  LEFT JOIN public.associations a ON a.id = ce.association_id
  WHERE ce.archived_at IS NULL
    AND ce.reminder_days_before IS NOT NULL
    AND ce.reminder_acknowledged_at IS NULL
    AND now() >= (ce.start_datetime - (ce.reminder_days_before || ' days')::interval)
    AND now() <= ce.start_datetime;;
