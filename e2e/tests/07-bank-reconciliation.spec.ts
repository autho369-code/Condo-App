import { test, expect, type Page } from '@playwright/test';
import { db, ids, asManager, isoDate, glBalance } from '../helpers';

// Bank reconciliation, end to end: a deposit the bank hasn't posted yet and a
// bank fee the books don't carry. Completing is refused while out of balance,
// allowed once the statement's items are cleared, locked afterwards, and can be
// undone with a reason and completed again. Earlier specs may have left other
// cash activity; the test works from whatever the book balance is.
test.describe.serial('bank reconciliation: outstanding deposit + bank fee → complete → undo', () => {
  test.use(asManager);
  const today = isoDate(0);
  let bankId = '';
  let bookBefore = 0;
  let reconciliationId = '';
  let depositItemId = '';

  const operating = async () => {
    const { data, error } = await db().from('bank_accounts').select('id').eq('association_id', ids.association).eq('purpose', 'operating').single();
    if (error) throw error;
    return data.id as string;
  };
  const recon = async () =>
    (await db().from('bank_reconciliations').select('status, statement_balance, ending_book_balance, reconciled_balance, undone_at').eq('id', reconciliationId).single()).data!;
  const toggle = (page: Page, itemId: string) =>
    page.locator(`form:has(input[name="item_id"][value="${itemId}"]) button[type="submit"]`);

  test('a $100 check receipt reaches the books; the bank charges a $5 fee', async ({ page }) => {
    bankId = await operating();

    await page.goto(`/units/${ids.unit}`);
    await page.locator('#adhoc_cat').selectOption({ label: 'HOA Dues' });
    await page.locator('#adhoc_amount').fill('100');
    await page.locator('#adhoc_desc').fill('E2E reconciliation dues');
    await page.locator('#adhoc_due').fill(isoDate(-1));
    await page.getByRole('button', { name: 'Post charge' }).click();
    await expect(page.getByText('E2E reconciliation dues').first()).toBeVisible();

    await page.locator('#pay_amount').fill('100');
    await page.locator('#pay_method').selectOption('check');
    await page.locator('#pay_ref').fill('Check 5150');
    await page.getByRole('button', { name: 'Record receipt' }).click();
    await expect(page.getByText(/Payment recorded and posted to the general ledger/i)).toBeVisible();

    await page.goto('/bank-accounts/adjustments/new');
    await page.locator('select[name="bank_account_id"]').selectOption(bankId);
    await page.locator('input[name="amount"]').fill('-5');
    await page.locator('input[name="adjustment_date"]').fill(today);
    await page.locator('textarea[name="description"]').fill('E2E monthly service fee');
    await page.getByRole('button', { name: 'Create adjustment' }).click();
    await expect(page.getByText('Adjustment saved')).toBeVisible();

    bookBefore = await glBalance(ids.glCash);
  });

  test('manager starts a reconciliation; the statement is $105 below the books', async ({ page }) => {
    // Statement = books − the $100 deposit still in transit − the $5 fee.
    const statement = Math.round((bookBefore - 105) * 100) / 100;
    await page.goto(`/bank-accounts/reconcile/new?account_id=${bankId}`);
    await page.locator('#statement_date').fill(today);
    await page.locator('#statement_balance').fill(statement.toFixed(2));
    await page.getByRole('button', { name: 'Start reconciliation' }).click();
    await expect(page).toHaveURL(/\/bank-accounts\/reconcile\?account_id=.*tab=unreconciled/);

    const { data: rec } = await db().from('bank_reconciliations').select('id').eq('bank_account_id', bankId).eq('status', 'in_progress').single();
    reconciliationId = rec!.id;
    const r = await recon();
    expect(Number(r.ending_book_balance)).toBe(bookBefore);
    expect(Number(r.statement_balance)).toBe(statement);

    // The deposit's item: the cash line of the $100 check payment's entry.
    const { data: pay } = await db().from('payments').select('id').eq('unit_id', ids.unit).eq('reference', 'Check 5150').single();
    const { data: entry } = await db().from('journal_entries').select('id').eq('source_type', 'payment').eq('source_id', pay!.id).single();
    const { data: line } = await db().from('journal_lines').select('id').eq('entry_id', entry!.id).eq('gl_account_id', ids.glCash).single();
    const { data: item } = await db().from('bank_reconciliation_items').select('id, amount, is_cleared').eq('reconciliation_id', reconciliationId).eq('journal_line_id', line!.id).single();
    expect(Number(item!.amount)).toBe(100);
    depositItemId = item!.id;

    const { data: fee } = await db().from('bank_reconciliation_items').select('amount, type').eq('reconciliation_id', reconciliationId).not('bank_adjustment_id', 'is', null);
    expect(fee).toEqual([expect.objectContaining({ type: 'bank_only' })]);
    expect(Number(fee![0].amount)).toBe(-5);
  });

  test('completing while out of balance is refused', async ({ page }) => {
    await page.goto(`/bank-accounts/reconcile?account_id=${bankId}`);
    await page.getByRole('button', { name: 'Complete reconciliation' }).click();
    await expect(page.getByText(/out of balance by \$/i)).toBeVisible();
    expect((await recon()).status).toBe('in_progress');
  });

  test('manager clears everything on the statement except the deposit, then completes', async ({ page }) => {
    const { data: items } = await db().from('bank_reconciliation_items').select('id, is_cleared').eq('reconciliation_id', reconciliationId);
    for (const it of items ?? []) {
      if (it.id === depositItemId || it.is_cleared) continue;
      await page.goto(`/bank-accounts/reconcile?account_id=${bankId}`);
      await toggle(page, it.id).click();
      await expect.poll(async () => (await db().from('bank_reconciliation_items').select('is_cleared').eq('id', it.id).single()).data?.is_cleared).toBe(true);
    }
    const { data: deposit } = await db().from('bank_reconciliation_items').select('is_cleared').eq('id', depositItemId).single();
    expect(deposit!.is_cleared).toBe(false);

    await page.goto(`/bank-accounts/reconcile?account_id=${bankId}`);
    await page.getByRole('button', { name: 'Complete reconciliation' }).click();
    await expect(page).toHaveURL(/tab=reconciled/);
    const r = await recon();
    expect(r.status).toBe('completed');
    expect(Number(r.reconciled_balance)).toBe(Number(r.statement_balance));
    const { data: bank } = await db().from('bank_accounts').select('last_reconciliation_date').eq('id', bankId).single();
    expect(bank!.last_reconciliation_date).toBe(today);
  });

  test('a completed reconciliation is locked; undo needs a reason, then it completes again', async ({ page }) => {
    await page.goto(`/bank-accounts/reconcile?account_id=${bankId}&tab=unreconciled`);
    await expect(toggle(page, depositItemId)).toBeDisabled();

    page.once('dialog', (d) => d.accept());
    await page.locator('#undo_reason').fill('E2E: statement re-checked with the bank');
    await page.getByRole('button', { name: 'Undo reconciliation' }).click();
    await expect(page.getByText(/The reconciliation was undone/i)).toBeVisible();
    let r = await recon();
    expect(r.status).toBe('in_progress');
    expect(r.undone_at).not.toBeNull();

    await page.getByRole('button', { name: 'Complete reconciliation' }).click();
    await expect(page).toHaveURL(/tab=reconciled/);
    r = await recon();
    expect(r.status).toBe('completed');
  });
});
