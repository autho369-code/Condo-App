'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Undo (reopen) the latest completed reconciliation of a bank account. The
 * database checks the caller can reconcile the account, that it is the
 * latest, that no month it covers is closed, and records who, when and why.
 */
export async function undoBankReconciliation(formData: FormData) {
  await requireFinanceStaff();
  const accountId = String(formData.get('bank_account_id') ?? '');
  const reconciliationId = String(formData.get('reconciliation_id') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  const back = UUID.test(accountId) ? `/bank-accounts/reconcile?account_id=${accountId}` : '/bank-accounts/reconcile';
  const fail = (msg: string): never => redirect(`${back}${back.includes('?') ? '&' : '?'}error=${encodeURIComponent(msg)}`);
  if (!UUID.test(reconciliationId)) fail('Choose the reconciliation to undo.');
  if (reason.length < 10) fail('Give a reason of at least 10 characters for undoing the reconciliation.');

  const db = (await createClient()) as any;
  const { error } = await db.rpc('undo_bank_reconciliation', { p_reconciliation_id: reconciliationId, p_reason: reason });
  if (error) fail(error.message);
  revalidatePath('/bank-accounts/reconcile');
  redirect(`${back}${back.includes('?') ? '&' : '?'}done=undone`);
}

/**
 * Discard an in-progress reconciliation (its items go with it). The database
 * refuses a completed one (undo it instead) and checks the caller can
 * reconcile the account.
 */
export async function discardBankReconciliation(formData: FormData) {
  await requireFinanceStaff();
  const accountId = String(formData.get('bank_account_id') ?? '');
  const reconciliationId = String(formData.get('reconciliation_id') ?? '');
  const back = UUID.test(accountId) ? `/bank-accounts/reconcile?account_id=${accountId}` : '/bank-accounts/reconcile';
  const fail = (msg: string): never => redirect(`${back}${back.includes('?') ? '&' : '?'}error=${encodeURIComponent(msg)}`);
  if (!UUID.test(reconciliationId)) fail('Choose the reconciliation to discard.');

  const db = (await createClient()) as any;
  const { data: rec, error: readError } = await db.from('bank_reconciliations')
    .select('id, status, undone_at').eq('id', reconciliationId).maybeSingle();
  if (readError) fail(readError.message);
  if (!rec || rec.status !== 'in_progress') fail('Only a reconciliation in progress can be discarded.');
  // A reopened one was completed once (its undo is on the row): complete it again.
  if (rec.undone_at) fail('This reconciliation was completed before and reopened. Complete it again instead of discarding it.');
  // Items first (their guard checks the reconciliation, which must still
  // exist), then the reconciliation, as the create route's clean-up does.
  const { error: itemsError } = await db.from('bank_reconciliation_items').delete().eq('reconciliation_id', reconciliationId);
  if (itemsError) fail(itemsError.message);
  const { data, error } = await db.from('bank_reconciliations')
    .delete()
    .eq('id', reconciliationId)
    .eq('status', 'in_progress')
    .select('id');
  if (error) fail(error.message);
  if (!data?.length) fail('Only a reconciliation in progress can be discarded.');
  revalidatePath('/bank-accounts/reconcile');
  redirect(`${back}${back.includes('?') ? '&' : '?'}done=discarded`);
}
