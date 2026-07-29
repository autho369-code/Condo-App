-- Per-association maintenance SMS contact
ALTER TABLE public.associations
  ADD COLUMN IF NOT EXISTS maintenance_contact_phone text;

-- Per-event SMS flags, mirroring the email flags
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS notify_sms         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_notified_at    timestamptz,
  ADD COLUMN IF NOT EXISTS sms_notify_error   text;

-- Index so a worker can cheaply find pending SMS
CREATE INDEX IF NOT EXISTS idx_calendar_events_pending_sms
  ON public.calendar_events (notify_sms, sms_notified_at)
  WHERE notify_sms = true AND sms_notified_at IS NULL;

-- Helper: queue an outbound SMS for a calendar event. Inserts into sms_messages
-- with status='queued' so whatever SMS worker/edge function the portfolio has
-- wired up will pick it up. Returns the message id.
CREATE OR REPLACE FUNCTION public.queue_calendar_sms(p_event_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  ev            RECORD;
  our_number    text;
  their_number  text;
  convo_id      uuid;
  msg_id        uuid;
  msg_body      text;
BEGIN
  SELECT ce.id, ce.title, ce.start_datetime, ce.location,
         ce.maintenance_instructions,
         a.id AS assoc_id, a.name AS assoc_name,
         a.maintenance_contact_phone, a.maintenance_contact_name,
         p.texting_phone_number
    INTO ev
  FROM public.calendar_events ce
  LEFT JOIN public.associations a ON a.id = ce.association_id
  LEFT JOIN public.portfolios p ON p.id = ce.portfolio_id
  WHERE ce.id = p_event_id;

  IF ev.maintenance_contact_phone IS NULL THEN
    UPDATE public.calendar_events SET sms_notify_error = 'No maintenance_contact_phone on association' WHERE id = p_event_id;
    RETURN NULL;
  END IF;

  our_number   := COALESCE(ev.texting_phone_number, '+10000000000');
  their_number := ev.maintenance_contact_phone;

  -- Find or create SMS conversation
  SELECT id INTO convo_id FROM public.sms_conversations
    WHERE with_phone_number = their_number AND our_phone_number = our_number
    LIMIT 1;
  IF convo_id IS NULL THEN
    INSERT INTO public.sms_conversations
      (portfolio_id, association_id, with_entity_type, with_entity_id, with_name, with_phone_number, our_phone_number)
    VALUES (
      (SELECT portfolio_id FROM public.calendar_events WHERE id = p_event_id),
      ev.assoc_id, 'maintenance', ev.assoc_id,
      COALESCE(ev.maintenance_contact_name, 'Maintenance'),
      their_number, our_number
    )
    RETURNING id INTO convo_id;
  END IF;

  msg_body := '[' || COALESCE(ev.assoc_name, 'Association') || '] ' || ev.title
              || E'\n' || to_char(ev.start_datetime, 'Mon DD, HH12:MIam')
              || CASE WHEN ev.location IS NOT NULL THEN ' @ ' || ev.location ELSE '' END
              || CASE WHEN ev.maintenance_instructions IS NOT NULL THEN E'\n' || ev.maintenance_instructions ELSE '' END;

  INSERT INTO public.sms_messages
    (conversation_id, direction, body, from_number, to_number, status, provider)
  VALUES
    (convo_id, 'outbound', msg_body, our_number, their_number, 'queued', 'pending')
  RETURNING id INTO msg_id;

  RETURN msg_id;
END;
$$;

-- Trigger: after a calendar event is inserted/updated with notify_sms=true,
-- queue the SMS message. Errors go into sms_notify_error so they don't block the insert.
CREATE OR REPLACE FUNCTION public.dispatch_calendar_sms_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.notify_sms = true AND NEW.sms_notified_at IS NULL THEN
    BEGIN
      PERFORM public.queue_calendar_sms(NEW.id);
    EXCEPTION WHEN others THEN
      NEW.sms_notify_error := SQLERRM;
    END;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_calendar_sms_notify ON public.calendar_events;
CREATE TRIGGER trg_calendar_sms_notify
  AFTER INSERT OR UPDATE OF notify_sms, maintenance_instructions
  ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_calendar_sms_notify();;
