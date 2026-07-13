'use server';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createOwnerPayable(formData: FormData) {
  await requireStaff();  // in-action guard: server actions are callable endpoints
  const failTo = (msg: string) => {
    redirect(`/bills/owner-payable/new?error=${encodeURIComponent(msg)}`);
  };
  const supabase = await createClient();

  const portfolio_id    = formData.get('portfolio_id') as string;
  const association_id  = formData.get('association_id') as string;
  const owner_id        = formData.get('owner_id') as string;
  const gl_account_id   = (formData.get('gl_account_id') as string) || null;
  const bank_account_id = (formData.get('bank_account_id') as string) || null;
  const payable_type    = (formData.get('payable_type') as string) || 'refund';
  const payable_date    = (formData.get('payable_date') as string) || new Date().toISOString().slice(0, 10);
  const due_date        = (formData.get('due_date') as string) || null;
  const amount          = parseFloat(formData.get('amount') as string);
  const memo            = (formData.get('memo') as string) || null;
  const status          = (formData.get('status') as string) || 'pending_approval';

  if (!owner_id || !association_id || !amount || amount <= 0) {
    failTo('Owner, association, and a positive amount are required.');
    return;
  }

  const { data, error } = await (supabase as any)
    .from('owner_payables')
    .insert({
      portfolio_id, association_id, owner_id, gl_account_id, bank_account_id,
      payable_type, payable_date, due_date, amount, memo, status,
    })
    .select('id')
    .single();

  if (error) { failTo(error.message); return; }
  revalidatePath('/bills/owner-payable');
  redirect('/bills/owner-payable');
}

export async function approveOwnerPayable(id: string) {
  await requireStaff();  // in-action guard: server actions are callable endpoints
  const failTo = (msg: string) => {
    redirect(`/bills/owner-payable?error=${encodeURIComponent(msg)}`);
  };
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from('owner_payables')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) { failTo(error.message); return; }
  revalidatePath('/bills/owner-payable');
}

export async function payOwnerPayable(id: string) {
  await requireStaff();  // in-action guard: server actions are callable endpoints
  const failTo = (msg: string) => {
    redirect(`/bills/owner-payable?error=${encodeURIComponent(msg)}`);
  };
  const supabase = await createClient();

  // Respect the owner's "Hold payments" accounting preference (owner profile →
  // Federal Tax, Payout & Accounting Preferences). Approval is allowed; paying is not.
  const { data: payable } = await (supabase as any)
    .from('owner_payables')
    .select('owner_id, owners(full_name)')
    .eq('id', id)
    .maybeSingle();
  if (payable?.owner_id) {
    const { data: fin } = await (supabase as any)
      .from('owner_financial_details')
      .select('hold_payments')
      .eq('owner_id', payable.owner_id)
      .maybeSingle();
    if (fin?.hold_payments) {
      failTo(`Payments to ${payable.owners?.full_name ?? 'this owner'} are on hold. Clear "Hold payments" on the owner profile first.`);
      return;
    }
  }

  const { error } = await (supabase as any)
    .from('owner_payables')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', id);
  if (error) { failTo(error.message); return; }
  revalidatePath('/bills/owner-payable');
}

export async function voidOwnerPayable(id: string) {
  await requireStaff();  // in-action guard: server actions are callable endpoints
  const failTo = (msg: string) => {
    redirect(`/bills/owner-payable?error=${encodeURIComponent(msg)}`);
  };
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from('owner_payables')
    .update({ status: 'void' })
    .eq('id', id);
  if (error) { failTo(error.message); return; }
  revalidatePath('/bills/owner-payable');
}
