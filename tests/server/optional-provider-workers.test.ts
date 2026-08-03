import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('optional provider cron workers', () => {
  const routes = [
    source('app/api/sms/deliver/route.ts'),
    source('app/api/webhooks/deliver/route.ts'),
    source('app/api/mail/deliver/route.ts'),
  ];

  it('authenticates cron requests before reporting provider availability', () => {
    for (const route of routes) {
      expect(route.indexOf('requireCronSecret(request)')).toBeGreaterThan(-1);
      expect(route.indexOf('requireCronSecret(request)')).toBeLessThan(route.indexOf('skipped: true'));
    }
  });

  it('treats an intentionally disabled worker as a successful skipped run', () => {
    for (const route of routes) {
      expect(route).toContain('skipped: true');
      expect(route).toContain('reason:');
      expect(route).not.toMatch(/skipped: true[\s\S]{0,160}status: 503/);
    }
  });
});
