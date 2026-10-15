// Plaid bank details (raw description, payer, memo) saved on bank_transactions.

const clip = (v: unknown, max: number) => {
  const t = typeof v === 'string' ? v.trim() : '';
  return t ? t.slice(0, max) : null;
};

/**
 * The bank's raw description and payment details (sender, memo) used to
 * identify owner payments such as Zelle. Signed-in users can't write these
 * columns (database guard), so they are saved with the service role, scoped
 * to the item and company the sync route authorised the caller for.
 *
 * A modified transaction always writes all three, nulls included, so details
 * the bank cleared don't linger. A new transaction with none of them is skipped
 * (its columns are already empty).
 */
export async function saveBankDetails(
  service: any,
  item: { id: string; portfolio_id: string },
  tx: { transaction_id: string; original_description?: string | null; payment_meta?: { payer?: string | null; reason?: string | null } | null },
  existing = false,
) {
  const details = {
    original_description: clip(tx.original_description, 1000),
    payer_name: clip(tx.payment_meta?.payer, 200),
    payment_reason: clip(tx.payment_meta?.reason, 500),
  };
  if (!existing && !details.original_description && !details.payer_name && !details.payment_reason) return;
  const { error } = await service
    .from('bank_transactions')
    .update(details)
    .eq('plaid_item_id', item.id)
    .eq('portfolio_id', item.portfolio_id)
    .eq('plaid_transaction_id', tx.transaction_id);
  if (error) throw new Error(`Could not save the bank details of transaction ${tx.transaction_id}: ${error.message}`);
}
