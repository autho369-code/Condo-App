import { test, expect } from '@playwright/test';
import { db, ids, asManager } from '../helpers';

// Onboarding, end to end: the manager adds a unit and a new owner with a portal
// invitation; the owner opens the invitation from their email, chooses a
// password, verifies their address from the second email, and lands in their
// own portal seeing their own unit — and nobody else's.
const NEW_OWNER = { first: 'Nora', last: 'Newowner', email: 'nora.newowner@e2e.portier369.test' };
const NEW_UNIT = '202';

/** The newest queued email to an address (the app's own outbox). */
async function latestEmailTo(email: string, subject: RegExp) {
  const { data } = await db().from('email_queue').select('subject, body, created_at')
    .eq('to_email', email).order('created_at', { ascending: false }).limit(10);
  return (data ?? []).find((m) => subject.test(m.subject ?? '')) ?? null;
}
/** The first link in an email body matching `shape` (HTML entities decoded). */
const linkIn = (body: string, shape: RegExp) =>
  (body.match(/https?:\/\/[^\s"'<>]+/g) ?? []).map((l) => l.replace(/&amp;/g, '&')).find((l) => shape.test(l)) ?? null;

test.describe.serial('onboarding: new unit → new owner invited → owner accepts and signs in', () => {
  let unitId = '';
  let ownerId = '';

  test('manager adds unit 202 to the association', async ({ browser }) => {
    const page = await (await browser.newContext(asManager)).newPage();
    await page.goto(`/units/new?association=${ids.association}`);
    const building = page.locator('select#building_id');
    if (await building.count()) await building.selectOption(ids.building);
    await page.locator('#unit_number').fill(NEW_UNIT);
    await page.getByRole('button', { name: /Create unit|Save unit|Add unit/i }).click();
    await expect(page).toHaveURL(/\/units\/[0-9a-f-]{36}/);
    unitId = page.url().match(/units\/([0-9a-f-]{36})/)![1];
    const { data } = await db().from('units').select('building_id, unit_number').eq('id', unitId).single();
    expect(data).toEqual({ building_id: ids.building, unit_number: NEW_UNIT });

    // Adding the same unit number again gives a plain message, not a database error.
    await page.goto(`/units/new?association=${ids.association}`);
    if (await building.count()) await building.selectOption(ids.building);
    await page.locator('#unit_number').fill(NEW_UNIT);
    await page.getByRole('button', { name: /Create unit|Save unit|Add unit/i }).click();
    await expect(page.getByText(`Unit ${NEW_UNIT} already exists in this building`).first()).toBeVisible();
    await expect(page.getByText(/unique constraint/)).toHaveCount(0);
  });

  test('manager creates the owner of unit 202 and invites them to the portal', async ({ browser }) => {
    const page = await (await browser.newContext(asManager)).newPage();
    await page.goto('/owners/new');
    await page.locator('#first_name').fill(NEW_OWNER.first);
    await page.locator('#last_name').fill(NEW_OWNER.last);
    await page.locator('#email').fill(NEW_OWNER.email);
    await page.locator('#association_id').selectOption(ids.association);
    await page.locator('#unit_id').selectOption(unitId);
    await expect(page.locator('input[name="activate_portal"]')).toBeChecked();
    await page.getByRole('button', { name: 'Create owner' }).click();
    await expect(page).toHaveURL(/\/owners\/[0-9a-f-]{36}/);
    ownerId = page.url().match(/owners\/([0-9a-f-]{36})/)![1];

    const { data: occ } = await db().from('occupancies').select('unit_id, owner_id, status').eq('owner_id', ownerId);
    expect(occ).toEqual([expect.objectContaining({ unit_id: unitId, owner_id: ownerId })]);
    await expect.poll(async () => (await latestEmailTo(NEW_OWNER.email, /owner portal|invit/i)) !== null).toBe(true);
  });

  test('owner accepts the emailed invitation, verifies their email and sees only their unit', async ({ browser }) => {
    const page = await (await browser.newContext()).newPage();
    const invite = await latestEmailTo(NEW_OWNER.email, /owner portal|invit/i);
    const inviteLink = linkIn(invite!.body ?? '', /\/invite\?token=/);
    expect(inviteLink, 'invitation email has a link').toMatch(/\/invite\?token=/);
    // Open the invitation on this server (the email names the company's own address).
    await page.goto(new URL(inviteLink!).pathname + new URL(inviteLink!).search);
    await page.locator('#password').fill('E2e-New-Owner-Pass-2026!');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/notice=verify_email/);

    const verify = await latestEmailTo(NEW_OWNER.email, /verify/i);
    const verifyLink = linkIn(verify!.body ?? '', /token|verify|callback/i);
    expect(verifyLink, 'verification email has a link').not.toBeNull();
    // The link names the company's own web address; open its path on this server.
    expect(new URL(verifyLink!).hostname).toBe('e2e-test-management.localhost');
    await page.goto(new URL(verifyLink!).pathname + new URL(verifyLink!).search);
    // The token is used only on the button press (an email scanner opening the link can't spend it).
    // Wait until the press has really left the confirm page: on a cold dev
    // server the first press can be dropped while the page compiles (seen in
    // CI as ECONNRESET); the token is still unused then, so press again.
    const verifyButton = page.getByRole('button', { name: 'Verify and continue' });
    await verifyButton.click();
    try {
      await expect(page).not.toHaveURL(/\/confirm/, { timeout: 30_000 });
    } catch {
      await verifyButton.click();
      await expect(page).not.toHaveURL(/\/confirm/, { timeout: 60_000 });
    }
    await page.waitForLoadState('networkidle');
    if (!/\/portal/.test(page.url())) {
      await page.goto('/login?mode=owner');
      await page.getByLabel('Email').fill(NEW_OWNER.email);
      await page.getByLabel('Password').fill('E2e-New-Owner-Pass-2026!');
      await page.getByRole('button', { name: /sign in/i }).click();
    }
    await expect(page).toHaveURL(/\/portal/);
    await page.goto('/portal/ledger');
    await expect(page.getByRole('heading', { name: 'Account ledger' })).toBeVisible();
    // Unit 101's history belongs to another owner.
    await expect(page.getByText('E2E monthly dues')).toHaveCount(0);
    await expect(page.getByText(/Violation fine/)).toHaveCount(0);
  });
});
