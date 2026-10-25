import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { E2E } from './fixture.mjs';

// Re-read on each use: the seed (global setup) rewrites it with a fresh password.
const readEnv = (): Record<string, string> => Object.fromEntries(
  readFileSync('.env.e2e.local', 'utf8').split(/\r?\n/)
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter((m): m is RegExpMatchArray => !!m).map((m) => [m[1], m[2]]),
);
const env = readEnv();
if (!/^http:\/\/127\.0\.0\.1:55321\/?$/.test(env.NEXT_PUBLIC_SUPABASE_URL ?? '')) {
  throw new Error('e2e helpers: .env.e2e.local does not point at the local test database.');
}

let client: SupabaseClient | null = null;
/** Service-role client on the LOCAL test database, for setup and assertions. */
export function db(): SupabaseClient {
  client ??= createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export const ids = E2E.ids;

export async function signIn(page: Page, who: 'manager' | 'owner' | 'vendor' | 'otherManager') {
  const account = E2E[who];
  await page.goto(`/login?mode=${who === 'owner' ? 'owner' : who === 'vendor' ? 'vendor' : 'manager'}`);
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(readEnv().E2E_TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(who === 'owner' ? /\/portal/ : who === 'vendor' ? /\/vendor/ : /\/dashboard/);
}

/** Session files written by e2e/tests/auth.setup.ts. */
export const asManager = { storageState: 'e2e/.auth/manager.json' };
export const asOwner = { storageState: 'e2e/.auth/owner.json' };
export const asVendor = { storageState: 'e2e/.auth/vendor.json' };
export const asOtherManager = { storageState: 'e2e/.auth/otherManager.json' };

/** The association's local date as YYYY-MM-DD, n days from today. */
export function isoDate(daysFromToday: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

/** Every posted journal entry of the test company balances (debits = credits). */
export async function expectBooksBalance() {
  const { data, error } = await db()
    .from('journal_entries')
    .select('id, posted, journal_lines(debit_amount, credit_amount)')
    .eq('portfolio_id', ids.portfolio);
  if (error) throw error;
  for (const entry of data ?? []) {
    const lines = (entry as any).journal_lines as { debit_amount: number | null; credit_amount: number | null }[];
    const debit = lines.reduce((s, l) => s + Number(l.debit_amount ?? 0), 0);
    const credit = lines.reduce((s, l) => s + Number(l.credit_amount ?? 0), 0);
    expect(Math.round(debit * 100), `journal entry ${entry.id} balances`).toBe(Math.round(credit * 100));
  }
  return data?.length ?? 0;
}

/** Net posted balance (debits − credits) of one GL account for the test company. */
export async function glBalance(glAccountId: string) {
  const { data, error } = await db()
    .from('journal_lines')
    .select('debit_amount, credit_amount, journal_entries!inner(posted, portfolio_id)')
    .eq('gl_account_id', glAccountId)
    .eq('journal_entries.portfolio_id', ids.portfolio)
    .eq('journal_entries.posted', true);
  if (error) throw error;
  return Math.round((data ?? []).reduce((s, l: any) => s + Number(l.debit_amount ?? 0) - Number(l.credit_amount ?? 0), 0) * 100) / 100;
}

/** Open balance of unit 101 from the charges view the app itself uses. */
export async function unitBalance() {
  const { data, error } = await db().from('v_charge_balances').select('balance_due').eq('unit_id', ids.unit);
  if (error) throw error;
  return Math.round((data ?? []).reduce((s, r: any) => s + Number(r.balance_due ?? 0), 0) * 100) / 100;
}
