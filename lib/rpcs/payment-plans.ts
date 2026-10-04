'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

/** Create a homeowner payment plan. Authorization is re-checked in create_payment_plan (can_manage_association). */
export async function createPaymentPlan(formData: FormData) {
  await requireStaff();
  const unitId = text(formData, 'unit_id');
  const total = Number(text(formData, 'total'));
  const installments = Number.parseInt(text(formData, 'installments'), 10);
  const firstDue = text(formData, 'first_due_date');
  const fail = (msg: string) => redirect(`/payment-plans/new?error=${encodeURIComponent(msg)}${UUID.test(unitId) ? `&unit=${unitId}` : ''}`);
  if (!UUID.test(unitId)) fail('Choose the unit the plan is for.');
  if (!DATE.test(firstDue)) fail('Choose the first due date.');

  const db = (await createClient()) as any;
  const { data, error } = await db.rpc('create_payment_plan', {
    p_unit_id: unitId,
    p_total: Number.isFinite(total) ? total : null,
    p_installments: Number.isFinite(installments) ? installments : null,
    p_frequency: text(formData, 'frequency') || 'monthly',
    p_first_due: firstDue,
    p_notes: text(formData, 'notes') || null,
  });
  if (error) {
    // payment_plans_one_active_per_unit: a double submit or a second plan for
    // the same unit. Send the user to the plan that already exists.
    if (error.code === '23505') {
      const { data: existing } = await db
        .from('payment_plans')
        .select('id')
        .eq('unit_id', unitId)
        .eq('status', 'active')
        .maybeSingle();
      if (existing?.id) redirect(`/payment-plans/${existing.id}?existing=1`);
      fail('This unit already has an active payment plan.');
    }
    fail(error.message);
  }
  revalidatePath('/payment-plans');
  revalidatePath('/delinquencies');
  redirect(`/payment-plans/${data}?created=1`);
}

/** Cancel an active plan (releases a collections hold it placed). Re-checked in cancel_payment_plan. */
export async function cancelPaymentPlan(formData: FormData) {
  await requireStaff();
  const id = text(formData, 'plan_id');
  if (!UUID.test(id)) redirect('/payment-plans');
  const db = (await createClient()) as any;
  const { error } = await db.rpc('cancel_payment_plan', { p_plan_id: id, p_reason: text(formData, 'reason') });
  if (error) redirect(`/payment-plans/${id}?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/payment-plans');
  revalidatePath(`/payment-plans/${id}`);
  revalidatePath('/delinquencies');
  redirect(`/payment-plans/${id}?cancelled=1`);
}
