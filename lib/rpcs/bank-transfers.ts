'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { claimSubmission, completeSubmission, releaseSubmission } from '@/lib/forms/submission';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Complete one or several incomplete transfers (posts each to the ledger).
// complete_bank_transfer re-checks finance access, association scope and GL
// links for every transfer.
export async function completeBankTransfers(formData: FormData) {
  await requireFinanceStaff();
  const ids = [...new Set(formData.getAll('transfer_id').map(String).filter((id) => UUID.test(id)))];
  if (ids.length === 0) redirect(`/bank-transfers?tab=incomplete&error=${encodeURIComponent('Select at least one transfer.')}`);
  const db = (await createClient()) as any;
  let done = 0;
  const failures: string[] = [];
  for (const id of ids) {
    const { error } = await db.rpc('complete_bank_transfer', { p_transfer_id: id });
    if (error) failures.push(error.message);
    else done++;
  }
  revalidatePath('/bank-transfers');
  revalidatePath('/journal-entries');
  const params = new URLSearchParams({ tab: 'incomplete', completed: String(done) });
  if (failures.length) params.set('error', `${failures.length} could not be completed: ${[...new Set(failures)].join('; ')}`);
  redirect(`/bank-transfers?${params.toString()}`);
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

// Record and post a transfer in one RPC: it re-checks finance access,
// association scope, that both accounts belong to the same association and
// have GL accounts, and operating/reserve authorization. A form token stops a
// double click from recording it twice.
export async function recordBankTransfer(formData: FormData) {
  await requireFinanceStaff();
  const fail = (m: string): never => redirect('/bank-transfers/new?error=' + encodeURIComponent(m));
  const from = str(formData, 'from_bank_account_id');
  const to = str(formData, 'to_bank_account_id');
  const amount = Number(str(formData, 'amount').replace(/[$,\s]/g, ''));
  const transferDate = str(formData, 'transfer_date');
  if (!UUID.test(from) || !UUID.test(to)) fail('Select both a source and destination account.');
  if (!Number.isFinite(amount) || amount <= 0) fail('Enter an amount greater than zero.');
  if (!DAY.test(transferDate)) fail('Choose the transfer date.');

  const db = (await createClient()) as any;
  const claim = await claimSubmission(db, formData, 'bank_transfer');
  if (claim.status === 'error') fail(claim.message);
  if (claim.status === 'duplicate') redirect('/bank-transfers?recorded=1');
  const token = (claim as { token: string }).token;
  const { data: id, error } = await db.rpc('record_bank_transfer', {
    p_from: from,
    p_to: to,
    p_amount: amount,
    p_transfer_date: transferDate,
    p_reference: str(formData, 'reference_number'),
    p_memo: str(formData, 'memo'),
    p_authorize_cross_fund: formData.get('authorize_cross_fund') === 'on',
    p_authorization_note: str(formData, 'authorization_note'),
  });
  if (error) {
    await releaseSubmission(db, token);
    fail(error.message);
  }
  await completeSubmission(db, token, String(id));
  revalidatePath('/bank-transfers');
  redirect(`/bank-transfers/${id}?recorded=1`);
}

// Void a transfer: its posting is reversed on the void date and it is kept,
// marked void. The RPC re-checks finance access and association scope.
export async function voidBankTransfer(formData: FormData) {
  await requireFinanceStaff();
  const id = str(formData, 'id');
  if (!UUID.test(id)) redirect('/bank-transfers?error=' + encodeURIComponent('Transfer not found'));
  const voidDate = str(formData, 'void_date');
  const db = (await createClient()) as any;
  const { error } = await db.rpc('void_bank_transfer', {
    p_id: id,
    p_void_date: DAY.test(voidDate) ? voidDate : null,
    p_reason: str(formData, 'reason'),
  });
  if (error) redirect(`/bank-transfers/${id}?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/bank-transfers');
  redirect(`/bank-transfers/${id}?voided=1`);
}
