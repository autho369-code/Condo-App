/**
 * GET /api/work-orders/notify-recurring
 * Called daily by cron, after the database's nightly recurring generator
 * (generate_recurring_work_orders, pg_cron 11:30 UTC). That generator creates
 * work orders already assigned to the plan's vendor but can't send email, so
 * this emails each vendor its new recurring jobs with the same white-labeled
 * assignment email staff assignment sends.
 *
 * Nightly jobs are the ones whose service request has source 'recurring'
 * ("Generate now" creates none and emails the vendor itself). Every
 * assignment email (staff, bulk, new work order, Generate now and this cron)
 * stamps vendor_notified_at, and only unstamped jobs from the last week are
 * read (a missed run catches up). Each job is emailed under its own fixed
 * key, so a run that stops after queueing, or whose stamp fails, queues
 * nothing twice on the next run (email_queue ignores a repeated key).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireCronSecret } from '@/lib/server/cron-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { notifyVendorOfAssignment } from '@/lib/notifications/vendor-assignment';

export const dynamic = 'force-dynamic';

const WINDOW_DAYS = 7;

export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const svc = createServiceClient() as any;
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const { data, error } = await svc
    .from('work_orders')
    .select('id, vendor_id, service_requests!inner(source)')
    .eq('service_requests.source', 'recurring')
    // Still active: staff may schedule or start a job before this runs.
    .in('status', ['assigned', 'scheduled', 'in_progress'])
    .not('vendor_id', 'is', null)
    .is('vendor_notified_at', null)
    .is('archived_at', null)
    .gte('created_at', since)
    .limit(5000);
  if (error) {
    console.error('[notify-recurring] failed to read work orders:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let emailed = 0;
  for (const w of (data ?? []) as Array<{ id: string; vendor_id: string }>) {
    const queued = await notifyVendorOfAssignment({
      vendorId: w.vendor_id,
      workOrderIds: [w.id],
      idempotencyKey: `wo-vendor-assign:recurring:${w.id}`,
    });
    if (queued) emailed += 1;
  }
  const body = { workOrders: data?.length ?? 0, emailed };
  return NextResponse.json(body);
}
