'use server';
// Creates a Stripe Checkout Session for a owner dues payment.
// Flow:
//   1. Insert a payment_intents row (pending) so we have a record.
//   2. Call calculate_convenience_fee to decide whether to add a fee line item.
//   3. Create a Stripe Checkout Session with the dues amount + optional fee.
//   4. Stamp the session id + URL back on payment_intents.
//   5. Redirect to session.url.
//
// Webhook (stripe-webhook edge function v2) handles:
//   - checkout.session.completed → updates payment_intents.status and inserts a
//     payments row. auto_apply_new_payment trigger then applies to charges.

import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/auth/me';
import { redirect } from 'next/navigation';

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  return new Stripe(key, { apiVersion: '2024-12-18.acacia' as any });
}

export async function createOwnerCheckoutSession(formData: FormData) {
  const me = await getMe();
  if (!me.auth_user_id || !me.owner_id || !me.portfolio) {
    return { error: 'You must be logged in as a owner.' };
  }

  const unit_id       = formData.get('unit_id') as string;
  const amount_dollars = parseFloat(formData.get('amount') as string);
  const method        = (formData.get('method') as string) || 'card';

  if (!unit_id || !(amount_dollars > 0)) return { error: 'Pick a unit and a positive amount.' };

  const supabase = await createClient();
  const amount_cents = Math.round(amount_dollars * 100);

  // 1) Resolve convenience fee via DB helper — respects portfolio policy
  const { data: feeCalc } = await supabase.rpc('calculate_convenience_fee', {
    p_portfolio_id: me.portfolio.id,
    p_amount_cents: amount_cents,
    p_method: method,
  });

  const feeCents   = (feeCalc as any)?.fee_cents ?? 0;
  const ownerPays  = (feeCalc as any)?.owner_pays_cents ?? amount_cents;
  const feeMode    = (feeCalc as any)?.mode as string ?? 'absorb';
  const feeLabel   = (feeCalc as any)?.label ?? 'Processing fee';

  // 2) Create our payment_intents row first
  const { data: pi, error: piErr } = await supabase.from('payment_intents').insert({
    unit_id,
    owner_id: me.owner_id,
    amount: amount_dollars,
    method,
    description: `Owner portal payment — ${me.portfolio.company_name ?? 'portfolio'}`,
    processor: 'stripe',
    status: 'pending',
    convenience_fee_cents: feeCents,
    owner_paid_cents: ownerPays,
    metadata: { fee_mode: feeMode },
    created_by: me.auth_user_id,
  }).select('id').single();
  if (piErr || !pi) return { error: piErr?.message ?? 'Could not create payment record.' };

  // 3) Build the Stripe Checkout Session
  const stripe = stripeClient();
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: 'usd',
        product_data: { name: `${me.portfolio.company_name ?? 'HOA'} — Assessment payment` },
        unit_amount: amount_cents,
      },
      quantity: 1,
    },
  ];
  if (feeCents > 0 && feeMode === 'pass_through') {
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: feeLabel },
        unit_amount: feeCents,
      },
      quantity: 1,
    });
  }

  const baseUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'http://localhost:3000';
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: method === 'ach'
      ? (['us_bank_account'] as Stripe.Checkout.SessionCreateParams.PaymentMethodType[])
      : (['card'] as Stripe.Checkout.SessionCreateParams.PaymentMethodType[]),
    line_items: lineItems,
    success_url: `${baseUrl}/portal/pay/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${baseUrl}/portal/pay/cancel?pi=${pi.id}`,
    customer_email: me.email ?? undefined,
    metadata: {
      payment_intent_id: pi.id,
      unit_id,
      owner_id: me.owner_id,
      portfolio_id: me.portfolio.id,
    },
    payment_intent_data: {
      metadata: {
        payment_intent_id: pi.id,
        unit_id,
        owner_id: me.owner_id,
      },
    },
  });

  // 4) Stamp session id back on our row
  await supabase.from('payment_intents').update({
    stripe_checkout_session_id: session.id,
  }).eq('id', pi.id);

  // 5) Redirect to Stripe-hosted checkout
  if (!session.url) return { error: 'Stripe did not return a checkout URL.' };
  redirect(session.url);
}

export async function cancelPendingPaymentIntent(paymentIntentId: string) {
  const supabase = await createClient();
  await supabase.from('payment_intents')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('id', paymentIntentId)
    .eq('status', 'pending');
}
