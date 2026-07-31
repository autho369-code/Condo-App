import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const route = readFileSync(resolve('app/api/automation/run-flows/route.ts'), 'utf8');
const migration = readFileSync(resolve('supabase/migrations/20260731000000_retry_failed_automation_actions.sql'), 'utf8');
const cooldown = readFileSync(resolve('supabase/migrations/20260731001000_prevent_concurrent_automation_reclaims.sql'), 'utf8');
const unambiguous = readFileSync(resolve('supabase/migrations/20260731002000_make_automation_claim_result_unambiguous.sql'), 'utf8');

describe('automation retry safety', () => {
  it('atomically claims new or retryable subjects with a five-attempt ceiling', () => {
    expect(route).toContain(".rpc('claim_automation_flow_run'");
    expect(migration).toContain("status in ('failed', 'partial')");
    expect(migration).toContain('attempt_count < 5');
    expect(migration).toContain("auth.role() <> 'service_role'");
    expect(cooldown).toContain("last_attempt_at < now() - interval '10 minutes'");
    expect(unambiguous).toContain('returns setof public.automation_flow_runs');
    expect(route).toContain('const runRow = claimedRows?.[0]');
  });

  it('preserves successful action outcomes and retries only failures', () => {
    expect(route).toContain('if (prior?.ok)');
    expect(route).toContain('outcomes.push({ ...prior, index, type: action.type })');
  });

  it('deduplicates retried automation emails by run, action, and recipient', () => {
    expect(route).toContain('idempotencyKey: `automation:${deliveryKey}:');
  });
});
