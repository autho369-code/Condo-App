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
import {
  isStripeConfigured,
  expectedStripeLivemode,
  createOffSessionPaymentIntent,
  isIndeterminateStripeError,
  findPaymentIntentByMetadata,
} from '@/lib/payments/stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { requireCronSecret } from '@/lib/server/cron-auth';
import { associationCanAcceptStripePayments, nextMonthlyRunDate } from '@/lib/payments/guards';
import { assertStripeId } from '@/lib/payments/stripe-invariants';

export const dynamic = 'force-dynamic';

/** Sum of open balances on a unit's charges of the given classes. */
/**
 * Open balance on charges due on or before `asOf`, optionally limited to some
 * charge types. Read errors throw: treating a failed read as "nothing due"
 * would skip the run and advance the schedule without charging.
 */
async function openBalanceDue(svc: any, unitId: string, asOf: string, classes?: string[]): Promise<number> {
  const { data: open, error } = await svc
    .from('aged_receivables')
    .select('charge_id, balance_due, due_date')
    .eq('unit_id', unitId)
    .gt('balance_due', 0)
    .lte('due_date', asOf);
  if (error) throw new Error(`open charges could not be read: ${error.message}`);
  const rows = (open ?? []) as Array<{ charge_id: string; balance_due: number }>;
  if (!classes) return rows.reduce((s, r) => s + Number(r.balance_due ?? 0), 0);
  const chargeIds = rows.map((r) => r.charge_id).filter(Boolean);
  if (chargeIds.length === 0) return 0;
  const { data: charges, error: chargesError } = await svc
    .from('charges')
    .select('id, charge_type')
    .in('id', chargeIds);
  if (chargesError) throw new Error(`charge types could not be read: ${chargesError.message}`);
  const typeById = new Map<string, string>((charges ?? []).map((c: any) => [c.id, String(c.charge_type)]));
  return rows
    .filter((r) => classes.includes(typeById.get(r.charge_id) ?? 'other'))
    .reduce((s, r) => s + Number(r.balance_due ?? 0), 0);
}

/** Unapplied credit on the unit (payments not yet applied to a charge). */
async function unitCredit(svc: any, unitId: string): Promise<number> {
  const { data, error } = await svc.from('unit_balances').select('balance').eq('unit_id', unitId).maybeSingle();
  if (error) throw new Error(`unit balance could not be read: ${error.message}`);
  const { data: open, error: openError } = await svc
    .from('aged_receivables')
    .select('balance_due')
    .eq('unit_id', unitId)
    .gt('balance_due', 0);
  if (openError) throw new Error(`open charges could not be read: ${openError.message}`);
  const openTotal = (open ?? []).reduce((s: number, r: any) => s + Number(r.balance_due ?? 0), 0);
  // balance = open charges - unapplied credit
  return Math.max(0, openTotal - Number(data?.balance ?? 0));
}

// Online payments for the unit that have started but are not yet on the
// ledger (ACH in flight, card awaiting the webhook, a checkout opened in the
// last day). Without this AutoPay charged the same balance again, and a
// co-owner's mandate charged what the first mandate had just collected.
async function inFlightAmount(svc: any, unitId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data, error } = await svc
    .from('payment_intents')
    .select('amount, status, created_at')
    .eq('unit_id', unitId)
    .is('payment_id', null)
    .in('status', ['pending', 'processing', 'succeeded']);
  if (error) throw new Error(`pending payments could not be read: ${error.message}`);
  return ((data ?? []) as Array<{ amount: number; status: string; created_at: string }>)
    .filter((i) => i.status !== 'pending' || i.created_at >= since)
    .reduce((s, i) => s + Number(i.amount ?? 0), 0);
}

async function claimRun(svc: any, mandateId: string, scheduledFor: string) {
  const { data, error } = await svc.rpc('claim_stripe_autopay_run', {
    p_mandate_id: mandateId,
    p_scheduled_for: scheduledFor,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.run_id || !row?.idempotency_key) return null;
  return { id: String(row.run_id), idempotencyKey: String(row.idempotency_key) };
}

async function updateRun(svc: any, runId: string, values: Record<string, unknown>) {
  const { error } = await svc
    .from('stripe_autopay_runs')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', runId);
  if (error) throw error;
}

export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;
  if (!isStripeConfigured()) {
    return NextResponse.json({ skipped: 'stripe not configured' });
  }

  const svc = createServiceClient() as any;
  const processorLivemode = expectedStripeLivemode();
  if (processorLivemode === null) {
    return NextResponse.json({ error: 'stripe environment is not pinned' }, { status: 503 });
  }
  const today = new Date().toISOString().slice(0, 10);
  const summary = { due: 0, charged: 0, skipped: 0, failed: 0, details: [] as string[] };

  // Every due mandate (one request stops at 1,000 rows); a read error must
  // fail loudly instead of reporting "0 due".
  const { rows: mandates, error: mandatesError } = await fetchAllRows<any>(() => svc
    .from('autopay_mandates')
    .select('*, payment_methods(processor_token, processor_customer_id, processor_account_id), associations(name, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_deauthorized_at), units(unit_number)')
    .eq('status', 'active')
    .lte('next_run_date', today)
    .order('id'));
  if (mandatesError) return NextResponse.json({ error: `Could not load AutoPay mandates: ${mandatesError}` }, { status: 500 });

  for (const m of mandates ?? []) {
    summary.due++;
    const scheduledFor = String(m.next_run_date);
    const runAt = new Date().toISOString();
    const advance = () => svc
      .from('autopay_mandates')
      .update({ next_run_date: nextMonthlyRunDate(m.day_of_month), last_run_at: runAt })
      .eq('id', m.id)
      .eq('next_run_date', scheduledFor)
      .eq('status', 'active');

    if (!associationCanAcceptStripePayments(m.associations)) {
      summary.skipped++;
      summary.details.push(`mandate ${m.id}: association not Stripe-enabled`);
      continue; // do not advance — charge as soon as the association goes live
    }
    // A mandate belongs to the owner of the unit; once they no longer own it
    // (sold), cancel it rather than charge them for the buyer's balance.
    const { data: stillOwner, error: ownerError } = await svc
      .from('occupancies')
      .select('id')
      .eq('unit_id', m.unit_id)
      .eq('owner_id', m.owner_id)
      .eq('status', 'current')
      .limit(1);
    if (ownerError) {
      summary.failed++;
      summary.details.push(`mandate ${m.id}: ownership check failed - ${ownerError.message}`);
      continue;
    }
    if (!stillOwner?.length) {
      await svc.from('autopay_mandates')
        .update({ status: 'canceled', canceled_at: runAt, updated_at: runAt })
        .eq('id', m.id)
        .eq('status', 'active');
      summary.skipped++;
      summary.details.push(`mandate ${m.id}: owner no longer owns this unit; AutoPay canceled`);
      continue;
    }
    const { data: blocked } = await svc.from('occupancies').select('id').eq('unit_id', m.unit_id).eq('status', 'current').eq('allow_online_payments', false).limit(1);
    if (blocked?.length) {
      summary.skipped++;
      summary.details.push(`mandate ${m.id}: online payments disabled for this homeowner`);
      continue;
    }
    if (!m.payment_methods?.processor_token || !m.payment_methods?.processor_customer_id) {
      summary.skipped++;
      summary.details.push(`mandate ${m.id}: no saved payment method`);
      continue;
    }
    if (m.payment_methods.processor_account_id !== m.associations.stripe_account_id) {
      summary.failed++;
      summary.details.push(`mandate ${m.id}: saved method belongs to a different Stripe account`);
      continue;
    }

    // Vacation mode still claims a durable run so concurrent cron requests
    // cannot advance the same mandate twice.
    if (m.skip_until && m.skip_until >= today) {
      try {
        const run = await claimRun(svc, m.id, scheduledFor);
        if (!run) {
          summary.skipped++;
          continue;
        }
        const { error: advanceError } = await advance();
        if (advanceError) throw advanceError;
        await updateRun(svc, run.id, {
          status: 'skipped',
          failure_reason: 'Owner vacation/skip setting',
          completed_at: new Date().toISOString(),
        });
        summary.skipped++;
      } catch (err: any) {
        summary.failed++;
        summary.details.push(`mandate ${m.id}: could not record skipped run - ${err?.message ?? 'unknown error'}`);
      }
      continue;
    }

    // ── Amount per mode ─────────────────────────────────────────
    let amountCents = 0;
    try {
      const pending = m.mode === 'fixed' ? 0 : await inFlightAmount(svc, m.unit_id);
      if (m.mode === 'fixed') {
        amountCents = m.fixed_amount_cents ?? 0;
      } else if (m.mode === 'recurring_only' || m.mode === 'special_only') {
        const wanted = m.mode === 'recurring_only' ? ['assessment'] : ['special_assessment'];
        const classes = m.include_late_fees ? [...wanted, 'late_fee', 'nsf_fee', 'fine'] : wanted;
        amountCents = Math.max(0, Math.round(((await openBalanceDue(svc, m.unit_id, today, classes)) - pending) * 100));
      } else {
        // current_balance / minimum: what is due today (charges dated later
        // are not owed yet), less any unapplied credit, optionally without
        // late/NSF/fine charges.
        let due = await openBalanceDue(svc, m.unit_id, today);
        if (!m.include_late_fees) due -= await openBalanceDue(svc, m.unit_id, today, ['late_fee', 'nsf_fee', 'fine']);
        due -= await unitCredit(svc, m.unit_id);
        due -= pending;
        const dueCents = Math.max(0, Math.round(due * 100));
        // Minimum: the owner's minimum, but never more than is due.
        amountCents = m.mode === 'minimum' ? Math.min(m.minimum_amount_cents ?? 0, dueCents) : dueCents;
      }
    } catch (err: any) {
      summary.failed++;
      summary.details.push(`mandate ${m.id}: amount computation failed — ${err?.message}`);
      continue;
    }

    amountCents = Math.min(amountCents, m.authorized_amount_max_cents ?? amountCents);
    if (amountCents < 100) { // nothing (meaningful) to charge this cycle
      try {
        const run = await claimRun(svc, m.id, scheduledFor);
        if (!run) {
          summary.skipped++;
          continue;
        }
        const { error: advanceError } = await advance();
        if (advanceError) throw advanceError;
        await updateRun(svc, run.id, {
          status: 'skipped',
          failure_reason: 'No payable balance this cycle',
          completed_at: new Date().toISOString(),
        });
        summary.skipped++;
      } catch (err: any) {
        summary.failed++;
        summary.details.push(`mandate ${m.id}: could not record zero-balance run - ${err?.message ?? 'unknown error'}`);
      }
      continue;
    }

    let run: { id: string; idempotencyKey: string } | null;
    try {
      run = await claimRun(svc, m.id, scheduledFor);
    } catch (err: any) {
      summary.failed++;
      summary.details.push(`mandate ${m.id}: AutoPay claim failed - ${err?.message ?? 'unknown error'}`);
      continue;
    }
    if (!run) {
      summary.skipped++;
      summary.details.push(`mandate ${m.id}: run already claimed or completed`);
      continue;
    }

    // ── Create intent + off-session charge ──────────────────────
    // A reclaimed run must reuse its original local amount. Stripe will also
    // reuse the original response for this run's stable idempotency key.
    let { data: intent, error: intentErr } = await svc.from('payment_intents')
      .select('id, portfolio_id, association_id, unit_id, owner_id, amount, status, processor_account_id, processor_livemode, processor_payment_intent_id, idempotency_key')
      .eq('id', run.id)
      .maybeSingle();
    if (intentErr) {
      await updateRun(svc, run.id, { status: 'failed', failure_reason: 'Could not read the local payment intent' }).catch(() => undefined);
      summary.failed++;
      summary.details.push(`mandate ${m.id}: intent lookup failed — ${intentErr.message}`);
      continue;
    }

    // A pre-existing local intent means an earlier attempt of this run may
    // already have reached Stripe.
    const reclaimed = !!intent;
    if (intent) {
      const persistedCents = Math.round(Number(intent.amount) * 100);
      const scopeMatches = intent.portfolio_id === m.portfolio_id
        && intent.association_id === m.association_id
        && intent.unit_id === m.unit_id
        && intent.owner_id === m.owner_id
        && intent.processor_account_id === m.associations.stripe_account_id
        && intent.processor_livemode === processorLivemode
        && intent.idempotency_key === run.idempotencyKey;
      if (!scopeMatches || !Number.isSafeInteger(persistedCents)
          || persistedCents < 100 || persistedCents > m.authorized_amount_max_cents) {
        await updateRun(svc, run.id, { status: 'failed', failure_reason: 'Persisted AutoPay intent failed scope or amount validation' }).catch(() => undefined);
        summary.failed++;
        summary.details.push(`mandate ${m.id}: persisted intent does not match the association-owned run`);
        continue;
      }
      if (intent.processor_payment_intent_id || intent.status === 'succeeded') {
        summary.skipped++;
        summary.details.push(`mandate ${m.id}: Stripe submission already exists; awaiting webhook reconciliation`);
        continue;
      }
      if (!['pending', 'failed'].includes(intent.status)) {
        summary.failed++;
        summary.details.push(`mandate ${m.id}: persisted intent is in unexpected state ${intent.status}`);
        continue;
      }
      amountCents = persistedCents;
      const { error: resetError } = await svc.from('payment_intents').update({
        status: 'pending',
        failure_reason: null,
        updated_at: new Date().toISOString(),
      }).eq('id', intent.id).in('status', ['pending', 'failed']);
      if (resetError) {
        summary.failed++;
        summary.details.push(`mandate ${m.id}: intent retry reset failed — ${resetError.message}`);
        continue;
      }
    } else {
      const inserted = await svc.from('payment_intents').insert({
        id: run.id,
        portfolio_id: m.portfolio_id,
        association_id: m.association_id,
        unit_id: m.unit_id,
        owner_id: m.owner_id,
        amount: amountCents / 100,
        status: 'pending',
        failure_reason: null,
        processor_account_id: m.associations.stripe_account_id,
        processor_livemode: processorLivemode,
        idempotency_key: run.idempotencyKey,
        breakdown: [{ description: `AutoPay (${m.mode.replace(/_/g, ' ')}) — Unit ${m.units?.unit_number ?? ''}`, amount: amountCents / 100 }],
      }).select('id').single();
      intent = inserted.data;
      intentErr = inserted.error;
    }
    if (intentErr || !intent) {
      await updateRun(svc, run.id, {
        status: 'failed',
        failure_reason: 'Could not create the local payment intent',
      }).catch(() => undefined);
      summary.failed++;
      summary.details.push(`mandate ${m.id}: intent insert failed — ${intentErr?.message}`);
      continue;
    }
    try {
      await updateRun(svc, run.id, { status: 'intent_created', payment_intent_id: intent.id });
      const { error: eventError } = await svc.from('payment_events').insert({
        payment_intent_id: intent.id,
        event: 'initiated',
        detail: `AutoPay run (${m.mode.replace(/_/g, ' ')} mode)`,
      });
      if (eventError) throw eventError;
    } catch (err: any) {
      await updateRun(svc, run.id, {
        status: 'failed',
        failure_reason: 'Could not persist the local AutoPay intent state',
      }).catch(() => undefined);
      await svc.from('payment_intents').update({
        status: 'failed',
        failure_reason: 'Could not persist the local AutoPay intent state',
      }).eq('id', intent.id).eq('status', 'pending');
      summary.failed++;
      summary.details.push(`mandate ${m.id}: local AutoPay state failed - ${err?.message ?? 'unknown error'}`);
      continue;
    }

    const { data: currentMandate, error: currentMandateError } = await svc
      .from('autopay_mandates')
      .select('status, next_run_date')
      .eq('id', m.id)
      .maybeSingle();
    if (currentMandateError || currentMandate?.status !== 'active' || String(currentMandate.next_run_date) !== scheduledFor) {
      await updateRun(svc, run.id, {
        status: 'skipped',
        failure_reason: 'Mandate changed before submission',
        completed_at: new Date().toISOString(),
      }).catch(() => undefined);
      await svc.from('payment_intents').update({
        status: 'failed',
        failure_reason: 'AutoPay mandate changed before submission',
      }).eq('id', intent.id).eq('status', 'pending');
      summary.skipped++;
      continue;
    }

    let submittedToStripe = false;
    try {
      // Stripe replays an idempotency key for only 24 hours, so before
      // re-submitting a reclaimed run look for the charge the earlier attempt
      // may have created. If Stripe cannot answer, stop: never risk a double
      // charge (the run stays retryable with the same key).
      let existing: { id: string; status: string; amount: number } | null = null;
      if (reclaimed) {
        try {
          existing = await findPaymentIntentByMetadata(m.associations.stripe_account_id, 'autopay_run_id', run.id);
        } catch (searchErr: any) {
          await updateRun(svc, run.id, {
            status: 'intent_created',
            failure_reason: 'Could not confirm with Stripe whether an earlier attempt charged; retrying later',
          }).catch(() => undefined);
          summary.failed++;
          summary.details.push(`mandate ${m.id}: Stripe lookup for an earlier attempt failed — ${searchErr?.message ?? 'unknown error'}`);
          continue;
        }
        // A declined/canceled earlier attempt is not a charge: retry normally.
        if (existing && !['succeeded', 'processing', 'requires_capture', 'requires_action'].includes(existing.status)) {
          existing = null;
        }
        if (existing && existing.amount !== amountCents) {
          await updateRun(svc, run.id, {
            status: 'failed',
            failure_reason: `Stripe already has a charge for this run in a different amount (${existing.amount} cents); needs review`,
          }).catch(() => undefined);
          summary.failed++;
          summary.details.push(`mandate ${m.id}: earlier Stripe charge ${existing.id} does not match the run amount`);
          continue;
        }
      }
      const pi = existing ?? await createOffSessionPaymentIntent({
        amountCents,
        customer: m.payment_methods.processor_customer_id,
        paymentMethod: m.payment_methods.processor_token,
        description: `AutoPay — ${m.associations?.name ?? 'Association'} Unit ${m.units?.unit_number ?? ''}`,
        metadata: { intent_id: intent.id, autopay_mandate_id: m.id, autopay_run_id: run.id },
        stripeAccount: m.associations.stripe_account_id,
        idempotencyKey: run.idempotencyKey,
      });
      submittedToStripe = true;
      const processorPaymentIntentId = assertStripeId(pi.id, 'pi', 'Stripe PaymentIntent id');
      // Card charges succeed immediately and the webhook may already have
      // finalized this run; never move a finished run back to 'submitted'.
      {
        const { error: runError } = await svc
          .from('stripe_autopay_runs')
          .update({ status: 'submitted', processor_payment_intent_id: processorPaymentIntentId, updated_at: new Date().toISOString() })
          .eq('id', run.id)
          .not('status', 'in', '("succeeded","failed")');
        if (runError) throw runError;
      }
      if (!['processing', 'succeeded'].includes(pi.status)) {
        const failureReason = pi.status === 'requires_action'
          ? 'Owner authentication is required before this AutoPay can complete'
          : `Stripe returned ${pi.status || 'an unsupported status'}`;
        const { error: failedIntentError } = await svc.from('payment_intents').update({
          processor_payment_intent_id: processorPaymentIntentId,
          status: 'failed',
          failure_reason: failureReason,
          updated_at: new Date().toISOString(),
        }).eq('id', intent.id).neq('status', 'succeeded');
        if (failedIntentError) throw failedIntentError;
        const { error: finalizeError } = await svc.rpc('finalize_stripe_autopay_run', {
          p_run_id: run.id,
          p_processor_account_id: m.associations.stripe_account_id,
          p_processor_payment_intent_id: processorPaymentIntentId,
          p_payment_intent_id: intent.id,
          p_outcome: 'failed',
          p_failure_reason: failureReason,
        });
        if (finalizeError) throw finalizeError;
        await svc.from('payment_events').insert({
          payment_intent_id: intent.id,
          event: 'failed',
          detail: failureReason,
        });
        summary.failed++;
        summary.details.push(`mandate ${m.id}: ${failureReason}`);
        continue;
      }
      const { error: intentUpdateError } = await svc.from('payment_intents').update({
        processor_payment_intent_id: processorPaymentIntentId,
        status: 'processing', // webhook finalizes success + ledger
        updated_at: new Date().toISOString(),
      })
        .eq('id', intent.id)
        // Only from pending: the success webhook may have finished first.
        .eq('status', 'pending');
      if (intentUpdateError) throw intentUpdateError;
      const { error: advanceError } = await advance();
      if (advanceError) throw advanceError;
      summary.charged++;
    } catch (err: any) {
      if (submittedToStripe || isIndeterminateStripeError(err)) {
        // Stripe accepted the idempotent request. Do not label it failed or
        // advance the schedule. A missing/5xx response is also indeterminate:
        // reclaim this run later and use the exact same idempotency key.
        if (!submittedToStripe) {
          await updateRun(svc, run.id, {
            status: 'intent_created',
            failure_reason: 'Stripe response was indeterminate; retry with the same idempotency key',
          }).catch(() => undefined);
        }
        summary.failed++;
        summary.details.push(`mandate ${m.id}: Stripe reconciliation is pending; safe idempotent retry retained`);
        continue;
      }
      await svc.from('payment_intents').update({ status: 'failed', failure_reason: err?.message ?? 'Off-session charge failed', updated_at: new Date().toISOString() }).eq('id', intent.id);
      await svc.from('payment_events').insert({ payment_intent_id: intent.id, event: 'failed', detail: err?.message ?? 'Off-session charge failed' });
      const { error: finalizeError } = await svc.rpc('finalize_stripe_autopay_run', {
        p_run_id: run.id,
        p_processor_account_id: m.associations.stripe_account_id,
        p_processor_payment_intent_id: null,
        p_payment_intent_id: intent.id,
        p_outcome: 'failed',
        p_failure_reason: err?.message ?? 'Off-session charge failed',
      });
      if (finalizeError) {
        await updateRun(svc, run.id, {
          status: 'failed',
          failure_reason: err?.message ?? 'Off-session charge failed',
        }).catch(() => undefined);
        summary.details.push(`mandate ${m.id}: AutoPay failure finalization is pending`);
      }
      summary.failed++;
      summary.details.push(`mandate ${m.id}: ${err?.message}`);
    }
  }

  return NextResponse.json(summary);
}
