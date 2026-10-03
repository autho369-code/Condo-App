'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BACK = '/journal-entries?tab=history&status=draft';

function fail(message: string): never {
  redirect(`${BACK}&error=${encodeURIComponent(message)}`);
}

// Post or delete a draft journal entry. draft_journal_entry_action checks
// finance access and that the caller manages every line's association; the
// ledger's balance check still rejects an unbalanced entry, and a posted
// bank-transfer draft is linked to its transfer.
async function draftAction(formData: FormData, action: 'post' | 'delete') {
  await requireFinanceStaff();
  const id = String(formData.get('entry_id') ?? '');
  if (!UUID.test(id)) fail('Choose a journal entry.');
  const db = (await createClient()) as any;
  const { error } = await db.rpc('draft_journal_entry_action', { p_entry_id: id, p_action: action });
  if (error) fail(error.message);
  revalidatePath('/journal-entries');
  revalidatePath('/bank-transfers');
  redirect(`${BACK}&${action === 'post' ? 'posted' : 'deleted'}=1`);
}

export async function postDraftJournalEntry(formData: FormData) {
  return draftAction(formData, 'post');
}

export async function deleteDraftJournalEntry(formData: FormData) {
  return draftAction(formData, 'delete');
}

// Reverse a posted entry: posts an equal and opposite entry on the chosen
// date. The RPC re-checks finance access and association scope, refuses
// entries that belong to a receipt, bill or other record (void those there),
// and refuses a second reversal.
export async function reverseJournalEntry(formData: FormData) {
  await requireFinanceStaff();
  const id = String(formData.get('entry_id') ?? '');
  if (!UUID.test(id)) fail('Choose a journal entry.');
  const back = `/journal-entries/${id}`;
  const reversalDate = String(formData.get('reversal_date') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  const db = (await createClient()) as any;
  const { data: reversalId, error } = await db.rpc('reverse_journal_entry', {
    p_id: id,
    p_reversal_date: /^\d{4}-\d{2}-\d{2}$/.test(reversalDate) ? reversalDate : null,
    p_reason: reason,
  });
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/journal-entries');
  redirect(`/journal-entries/${reversalId}?reversal=1`);
}
