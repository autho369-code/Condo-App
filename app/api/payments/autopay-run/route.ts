/**
 * GET /api/payments/autopay-run
 *
 * Daily AutoPay engine. For every active mandate due today:
 *   1. Honor skip-a-month / vacation mode (skip_until) — advance without charging.
 *   2. Compute the charge amount per the owner's chosen mode:
 *        fixed | current_balance | minimum | recurring_only | special_only,
 *      optionally including late/NSF/fine balances, capped at the owner's
 *      authorized maximum withdrawal.
 *   3. Create a payment_intents row, then an off-session Stripe PaymentIntent
 *      on the ASSOCIATION'S connected account. Success posts to the ledger via
 *      the standard webhook path — one accounting pipeline for everything.
 *
 * Scheduled by vercel.json; idempotent per day via next_run_date advancement.
 */
import { NextRequest, NextResponse } from 'next/server';
import { isStripeConfigured, createOffSessionPaymentIntent } from '@/lib/payments/stripe';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Sum of open balances on a unit's charges of the given classes. */
async function outstandingByClass(svc: any, unitId: string, classes: string[]): Promise<number> {
  const { data: open } = await svc
    .from('aged_receivables')
    .select('charge_id, balance_due')
    .eq('unit_id', unitId);
  const chargeIds = (open ?? []).map((r: any) => r.charge_id).filter(Boolean);
  if (chargeIds.length === 0) return 0;
  const { data: charges } = await svc
    .from('charges')
    .select('id, charge_type')
    .in('id', chargeIds);
  const typeById = new Map<string, string>((charges ?? []).map((c: any) => [c.id, String(c.charge_type)]));
  return (open ?? [])
    .filter((r: any) => classes.includes(typeById.get(r.charge_id) ?? 'other'))
    .reduce((s: number, r: any) => s + Number(r.balance_due ?? 0), 0);
}

function nextMonthly(day: number): string {
  const now = new Date();
  const d = Math.min(28, Math.max(1, day || 1));
  const next = new Date(now.getFullYear(), now.getMonth() + 1, d);
  return next.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isStripeConfigured()) {
    return NextResponse.json({ skipped: 'stripe not configured' });
  }

  const svc = createServiceClient() as any;
  const today = new Date().toISOString().slice(0, 10);
  const summary = { due: 0, charged: 0, skipped: 0, failed: 0, details: [] as string[] };

  const { data: mandates } = await svc
    .from('autopay_mandates')
    .select('*, payment_methods(processor_token, processor_customer_id), associations(name, stripe_account_id, stripe_charges_enabled), units(unit_number)')
    .eq('status', 'active')
    .lte('next_run_date', today);

  for (const m of mandates ?? []) {
    summary.due++;
    const advance = () => svc.from('autopay_mandates').update({ next_run_date: nextMonthly(m.day_of_month), last_run_at: new Date().toISOString() }).eq('id', m.id);

    // Vacation mode / skip-a-month: advance the schedule without charging.
    if (m.skip_until && m.skip_until >= today) {
      await advance();
      summary.skipped++;
      continue;
    }
    if (!m.associations?.stripe_account_id || !m.associations?.stripe_charges_enabled) {
      summary.skipped++;
      summary.details.push(`mandate ${m.id}: association not Stripe-enabled`);
      continue; // do not advance — charge as soon as the association goes live
    }
    if (!m.payment_methods?.processor_token || !m.payment_methods?.processor_customer_id) {
      summary.skipped++;
      summary.details.push(`mandate ${m.id}: no saved payment method`);
      continue;
    }

    // ── Amount per mode ─────────────────────────────────────────
    let amountCents = 0;
    try {
      if (m.mode === 'fixed') {
        amountCents = m.fixed_amount_cents ?? 0;
      } else if (m.mode === 'minimum') {
        amountCents = m.minimum_amount_cents ?? 0;
      } else if (m.mode === 'recurring_only' || m.mode === 'special_only') {
        const wanted = m.mode === 'recurring_only' ? ['assessment'] : ['special_assessment'];
        const classes = m.include_late_fees ? [...wanted, 'late_fee', 'nsf_fee', 'fine'] : wanted;
        amountCents = Math.round((await outstandingByClass(svc, m.unit_id, classes)) * 100);
      } else { // current_balance
        const { data: bal } = await svc.from('unit_balances').select('balance').eq('unit_id', m.unit_id).maybeSingle();
        amountCents = Math.round(Math.max(0, Number(bal?.balance ?? 0)) * 100);
        if (!m.include_late_fees) {
          const feeBal = await outstandingByClass(svc, m.unit_id, ['late_fee', 'nsf_fee', 'fine']);
          amountCents -= Math.round(feeBal * 100);
        }
      }
    } catch (err: any) {
      summary.failed++;
      summary.details.push(`mandate ${m.id}: amount computation failed — ${err?.message}`);
      continue;
    }

    amountCents = Math.min(amountCents, m.authorized_amount_max_cents ?? amountCents);
    if (amountCents < 100) { // nothing (meaningful) to charge this cycle
      await advance();
      summary.skipped++;
      continue;
    }

    // ── Create intent + off-session charge ──────────────────────
    const { data: intent, error: intentErr } = await svc.from('payment_intents').insert({
      portfolio_id: m.portfolio_id,
      association_id: m.association_id,
      unit_id: m.unit_id,
      owner_id: m.owner_id,
      amount: amountCents / 100,
      status: 'pending',
      breakdown: [{ description: `AutoPay (${m.mode.replace(/_/g, ' ')}) — Unit ${m.units?.unit_number ?? ''}`, amount: amountCents / 100 }],
    }).select('id').single();
    if (intentErr || !intent) {
      summary.failed++;
      summary.details.push(`mandate ${m.id}: intent insert failed — ${intentErr?.message}`);
      continue;
    }
    await svc.from('payment_events').insert({ payment_intent_id: intent.id, event: 'initiated', detail: `AutoPay run (${m.mode.replace(/_/g, ' ')} mode)` });

    try {
      const pi = await createOffSessionPaymentIntent({
        amountCents,
        customer: m.payment_methods.processor_customer_id,
        paymentMethod: m.payment_methods.processor_token,
        description: `AutoPay — ${m.associations?.name ?? 'Association'} Unit ${m.units?.unit_number ?? ''}`,
        metadata: { intent_id: intent.id, autopay_mandate_id: m.id },
        stripeAccount: m.associations.stripe_account_id,
      });
      await svc.from('payment_intents').update({
        processor_payment_intent_id: pi.id,
        status: pi.status === 'succeeded' ? 'processing' : 'processing', // webhook finalizes success + ledger
        updated_at: new Date().toISOString(),
      }).eq('id', intent.id);
      await svc.from('autopay_mandates').update({
        next_run_date: nextMonthly(m.day_of_month),
        last_run_at: new Date().toISOString(),
        success_count: (m.success_count ?? 0) + 1,
      }).eq('id', m.id);
      summary.charged++;
    } catch (err: any) {
      await svc.from('payment_intents').update({ status: 'failed', failure_reason: err?.message ?? 'Off-session charge failed', updated_at: new Date().toISOString() }).eq('id', intent.id);
      await svc.from('payment_events').insert({ payment_intent_id: intent.id, event: 'failed', detail: err?.message ?? 'Off-session charge failed' });
      await svc.from('autopay_mandates').update({
        next_run_date: nextMonthly(m.day_of_month),
        last_run_at: new Date().toISOString(),
        failure_count: (m.failure_count ?? 0) + 1,
        last_failure_at: new Date().toISOString(),
        last_failure_reason: err?.message ?? 'Off-session charge failed',
      }).eq('id', m.id);
      summary.failed++;
      summary.details.push(`mandate ${m.id}: ${err?.message}`);
    }
  }

  return NextResponse.json(summary);
}
