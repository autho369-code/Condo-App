'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

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
