import { test, expect } from '@playwright/test';
import { db, ids, asManager, asVendor, isoDate, expectBooksBalance, glBalance } from '../helpers';

// Maintenance, end to end across two portals: the manager opens a work order
// for unit 101 and assigns the plumber; the vendor sees it in their portal,
// works it, and invoices it with a PDF; the invoice arrives as a bill linked
// to the work order, and approving it posts the cost to repairs and A/P.
test.describe.serial('work orders: open → vendor works it → vendor invoice → approved bill', () => {
  let workOrderId = '';

  test('manager opens a work order for unit 101 and assigns the plumber', async ({ browser }) => {
    const page = await (await browser.newContext(asManager)).newPage();
    await page.goto('/work-orders/new');
    await page.locator('#association_id').selectOption(ids.association);
    await page.locator('#unit_id').selectOption(ids.unit);
    await page.locator('#title').fill('E2E leaking riser in unit 101');
    await page.locator('#description').fill('Water coming through the ceiling of unit 001 from the riser in unit 101.');
    await page.locator('#category').selectOption('plumbing');
    await page.locator('#priority').selectOption('high');
    await page.locator('#vendor_id').selectOption(ids.vendor);
    await page.getByRole('button', { name: 'Create work order' }).click();
    await expect(page).toHaveURL(/\/work-orders\/[0-9a-f-]{36}/);
    workOrderId = page.url().match(/work-orders\/([0-9a-f-]{36})/)![1];

    await page.getByRole('button', { name: /Mark as Scheduled/i }).click();
    await expect.poll(async () => (await db().from('work_orders').select('status').eq('id', workOrderId).single()).data?.status).toBe('scheduled');
    const { data } = await db().from('work_orders').select('vendor_id, unit_id, association_id').eq('id', workOrderId).single();
    expect(data).toEqual({ vendor_id: ids.vendor, unit_id: ids.unit, association_id: ids.association });
  });

  test('vendor sees the job, marks it in progress, then done', async ({ browser }) => {
    const page = await (await browser.newContext(asVendor)).newPage();
    await page.goto('/vendor/work-orders');
    await expect(page.getByText('E2E leaking riser in unit 101').first()).toBeVisible();
    await page.goto(`/vendor/work-orders/${workOrderId}`);
    await page.locator('select[name="new_status"]').selectOption('in_progress');
    await page.locator('textarea[name="note"]').fill('E2E: on site, riser valve isolated, replacing tomorrow.');
    await page.getByRole('button', { name: 'Post update' }).click();
    await expect.poll(async () => (await db().from('work_orders').select('status').eq('id', workOrderId).single()).data?.status).toBe('in_progress');

    // Only a finished job can be invoiced: it isn't offered on the invoice form yet.
    await page.goto('/vendor/payments');
    await expect(page.locator(`#vi-work-order option[value="${workOrderId}"]`)).toHaveCount(0);

    await page.goto(`/vendor/work-orders/${workOrderId}`);
    await page.locator('select[name="new_status"]').selectOption('done');
    await page.locator('textarea[name="note"]').fill('E2E: valve replaced, no leak after 24 hours.');
    await page.getByRole('button', { name: 'Post update' }).click();
    await expect.poll(async () => (await db().from('work_orders').select('status').eq('id', workOrderId).single()).data?.status).toBe('done');
  });

  test('vendor submits a $450 invoice with a PDF for the job', async ({ browser }) => {
    const page = await (await browser.newContext(asVendor)).newPage();
    await page.goto('/vendor/payments');
    await page.locator('#vi-work-order').selectOption(workOrderId);
    await page.locator('#vi-number').fill('E2E-WO-INV-1');
    await page.locator('#vi-amount').fill('450.00');
    await page.locator('#vi-date').fill(isoDate(0));
    await page.locator('#vi-due').fill(isoDate(30));
    await page.locator('#vi-memo').fill('E2E: riser valve replacement, parts and labor.');
    await page.locator('input[type="file"]').setInputFiles('e2e/files/invoice.pdf');
    await page.getByRole('button', { name: /Submit invoice/i }).click();
    await expect.poll(async () => (await db().from('payable_bills').select('id').eq('work_order_id', workOrderId)).data?.length ?? 0).toBe(1);

    const { data: bill } = await db().from('payable_bills').select('amount, vendor_id, bill_number, status').eq('work_order_id', workOrderId).single();
    expect(bill).toEqual(expect.objectContaining({ vendor_id: ids.vendor, bill_number: 'E2E-WO-INV-1' }));
    expect(Number(bill!.amount)).toBe(450);
    // A duplicate invoice number from the same vendor is rejected.
    await page.goto('/vendor/payments');
    await page.locator('#vi-work-order').selectOption(workOrderId);
    await page.locator('#vi-number').fill('E2E-WO-INV-1');
    await page.locator('#vi-amount').fill('450.00');
    await page.locator('#vi-date').fill(isoDate(0));
    await page.locator('input[type="file"]').setInputFiles('e2e/files/invoice.pdf');
    await page.getByRole('button', { name: /Submit invoice/i }).click();
    await expect(page.getByText(/already|duplicate/i).first()).toBeVisible();
    expect((await db().from('payable_bills').select('id').eq('work_order_id', workOrderId)).data).toHaveLength(1);
  });

  test('manager approves the vendor bill; the repair cost posts to the job', async ({ browser }) => {
    const page = await (await browser.newContext(asManager)).newPage();
    const repairsBefore = await glBalance(ids.glRepairs);
    const { data: bill } = await db().from('payable_bills').select('id').eq('work_order_id', workOrderId).single();
    await page.goto(`/bills/${bill!.id}`);
    // A vendor's invoice arrives without an expense account: the page suggests
    // the vendor's default (Repairs) and the manager saves it before approving.
    await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(page.locator('select[name="gl_account_id"]')).toHaveValue(ids.glRepairs);
    await expect(page.getByText(/Suggested from the vendor's default account/)).toBeVisible();
    await page.getByRole('button', { name: 'Save account' }).click();
    await expect.poll(async () => (await db().from('payable_bills').select('gl_account_id').eq('id', bill!.id).single()).data?.gl_account_id).toBe(ids.glRepairs);
    const submit = page.getByRole('button', { name: 'Submit for approval' });
    if (await submit.count()) await submit.click();
    await page.getByRole('button', { name: 'Approve' }).click();
    await expect.poll(async () => (await db().from('payable_bills').select('status').eq('id', bill!.id).single()).data?.status).toBe('approved');
    expect(await glBalance(ids.glRepairs)).toBe(Math.round((repairsBefore + 450) * 100) / 100);
    await expectBooksBalance();
  });

  test('vendor cannot open another company area or the manager pages', async ({ browser }) => {
    const page = await (await browser.newContext(asVendor)).newPage();
    await page.goto(`/units/${ids.unit}`);
    await expect(page.getByRole('button', { name: 'Record receipt' })).toHaveCount(0);
    await page.goto('/bills/new');
    await expect(page.getByRole('button', { name: 'Save bill' })).toHaveCount(0);
  });
});
