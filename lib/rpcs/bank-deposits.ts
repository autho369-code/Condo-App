'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { claimSubmission, completeSubmission, releaseSubmission } from '@/lib/forms/submission';

// Bank deposits group receipts already posted to a bank account. The RPCs
// re-check finance permission, association scope, and that every receipt
// belongs to the bank and is not deposited, reversed or voided.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ids = (fd: FormData, key: string) => [...new Set(fd.getAll(key).map(String).filter((v) => UUID.test(v)))];

export async function createBankDeposit(formData: FormData) {
  await requireFinanceStaff();
  const bankAccountId = String(formData.get('bank_account_id') ?? '');
  const back = `/bank-accounts/deposits/new?bank_account_id=${encodeURIComponent(bankAccountId)}`;
  const fail = (msg: string): never => redirect(`${back}&error=${encodeURIComponent(msg)}`);
  const depositDate = String(formData.get('deposit_date') ?? '');
  const paymentIds = ids(formData, 'payment_id');
  const otherIds = ids(formData, 'other_receipt_id');
  if (!UUID.test(bankAccountId)) fail('Choose a bank account.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(depositDate)) fail('Choose the deposit date.');
  if (paymentIds.length + otherIds.length === 0) fail('Select at least one receipt.');

  const db = (await createClient()) as any;
  const claim = await claimSubmission(db, formData, 'bank_deposit_receipts');
  if (claim.status === 'error') fail(claim.message);
  if (claim.status === 'duplicate') redirect('/bank-accounts/deposits?created=1');
  const token = (claim as { token: string }).token;

  const { data: depositId, error } = await db.rpc('create_bank_deposit', {
    p_bank_account_id: bankAccountId,
    p_deposit_date: depositDate,
    p_payment_ids: paymentIds,
    p_other_receipt_ids: otherIds,
    p_memo: String(formData.get('memo') ?? ''),
  });
  if (error) {
    await releaseSubmission(db, token);
    fail(error.message);
  }
  await completeSubmission(db, token, String(depositId));
  revalidatePath('/bank-accounts/deposits');
  redirect('/bank-accounts/deposits?created=1');
}

export async function voidBankDeposit(formData: FormData) {
  await requireFinanceStaff();
  const id = String(formData.get('id') ?? '');
  if (!UUID.test(id)) redirect('/bank-accounts/deposits?error=' + encodeURIComponent('Bank deposit not found'));
  const db = (await createClient()) as any;
  const { error } = await db.rpc('void_bank_deposit', { p_id: id });
  if (error) redirect(`/bank-accounts/deposits?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/bank-accounts/deposits');
  redirect('/bank-accounts/deposits?voided=1');
}
