/**
 * GET /api/billing/assess-interest
 * Daily cron. Posts monthly interest on delinquent balances for every
 * association whose posting day is today (assess_association_interest:
 * simple interest on overdue principal, never compounding, one per unit per
 * month). Service role only; authenticated by the cron secret.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireCronSecret } from '@/lib/server/cron-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;
  const svc = createServiceClient() as any;
  const { data, error } = await svc.rpc('assess_association_interest', { p_as_of: new Date().toISOString().slice(0, 10) });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ...data });
}
