INSERT INTO public.calendar_events (
  portfolio_id, association_id, vendor_id, maintenance_task_id,
  title, event_type, calendar_scope,
  start_datetime, operations_status,
  notification_recipients, reminder_rules, created_by
)
SELECT
  'a1000000-0000-0000-0000-000000000001'::uuid,
  mt.association_id,
  mt.vendor_id,
  mt.id,
  '🔧 ' || mt.task_name,
  (CASE mt.category
    WHEN 'Safety' THEN 'inspection'
    WHEN 'Plumbing' THEN 'vendor_service'
    WHEN 'Exterior' THEN 'landscaping'
    WHEN 'Interior' THEN 'vendor_service'
    WHEN 'Grounds' THEN 'landscaping'
    WHEN 'HVAC' THEN 'vendor_service'
    WHEN 'Mechanical' THEN 'vendor_service'
    WHEN 'Electrical' THEN 'vendor_service'
    ELSE 'custom_event'
  END)::event_type,
  'daily',
  (COALESCE(mt.next_due_date, mt.start_date) || 'T09:00:00')::timestamptz,
  'scheduled',
  '["management_office"]'::jsonb,
  '[{"minutes_before": 10080, "actions": ["notify_management_office"]}]'::jsonb,
  '11111111-1111-1111-1111-111111111111'::uuid
FROM public.maintenance_tasks mt
WHERE mt.archived_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.calendar_events ce
    WHERE ce.maintenance_task_id = mt.id AND ce.archived_at IS NULL
  );
