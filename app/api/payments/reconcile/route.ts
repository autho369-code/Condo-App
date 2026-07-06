/**
 * GET /api/payments/reconcile
 *
 * Background reconciliation worker (the spec's "cron every 5–15 minutes"):
 * matches Stripe payout batches against the Plaid bank feed so deposits that
 * arrive after the payout webhook still auto-reconcile without a human.
 * Scheduled via vercel.json cron; also safe to invoke manually.
 *
 * When CRON_SECRET is set, requires Vercel's `Authorization: Bearer` header.
 * The job is idempotent — it only links unmatched records.
 */
import { NextRequest, NextResponse } from 'next/server';
import { reconcilePayouts } from '@/lib/payments/reconcile';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const summary = await reconcilePayouts(createServiceClient() as any);
    return NextResponse.json(summary);
  } catch (err: any) {
    console.error('Reconcile cron error:', err?.message);
    return NextResponse.json({ error: err?.message ?? 'reconcile failed' }, { status: 500 });
  }
}
