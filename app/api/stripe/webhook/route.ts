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
import { verifyStripeSignature, isStripeConfigured } from '@/lib/payments/stripe';
import { reconcilePayouts } from '@/lib/payments/reconcile';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

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
        } else if (intent.status === 'pending') {
          updates.status = 'processing'; // ACH: awaiting settlement
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
        break;
      }

      case 'payment_intent.payment_failed': {
        await svc.from('payment_intents').update({
          status: 'failed',
          failure_reason: obj.last_payment_error?.message ?? 'Payment failed',
          updated_at: now,
        }).eq('processor_payment_intent_id', obj.id).neq('status', 'succeeded');
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
        // v1 runs a single Stripe account for the platform's one merchant, so
        // the payout portfolio is the portfolio with online payments (env
        // override available for explicitness).
        let portfolioId = process.env.STRIPE_PORTFOLIO_ID ?? null;
        if (!portfolioId) {
          const { data: anyIntent } = await svc.from('payment_intents').select('portfolio_id').eq('status', 'succeeded').order('created_at', { ascending: false }).limit(1).maybeSingle();
          portfolioId = anyIntent?.portfolio_id ?? null;
        }
        if (!portfolioId) {
          const { data: onlyPortfolio } = await svc.from('portfolios').select('id').is('archived_at', null).limit(2);
          if ((onlyPortfolio ?? []).length === 1) portfolioId = onlyPortfolio[0].id;
        }
        if (!portfolioId) break;

        const arrival = obj.arrival_date ? new Date(obj.arrival_date * 1000).toISOString().slice(0, 10) : null;
        await svc.from('payout_batches').upsert({
          processor: 'stripe',
          processor_payout_id: payoutId,
          portfolio_id: portfolioId,
          amount,
          arrival_date: arrival,
          status: event.type === 'payout.paid' ? 'paid' : 'pending',
          updated_at: now,
        }, { onConflict: 'processor,processor_payout_id' });

        if (event.type === 'payout.paid') {
          // Attribute this payout to unsettled succeeded intents (exact batch
          // sum match — Rule 1 of the matching spec).
          const { data: unsettled } = await svc
            .from('payment_intents')
            .select('id, amount')
            .eq('portfolio_id', portfolioId)
            .eq('status', 'succeeded')
            .is('processor_payout_id', null);
          const total = (unsettled ?? []).reduce((s: number, i: any) => s + Number(i.amount), 0);
          await svc.from('payout_batches').update({ expected_amount: total, updated_at: now })
            .eq('processor_payout_id', payoutId).eq('processor', 'stripe');
          if (Math.abs(total - amount) < 0.01 && (unsettled ?? []).length > 0) {
            await svc.from('payment_intents')
              .update({ processor_payout_id: payoutId, settled_at: now, updated_at: now })
              .in('id', (unsettled ?? []).map((i: any) => i.id));
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
