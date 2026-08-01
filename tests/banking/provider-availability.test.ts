import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('banking provider availability', () => {
  const page = source('app/(app)/bank-accounts/link-bank/page.tsx');
  const client = source('app/(app)/bank-accounts/link-bank/link-bank-client.tsx');
  const feed = source('app/(app)/bank-accounts/feeds/page.tsx');
  const routes = [
    source('app/api/plaid/create-link-token/route.ts'),
    source('app/api/plaid/exchange-token/route.ts'),
    source('app/api/plaid/transactions/sync/route.ts'),
  ];

  it('checks staff access and provider readiness on the server', () => {
    expect(page).toContain('await requireStaff()');
    expect(page).toContain('configured={isPlaidConfigured()}');
    expect(page).toContain('<Suspense');
  });

  it('renders an honest unavailable state without contacting Plaid', () => {
    expect(client).toContain('if (!configured) return;');
    expect(client).toContain('Bank connections are not enabled');
    expect(client).toContain('No bank credentials are requested or transmitted');
    expect(client.indexOf('if (!configured) return;')).toBeLessThan(client.indexOf("fetch('/api/plaid/create-link-token'"));
  });

  it('hides bank-connection calls to action when the provider is unavailable', () => {
    expect(feed).toContain('const plaidConfigured = isPlaidConfigured()');
    expect(feed).toContain('actions={plaidConfigured ? (');
    expect(feed).toContain('action={plaidConfigured ? (');
  });

  it('reports unavailable provider APIs as service unavailable', () => {
    for (const route of routes) {
      expect(route).toContain('if (!isPlaidConfigured())');
      expect(route).toMatch(/if \(!isPlaidConfigured\(\)\)[\s\S]*?status: 503/);
    }
  });
});
