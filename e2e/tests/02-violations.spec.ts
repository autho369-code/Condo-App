import { test, expect } from '@playwright/test';
import { db, ids, asManager, asOwner, expectBooksBalance, glBalance, unitBalance } from '../helpers';

// Compliance, end to end: open a violation against unit 101 under a house rule,
// send the courtesy and formal notices, record the board's hearing decision,
// assess the first fine, and see the fine on the owner's ledger and in the GL.
test.describe.serial('violations: notice → hearing → fine → owner ledger', () => {
  test.use(asManager);
  let violationId = '';

  test('manager opens a violation for unit 101 under rule R-1', async ({ page }) => {
    await page.goto('/violations/new');
    await page.locator('#association_id').selectOption(ids.association);
    await page.locator('#unit_id').selectOption(ids.unit);
    await page.locator('#house_rule_id').selectOption({ label: 'R-1 — Quiet hours' });
    await page.locator('#description').fill('E2E: loud music at 1 a.m. reported by unit 102.');
    await page.getByRole('button', { name: 'Open violation' }).click();
    await expect(page).toHaveURL(/\/violations\/[0-9a-f-]{36}/);
    await expect(page.getByText(/Violation opened/i).first()).toBeVisible();
    violationId = page.url().match(/violations\/([0-9a-f-]{36})/)![1];

    const { data } = await db().from('violations').select('unit_id, owner_id, status, title').eq('id', violationId).single();
    expect(data).toEqual(expect.objectContaining({ unit_id: ids.unit, owner_id: ids.owner, title: 'Quiet hours' }));
  });

  test('courtesy notice, then formal notice with hearing opportunity', async ({ page }) => {
    await page.goto(`/violations/${violationId}`);
    await page.getByRole('button', { name: 'Record courtesy notice' }).click();
    await expect(page.getByText(/Courtesy notice recorded/i).first()).toBeVisible();
    await page.getByRole('button', { name: 'Record formal notice with hearing opportunity' }).click();
    await expect(page.getByText(/Formal notice with hearing opportunity recorded/i).first()).toBeVisible();

    // The fine is blocked until the hearing window passes or the board decides.
    await expect(page.getByRole('button', { name: 'Record first fine' })).toBeDisabled();

    // Each notice is a letter to the owner of record.
    const { data: letters } = await db().from('violation_letters').select('id').eq('violation_id', violationId);
    expect((letters ?? []).length).toBeGreaterThanOrEqual(2);
    expect(await unitBalance()).toBe(0);
  });

  test('board upholds at the hearing; the first fine posts $50 to the unit', async ({ page }) => {
    await page.goto(`/violations/${violationId}`);
    await page.locator('select[name="decision"]').selectOption('upheld');
    await page.locator('input[name="notes"]').fill('E2E: board vote 3-0 to uphold.');
    await page.getByRole('button', { name: 'Save decision' }).click();
    await expect(page.getByRole('button', { name: 'Record first fine' })).toBeEnabled();

    await page.getByRole('button', { name: 'Record first fine' }).click();
    await expect(page.getByText(/\$50\.00 fine posted to the unit ledger/i).first()).toBeVisible();

    const { data: v } = await db().from('violations').select('fines_total, board_decision').eq('id', violationId).single();
    expect(v).toEqual(expect.objectContaining({ board_decision: 'upheld' }));
    expect(Number(v!.fines_total)).toBe(50);
    expect(await unitBalance()).toBe(50);
    expect(await glBalance(ids.glFines)).toBe(-50);
    await expectBooksBalance();
  });

  test('owner sees the violation and the fine', async ({ browser }) => {
    const page = await (await browser.newContext(asOwner)).newPage();
    await page.goto('/portal/ledger');
    await expect(page.getByText(/Violation fine — Quiet hours/).first()).toBeVisible();
    await page.goto(`/portal/violations/${violationId}`);
    await expect(page.getByText('Quiet hours').first()).toBeVisible();
  });
});
