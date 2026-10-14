/**
 * GET /api/work-orders/notify-recurring
 * Called daily by cron, after the database's nightly recurring generator
 * (generate_recurring_work_orders, pg_cron 11:30 UTC). That generator creates
 * work orders already assigned to the plan's vendor but can't send email, so
 * this emails each vendor its new recurring jobs with the same white-labeled
 * assignment email staff assignment sends.
 *
 * Nightly jobs are the ones whose service request has source 'recurring'
 * ("Generate now" creates none and emails the vendor itself). Each job is
 * emailed at most once: a run first claims its jobs by stamping
 * vendor_notified_at where it is still empty (so overlapping runs can't both
 * send), emails only what it claimed, and clears the stamp again when no
 * email was queued so the next run retries. Only unstamped jobs from the
 * last week are read (a missed run catches up).
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

  const byVendor = new Map<string, string[]>();
  for (const w of (data ?? []) as Array<{ id: string; vendor_id: string }>) {
    byVendor.set(w.vendor_id, [...(byVendor.get(w.vendor_id) ?? []), w.id]);
  }

  let emailed = 0;
  let failed = 0;
  for (const [vendorId, workOrderIds] of byVendor) {
    const { data: claimed, error: claimError } = await svc
      .from('work_orders')
      .update({ vendor_notified_at: new Date().toISOString() })
      .in('id', workOrderIds)
      .is('vendor_notified_at', null)
      .select('id');
    if (claimError) {
      console.error('[notify-recurring] failed to claim jobs:', vendorId, claimError.message);
      failed += 1;
      continue;
    }
    const ids = ((claimed ?? []) as Array<{ id: string }>).map((r) => r.id);
    if (ids.length === 0) continue;
    if (await notifyVendorOfAssignment({ vendorId, workOrderIds: ids })) {
      emailed += 1;
      continue;
    }
    // Nothing was queued (no email on file, or the queue refused): let the
    // next run try again.
    const { error: releaseError } = await svc
      .from('work_orders')
      .update({ vendor_notified_at: null })
      .in('id', ids);
    if (releaseError) console.error('[notify-recurring] failed to release jobs:', vendorId, releaseError.message);
  }
  const body = { workOrders: data?.length ?? 0, vendors: byVendor.size, emailed, failed };
  return NextResponse.json(body, { status: failed > 0 ? 500 : 200 });
}
