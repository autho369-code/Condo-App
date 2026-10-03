import 'server-only';
import { fetchAllRows } from '@/lib/supabase/fetch-all';

type Bank = { id: string; gl_account_id: string; association_id: string | null };

/**
 * Book balance of a bank account through the statement date, summed in the
 * database. Only this bank's association: several associations' banks can
 * share one cash GL account.
 */
export async function bookBalance(db: any, bank: Bank, statementDate: string): Promise<{ balance: number; error?: string }> {
  const { data, error } = await db.rpc('journal_line_totals', {
    p_gl_account_ids: [bank.gl_account_id],
    p_association_ids: bank.association_id ? [bank.association_id] : null,
    p_to: statementDate,
  });
  if (error) return { balance: 0, error: error.message };
  const balance = ((data ?? []) as any[]).reduce(
    (sum: number, r: any) => sum + Number(r.debit_total ?? 0) - Number(r.credit_total ?? 0),
    0,
  );
  return { balance };
}

/**
 * Every posted line of the bank through the statement date that was not
 * cleared on a completed reconciliation of the account, less the lines in
 * `exclude` (already on the reconciliation being worked).
 */
export async function reconcilableLines(
  db: any,
  bank: Bank,
  statementDate: string,
  exclude: Set<string> = new Set(),
): Promise<{ lines: any[]; error?: string; truncated?: boolean }> {
  const { rows: lineRows, truncated, error } = await fetchAllRows<any>(() => {
    let q = db
      .from('journal_lines')
      .select('id, debit_amount, credit_amount, memo, journal_entries!inner(entry_date, reference_number, description, posted)')
      .eq('gl_account_id', bank.gl_account_id)
      .eq('journal_entries.posted', true)
      .lte('journal_entries.entry_date', statementDate);
    if (bank.association_id) q = q.eq('association_id', bank.association_id);
    return q.order('id');
  });
  if (error) return { lines: [], error: `Could not load ledger lines: ${error}` };
  if (truncated) return { lines: [], truncated: true };
  const { rows: clearedRows, error: clearedError } = await fetchAllRows<any>(() => db
    .from('bank_reconciliation_items')
    .select('journal_line_id, bank_reconciliations!inner(bank_account_id, status)')
    .eq('bank_reconciliations.bank_account_id', bank.id)
    .eq('bank_reconciliations.status', 'completed')
    .eq('is_cleared', true)
    .not('journal_line_id', 'is', null)
    .order('journal_line_id'));
  if (clearedError) return { lines: [], error: `Could not load earlier reconciliations: ${clearedError}` };
  const alreadyCleared = new Set(clearedRows.map((r: any) => r.journal_line_id));
  return { lines: lineRows.filter((line: any) => !alreadyCleared.has(line.id) && !exclude.has(line.id)) };
}

export const itemFromLine = (reconciliationId: string, line: any, index: number) => ({
  reconciliation_id: reconciliationId,
  journal_line_id: line.id,
  amount: (line.debit_amount ?? 0) - (line.credit_amount ?? 0),
  type: 'book',
  is_cleared: false,
  sort_order: index,
});
