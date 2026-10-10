// The one opening journal entry an association gets from the previous
// system's trial balance (import page, "Post opening balances"). It already
// brings A/R and income to the old system's totals, so open balances imported
// after it would count every open item twice.

export const OPENING_MEMO = 'Opening balance from previous system trial balance';

export const OPENING_ENTRY_POSTED_MESSAGE =
  'This association already has its opening balances from the trial balance, which include the open balances. Nothing was imported. Make any corrections with a journal entry.';

/** Whether the association already has its trial-balance opening entry (error text when the check fails). */
export async function openingEntryPosted(db: any, associationId: string): Promise<{ posted: boolean; error: string | null }> {
  const { data, error } = await db
    .from('journal_lines').select('id').eq('association_id', associationId).eq('memo', OPENING_MEMO).limit(1);
  if (error) return { posted: false, error: `Could not check for an opening balance entry: ${error.message}` };
  return { posted: (data ?? []).length > 0, error: null };
}
