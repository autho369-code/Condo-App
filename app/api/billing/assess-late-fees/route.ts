/**
 * GET /api/billing/assess-late-fees
 * Daily cron. For every association with late fees on, posts a late fee on
 * each unpaid dues charge (charge_type 'assessment') that is past
 * due_date + late_fee_grace_days and has no late_fee_assessments row yet.
 * The whole run happens in cron_assess_late_fees() (no 1,000-row API cap);
 * each charge goes through assess_late_fee(), which re-validates every rule
 * and records the assessment in the same transaction (one fee per charge).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireCronSecret } from '@/lib/server/cron-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const svc = createServiceClient() as any;
  const { data, error } = await svc.rpc('cron_assess_late_fees');
  if (error) {
    console.error('[assess-late-fees] run failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const summary = (data ?? {}) as { failed?: number };
  return NextResponse.json(summary, { status: Number(summary.failed ?? 0) > 0 ? 207 : 200 });
}
