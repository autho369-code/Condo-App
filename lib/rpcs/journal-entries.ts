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

// Post a draft journal entry. RLS limits the row to the caller's company, and
// the ledger's balance check rejects an entry whose debits and credits differ.
export async function postDraftJournalEntry(formData: FormData) {
  await requireFinanceStaff();
  const id = String(formData.get('entry_id') ?? '');
  if (!UUID.test(id)) fail('Choose a journal entry.');
  const db = (await createClient()) as any;
  const { data, error } = await db
    .from('journal_entries')
    .update({ posted: true })
    .eq('id', id)
    .eq('posted', false)
    .select('id')
    .maybeSingle();
  if (error) fail(error.message);
  if (!data) fail('That draft was not found or is already posted.');
  revalidatePath('/journal-entries');
  redirect(`${BACK}&posted=1`);
}

// Delete a draft journal entry that was never posted.
export async function deleteDraftJournalEntry(formData: FormData) {
  await requireFinanceStaff();
  const id = String(formData.get('entry_id') ?? '');
  if (!UUID.test(id)) fail('Choose a journal entry.');
  const db = (await createClient()) as any;
  const { data, error } = await db
    .from('journal_entries')
    .delete()
    .eq('id', id)
    .eq('posted', false)
    .select('id')
    .maybeSingle();
  if (error) fail(error.message);
  if (!data) fail('That draft was not found or is already posted.');
  revalidatePath('/journal-entries');
  redirect(`${BACK}&deleted=1`);
}
