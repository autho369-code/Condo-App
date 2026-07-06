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
import { verifyStripeSignature, isStripeConfigured, retrievePaymentIntent } from '@/lib/payments/stripe';
import { reconcilePayouts } from '@/lib/payments/reconcile';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function logEvent(db: any, intentId: string, eventName: string, detail?: string | null) {
  try {
    await db.from('payment_events').insert({ payment_intent_id: intentId, event: eventName, detail: detail ?? null });
  } catch { /* audit trail is best-effort, never blocks money movement */ }
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
    await db.from('email_queue').insert({
      to_email: owner.email,
      to_name: owner.full_name,
      subject: `Payment received — ${amount} for Unit ${unit?.unit_number ?? ''}`,
      body: `<p>Hello${owner.full_name ? ` ${owner.full_name}` : ''},</p><p>We received your ${method === 'ach' ? 'bank (ACH)' : 'card'} payment of <strong>${amount}</strong> for Unit ${unit?.unit_number ?? ''} at ${assoc?.name ?? 'your association'}. It has been applied to your account.</p><p>You can view your updated ledger any time in the owner portal.</p><p>Reference: ${intent.processor_payment_intent_id ?? intent.id}</p>`,
      status: 'pending',
      from_address: 'hello@portier369.com',
      from_name: 'Portier369',
      portfolio_id: intent.portfolio_id,
    });
    return true;
  } catch {
    return false;
  }
}

/** Best-effort Stripe fee capture from the charge's balance transaction. */
async function captureFee(db: any, intentId: string, piId: string, stripeAccount: string | null) {
  try {
    const pi = await retrievePaymentIntent(piId, stripeAccount);
    const fee = pi?.latest_charge?.balance_transaction?.fee;
    if (typeof fee === 'number') {
      await db.from('payment_intents').update({ processor_fee_cents: fee }).eq('id', intentId);
    }
  } catch { /* fees are informational */ }
}

async function postLedgerPayment(db: any, intent: any, method: string, piId: string) {
  // Idempotent: never post twice for the same intent.
  if (intent.payment_id) return intent.payment_id;

  const { data: payment, error } = await db
    .from('payments')
    .insert({
      unit_id: intent.unit_id,
      amount: intent.amount,
      payment_date: new Date().toISOString().slice(0, 10),
      method,
      reference: piId,
      notes: `Online payment via Stripe (${method})`,
    })
    .select('id')
    .single();
  if (error) throw new Error(`ledger post failed: ${error.message}`);
  return payment.id;
}

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const rawBody = await request.text();
  if (!verifyStripeSignature(rawBody, request.headers.get('stripe-signature'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const svc = createServiceClient() as any;
  const obj = event?.data?.object ?? {};
  const now = new Date().toISOString();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        // AutoPay enrollment: setup-mode sessions save a payment method and
        // activate the mandate described in the session metadata.
        if (obj.mode === 'setup') {
          const md = obj.metadata ?? {};
          if (!event.account || !obj.setup_intent || !md.owner_id) break;
          const { getSetupIntent, getPaymentMethod } = await import('@/lib/payments/stripe');
          const si = await getSetupIntent(obj.setup_intent, event.account);
          if (!si?.payment_method) break;
          let methodType = 'card';
          let lastFour: string | null = null;
          let brand: string | null = null;
          let bankName: string | null = null;
          try {
            const pm = await getPaymentMethod(si.payment_method, event.account);
            methodType = pm?.type === 'us_bank_account' ? 'ach' : 'card';
            lastFour = pm?.card?.last4 ?? pm?.us_bank_account?.last4 ?? null;
            brand = pm?.card?.brand ?? null;
            bankName = pm?.us_bank_account?.bank_name ?? null;
          } catch { /* cosmetic details only */ }

          const { data: savedMethod, error: pmErr } = await svc.from('payment_methods').insert({
            portfolio_id: md.portfolio_id,
            owner_id: md.owner_id,
            processor: 'stripe',
            method_type: methodType,
            processor_token: si.payment_method,
            processor_customer_id: obj.customer ?? si.customer ?? null,
            last_four: lastFour,
            brand,
            bank_name: bankName,
            is_default: true,
            is_verified: true,
            verified_at: now,
          }).select('id').single();
          if (pmErr || !savedMethod) break;

          const dayOfMonth = Math.min(28, Math.max(1, Number(md.day_of_month ?? 1)));
          const today = new Date();
          const nextRun = new Date(today.getFullYear(), today.getMonth() + (today.getDate() >= dayOfMonth ? 1 : 0), dayOfMonth);
          await svc.from('autopay_mandates').insert({
            portfolio_id: md.portfolio_id,
            association_id: md.association_id ?? null,
            owner_id: md.owner_id,
            unit_id: md.unit_id ?? null,
            payment_method_id: savedMethod.id,
            authorized_amount_max_cents: Number(md.max_cents ?? 500000),
            frequency: 'monthly',
            day_of_month: dayOfMonth,
            start_date: now.slice(0, 10),
            status: 'active',
            mandate_signed_at: now,
            next_run_date: nextRun.toISOString().slice(0, 10),
            mode: md.mode ?? 'current_balance',
            fixed_amount_cents: md.fixed_cents ? Number(md.fixed_cents) : null,
            minimum_amount_cents: md.minimum_cents ? Number(md.minimum_cents) : null,
            include_late_fees: md.include_late_fees !== 'false',
          });
          break;
        }

        const intentId = obj.client_reference_id;
        if (!intentId) break;
        const { data: intent } = await svc.from('payment_intents').select('*').eq('id', intentId).maybeSingle();
        if (!intent) break;
        const updates: any = {
          processor_payment_intent_id: obj.payment_intent ?? intent.processor_payment_intent_id,
          updated_at: now,
        };
        if (obj.payment_status === 'paid' && intent.status !== 'succeeded') {
          const paymentId = await postLedgerPayment(svc, intent, 'card', obj.payment_intent ?? obj.id);
          updates.status = 'succeeded';
          updates.succeeded_at = now;
          updates.payment_id = paymentId;
          updates.method = intent.method ?? 'card';
          await logEvent(svc, intentId, 'stripe_accepted', 'Card payment confirmed at checkout');
          await logEvent(svc, intentId, 'ledger_posted', 'Payment applied to open charges per association policy');
          const emailed = await emailReceipt(svc, { ...intent, ...updates, processor_payment_intent_id: updates.processor_payment_intent_id }, 'card');
          if (emailed) await logEvent(svc, intentId, 'receipt_emailed');
          await logEvent(svc, intentId, 'settlement_pending', 'Awaiting Stripe payout to the association bank');
          if (event.account) await captureFee(svc, intentId, obj.payment_intent, event.account);
        } else if (intent.status === 'pending') {
          updates.status = 'processing'; // ACH: awaiting settlement
          await logEvent(svc, intentId, 'stripe_accepted', 'Bank (ACH) payment submitted — clearing takes 3-5 business days');
        }
        await svc.from('payment_intents').update(updates).eq('id', intentId);
        break;
      }

      case 'payment_intent.succeeded': {
        const piId = obj.id;
        const { data: intent } = await svc
          .from('payment_intents')
          .select('*')
          .or(`processor_payment_intent_id.eq.${piId},id.eq.${obj.metadata?.intent_id ?? '00000000-0000-0000-0000-000000000000'}`)
          .maybeSingle();
        if (!intent || intent.status === 'succeeded') break;
        const pmType = Array.isArray(obj.payment_method_types) && obj.payment_method_types.includes('us_bank_account') && obj.payment_method_types.length === 1
          ? 'ach'
          : (obj.latest_charge?.payment_method_details?.type === 'us_bank_account' ? 'ach' : 'card');
        const paymentId = await postLedgerPayment(svc, intent, pmType, piId);
        await svc.from('payment_intents').update({
          status: 'succeeded',
          succeeded_at: now,
          method: pmType,
          payment_id: paymentId,
          processor_payment_intent_id: piId,
          processor_charge_id: typeof obj.latest_charge === 'string' ? obj.latest_charge : obj.latest_charge?.id ?? null,
          updated_at: now,
        }).eq('id', intent.id);
        await logEvent(svc, intent.id, 'stripe_accepted', `${pmType === 'ach' ? 'Bank (ACH)' : 'Card'} payment settled at Stripe`);
        await logEvent(svc, intent.id, 'ledger_posted', 'Payment applied to open charges per association policy');
        const emailedOk = await emailReceipt(svc, { ...intent, processor_payment_intent_id: piId }, pmType);
        if (emailedOk) await logEvent(svc, intent.id, 'receipt_emailed');
        await logEvent(svc, intent.id, 'settlement_pending', 'Awaiting Stripe payout to the association bank');
        if (event.account) await captureFee(svc, intent.id, piId, event.account);
        break;
      }

      case 'payment_intent.payment_failed': {
        const { data: failedRows } = await svc.from('payment_intents').update({
          status: 'failed',
          failure_reason: obj.last_payment_error?.message ?? 'Payment failed',
          updated_at: now,
        }).eq('processor_payment_intent_id', obj.id).neq('status', 'succeeded').select('id');
        for (const r of failedRows ?? []) {
          await logEvent(svc, r.id, 'failed', obj.last_payment_error?.message ?? 'Payment failed');
        }
        break;
      }

      case 'charge.refunded': {
        await svc.from('payment_intents').update({
          status: 'refunded',
          failure_reason: 'Refunded in Stripe — review the owner ledger for an offsetting adjustment.',
          updated_at: now,
        }).eq('processor_charge_id', obj.id);
        break;
      }

      case 'charge.dispute.created': {
        await svc.from('payment_intents').update({
          status: 'chargeback',
          failure_reason: `Dispute opened (${obj.reason ?? 'unknown reason'}) — respond in the Stripe dashboard.`,
          updated_at: now,
        }).eq('processor_charge_id', obj.charge);
        break;
      }

      case 'payout.paid':
      case 'payout.created': {
        const payoutId = obj.id;
        const amount = (obj.amount ?? 0) / 100;
        // Per-association Stripe accounts (Connect): the event carries the
        // connected account id, which maps 1:1 to an association — payouts
        // settle to THAT association's own bank, never a shared one.
        const connectedAccount: string | null = event.account ?? null;
        let associationId: string | null = null;
        let portfolioId: string | null = null;
        if (connectedAccount) {
          const { data: assoc } = await svc
            .from('associations')
            .select('id, portfolio_id')
            .eq('stripe_account_id', connectedAccount)
            .maybeSingle();
          associationId = assoc?.id ?? null;
          portfolioId = assoc?.portfolio_id ?? null;
        }
        if (!portfolioId) break; // unknown connected account — ignore

        const arrival = obj.arrival_date ? new Date(obj.arrival_date * 1000).toISOString().slice(0, 10) : null;
        await svc.from('payout_batches').upsert({
          processor: 'stripe',
          processor_payout_id: payoutId,
          portfolio_id: portfolioId,
          association_id: associationId,
          amount,
          arrival_date: arrival,
          status: event.type === 'payout.paid' ? 'paid' : 'pending',
          updated_at: now,
        }, { onConflict: 'processor,processor_payout_id' });

        if (event.type === 'payout.paid') {
          // Attribute this payout to the association's unsettled succeeded
          // intents (exact batch sum match — Rule 1 of the matching spec).
          let unsettledQuery = svc
            .from('payment_intents')
            .select('id, amount')
            .eq('status', 'succeeded')
            .is('processor_payout_id', null);
          unsettledQuery = associationId
            ? unsettledQuery.eq('association_id', associationId)
            : unsettledQuery.eq('portfolio_id', portfolioId);
          const { data: unsettled } = await unsettledQuery;
          const total = (unsettled ?? []).reduce((s: number, i: any) => s + Number(i.amount), 0);
          await svc.from('payout_batches').update({ expected_amount: total, updated_at: now })
            .eq('processor_payout_id', payoutId).eq('processor', 'stripe');
          if (Math.abs(total - amount) < 0.01 && (unsettled ?? []).length > 0) {
            await svc.from('payment_intents')
              .update({ processor_payout_id: payoutId, settled_at: now, updated_at: now })
              .in('id', (unsettled ?? []).map((i: any) => i.id));
            for (const i of unsettled ?? []) {
              await logEvent(svc, i.id, 'payout_created', `Stripe payout ${payoutId} sent to the association bank`);
            }
          } else if ((unsettled ?? []).length > 0) {
            await svc.from('payout_batches').update({
              status: 'needs_review',
              notes: `Payout ${amount.toFixed(2)} does not equal the ${total.toFixed(2)} of unsettled online payments (fees or partial batch) — review and settle manually.`,
              updated_at: now,
            }).eq('processor_payout_id', payoutId).eq('processor', 'stripe');
          }
          // Try to reconcile against the Plaid bank feed immediately.
          await reconcilePayouts(svc);
        }
        break;
      }

      case 'account.updated': {
        // Connected-account onboarding progress → keep the association row current.
        const acctId = obj.id ?? event.account;
        if (!acctId) break;
        await svc.from('associations').update({
          stripe_charges_enabled: !!obj.charges_enabled,
          stripe_details_submitted: !!obj.details_submitted,
          ...(obj.charges_enabled ? { stripe_onboarded_at: now } : {}),
        }).eq('stripe_account_id', acctId);
        break;
      }

      case 'payout.failed': {
        await svc.from('payout_batches').update({ status: 'failed', notes: obj.failure_message ?? 'Payout failed', updated_at: now })
          .eq('processor_payout_id', obj.id).eq('processor', 'stripe');
        break;
      }

      default:
        break; // ignore unhandled events
    }
  } catch (err: any) {
    console.error('Stripe webhook error:', event?.type, err?.message);
    return NextResponse.json({ error: err?.message ?? 'handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
