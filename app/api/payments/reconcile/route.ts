/**
 * GET /api/payments/reconcile
 *
 * Background reconciliation worker (the spec's "cron every 5–15 minutes"):
 * matches Stripe payout batches against the Plaid bank feed so deposits that
 * arrive after the payout webhook still auto-reconcile without a human.
 * Scheduled via vercel.json cron; also safe to invoke manually.
 *
 * Requires Vercel's `Authorization: Bearer ${CRON_SECRET}` header and
 * fails closed when CRON_SECRET is not configured.
 * The job is idempotent — it only links unmatched records.
 */
import { NextRequest, NextResponse } from 'next/server';
import { reconcilePayouts } from '@/lib/payments/reconcile';
import { createServiceClient } from '@/lib/supabase/server';
import { requireCronSecret } from '@/lib/server/cron-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  try {
    const summary = await reconcilePayouts(createServiceClient() as any);
    return NextResponse.json(summary);
  } catch (err: any) {
    console.error('Reconcile cron error:', err?.message);
    return NextResponse.json({ error: err?.message ?? 'reconcile failed' }, { status: 500 });
  }
}
