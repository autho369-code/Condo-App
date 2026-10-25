import { test, expect } from '@playwright/test';
import { db, ids, asOtherManager } from '../helpers';
import { E2E } from '../fixture.mjs';

// A manager at another company sees none of the test company's records, and
// can't change them by posting to the same forms (runs after the money tests,
// so there are charges, payments, a violation and a paid bill to protect).
test.describe('isolation: another company cannot see or change our records', () => {
  test.use(asOtherManager);

  test('unit, violation and bill pages show nothing of ours', async ({ page }) => {
    await page.goto(`/units/${ids.unit}`);
    await expect(page.getByText('E2E monthly dues')).toHaveCount(0);
    await expect(page.getByText(E2E.owner.name)).toHaveCount(0);

    const { data: violation } = await db().from('violations').select('id').eq('unit_id', ids.unit).limit(1).maybeSingle();
    if (violation) {
      await page.goto(`/violations/${violation.id}`);
      await expect(page.getByText('Quiet hours')).toHaveCount(0);
    }
    const { data: bill } = await db().from('payable_bills').select('id').eq('portfolio_id', ids.portfolio).limit(1).maybeSingle();
    if (bill) {
      await page.goto(`/bills/${bill.id}`);
      await expect(page.getByText('E2E-INV-77')).toHaveCount(0);
    }
  });

  test('lists show none of our associations, owners or vendors', async ({ page }) => {
    for (const path of ['/associations', '/owners', '/vendors', '/charges']) {
      await page.goto(path);
      await expect(page.getByText(E2E.associationName)).toHaveCount(0);
      await expect(page.getByText(E2E.owner.name)).toHaveCount(0);
      await expect(page.getByText(E2E.vendorName)).toHaveCount(0);
    }
  });

  test('posting a charge to our unit is refused', async ({ page }) => {
    const before = (await db().from('charges').select('id').eq('unit_id', ids.unit)).data?.length ?? 0;
    await page.goto('/charges/new');
    // Our unit is not offered; force the value the way a hand-crafted request would.
    await expect(page.locator(`select[name="unit_id"] option[value="${ids.unit}"]`)).toHaveCount(0);
    await page.locator('select[name="unit_id"]').evaluate((el, unit) => {
      const s = el as HTMLSelectElement;
      s.add(new Option('forged', unit));
      s.value = unit;
    }, ids.unit);
    // …and our company's dues category, which this company can't see either.
    const { data: dues } = await db().from('charge_categories').select('id').eq('portfolio_id', ids.portfolio).eq('code', 'DUES').single();
    await page.locator('select[name="charge_category_id"]').evaluate((el, cat) => {
      const s = el as HTMLSelectElement;
      s.add(new Option('forged', cat));
      s.value = cat;
    }, dues!.id);
    // Skip the browser's own checks so the request reaches the server.
    await page.locator('form:has(select[name="unit_id"])').evaluate((f) => { (f as HTMLFormElement).noValidate = true; });
    await page.locator('input[name="amount"]').fill('999');
    await page.locator('input[name="description"], textarea[name="description"]').first().fill('E2E forged charge');
    await page.getByRole('button', { name: /Post charge/ }).click();
    // The server refused it (redirect back with an error), not the browser.
    await expect(page).toHaveURL(/[?&]error=/);
    await expect(page).not.toHaveURL(/posted=1/);
    const after = (await db().from('charges').select('id, description').eq('unit_id', ids.unit)).data ?? [];
    expect(after.length).toBe(before);
    expect(after.some((c) => c.description === 'E2E forged charge')).toBe(false);
  });
});
