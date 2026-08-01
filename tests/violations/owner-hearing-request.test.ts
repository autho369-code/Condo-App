import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260801020000_owner_violation_hearing_requests.sql'), 'utf8');
const page = readFileSync(resolve(process.cwd(), 'app/portal/violations/[id]/page.tsx'), 'utf8');

describe('owner violation hearing requests', () => {
  it('derives ownership in a security-definer RPC and rejects closed cases', () => {
    expect(migration).toContain('security definer');
    expect(migration).toContain('v_owner_id := public.current_owner_id()');
    expect(migration).toContain('v.owner_id = v_owner_id');
    expect(migration).toContain("v_violation.status in ('cured', 'closed')");
    expect(migration).toContain("status = 'hearing_pending'");
    expect(migration).toContain('revoke all on function public.request_owner_violation_hearing');
  });

  it('exposes a real owner action with visible success and error states', () => {
    expect(page).toContain('requestViolationHearing');
    expect(page).toContain('Submit hearing request');
    expect(page).toContain('Hearing request submitted to association management.');
    expect(page).toContain('Could not request a hearing:');
  });
});
