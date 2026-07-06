'use server';

import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/auth/me';
import { createServiceClient } from '@/lib/supabase/server';
import { createCheckoutSession, isStripeConfigured } from '@/lib/payments/stripe';

const SITE_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portier369.com';
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
  const amount = Math.round(Number(amountRaw) * 100) / 100;
  if (!unitId || !Number.isFinite(amount) || amount < 1) {
    redirect(`${RETURN}?error=${encodeURIComponent('Enter a valid amount (minimum $1.00).')}`);
  }
  if (amount > 50000) {
    redirect(`${RETURN}?error=${encodeURIComponent('For payments over $50,000 please contact your management company.')}`);
  }

  const svc = createServiceClient() as any;

  // Validate the unit belongs to this owner and resolve association/portfolio.
  const { data: occ } = await svc
    .from('occupancies')
    .select('unit_id, association_id, associations(portfolio_id, name, stripe_account_id, stripe_charges_enabled), units(unit_number)')
    .eq('owner_id', me.owner_id)
    .eq('unit_id', unitId)
    .eq('status', 'current')
    .maybeSingle();
  if (!occ?.association_id || !occ?.associations?.portfolio_id) {
    redirect(`${RETURN}?error=${encodeURIComponent('That unit is not linked to your account.')}`);
  }
  // Per-association Stripe accounts: money settles to THIS association's own
  // bank. No connected account, no online payments.
  if (!occ.associations.stripe_account_id || !occ.associations.stripe_charges_enabled) {
    redirect(`${RETURN}?error=${encodeURIComponent('Online payments are not enabled for your association yet — please use the payment instructions below.')}`);
  }

  const { data: intent, error } = await svc
    .from('payment_intents')
    .insert({
      portfolio_id: occ.associations.portfolio_id,
      association_id: occ.association_id,
      unit_id: unitId,
      owner_id: me.owner_id,
      amount,
      status: 'pending',
      breakdown: [{ description: `Assessment payment — Unit ${occ.units?.unit_number ?? ''}`, amount }],
    })
    .select('id')
    .single();
  if (error) redirect(`${RETURN}?error=${encodeURIComponent(error.message)}`);

  let session;
  try {
    session = await createCheckoutSession({
      intentId: intent.id,
      amountCents: Math.round(amount * 100),
      description: `${occ.associations?.name ?? 'Association'} — Unit ${occ.units?.unit_number ?? ''} assessment payment`,
      customerEmail: me.profile?.email ?? null,
      successUrl: `${SITE_URL}/portal/pay/success?intent=${intent.id}`,
      cancelUrl: `${SITE_URL}/portal/pay?canceled=1`,
      metadata: { intent_id: intent.id, unit_id: unitId, association_id: occ.association_id },
      stripeAccount: occ.associations.stripe_account_id,
    });
  } catch (err: any) {
    await svc.from('payment_intents').update({ status: 'failed', failure_reason: err?.message ?? 'Checkout creation failed' }).eq('id', intent.id);
    redirect(`${RETURN}?error=${encodeURIComponent('Could not start the payment — please try again or use the offline options below.')}`);
  }

  await svc.from('payment_intents').update({ processor_session_id: session.id }).eq('id', intent.id);
  await svc.from('payment_events').insert([
    { payment_intent_id: intent.id, event: 'initiated', detail: `Owner started a $${amount.toFixed(2)} payment from the portal` },
    { payment_intent_id: intent.id, event: 'checkout_created', detail: 'Redirected to secure Stripe checkout' },
  ]);
  redirect(session.url);
}
