import { test as setup } from '@playwright/test';
import { signIn } from '../helpers';

// Sign each role in once per run through the real login page and keep the
// session (the app rate-limits sign-ins: 10 per account per 15 minutes).
for (const who of ['manager', 'owner', 'vendor', 'otherManager'] as const) {
  setup(`sign in as ${who}`, async ({ page }) => {
    await signIn(page, who);
    await page.context().storageState({ path: `e2e/.auth/${who}.json` });
  });
}
