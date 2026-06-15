'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

/* ============ Charge Categories ============ */

export async function createChargeCategory(formData: FormData) {
  const failTo = (msg: string) => {
    redirect(`/charge-categories/new?error=${encodeURIComponent(msg)}`);
  };
  const supabase = await createClient();
  const { data, error } = await (supabase as any).from('charge_categories').insert({
    portfolio_id:       formData.get('portfolio_id') as string,
    association_id:     (formData.get('association_id') as string) || null,
    name:               formData.get('name') as string,
    code:               (formData.get('code') as string)?.toUpperCase() || null,
    description:        (formData.get('description') as string) || null,
    default_amount:     parseFloat(formData.get('default_amount') as string) || 0,
    default_frequency:  (formData.get('default_frequency') as any) || 'monthly',
    gl_account_id:      (formData.get('gl_account_id') as string) || null,
    charge_type:        (formData.get('charge_type') as any) || 'other',
    is_assessment:      formData.get('is_assessment') === 'on',
    is_fee:             formData.get('is_fee') === 'on',
    active:             true,
  }).select('id').single();
  if (error) { failTo(error.message); return; }
  revalidatePath('/charge-categories');
  redirect(`/charge-categories/${data.id}`);
}

export async function updateChargeCategory(id: string, formData: FormData) {
  const failTo = (msg: string) => {
    redirect(`/charge-categories/${id}?error=${encodeURIComponent(msg)}`);
  };
  const supabase = await createClient();
  const { error } = await (supabase as any).from('charge_categories').update({
    name:              formData.get('name') as string,
    code:              (formData.get('code') as string)?.toUpperCase() || null,
    description:       (formData.get('description') as string) || null,
    default_amount:    parseFloat(formData.get('default_amount') as string) || 0,
    default_frequency: (formData.get('default_frequency') as any) || 'monthly',
    gl_account_id:     (formData.get('gl_account_id') as string) || null,
    charge_type:       (formData.get('charge_type') as any) || 'other',
    is_assessment:     formData.get('is_assessment') === 'on',
    is_fee:            formData.get('is_fee') === 'on',
    active:            formData.get('active') === 'on',
  }).eq('id', id);
  if (error) { failTo(error.message); return; }
  revalidatePath('/charge-categories');
  revalidatePath(`/charge-categories/${id}`);
}

export async function archiveChargeCategory(id: string) {
  const failTo = (msg: string) => {
    redirect(`/charge-categories/${id}?error=${encodeURIComponent(msg)}`);
  };
  const supabase = await createClient();
  const { error } = await (supabase as any).from('charge_categories')
    .update({ archived_at: new Date().toISOString(), active: false }).eq('id', id);
  if (error) { failTo(error.message); return; }
  revalidatePath('/charge-categories');
  redirect('/charge-categories');
}

/* ============ Per-Unit Subscriptions ============ */

export async function subscribeUnitToCharge(formData: FormData) {
  const supabase = await createClient();
  const unit_id            = formData.get('unit_id') as string;
  const failTo = (msg: string) => {
    redirect(`/units/${unit_id}?error=${encodeURIComponent(msg)}`);
  };
  const charge_category_id = formData.get('charge_category_id') as string;
  const amount             = parseFloat(formData.get('amount') as string);
  const frequency          = (formData.get('frequency') as any) || null;
  const start_date         = (formData.get('start_date') as string) || undefined;
  const memo               = (formData.get('memo') as string) || undefined;
  const identifier         = (formData.get('identifier') as string) || undefined;

  const { error } = await (supabase as any).rpc('subscribe_unit_to_charge', {
    p_unit_id:            unit_id,
    p_charge_category_id: charge_category_id,
    p_amount:             amount,
    p_frequency:          frequency,
    p_start_date:         start_date,
    p_memo:               memo,
    p_identifier:         identifier,
  });
  if (error) { failTo(error.message); return; }
  revalidatePath(`/units/${unit_id}`);
}

export async function unsubscribeUnit(subscriptionId: string, unitId: string) {
  const failTo = (msg: string) => {
    redirect(`/units/${unitId}?error=${encodeURIComponent(msg)}`);
  };
  const supabase = await createClient();
  const { error } = await (supabase as any).from('unit_recurring_charges')
    .update({ active: false, end_date: new Date().toISOString().slice(0,10) })
    .eq('id', subscriptionId);
  if (error) { failTo(error.message); return; }
  revalidatePath(`/units/${unitId}`);
}

export async function updateUnitSubscription(id: string, unitId: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await (supabase as any).from('unit_recurring_charges').update({
    amount:    parseFloat(formData.get('amount') as string),
    frequency: (formData.get('frequency') as any) || 'monthly',
    memo:      (formData.get('memo') as string) || null,
    active:    formData.get('active') === 'on',
  }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(`/units/${unitId}`);
}

/* ============ Ad-hoc charges + manual receipts ============ */

export async function postAdHocCharge(formData: FormData) {
  const supabase = await createClient();
  const unit_id            = formData.get('unit_id') as string;
  const failTo = (msg: string) => {
    redirect(`/units/${unit_id}?error=${encodeURIComponent(msg)}`);
  };
  const charge_category_id = formData.get('charge_category_id') as string;
  const amount             = parseFloat(formData.get('amount') as string);
  const description        = formData.get('description') as string;
  const due_date           = (formData.get('due_date') as string) || undefined;

  const { error } = await (supabase as any).rpc('post_ad_hoc_charge', {
    p_unit_id:             unit_id,
    p_charge_category_id:  charge_category_id,
    p_amount:              amount,
    p_description:         description,
    p_due_date:            due_date,
  });
  if (error) { failTo(error.message); return; }
  revalidatePath(`/units/${unit_id}`);
}

export async function recordReceipt(formData: FormData) {
  const supabase = await createClient();
  const unit_id      = formData.get('unit_id') as string;
  const failTo = (msg: string) => {
    redirect(`/units/${unit_id}?error=${encodeURIComponent(msg)}`);
  };
  const amount       = parseFloat(formData.get('amount') as string);
  const payment_date = formData.get('payment_date') as string;
  const method       = formData.get('method') as string;
  const reference    = (formData.get('reference') as string) || null;
  const notes        = (formData.get('notes') as string) || null;

  // auto_apply_new_payment trigger handles application automatically
  const { error } = await (supabase as any).from('payments').insert({
    unit_id, amount, payment_date, method, reference, notes,
  });
  if (error) { failTo(error.message); return; }
  revalidatePath(`/units/${unit_id}`);
}

export async function unapplyPayment(paymentId: string, unitId: string) {
  const failTo = (msg: string) => {
    redirect(`/units/${unitId}?error=${encodeURIComponent(msg)}`);
  };
  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('unapply_payment', {
    p_payment_id: paymentId,
    p_charge_id:  undefined,
  });
  if (error) { failTo(error.message); return; }
  revalidatePath(`/units/${unitId}`);
}
