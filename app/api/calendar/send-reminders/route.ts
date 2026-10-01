/**
 * GET /api/calendar/send-reminders
 * Cron: emails calendar event reminders that are due (see
 * lib/calendar/reminder-delivery.ts). Protected by CRON_SECRET.
 */
import { NextRequest, NextResponse } from 'next/server';
import { deliverDueCalendarReminders } from '@/lib/calendar/reminder-delivery';
import { requireCronSecret } from '@/lib/server/cron-auth';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;
  try {
    const summary = await deliverDueCalendarReminders(createServiceClient() as any);
    return NextResponse.json(summary);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Reminder delivery failed' }, { status: 500 });
  }
}
