import { test, expect } from '@playwright/test';
import { db, ids, asManager, isoDate, expectBooksBalance, glBalance } from '../helpers';

// Vendor money, end to end: a plumber's invoice is entered, approved, and paid
// in a check run. The bill accrues to A/P on approval and the check clears it
// against operating cash; the check number is taken from the bank account.
test.describe.serial('payables: bill → approval → check run', () => {
  test.use(asManager);
  let billId = '';

  test('manager enters a $450 plumbing bill and submits it', async ({ page }) => {
    await page.goto('/bills/new');
    await page.locator('#association_id').selectOption(ids.association);
    await page.locator('#vendor_id').selectOption(ids.vendor);
    await page.locator('#amount').fill('450');
    await page.locator('#bill_number').fill('E2E-INV-77');
    await page.locator('#bill_date').fill(isoDate(-2));
    await page.locator('#due_date').fill(isoDate(28));
    await page.locator('#gl_account_id').selectOption(ids.glRepairs);
    await page.locator('#memo').fill('E2E: replace leaking riser valve, unit 101');
    await page.locator('#status').selectOption('pending_approval');
    await page.getByRole('button', { name: 'Save bill' }).click();
    await expect(page).toHaveURL(/\/bills\/[0-9a-f-]{36}/);
    billId = page.url().match(/bills\/([0-9a-f-]{36})/)![1];

    const { data } = await db().from('payable_bills').select('amount, status, vendor_id, gl_account_id').eq('id', billId).single();
    expect(data).toEqual(expect.objectContaining({ vendor_id: ids.vendor, gl_account_id: ids.glRepairs }));
    expect(Number(data!.amount)).toBe(450);
  });

  test('manager approves; the bill accrues to accounts payable', async ({ page }) => {
    await page.goto(`/bills/${billId}`);
    await page.getByRole('button', { name: 'Approve' }).click();
    await expect.poll(async () => (await db().from('payable_bills').select('status').eq('id', billId).single()).data?.status).toBe('approved');

    expect(await glBalance(ids.glRepairs)).toBe(450);
    expect(await glBalance(ids.glAp)).toBe(-450);
    await expectBooksBalance();
  });

  test('check run pays the bill with check #1001 from operating cash', async ({ page }) => {
    const cashBefore = await glBalance(ids.glCash);
    await page.goto('/bills/check-run');
    const row = page.locator(`input[name="bill_ids"][value="${billId}"]`).first();
    await expect(row).toBeChecked();
    await page.locator('#starting_check_number').fill('1001');
    await page.locator('input[name="authorization_confirmed"]').check();
    await page.getByRole('button', { name: 'Write checks' }).click();
    await expect(page).toHaveURL(/\/bills\/check-run\/print\//);
    await expect(page.getByText(/Check preview/i).first()).toBeVisible();

    const { data: checks } = await db().from('payable_checks').select('check_number, amount, status, bill_id').eq('bill_id', billId);
    expect(checks).toHaveLength(1);
    expect(Number(checks![0].amount)).toBe(450);
    expect(String(checks![0].check_number)).toBe('1001');
    const { data: bill } = await db().from('payable_bills').select('status, paid_at').eq('id', billId).single();
    expect(bill!.paid_at).not.toBeNull();

    expect(await glBalance(ids.glAp)).toBe(0);
    expect(await glBalance(ids.glCash)).toBe(Math.round((cashBefore - 450) * 100) / 100);
    await expectBooksBalance();
  });

  test('the same bill cannot be paid twice', async ({ page }) => {
    await page.goto('/bills/check-run');
    await expect(page.locator(`input[name="bill_ids"][value="${billId}"]`)).toHaveCount(0);
  });
});
