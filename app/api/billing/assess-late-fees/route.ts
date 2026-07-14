/**
 * GET /api/billing/assess-late-fees
 * Daily cron. For every association with late_fee_enabled, finds unpaid dues
 * charges (charge_type 'assessment', balance_due > 0 in v_charge_balances)
 * that are past due_date + late_fee_grace_days and have no
 * late_fee_assessments row yet, then posts a late-fee charge through the
 * assess_late_fee() RPC — the same charges-table insert the manual
 * post_ad_hoc_charge path uses, so credit auto-application and webhooks fire
 * identically. The RPC re-validates every rule and records the assessment row
 * in the same transaction (charge_id is unique — one fee per overdue charge).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireCronSecret } from '@/lib/server/cron-auth';

export const dynamic = 'force-dynamic';

function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const svc = createServiceClient() as any;
  const summary = {
    associations: 0,
    candidates: 0,
    assessed: 0,
    skipped: 0,
    failed: 0,
    details: [] as string[],
  };

  try {
    const { data: assocs, error } = await svc
      .from('associations')
      .select('id, name, late_fee_amount, late_fee_is_percent, late_fee_grace_days')
      .eq('late_fee_enabled', true)
      .gt('late_fee_amount', 0)
      .is('archived_at', null);
    if (error) throw new Error(error.message);

    for (const a of assocs ?? []) {
      summary.associations++;
      const grace = Number.isFinite(Number(a.late_fee_grace_days)) ? Number(a.late_fee_grace_days) : 10;
      // Overdue means due_date + grace < today, i.e. due_date < today - grace.
      const cutoff = isoDaysAgo(grace);

      const { data: units, error: unitsErr } = await svc
        .from('units')
        .select('id, buildings!inner(association_id)')
        .eq('buildings.association_id', a.id);
      if (unitsErr) {
        summary.failed++;
        summary.details.push(`${a.name}: units query failed — ${unitsErr.message}`);
        continue;
      }
      const unitIds = (units ?? []).map((u: any) => u.id);
      if (unitIds.length === 0) continue;

      const { data: overdue, error: overdueErr } = await svc
        .from('v_charge_balances')
        .select('charge_id, unit_id, balance_due, due_date, description')
        .in('unit_id', unitIds)
        .eq('charge_type', 'assessment')
        .gt('balance_due', 0)
        .lt('due_date', cutoff);
      if (overdueErr) {
        summary.failed++;
        summary.details.push(`${a.name}: balance query failed — ${overdueErr.message}`);
        continue;
      }
      if (!overdue?.length) continue;

      const { data: done } = await svc
        .from('late_fee_assessments')
        .select('charge_id')
        .eq('association_id', a.id);
      const alreadyAssessed = new Set((done ?? []).map((d: any) => d.charge_id));

      for (const c of overdue) {
        if (alreadyAssessed.has(c.charge_id)) continue;
        summary.candidates++;
        const { data: feeChargeId, error: feeErr } = await svc.rpc('assess_late_fee', {
          p_charge_id: c.charge_id,
        });
        if (feeErr) {
          summary.failed++;
          summary.details.push(`${a.name} charge ${c.charge_id}: ${feeErr.message}`);
        } else if (feeChargeId) {
          summary.assessed++;
        } else {
          summary.skipped++; // rule re-check inside the RPC said no fee is due
        }
      }
    }

    return NextResponse.json(summary);
  } catch (e: any) {
    return NextResponse.json({ error: e.message, ...summary }, { status: 500 });
  }
}
