import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const route = readFileSync(resolve('app/api/reports/run-scheduled/route.ts'), 'utf8');

describe('scheduled report delivery recovery', () => {
  it('recovers successful runs independently of the current generation batch', () => {
    expect(route).toContain(".eq('status', 'succeeded')");
    expect(route).toContain(".gte('finished_at', recoveryCutoff)");
    expect(route).toContain(".limit(200)");
  });

  it('deduplicates recipients and queue delivery by run', () => {
    expect(route).toContain('Array.from(new Set(');
    expect(route).toContain('idempotencyKey: `scheduled-report:${run.id}:${to}`');
    expect(route).toContain('queueEmails(svc');
    expect(route).not.toContain(".from('email_queue').insert");
  });

  it('keeps queue rows portfolio-scoped and uses management-company branding', () => {
    expect(route).toContain('portfolioId: run.portfolio_id');
    expect(route).toContain("run.portfolios?.company_name ?? 'Portier369'");
    expect(route).toContain('replyTo: run.portfolios?.support_email ?? null');
  });
});
