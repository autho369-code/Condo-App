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
  // Filtered in the database (bank_reconcilable_lines): only lines not yet
  // cleared come back, instead of every line ever posted to the account.
  const { rows, truncated, error } = await fetchAllRows<any>(() => db
    .rpc('bank_reconcilable_lines', { p_bank_account_id: bank.id, p_statement_date: statementDate })
    .order('id'));
  if (error) return { lines: [], error: `Could not load ledger lines: ${error}` };
  if (truncated) return { lines: [], truncated: true };
  return {
    lines: rows
      .filter((row: any) => !exclude.has(row.id))
      .map((row: any) => ({
        id: row.id,
        debit_amount: row.debit_amount,
        credit_amount: row.credit_amount,
        memo: row.memo,
        journal_entries: {
          id: row.entry_id,
          entry_date: row.entry_date,
          reference_number: row.reference_number,
          description: row.description,
          posted: true,
          source_type: row.source_type,
          source_id: row.source_id,
        },
      })),
  };
}

export const itemFromLine = (reconciliationId: string, line: any, index: number) => ({
  reconciliation_id: reconciliationId,
  journal_line_id: line.id,
  amount: (line.debit_amount ?? 0) - (line.credit_amount ?? 0),
  type: 'book',
  is_cleared: false,
  sort_order: index,
});
