import { test, expect } from '@playwright/test';
import { db, ids, asManager, asOwner, isoDate, expectBooksBalance, glBalance, unitBalance } from '../helpers';

// Owner money, end to end in the browser: an overdue assessment, the late fee
// run (once only), a check payment, and what the owner sees — with the general
// ledger checked after each step.
test.describe.serial('receivables: charge → late fee → check payment → owner ledger', () => {
  test.use(asManager);
  test('manager posts an overdue assessment to unit 101', async ({ page }) => {
    await page.goto(`/units/${ids.unit}`);
    await page.locator('#adhoc_cat').selectOption({ label: 'HOA Dues' });
    await page.locator('#adhoc_amount').fill('300');
    await page.locator('#adhoc_desc').fill('E2E monthly dues');
    await page.locator('#adhoc_due').fill(isoDate(-40));
    await page.getByRole('button', { name: 'Post charge' }).click();
    await expect(page.getByText('E2E monthly dues').first()).toBeVisible();

    expect(await unitBalance()).toBe(300);
    await expectBooksBalance();
    expect(await glBalance(ids.glAr)).toBe(300);
    expect(await glBalance(ids.glAssessments)).toBe(-300);
  });

  test('late fee run charges $25 once; a second run charges nothing', async ({ page }) => {
    await page.goto('/charges/tasks');
    await page.locator('#fee_association').selectOption(ids.association);
    await page.getByRole('button', { name: 'Charge late fees' }).click();
    await expect(page.getByText(/1 late fee(\(s\))? charged/i)).toBeVisible();

    expect(await unitBalance()).toBe(325);
    expect(await glBalance(ids.glLateFees)).toBe(-25);

    await page.locator('#fee_association').selectOption(ids.association);
    await page.getByRole('button', { name: 'Charge late fees' }).click();
    await expect(page.getByText(/No late fees were due/i)).toBeVisible();
    expect(await unitBalance()).toBe(325);
    await expectBooksBalance();
  });

  test('manager records a $325 check; the unit is paid in full', async ({ page }) => {
    await page.goto(`/units/${ids.unit}`);
    await page.locator('#pay_amount').fill('325');
    await page.locator('#pay_method').selectOption('check');
    await page.locator('#pay_ref').fill('Check 1234');
    await page.getByRole('button', { name: 'Record receipt' }).click();
    await expect(page.getByText(/Payment recorded and posted to the general ledger/i)).toBeVisible();

    expect(await unitBalance()).toBe(0);
    await expectBooksBalance();
    expect(await glBalance(ids.glAr)).toBe(0);
    expect(await glBalance(ids.glCash)).toBe(325);

    const { data: payments } = await db().from('payments').select('amount, method, reference').eq('unit_id', ids.unit);
    expect(payments).toEqual([expect.objectContaining({ amount: 325, method: 'check', reference: 'Check 1234' })]);
  });

  test('owner sees the dues, the late fee and the payment, and owes nothing', async ({ browser }) => {
    const page = await (await browser.newContext(asOwner)).newPage();
    await page.goto('/portal/ledger');
    await expect(page.getByRole('heading', { name: 'Account ledger' })).toBeVisible();
    await expect(page.getByText('E2E monthly dues').first()).toBeVisible();
    await expect(page.getByText(/Late fee/).first()).toBeVisible();
    await expect(page.getByText('Check 1234').first()).toBeVisible();
  });

  test('owner cannot open the manager unit page', async ({ browser }) => {
    const page = await (await browser.newContext(asOwner)).newPage();
    await page.goto(`/units/${ids.unit}`);
    await expect(page).not.toHaveURL(new RegExp(`/units/${ids.unit}$`));
    await expect(page.getByRole('button', { name: 'Record receipt' })).toHaveCount(0);
  });
});
