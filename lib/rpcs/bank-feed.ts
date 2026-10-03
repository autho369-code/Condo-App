'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

// Bank feed review: match an imported transaction to a ledger line, post it as
// a new entry, or ignore it. The RPCs re-check finance permission and the
// bank's association scope.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

export async function bankFeedAction(formData: FormData) {
  await requireFinanceStaff();
  const back = s(formData, 'back').startsWith('/bank-accounts/feeds') ? s(formData, 'back') : '/bank-accounts/feeds';
  const sep = back.includes('?') ? '&' : '?';
  const fail = (msg: string): never => redirect(`${back}${sep}error=${encodeURIComponent(msg)}`);
  const id = s(formData, 'id');
  if (!UUID.test(id)) fail('Bank transaction not found');
  const op = s(formData, 'op');
  const db = (await createClient()) as any;

  let result: { error: { message: string } | null };
  if (op === 'match') {
    const lineId = s(formData, 'journal_line_id');
    if (!UUID.test(lineId)) fail('Choose the ledger entry it matches.');
    result = await db.rpc('match_bank_transaction', { p_id: id, p_journal_line_id: lineId });
  } else if (op === 'match_deposit') {
    const depositId = s(formData, 'bank_deposit_id');
    if (!UUID.test(depositId)) fail('Choose the bank deposit it matches.');
    result = await db.rpc('match_bank_transaction_to_deposit', { p_id: id, p_deposit_id: depositId });
  } else if (op === 'post') {
    const glId = s(formData, 'gl_account_id');
    if (!UUID.test(glId)) fail('Choose the GL account to post it to.');
    result = await db.rpc('post_bank_transaction', { p_id: id, p_gl_account_id: glId, p_memo: s(formData, 'memo') });
  } else if (op === 'ignore' || op === 'restore') {
    result = await db.rpc('set_bank_transaction_ignored', { p_id: id, p_ignored: op === 'ignore' });
  } else {
    fail('Choose an action.');
    return;
  }
  if (result.error) fail(result.error.message);
  revalidatePath('/bank-accounts/feeds');
  redirect(`${back}${sep}done=${op}`);
}
