'use server';
import { createClient } from '@/lib/supabase/server';
import { requireFinanceStaff } from '@/lib/auth/me';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createBill(formData: FormData) {
  const me = await requireFinanceStaff();  // in-action guard: server actions are callable endpoints
  const failTo = (msg: string) => {
    redirect(`/bills/new?error=${encodeURIComponent(msg)}`);
  };
  const supabase = await createClient();

  const submittedPortfolio = formData.get('portfolio_id') as string;
  const portfolio_id      = me.portfolio?.id ?? (me.is_platform_operator ? submittedPortfolio : '');
  const vendor_id         = formData.get('vendor_id') as string;
  const association_id    = formData.get('association_id') as string | null;
  const gl_account_id     = (formData.get('gl_account_id') as string) || null;
  const bank_account_id   = (formData.get('bank_account_id') as string) || null;
  const bill_number       = (formData.get('bill_number') as string) || null;
  const bill_date         = formData.get('bill_date') as string;
  const due_date          = (formData.get('due_date') as string) || null;
  const amount            = parseFloat(formData.get('amount') as string);
  const memo              = (formData.get('memo') as string) || null;
  const submit_for_approval = formData.get('status') === 'pending_approval';
  const board_approval      = formData.get('approval_required') === 'on';

  if (!portfolio_id || !vendor_id || !bill_date || !Number.isFinite(amount) || amount <= 0) {
    failTo('Portfolio, vendor, bill date, and a positive amount are required.');
    return;
  }

  const { data, error } = await (supabase as any)
    .rpc('create_payable_bill', {
      p_portfolio_id: portfolio_id,
      p_vendor_id: vendor_id,
      p_association_id: association_id || null,
      p_gl_account_id: gl_account_id,
      p_bank_account_id: bank_account_id,
      p_bill_number: bill_number,
      p_bill_date: bill_date,
      p_due_date: due_date,
      p_amount: amount,
      p_memo: memo,
      p_submit_for_approval: submit_for_approval,
      p_board_approval: board_approval,
    });

  if (error) { failTo(error.message); return; }
  revalidatePath('/bills');
  redirect(`/bills/${data}`);
}

export async function approveBill(billId: string) {
  await requireFinanceStaff();  // in-action guard: server actions are callable endpoints
  const failTo = (msg: string) => {
    redirect(`/bills/${billId}?error=${encodeURIComponent(msg)}`);
  };
  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('approve_payable_bill', { p_bill_id: billId });
  if (error) { failTo(error.message); return; }
  revalidatePath('/bills');
  revalidatePath(`/bills/${billId}`);
}

export async function submitBillForApproval(billId: string) {
  await requireFinanceStaff();
  const failTo = (msg: string) => redirect(`/bills/${billId}?error=${encodeURIComponent(msg)}`);
  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('request_payable_bill_approval', { p_bill_id: billId });
  if (error) { failTo(error.message); return; }
  revalidatePath('/bills');
  revalidatePath(`/bills/${billId}`);
}

export async function voidBill(billId: string) {
  await requireFinanceStaff();  // in-action guard: server actions are callable endpoints
  const failTo = (msg: string) => {
    redirect(`/bills/${billId}?error=${encodeURIComponent(msg)}`);
  };
  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('void_payable_bill', { p_bill_id: billId });
  if (error) { failTo(error.message); return; }
  revalidatePath('/bills');
  revalidatePath(`/bills/${billId}`);
}

export async function writeChecks(formData: FormData) {
  await requireFinanceStaff();  // in-action guard: server actions are callable endpoints
  const failTo = (msg: string) => {
    redirect(`/bills/check-run?error=${encodeURIComponent(msg)}`);
  };
  const supabase = await createClient();
  const bank_account_id       = formData.get('bank_account_id') as string;
  const starting_check_number = parseInt(formData.get('starting_check_number') as string);
  const payment_date          = (formData.get('payment_date') as string) || new Date().toISOString().slice(0, 10);
  const bill_ids              = formData.getAll('bill_ids') as string[];
  const authorization_confirmed = formData.get('authorization_confirmed') === 'on';

  if (!bank_account_id || !bill_ids.length || !starting_check_number || !authorization_confirmed) {
    failTo('Select a bank account and bills, enter the check number, and confirm signing authorization.');
    return;
  }

  const { error } = await (supabase as any).rpc('record_check_run', {
    p_bank_account_id: bank_account_id,
    p_bill_ids: bill_ids,
    p_starting_check_number: starting_check_number,
    p_payment_date: payment_date,
    p_authorization_confirmed: authorization_confirmed,
  });

  if (error) { failTo(error.message); return; }
  revalidatePath('/bills');
  const { data: firstCheck, error: firstCheckError } = await (supabase as any)
    .from('payable_checks')
    .select('id')
    .eq('bill_id', bill_ids[0])
    .eq('check_number', starting_check_number)
    .eq('status', 'issued')
    .order('issued_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (firstCheckError || !firstCheck) {
    failTo(firstCheckError?.message ?? 'The check run was recorded, but its printable history could not be loaded.');
    return;
  }
  redirect(`/bills/check-run/print/${firstCheck.id}`);
}

export async function voidPaidCheck(formData: FormData) {
  await requireFinanceStaff();
  const checkId = formData.get('check_id') as string;
  const billId = formData.get('bill_id') as string;
  const reason = (formData.get('reason') as string) || '';
  const stopPayment = formData.get('stop_payment') === 'true';
  const failTo = (msg: string) => redirect(`/bills/${billId}?error=${encodeURIComponent(msg)}`);
  if (!checkId || !billId || reason.trim().length < 3) {
    failTo('A check and a reason of at least 3 characters are required.');
    return;
  }
  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('void_payable_check', {
    p_check_id: checkId,
    p_reason: reason.trim(),
    p_stop_payment: stopPayment,
  });
  if (error) { failTo(error.message); return; }
  revalidatePath('/bills');
  revalidatePath(`/bills/${billId}`);
  redirect(`/bills/${billId}?check_voided=1`);
}
