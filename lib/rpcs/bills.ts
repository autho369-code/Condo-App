'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createBill(formData: FormData) {
  const supabase = await createClient();

  const portfolio_id      = formData.get('portfolio_id') as string;
  const vendor_id         = formData.get('vendor_id') as string;
  const association_id    = formData.get('association_id') as string | null;
  const gl_account_id     = (formData.get('gl_account_id') as string) || null;
  const bank_account_id   = (formData.get('bank_account_id') as string) || null;
  const bill_number       = (formData.get('bill_number') as string) || null;
  const bill_date         = formData.get('bill_date') as string;
  const due_date          = (formData.get('due_date') as string) || null;
  const amount            = parseFloat(formData.get('amount') as string);
  const memo              = (formData.get('memo') as string) || null;
  const status            = (formData.get('status') as string) || 'draft';
  const approval_required = formData.get('approval_required') === 'on';

  if (!vendor_id || !amount || amount <= 0)
    return { error: 'Vendor and a positive amount are required.' };

  const { data, error } = await supabase
    .from('payable_bills')
    .insert({
      portfolio_id, vendor_id, association_id, gl_account_id, bank_account_id,
      bill_number, bill_date, due_date, amount, memo,
      status, approval_required,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };
  revalidatePath('/bills');
  redirect(`/bills/${data.id}`);
}

export async function approveBill(billId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('payable_bills')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', billId);
  if (error) return { error: error.message };
  revalidatePath('/bills');
  revalidatePath(`/bills/${billId}`);
}

export async function voidBill(billId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('payable_bills')
    .update({ status: 'void' })
    .eq('id', billId);
  if (error) return { error: error.message };
  revalidatePath('/bills');
  revalidatePath(`/bills/${billId}`);
}

export async function writeChecks(formData: FormData) {
  const supabase = await createClient();
  const bank_account_id       = formData.get('bank_account_id') as string;
  const starting_check_number = parseInt(formData.get('starting_check_number') as string);
  const payment_date          = (formData.get('payment_date') as string) || new Date().toISOString().slice(0, 10);
  const bill_ids              = formData.getAll('bill_ids') as string[];

  if (!bank_account_id || !bill_ids.length || !starting_check_number) {
    return { error: 'Select a bank account, starting check number, and at least one bill.' };
  }

  const { data, error } = await supabase.rpc('record_check_run', {
    p_bank_account_id: bank_account_id,
    p_bill_ids: bill_ids,
    p_starting_check_number: starting_check_number,
    p_payment_date: payment_date,
  });

  if (error) return { error: error.message };
  revalidatePath('/bills');
  redirect(`/bills/check-run/print/${bill_ids[0]}?count=${(data as any)?.checks_written ?? bill_ids.length}`);
}
