import { defineConfig, devices } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';

// Browser tests drive a Next.js dev server on :3100 against the LOCAL test
// database (e2e/supabase, :55321) only. `npm run e2e:db` starts and seeds it.
// The settings below are passed to the server's environment, which wins over
// .env.local (that file points at production and must never be used here).
const envFile = '.env.e2e.local';
const e2eEnv: Record<string, string> = existsSync(envFile)
  ? Object.fromEntries(readFileSync(envFile, 'utf8').split(/\r?\n/)
      .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter((m): m is RegExpMatchArray => !!m).map((m) => [m[1], m[2]]))
  : {};
if (!/^http:\/\/127\.0\.0\.1:55321\/?$/.test(e2eEnv.NEXT_PUBLIC_SUPABASE_URL ?? '')) {
  throw new Error('Browser tests run only against the local test database. Run `npm run e2e:db` first (writes .env.e2e.local).');
}

// Every key in .env.local (production) that the e2e file doesn't set is blanked
// for the test server: Next.js never replaces a variable that is already set.
const localKeys = existsSync('.env.local')
  ? readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim().match(/^([A-Z0-9_]+)=/)?.[1]).filter((k): k is string => !!k)
  : [];
const blanked = Object.fromEntries(localKeys.filter((k) => !(k in e2eEnv)).map((k) => [k, '']));

const PORT = 3100;

export default defineConfig({
  testDir: 'e2e/tests',
  // One shared test company: run in order, one at a time.
  fullyParallel: false,
  workers: 1,
  // No retries: the groups share one seeded company, so a retry would rerun a
  // group on data the failed attempt already changed (a failure must be read).
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    navigationTimeout: 90_000,
    actionTimeout: 30_000,
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'], testIgnore: /auth\.setup\.ts/ },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    // Always start our own server: one already on :3100 could be reading .env.local.
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      ...blanked,
      ...e2eEnv,
      // No outside services from a test run.
      RESEND_API_KEY: '',
      STRIPE_SECRET_KEY: '',
      STRIPE_WEBHOOK_SECRET: '',
      DEEPSEEK_API_KEY: '',
      TWILIO_AUTH_TOKEN: '',
      LOB_API_KEY: '',
      PLAID_SECRET: '',
      SMS_DELIVERY_ENABLED: 'false',
      WEBHOOK_DELIVERY_ENABLED: 'false',
      PHYSICAL_MAIL_DELIVERY_ENABLED: 'false',
      VERCEL_API_TOKEN: '',
      AI_CREDENTIALS_ENCRYPTION_KEY: '',
      LOCAL_PREVIEW_MODE: 'false',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
