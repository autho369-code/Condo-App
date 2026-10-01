import 'server-only';
import { redirect } from 'next/navigation';
import { DEFAULT_TIME_ZONE, wallDateTimeToIso } from '@/lib/time/zoned';
import type { CalendarEventType } from '@/lib/operations/calendar';

// Map maintenance categories to calendar event types
export const MAINTENANCE_CATEGORY_EVENT_TYPE: Record<string, CalendarEventType> = {
  Safety: 'inspection', Plumbing: 'vendor_service', Exterior: 'landscaping',
  Interior: 'vendor_service', Grounds: 'landscaping', HVAC: 'vendor_service',
  Mechanical: 'vendor_service', Electrical: 'vendor_service',
  Operations: 'custom_event', Other: 'custom_event',
};

export async function associationZone(db: any, assocId: string | null): Promise<string> {
  if (!assocId) return DEFAULT_TIME_ZONE;
  const { data } = await db.from('associations').select('timezone').eq('id', assocId).maybeSingle();
  return data?.timezone || DEFAULT_TIME_ZONE;
}

export async function syncMaintenanceCalendarEvent(
  db: any, portfolioId: string, taskId: string, assocId: string | null, vendorId: string | null,
  title: string, category: string, dueDate: string, endDate: string | null,
  notes: string | null, createdBy: string | null
) {
  const eventType = MAINTENANCE_CATEGORY_EVENT_TYPE[category] || 'custom_event';
  // 9 AM-5 PM in the association's time zone (raw "T09:00" strings were read
  // as UTC: 4 AM Central).
  const zone = await associationZone(db, assocId);
  const start = (dueDate ? wallDateTimeToIso(`${dueDate}T09:00`, zone) : null) ?? new Date().toISOString();
  const end = endDate ? wallDateTimeToIso(`${endDate}T17:00`, zone) : null;
  const { error } = await db.from('calendar_events').insert({
    portfolio_id: portfolioId,
    association_id: assocId, vendor_id: vendorId,
    maintenance_task_id: taskId,
    title: `🔧 ${title}`, event_type: eventType,
    calendar_scope: 'daily',
    start_datetime: start, end_datetime: end,
    location: null, description: notes?.slice(0,200) || null,
    operations_status: 'scheduled',
    notification_recipients: ['management_office'],
    reminder_rules: [{ minutes_before: 10080, actions: ['notify_management_office'] }],
    created_by: createdBy,
  });
  if (error) redirect(`/maintenance?tab=tasks&error=${encodeURIComponent(`The task was saved, but its calendar event could not be created: ${error.message}`)}`);
}

