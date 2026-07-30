-- Per-association maintenance contact for calendar-event notifications.
ALTER TABLE public.associations
  ADD COLUMN IF NOT EXISTS maintenance_contact_email text,
  ADD COLUMN IF NOT EXISTS maintenance_contact_name  text;

-- Per-event flags + instruction body. A worker picks up rows where
-- notify_maintenance = true AND maintenance_notified_at IS NULL and sends them.
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS notify_maintenance       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS maintenance_instructions text,
  ADD COLUMN IF NOT EXISTS maintenance_notified_at  timestamptz,
  ADD COLUMN IF NOT EXISTS maintenance_notify_error text;

-- Index so the worker query (pending notifications) is cheap.
CREATE INDEX IF NOT EXISTS idx_calendar_events_pending_notify
  ON public.calendar_events (notify_maintenance, maintenance_notified_at)
  WHERE notify_maintenance = true AND maintenance_notified_at IS NULL;

-- Webhook-style trigger stub: fires via dispatch_webhook if available.
-- If your portfolio hasn't configured the calendar_event_created webhook endpoint
-- yet, this is a no-op and the nightly worker still catches it via the index above.
CREATE OR REPLACE FUNCTION public.dispatch_calendar_maintenance_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.notify_maintenance = true AND NEW.maintenance_notified_at IS NULL THEN
    -- Best-effort: try to fan out via the existing webhook dispatcher.
    -- Silently swallows errors so a failed webhook doesn't block the insert.
    BEGIN
      PERFORM public.dispatch_webhook(
        'calendar.maintenance_notify',
        jsonb_build_object(
          'event_id',        NEW.id,
          'portfolio_id',    NEW.portfolio_id,
          'association_id',  NEW.association_id,
          'title',           NEW.title,
          'event_type',      NEW.event_type,
          'start_datetime',  NEW.start_datetime,
          'end_datetime',    NEW.end_datetime,
          'location',        NEW.location,
          'instructions',    NEW.maintenance_instructions
        )
      );
    EXCEPTION WHEN others THEN
      NEW.maintenance_notify_error := SQLERRM;
    END;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_calendar_maintenance_notify ON public.calendar_events;
CREATE TRIGGER trg_calendar_maintenance_notify
  AFTER INSERT OR UPDATE OF notify_maintenance, maintenance_instructions
  ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_calendar_maintenance_notify();;
