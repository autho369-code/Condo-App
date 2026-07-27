/**
 * POST /api/stripe/webhook
 *
 * Stripe event intake. Truth hierarchy: Portier ledger -> Stripe -> bank;
 * events FEED the ledger, they never override it.
 *
 * Handled events:
 *   checkout.session.completed      -> attach PaymentIntent id; card payments
 *                                      settle here, ACH stays 'processing'
 *   payment_intent.succeeded        -> post a `payments` row (same accounting
 *                                      path as a manager-recorded payment)
 *   payment_intent.payment_failed   -> mark failed with reason
 *   charge.refunded                 -> flag refunded (ledger adjustment is a
 *                                      manual accounting decision, surfaced in
 *                                      the exception queue)
 *   charge.dispute.created          -> flag chargeback
 *   payout.paid                     -> record payout batch, attribute settled
 *                                      intents, run bank-feed reconciliation
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  verifyStripeSignature,
  isStripeConfigured,
  expectedStripeLivemode,
  retrievePaymentIntent,
  listPayoutBalanceTransactions,
} from '@/lib/payments/stripe';
import { reconcilePayouts } from '@/lib/payments/reconcile';
import {
  assertStripeId,
  assertConnectedAccountScope,
  assertStripeMoney,
  payoutChargeIds,
  sumStripeNetCents,
  usdDollarsToCents,
} from '@/lib/payments/stripe-invariants';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const MAX_WEBHOOK_BYTES = 1_048_576;

async function logEvent(db: any, intentId: string, eventName: string, detail?: string | null) {
  try {
    await db.from('payment_events').insert({ payment_intent_id: intentId, event: eventName, detail: detail ?? null });
  } catch { /* audit trail is best-effort, never blocks money movement */ }
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function emailReceipt(db: any, intent: any, method: string) {
  try {
    const [{ data: owner }, { data: unit }, { data: assoc }] = await Promise.all([
      db.from('owners').select('full_name, email').eq('id', intent.owner_id).maybeSingle(),
      db.from('units').select('unit_number').eq('id', intent.unit_id).maybeSingle(),
      db.from('associations').select('name').eq('id', intent.association_id).maybeSingle(),
    ]);
    if (!owner?.email) return false;
    const amount = Number(intent.amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    const ownerName = escapeHtml(owner.full_name);
    const unitNumber = escapeHtml(unit?.unit_number);
    const associationName = escapeHtml(assoc?.name || 'your association');
    const { error } = await db.from('email_queue').insert({
      to_email: owner.email,
      to_name: owner.full_name,
      subject: `Payment received — ${amount} for Unit ${unit?.unit_number ?? ''}`,
      body: `<p>Hello${ownerName ? ` ${ownerName}` : ''},</p><p>We received your ${method === 'ach' ? 'bank (ACH)' : 'card'} payment of <strong>${escapeHtml(amount)}</strong> for Unit ${unitNumber} at ${associationName}. It has been applied to your account.</p><p>You can view your updated ledger any time in the owner portal.</p><p>Reference: ${escapeHtml(intent.processor_payment_intent_id ?? intent.id)}</p>`,
      status: 'pending',
      from_address: 'hello@portier369.com',
      from_name: 'Portier369',
      portfolio_id: intent.portfolio_id,
    });
    return !error;
  } catch {
    return false;
  }
}

/** Best-effort Stripe fee capture from the charge's balance transaction. */
async function captureFee(db: any, intentId: string, piId: string, stripeAccount: string) {
  try {
    const pi = await retrievePaymentIntent(piId, stripeAccount);
    const fee = pi?.latest_charge?.balance_transaction?.fee;
    if (typeof fee === 'number') {
      await db.from('payment_intents').update({ processor_fee_cents: fee }).eq('id', intentId);
    }
  } catch { /* fees are informational */ }
}

async function postLedgerPayment(db: any, intent: any, method: string, piId: string, stripeAccount: string) {
  // Row lock + unique provider reference make concurrent webhook retries safe.
  const { data: paymentId, error } = await db.rpc('post_stripe_ledger_payment', {
    p_intent_id: intent.id,
    p_method: method,
    p_processor_payment_intent_id: piId,
    p_processor_account_id: stripeAccount,
  });
  if (error) throw new Error(`ledger post failed: ${error.message}`);
  return paymentId;
}

async function finalizeAutopayRun(
  db: any,
  stripeObject: any,
  intentId: string,
  stripeAccount: string,
  outcome: 'succeeded' | 'failed',
  failureReason?: string | null,
) {
  const runId = stripeObject?.metadata?.autopay_run_id;
  if (runId == null) return;
  if (!isUuid(runId)) throw new Error('Invalid Stripe AutoPay run identity');
  const { error } = await db.rpc('finalize_stripe_autopay_run', {
    p_run_id: runId,
    p_processor_account_id: stripeAccount,
    p_processor_payment_intent_id: stripeObject.id,
    p_payment_intent_id: intentId,
    p_outcome: outcome,
    p_failure_reason: failureReason ?? null,
  });
  if (error) throw new Error(`AutoPay finalization failed: ${error.message}`);
}

const ACCOUNT_SCOPED_EVENTS = new Set([
  'checkout.session.completed',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'charge.refunded',
  'charge.dispute.created',
  'payout.created',
  'payout.paid',
  'payout.failed',
  'account.updated',
  'account.application.deauthorized',
]);

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function requireIntentAccount(db: any, intent: any, stripeAccount: string) {
  const { data: association } = await db
    .from('associations')
    .select('id, portfolio_id, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled')
    .eq('id', intent.association_id)
    .maybeSingle();
  if (!association) throw new Error('Payment association was not found');
  assertConnectedAccountScope(stripeAccount, association.stripe_account_id, intent.processor_account_id);
  return association;
}

function requireMatchingMoney(obj: any, intent: any, amountField: 'amount_total' | 'amount_received' | 'amount') {
  assertStripeMoney(obj, intent.amount, amountField);
}

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }
  if (!verifyStripeSignature(rawBody, request.headers.get('stripe-signature'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const expectedLivemode = expectedStripeLivemode();
  if (expectedLivemode === null || event?.livemode !== expectedLivemode) {
    return NextResponse.json({ error: 'Stripe environment mismatch' }, { status: 400 });
  }
  if (typeof event?.id !== 'string' || !event.id.startsWith('evt_') || typeof event?.type !== 'string') {
    return NextResponse.json({ error: 'Invalid event identity' }, { status: 400 });
  }
  const stripeAccount = typeof event.account === 'string' ? event.account : null;
  if (ACCOUNT_SCOPED_EVENTS.has(event.type) && !stripeAccount) {
    return NextResponse.json({ error: 'Connected Stripe account required' }, { status: 400 });
  }

  const svc = createServiceClient() as any;
  const obj = event?.data?.object ?? {};
  const now = new Date().toISOString();

  const { data: claimed, error: claimError } = await svc.rpc('claim_stripe_webhook_event', {
    p_event_id: event.id,
    p_processor_account_id: stripeAccount,
    p_event_type: event.type,
  });
  if (claimError) {
    console.error('Stripe webhook claim failed:', claimError.message);
    return NextResponse.json({ error: 'Webhook idempotency unavailable' }, { status: 503 });
  }
  if (!claimed) {
    const { data: priorEvent } = await svc.from('stripe_webhook_events')
      .select('processor_account_id, event_type, status')
      .eq('event_id', event.id)
      .maybeSingle();
    if (!priorEvent
        || priorEvent.processor_account_id !== stripeAccount
        || priorEvent.event_type !== event.type) {
      return NextResponse.json({ error: 'Webhook identity conflict' }, { status: 400 });
    }
    if (priorEvent.status === 'processed') {
      return NextResponse.json({ received: true, duplicate: true });
    }
    return NextResponse.json({ error: 'Webhook is awaiting retry' }, { status: 503 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        // AutoPay enrollment: setup-mode sessions save a payment method and
        // activate only the locally authorized, association-scoped attempt.
        if (obj.mode === 'setup') {
          const md = obj.metadata ?? {};
          const setupSessionId = assertStripeId(obj.id, 'cs', 'Stripe Checkout Session id');
          const metadataKeys = Object.keys(md).sort();
          if (!stripeAccount
              || metadataKeys.length !== 2
              || metadataKeys[0] !== 'purpose'
              || metadataKeys[1] !== 'setup_attempt_id'
              || md.purpose !== 'autopay_setup'
              || !isUuid(md.setup_attempt_id)) {
            throw new Error('Invalid AutoPay enrollment identity');
          }

          const attemptId = md.setup_attempt_id;
          const { data: attempt, error: attemptError } = await svc.from('stripe_setup_attempts')
            .select('*')
            .eq('id', attemptId)
            .maybeSingle();
          if (attemptError) throw new Error(`AutoPay setup lookup failed: ${attemptError.message}`);
          if (!attempt) throw new Error('AutoPay setup attempt was not found');

          const failAttempt = async (message: string, status = 'failed') => {
            await svc.from('stripe_setup_attempts').update({
              status,
              last_error: message.slice(0, 500),
              updated_at: now,
            }).eq('id', attemptId).neq('status', 'completed');
            throw new Error(message);
          };

          if (setupSessionId !== attempt.processor_session_id
              || stripeAccount !== attempt.processor_account_id
              || !obj.setup_intent) {
            await failAttempt('Stripe setup session does not match the locally authorized attempt');
          }
          if (attempt.status === 'completed') break;
          if (attempt.status !== 'session_created') {
            await failAttempt('AutoPay setup attempt is not awaiting Stripe completion');
          }
          if (!attempt.expires_at || new Date(attempt.expires_at).getTime() <= Date.now()) {
            await failAttempt('AutoPay setup attempt expired before completion', 'expired');
          }

          const [{ data: setupAssociation }, { data: setupOccupancy }] = await Promise.all([
            svc.from('associations')
              .select('id, portfolio_id, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_deauthorized_at')
              .eq('id', attempt.association_id)
              .maybeSingle(),
            svc.from('occupancies')
              .select('owner_id, unit_id, association_id')
              .eq('owner_id', attempt.owner_id)
              .eq('unit_id', attempt.unit_id)
              .eq('association_id', attempt.association_id)
              .eq('status', 'current')
              .maybeSingle(),
          ]);
          if (!setupAssociation || !setupOccupancy
              || setupAssociation.portfolio_id !== attempt.portfolio_id
              || setupAssociation.stripe_account_id !== stripeAccount
              || !setupAssociation.stripe_charges_enabled
              || !setupAssociation.stripe_payouts_enabled
              || setupAssociation.stripe_deauthorized_at) {
            await failAttempt('AutoPay enrollment no longer matches a payment-ready association account');
          }

          const { getSetupIntent, getPaymentMethod } = await import('@/lib/payments/stripe');
          const setupIntentId = assertStripeId(obj.setup_intent, 'seti', 'Stripe SetupIntent id');
          const si = await getSetupIntent(setupIntentId, stripeAccount);
          if (si?.status !== 'succeeded' || si?.usage !== 'off_session' || !si.payment_method) {
            await failAttempt('Stripe did not return a completed off-session payment-method setup');
          }
          const paymentMethodId = assertStripeId(si.payment_method, 'pm', 'Stripe PaymentMethod id');
          const customerId = assertStripeId(si.customer ?? obj.customer, 'cus', 'Stripe Customer id');
          const pm = await getPaymentMethod(paymentMethodId, stripeAccount);
          if (pm?.id !== paymentMethodId
              || !['card', 'us_bank_account'].includes(pm?.type)
              || (pm.customer && pm.customer !== customerId)) {
            await failAttempt('Stripe payment method does not match the authorized setup');
          }
          const methodType = pm.type === 'us_bank_account' ? 'ach' : 'card';
          const lastFour = pm.card?.last4 ?? pm.us_bank_account?.last4 ?? null;
          const brand = pm.card?.brand ?? null;
          const bankName = pm.us_bank_account?.bank_name ?? null;

          const { data: existingMethod, error: existingMethodError } = await svc.from('payment_methods')
            .select('id, portfolio_id, association_id, owner_id, processor_customer_id')
            .eq('processor', 'stripe')
            .eq('processor_account_id', stripeAccount)
            .eq('processor_token', paymentMethodId)
            .maybeSingle();
          if (existingMethodError) throw new Error(`Saved payment method lookup failed: ${existingMethodError.message}`);
          if (existingMethod
              && (existingMethod.portfolio_id !== attempt.portfolio_id
                || existingMethod.association_id !== attempt.association_id
                || existingMethod.owner_id !== attempt.owner_id
                || (existingMethod.processor_customer_id && existingMethod.processor_customer_id !== customerId))) {
            await failAttempt('Saved Stripe payment method belongs to a different association or owner');
          }

          let savedMethod = existingMethod;
          if (!savedMethod) {
            const { data, error: pmError } = await svc.from('payment_methods').insert({
              portfolio_id: attempt.portfolio_id,
              association_id: attempt.association_id,
              owner_id: attempt.owner_id,
              processor: 'stripe',
              processor_account_id: stripeAccount,
              method_type: methodType,
              processor_token: paymentMethodId,
              processor_customer_id: customerId,
              last_four: lastFour,
              brand,
              bank_name: bankName,
              is_default: true,
              is_verified: true,
              verified_at: now,
            }).select('id').single();
            if (pmError || !data) throw new Error(`Payment method save failed: ${pmError?.message ?? 'no row returned'}`);
            savedMethod = data;
          }

          const today = new Date();
          const runMonthOffset = today.getUTCDate() >= attempt.day_of_month ? 1 : 0;
          const nextRun = new Date(Date.UTC(
            today.getUTCFullYear(),
            today.getUTCMonth() + runMonthOffset,
            attempt.day_of_month,
          )).toISOString().slice(0, 10);

          const { data: existingMandate, error: existingMandateError } = await svc.from('autopay_mandates')
            .select('id, payment_method_id, portfolio_id, association_id, owner_id, unit_id')
            .eq('owner_id', attempt.owner_id)
            .eq('unit_id', attempt.unit_id)
            .neq('status', 'canceled')
            .limit(1)
            .maybeSingle();
          if (existingMandateError) throw new Error(`AutoPay mandate lookup failed: ${existingMandateError.message}`);
          if (existingMandate
              && (existingMandate.payment_method_id !== savedMethod.id
                || existingMandate.portfolio_id !== attempt.portfolio_id
                || existingMandate.association_id !== attempt.association_id)) {
            await failAttempt('A different AutoPay mandate already exists for this owner and unit');
          }
          if (!existingMandate) {
            const { error: mandateError } = await svc.from('autopay_mandates').insert({
              portfolio_id: attempt.portfolio_id,
              association_id: attempt.association_id,
              owner_id: attempt.owner_id,
              unit_id: attempt.unit_id,
              payment_method_id: savedMethod.id,
              authorized_amount_max_cents: attempt.authorized_amount_max_cents,
              frequency: 'monthly',
              day_of_month: attempt.day_of_month,
              start_date: now.slice(0, 10),
              status: 'active',
              mandate_signed_at: now,
              next_run_date: nextRun,
              mode: attempt.mode,
              fixed_amount_cents: attempt.fixed_amount_cents,
              minimum_amount_cents: attempt.minimum_amount_cents,
              include_late_fees: attempt.include_late_fees,
            });
            if (mandateError) throw new Error(`AutoPay mandate creation failed: ${mandateError.message}`);
          }

          const { data: completedAttempts, error: completionError } = await svc.from('stripe_setup_attempts').update({
            status: 'completed',
            processor_setup_intent_id: setupIntentId,
            completed_at: now,
            updated_at: now,
            last_error: null,
          }).eq('id', attemptId)
            .eq('status', 'session_created')
            .eq('processor_session_id', setupSessionId)
            .eq('processor_account_id', stripeAccount)
            .select('id');
          if (completionError || completedAttempts?.length !== 1) {
            throw new Error(`AutoPay setup completion failed: ${completionError?.message ?? 'attempt state changed'}`);
          }
          break;
        }

        const intentId = obj.client_reference_id;
        const checkoutSessionId = assertStripeId(obj.id, 'cs', 'Stripe Checkout Session id');
        if (!stripeAccount || obj.mode !== 'payment' || !isUuid(intentId)) {
          throw new Error('Invalid checkout payment identity');
        }
        const { data: intent } = await svc.from('payment_intents').select('*').eq('id', intentId).maybeSingle();
        if (!intent) throw new Error('Checkout payment intent not found');
        if (intent.processor_session_id !== checkoutSessionId
            || obj.metadata?.intent_id !== intentId
            || obj.metadata?.association_id !== intent.association_id
            || obj.metadata?.unit_id !== intent.unit_id) {
          throw new Error('Checkout session does not match the locally created payment attempt');
        }
        await requireIntentAccount(svc, intent, stripeAccount);
        requireMatchingMoney(obj, intent, 'amount_total');
        if (intent.processor_livemode !== null && intent.processor_livemode !== event.livemode) {
          throw new Error('Checkout mode does not match the payment intent');
        }
        if (typeof obj.payment_intent !== 'string' || !obj.payment_intent.startsWith('pi_')) {
          throw new Error('Checkout has no valid Stripe PaymentIntent');
        }
        const updates: any = {
          processor_payment_intent_id: obj.payment_intent ?? intent.processor_payment_intent_id,
          processor_account_id: stripeAccount,
          processor_livemode: event.livemode,
          updated_at: now,
        };
        const wasSucceeded = intent.status === 'succeeded' && !!intent.payment_id;
        if (obj.payment_status === 'paid') {
          const paymentId = await postLedgerPayment(svc, intent, 'card', obj.payment_intent, stripeAccount);
          updates.status = 'succeeded';
          updates.succeeded_at = now;
          updates.payment_id = paymentId;
          updates.method = intent.method ?? 'card';
        } else if (intent.status === 'pending') {
          updates.status = 'processing'; // ACH: awaiting settlement
        }
        const { error: updateError } = await svc.from('payment_intents').update(updates).eq('id', intentId);
        if (updateError) throw new Error(`Checkout payment update failed: ${updateError.message}`);
        if (obj.payment_status === 'paid' && !wasSucceeded) {
          await logEvent(svc, intentId, 'stripe_accepted', 'Card payment confirmed at checkout');
          await logEvent(svc, intentId, 'ledger_posted', 'Payment applied to open charges per association policy');
          const emailed = await emailReceipt(svc, { ...intent, ...updates }, 'card');
          if (emailed) await logEvent(svc, intentId, 'receipt_emailed');
          await logEvent(svc, intentId, 'settlement_pending', 'Awaiting Stripe payout to the association bank');
          await captureFee(svc, intentId, obj.payment_intent, stripeAccount);
        } else if (obj.payment_status !== 'paid' && intent.status === 'pending') {
          await logEvent(svc, intentId, 'stripe_accepted', 'Bank (ACH) payment submitted — clearing takes 3-5 business days');
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const piId = obj.id;
        if (!stripeAccount || typeof piId !== 'string' || !piId.startsWith('pi_')) {
          throw new Error('Invalid settled PaymentIntent identity');
        }
        const localIntentId = obj.metadata?.intent_id;
        const query = svc.from('payment_intents').select('*');
        const { data: intent } = isUuid(localIntentId)
          ? await query.eq('id', localIntentId).maybeSingle()
          : await query.eq('processor_payment_intent_id', piId)
            .eq('processor_account_id', stripeAccount)
            .maybeSingle();
        if (!intent) throw new Error('Settled payment intent not found');
        await requireIntentAccount(svc, intent, stripeAccount);
        requireMatchingMoney(obj, intent, 'amount_received');
        if (intent.processor_livemode !== null && intent.processor_livemode !== event.livemode) {
          throw new Error('Payment mode does not match the payment intent');
        }
        const wasSucceeded = intent.status === 'succeeded' && !!intent.payment_id;
        const pmType = Array.isArray(obj.payment_method_types) && obj.payment_method_types.includes('us_bank_account') && obj.payment_method_types.length === 1
          ? 'ach'
          : (obj.latest_charge?.payment_method_details?.type === 'us_bank_account' ? 'ach' : 'card');
        const paymentId = await postLedgerPayment(svc, intent, pmType, piId, stripeAccount);
        const { error: updateError } = await svc.from('payment_intents').update({
          status: 'succeeded',
          succeeded_at: now,
          method: pmType,
          payment_id: paymentId,
          processor_payment_intent_id: piId,
          processor_account_id: stripeAccount,
          processor_livemode: event.livemode,
          processor_charge_id: typeof obj.latest_charge === 'string' ? obj.latest_charge : obj.latest_charge?.id ?? null,
          updated_at: now,
        }).eq('id', intent.id);
        if (updateError) throw new Error(`Settled payment update failed: ${updateError.message}`);
        await finalizeAutopayRun(svc, obj, intent.id, stripeAccount, 'succeeded');
        if (!wasSucceeded) {
          await logEvent(svc, intent.id, 'stripe_accepted', `${pmType === 'ach' ? 'Bank (ACH)' : 'Card'} payment settled at Stripe`);
          await logEvent(svc, intent.id, 'ledger_posted', 'Payment applied to open charges per association policy');
          const emailedOk = await emailReceipt(svc, { ...intent, processor_payment_intent_id: piId }, pmType);
          if (emailedOk) await logEvent(svc, intent.id, 'receipt_emailed');
          await logEvent(svc, intent.id, 'settlement_pending', 'Awaiting Stripe payout to the association bank');
          await captureFee(svc, intent.id, piId, stripeAccount);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        if (!stripeAccount || typeof obj.id !== 'string' || !obj.id.startsWith('pi_')) {
          throw new Error('Invalid failed PaymentIntent identity');
        }
        const localIntentId = obj.metadata?.intent_id;
        const query = svc.from('payment_intents').select('*');
        const { data: failedIntent } = isUuid(localIntentId)
          ? await query.eq('id', localIntentId).maybeSingle()
          : await query.eq('processor_payment_intent_id', obj.id)
            .eq('processor_account_id', stripeAccount)
            .maybeSingle();
        if (!failedIntent) throw new Error('Failed payment intent not found');
        await requireIntentAccount(svc, failedIntent, stripeAccount);
        requireMatchingMoney(obj, failedIntent, 'amount');
        if (failedIntent.processor_livemode !== null && failedIntent.processor_livemode !== event.livemode) {
          throw new Error('Failed payment mode does not match the payment intent');
        }
        const { data: failedRows, error: failedUpdateError } = await svc.from('payment_intents').update({
          status: 'failed',
          failure_reason: obj.last_payment_error?.message ?? 'Payment failed',
          processor_account_id: stripeAccount,
          processor_livemode: event.livemode,
          updated_at: now,
        }).eq('id', failedIntent.id).neq('status', 'succeeded').select('id');
        if (failedUpdateError) throw new Error(`Failed payment update failed: ${failedUpdateError.message}`);
        if ((failedRows ?? []).length > 0) {
          await finalizeAutopayRun(
            svc,
            obj,
            failedIntent.id,
            stripeAccount,
            'failed',
            obj.last_payment_error?.message ?? 'Payment failed',
          );
        }
        for (const r of failedRows ?? []) {
          await logEvent(svc, r.id, 'failed', obj.last_payment_error?.message ?? 'Payment failed');
        }
        break;
      }

      case 'charge.refunded': {
        if (!stripeAccount || typeof obj.id !== 'string' || !obj.id.startsWith('ch_')) {
          throw new Error('Invalid refunded charge identity');
        }
        const { data: refundedIntent } = await svc.from('payment_intents').select('*')
          .eq('processor_charge_id', obj.id)
          .eq('processor_account_id', stripeAccount)
          .maybeSingle();
        if (!refundedIntent) throw new Error('Refunded payment intent not found');
        await requireIntentAccount(svc, refundedIntent, stripeAccount);
        const refundCents = Number(obj.amount_refunded);
        const originalCents = usdDollarsToCents(refundedIntent.amount);
        if (!Number.isSafeInteger(refundCents) || refundCents <= 0 || refundCents > originalCents
            || String(obj.currency ?? '').toLowerCase() !== 'usd') {
          throw new Error('Refund amount or currency does not match the local payment');
        }
        const isFullRefund = refundCents === originalCents && obj.refunded === true;
        const { error: refundUpdateError } = await svc.from('payment_intents').update({
          status: isFullRefund ? 'refunded' : refundedIntent.status,
          failure_reason: `${isFullRefund ? 'Refund' : 'Partial refund'} recorded in Stripe — review the owner ledger for an offsetting adjustment.`,
          updated_at: now,
        }).eq('id', refundedIntent.id);
        if (refundUpdateError) throw new Error(`Refund status update failed: ${refundUpdateError.message}`);
        const { error: adjustmentError } = await svc.from('payment_processor_adjustments').upsert({
          stripe_event_id: event.id,
          payment_intent_id: refundedIntent.id,
          processor_account_id: stripeAccount,
          adjustment_type: 'refund',
          amount: refundCents / 100,
          currency: String(obj.currency ?? 'usd').toLowerCase(),
          reason: obj.refunds?.data?.[0]?.reason ?? null,
        }, { onConflict: 'stripe_event_id' });
        if (adjustmentError) throw new Error(`Refund review creation failed: ${adjustmentError.message}`);
        break;
      }

      case 'charge.dispute.created': {
        if (!stripeAccount || typeof obj.charge !== 'string' || !obj.charge.startsWith('ch_')) {
          throw new Error('Invalid disputed charge identity');
        }
        const { data: disputedIntent } = await svc.from('payment_intents').select('*')
          .eq('processor_charge_id', obj.charge)
          .eq('processor_account_id', stripeAccount)
          .maybeSingle();
        if (!disputedIntent) throw new Error('Disputed payment intent not found');
        await requireIntentAccount(svc, disputedIntent, stripeAccount);
        const disputeCents = Number(obj.amount);
        const paymentCents = usdDollarsToCents(disputedIntent.amount);
        if (!Number.isSafeInteger(disputeCents) || disputeCents <= 0 || disputeCents > paymentCents
            || String(obj.currency ?? '').toLowerCase() !== 'usd') {
          throw new Error('Dispute amount or currency does not match the local payment');
        }
        const { error: disputeUpdateError } = await svc.from('payment_intents').update({
          status: 'chargeback',
          failure_reason: `Dispute opened (${obj.reason ?? 'unknown reason'}) — respond in the Stripe dashboard.`,
          updated_at: now,
        }).eq('id', disputedIntent.id);
        if (disputeUpdateError) throw new Error(`Dispute status update failed: ${disputeUpdateError.message}`);
        const { error: adjustmentError } = await svc.from('payment_processor_adjustments').upsert({
          stripe_event_id: event.id,
          payment_intent_id: disputedIntent.id,
          processor_account_id: stripeAccount,
          adjustment_type: 'dispute',
          amount: disputeCents / 100,
          currency: String(obj.currency ?? 'usd').toLowerCase(),
          reason: obj.reason ?? null,
        }, { onConflict: 'stripe_event_id' });
        if (adjustmentError) throw new Error(`Dispute review creation failed: ${adjustmentError.message}`);
        break;
      }

      case 'payout.paid':
      case 'payout.created': {
        const payoutId = assertStripeId(obj.id, 'po', 'Stripe payout id');
        const payoutCents = Number(obj.amount);
        if (!Number.isSafeInteger(payoutCents) || payoutCents <= 0
            || String(obj.currency ?? '').toLowerCase() !== 'usd') {
          throw new Error('Invalid Stripe payout amount or currency');
        }
        const amount = payoutCents / 100;
        // Per-association Stripe accounts (Connect): the event carries the
        // connected account id, which maps 1:1 to an association — payouts
        // settle to THAT association's own bank, never a shared one.
        const connectedAccount: string | null = event.account ?? null;
        let associationId: string | null = null;
        let portfolioId: string | null = null;
        let settlementBankAccountId: string | null = null;
        if (connectedAccount) {
          const { data: assoc } = await svc
            .from('associations')
            .select('id, portfolio_id, stripe_settlement_bank_account_id')
            .eq('stripe_account_id', connectedAccount)
            .maybeSingle();
          associationId = assoc?.id ?? null;
          portfolioId = assoc?.portfolio_id ?? null;
          settlementBankAccountId = assoc?.stripe_settlement_bank_account_id ?? null;
        }
        if (!portfolioId || !associationId || !connectedAccount) {
          throw new Error('Unknown connected account for payout');
        }

        const arrival = obj.arrival_date ? new Date(obj.arrival_date * 1000).toISOString().slice(0, 10) : null;
        const { data: existingPayout, error: existingPayoutError } = await svc.from('payout_batches')
          .select('status')
          .eq('processor', 'stripe')
          .eq('processor_payout_id', payoutId)
          .maybeSingle();
        if (existingPayoutError) throw new Error(`Payout lookup failed: ${existingPayoutError.message}`);
        const initialStatus = event.type === 'payout.paid'
          ? 'paid'
          : (existingPayout?.status ?? 'pending');
        const { error: payoutUpsertError } = await svc.from('payout_batches').upsert({
          processor: 'stripe',
          processor_payout_id: payoutId,
          portfolio_id: portfolioId,
          association_id: associationId,
          processor_account_id: connectedAccount,
          settlement_bank_account_id: settlementBankAccountId,
          amount,
          arrival_date: arrival,
          status: initialStatus,
          updated_at: now,
        }, { onConflict: 'processor,processor_payout_id' });
        if (payoutUpsertError) throw new Error(`Payout record failed: ${payoutUpsertError.message}`);

        if (event.type === 'payout.paid') {
          // Stripe is authoritative for payout membership. Direct-charge
          // balance transactions are queried on this association's connected
          // account; gross portfolio totals must never be used as a proxy.
          const balanceTransactions = await listPayoutBalanceTransactions(payoutId, connectedAccount);
          const netCents = sumStripeNetCents(balanceTransactions);
          const chargeIds = payoutChargeIds(balanceTransactions);

          let includedIntents: Array<{ id: string; processor_payout_id: string | null }> = [];
          let conflictingPayoutCount = 0;
          if (chargeIds.length > 0) {
            const { data, error } = await svc.from('payment_intents')
              .select('id, processor_payout_id')
              .eq('association_id', associationId)
              .eq('processor_account_id', connectedAccount)
              .eq('status', 'succeeded')
              .in('processor_charge_id', chargeIds);
            if (error) throw new Error(`Payout membership lookup failed: ${error.message}`);
            conflictingPayoutCount = (data ?? []).filter(
              (intent: any) => intent.processor_payout_id && intent.processor_payout_id !== payoutId,
            ).length;
            includedIntents = (data ?? []).filter(
              (intent: any) => !intent.processor_payout_id || intent.processor_payout_id === payoutId,
            );
          }

          const missingChargeCount = chargeIds.length - includedIntents.length - conflictingPayoutCount;
          const payoutMatchesStripeNet = netCents === payoutCents;
          const reviewReasons = [
            ...(!settlementBankAccountId ? ['No association settlement bank account is configured'] : []),
            ...(!payoutMatchesStripeNet
              ? [`Stripe balance transaction net ${(netCents / 100).toFixed(2)} does not match payout ${amount.toFixed(2)}`]
              : []),
            ...(missingChargeCount > 0
              ? [`${missingChargeCount} payout charge(s) do not map to a settled local payment intent`]
              : []),
            ...(conflictingPayoutCount > 0
              ? [`${conflictingPayoutCount} charge(s) are already attributed to a different Stripe payout`]
              : []),
          ];

          if (includedIntents.length > 0) {
            const includedIds = includedIntents.map((intent) => intent.id);
            const { error: settleError } = await svc.from('payment_intents')
              .update({ processor_payout_id: payoutId, settled_at: now, updated_at: now })
              .eq('association_id', associationId)
              .eq('processor_account_id', connectedAccount)
              .in('id', includedIds);
            if (settleError) throw new Error(`Payout attribution failed: ${settleError.message}`);
            for (const intent of includedIntents) {
              await logEvent(svc, intent.id, 'payout_created', `Stripe payout ${payoutId} sent to the association bank`);
            }
          }

          const { error: payoutUpdateError } = await svc.from('payout_batches').update({
            expected_amount: netCents / 100,
            ...(reviewReasons.length > 0
              ? { status: 'needs_review', notes: `${reviewReasons.join('; ')}.`, updated_at: now }
              : { notes: null, updated_at: now }),
          }).eq('processor_payout_id', payoutId)
            .eq('processor', 'stripe')
            .eq('association_id', associationId)
            .eq('processor_account_id', connectedAccount);
          if (payoutUpdateError) throw new Error(`Payout status update failed: ${payoutUpdateError.message}`);

          // Try to reconcile against the Plaid bank feed immediately.
          await reconcilePayouts(svc);
        }
        break;
      }

      case 'account.updated': {
        // Connected-account onboarding progress → keep the association row current.
        const acctId = obj.id ?? event.account;
        if (!acctId || acctId !== stripeAccount) {
          throw new Error('Connected account update identity mismatch');
        }
        const { data: updatedAssociations, error: accountUpdateError } = await svc.from('associations').update({
          stripe_charges_enabled: !!obj.charges_enabled,
          stripe_payouts_enabled: !!obj.payouts_enabled,
          stripe_details_submitted: !!obj.details_submitted,
          stripe_disabled_reason: obj.requirements?.disabled_reason ?? null,
          stripe_last_status_at: now,
          stripe_deauthorized_at: null,
          ...(obj.charges_enabled && obj.payouts_enabled ? { stripe_onboarded_at: now } : {}),
        }).eq('stripe_account_id', acctId).select('id');
        if (accountUpdateError || updatedAssociations?.length !== 1) {
          throw new Error(`Connected account status update failed: ${accountUpdateError?.message ?? 'account is not linked to one association'}`);
        }
        break;
      }

      case 'account.application.deauthorized': {
        if (!stripeAccount) throw new Error('Connected account required for deauthorization');
        const { data: deauthorizedAssociations, error: deauthorizeError } = await svc.from('associations').update({
          stripe_charges_enabled: false,
          stripe_payouts_enabled: false,
          stripe_disabled_reason: 'account.application.deauthorized',
          stripe_deauthorized_at: now,
          stripe_last_status_at: now,
        }).eq('stripe_account_id', stripeAccount).select('id');
        if (deauthorizeError || deauthorizedAssociations?.length !== 1) {
          throw new Error(`Connected account deauthorization failed: ${deauthorizeError?.message ?? 'account is not linked to one association'}`);
        }
        break;
      }

      case 'payout.failed': {
        if (!stripeAccount) throw new Error('Connected account required for failed payout');
        const { data: payoutAssociation } = await svc.from('associations').select('id')
          .eq('stripe_account_id', stripeAccount).maybeSingle();
        if (!payoutAssociation) throw new Error('Unknown connected account for failed payout');
        const { data: failedPayouts, error: failedPayoutError } = await svc.from('payout_batches').update({ status: 'failed', notes: obj.failure_message ?? 'Payout failed', updated_at: now })
          .eq('processor_payout_id', obj.id).eq('processor', 'stripe')
          .eq('association_id', payoutAssociation.id)
          .eq('processor_account_id', stripeAccount)
          .select('id');
        if (failedPayoutError || failedPayouts?.length !== 1) {
          throw new Error(`Failed payout update failed: ${failedPayoutError?.message ?? 'payout not found'}`);
        }
        break;
      }

      default:
        break; // ignore unhandled events
    }
  } catch (err: any) {
    await svc.from('stripe_webhook_events').update({
      status: 'failed',
      last_error: String(err?.message ?? 'handler failed').slice(0, 500),
    }).eq('event_id', event.id);
    console.error('Stripe webhook error:', event?.type, err?.message);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }

  const { error: processedError } = await svc.from('stripe_webhook_events').update({
    status: 'processed',
    processed_at: now,
    last_error: null,
  }).eq('event_id', event.id);
  if (processedError) {
    console.error('Stripe webhook completion record failed:', processedError.message);
    return NextResponse.json({ error: 'Webhook completion unavailable' }, { status: 503 });
  }
  return NextResponse.json({ received: true });
}
