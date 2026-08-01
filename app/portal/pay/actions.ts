'use server';

import { randomUUID } from 'node:crypto';

import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/auth/me';
import { createServiceClient } from '@/lib/supabase/server';
import { createCheckoutSession, expectedStripeLivemode, isStripeConfigured } from '@/lib/payments/stripe';
import { associationCanAcceptStripePayments, parseUsdCents } from '@/lib/payments/guards';
import { tenantWorkspaceUrl } from '@/lib/tenant/host';

const RETURN = '/portal/pay';

/**
 * Start an online payment: create a payment_intents row (Portier ledger is
 * the source of truth) and a Stripe Checkout session, then send the owner to
 * Stripe. The webhook posts the ledger payment when Stripe confirms.
 */
export async function startOnlinePayment(formData: FormData) {
  const me = await requireOwner();
  if (!isStripeConfigured()) {
    redirect(`${RETURN}?error=${encodeURIComponent('Online payments are not enabled yet.')}`);
  }

  const unitId = (formData.get('unit_id') as string) || '';
  const amountRaw = ((formData.get('amount') as string) || '').replace(/[$,]/g, '').trim();
  const amountCents = parseUsdCents(amountRaw);
  if (!unitId || amountCents === null) {
    redirect(`${RETURN}?error=${encodeURIComponent('Enter a valid amount (minimum $1.00).')}`);
  }
  const amount = amountCents / 100;

  const svc = createServiceClient() as any;

  // Validate the unit belongs to this owner and resolve association/portfolio.
  const { data: occ } = await svc
    .from('occupancies')
    .select('unit_id, association_id, associations(portfolio_id, name, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_deauthorized_at), units(unit_number)')
    .eq('owner_id', me.owner_id)
    .eq('unit_id', unitId)
    .eq('status', 'current')
    .maybeSingle();
  if (!occ?.association_id || !occ?.associations?.portfolio_id) {
    redirect(`${RETURN}?error=${encodeURIComponent('That unit is not linked to your account.')}`);
  }
  // Per-association Stripe accounts: money settles to THIS association's own
  // bank. No connected account, no online payments.
  if (!associationCanAcceptStripePayments(occ.associations)) {
    redirect(`${RETURN}?error=${encodeURIComponent('Online payments are not enabled for your association yet — please use the payment instructions below.')}`);
  }

  const intentId = randomUUID();
  const idempotencyKey = `checkout-${intentId}`;
  const processorLivemode = expectedStripeLivemode();
  if (processorLivemode === null) {
    redirect(`${RETURN}?error=${encodeURIComponent('Online payments are not configured safely.')}`);
  }
  const { data: intent, error } = await svc
    .from('payment_intents')
    .insert({
      id: intentId,
      portfolio_id: occ.associations.portfolio_id,
      association_id: occ.association_id,
      unit_id: unitId,
      owner_id: me.owner_id,
      amount,
      status: 'pending',
      processor_account_id: occ.associations.stripe_account_id,
      processor_livemode: processorLivemode,
      idempotency_key: idempotencyKey,
      breakdown: [{ description: `Assessment payment — Unit ${occ.units?.unit_number ?? ''}`, amount }],
    })
    .select('id')
    .single();
  if (error || !intent) {
    redirect(`${RETURN}?error=${encodeURIComponent('Could not start the payment. Please try again.')}`);
  }

  let session;
  try {
    session = await createCheckoutSession({
      intentId: intent.id,
      amountCents,
      description: `${occ.associations?.name ?? 'Association'} — Unit ${occ.units?.unit_number ?? ''} assessment payment`,
      customerEmail: me.profile?.email ?? null,
      successUrl: tenantWorkspaceUrl(me.portfolio?.slug, `/portal/pay/success?intent=${intent.id}`),
      cancelUrl: tenantWorkspaceUrl(me.portfolio?.slug, '/portal/pay?canceled=1'),
      metadata: { intent_id: intent.id, unit_id: unitId, association_id: occ.association_id },
      stripeAccount: occ.associations.stripe_account_id,
    });
  } catch (err: any) {
    await svc.from('payment_intents').update({ status: 'failed', failure_reason: err?.message ?? 'Checkout creation failed' }).eq('id', intent.id);
    redirect(`${RETURN}?error=${encodeURIComponent('Could not start the payment — please try again or use the offline options below.')}`);
  }

  const { error: sessionUpdateError } = await svc
    .from('payment_intents')
    .update({ processor_session_id: session.id })
    .eq('id', intent.id)
    .eq('status', 'pending');
  const { error: eventError } = await svc.from('payment_events').insert([
    { payment_intent_id: intent.id, event: 'initiated', detail: `Owner started a $${amount.toFixed(2)} payment from the portal` },
    { payment_intent_id: intent.id, event: 'checkout_created', detail: 'Redirected to secure Stripe checkout' },
  ]);
  if (sessionUpdateError || eventError) {
    await svc
      .from('payment_intents')
      .update({ status: 'failed', failure_reason: 'Could not persist Stripe checkout state' })
      .eq('id', intent.id)
      .eq('status', 'pending');
    redirect(`${RETURN}?error=${encodeURIComponent('Could not start the payment. Please try again.')}`);
  }
  redirect(session.url);
}
