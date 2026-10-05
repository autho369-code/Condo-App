/**
 * GET /api/billing/run-management-fees
 * Daily cron. For every company that scheduled management fees, bills last
 * month's fee for each association with a fee policy once the company's chosen
 * day arrives (run_scheduled_management_fees: one fee per association per
 * month, never double-billed; failures are recorded on the company and retried
 * the next day). Service role only; authenticated by the cron secret.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireCronSecret } from '@/lib/server/cron-auth';
import { todayInZone } from '@/lib/time/zoned';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;
  const svc = createServiceClient() as any;
  const { data, error } = await svc.rpc('run_scheduled_management_fees', { p_today: todayInZone() });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ...data });
}
