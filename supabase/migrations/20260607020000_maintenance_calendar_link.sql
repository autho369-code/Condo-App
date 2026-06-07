-- Backfill calendar_events for existing maintenance tasks
INSERT INTO public.calendar_events (
  portfolio_id, association_id, vendor_id, maintenance_task_id,
  title, event_type, calendar_scope,
  start_datetime, operations_status,
  notification_recipients, reminder_rules, created_by
)
SELECT
  'a1000000-0000-0000-0000-000000000001'::uuid AS portfolio_id,
  mt.association_id,
  mt.vendor_id,
  mt.id AS maintenance_task_id,
  '🔧 ' || mt.task_name AS title,
  CASE mt.category
    WHEN 'Safety' THEN 'inspection'::public.calendar_event_type
    WHEN 'Plumbing' THEN 'vendor_service'::public.calendar_event_type
    WHEN 'Exterior' THEN 'landscaping'::public.calendar_event_type
    WHEN 'Interior' THEN 'vendor_service'::public.calendar_event_type
    WHEN 'Grounds' THEN 'landscaping'::public.calendar_event_type
    WHEN 'HVAC' THEN 'vendor_service'::public.calendar_event_type
    WHEN 'Mechanical' THEN 'vendor_service'::public.calendar_event_type
    WHEN 'Electrical' THEN 'vendor_service'::public.calendar_event_type
    ELSE 'custom_event'::public.calendar_event_type
  END AS event_type,
  'daily'::public.calendar_event_scope AS calendar_scope,
  (COALESCE(mt.next_due_date, mt.start_date) || 'T09:00:00')::timestamptz AS start_datetime,
  'scheduled' AS operations_status,
  '["management_office"]'::jsonb AS notification_recipients,
  '[{"minutes_before": 10080, "actions": ["notify_management_office"]}]'::jsonb AS reminder_rules,
  '11111111-1111-1111-1111-111111111111'::uuid AS created_by
FROM public.maintenance_tasks mt
WHERE mt.archived_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.calendar_events ce
    WHERE ce.maintenance_task_id = mt.id AND ce.archived_at IS NULL
  );
