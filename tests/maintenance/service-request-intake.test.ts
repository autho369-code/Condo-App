import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(path, 'utf8');

describe('manager service-request intake', () => {
  it('has an atomic, portfolio-scoped triage RPC', () => {
    const migration = source('supabase/migrations/20260803060000_service_request_intake.sql');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('public.can_access_portfolio(v_request.portfolio_id)');
    expect(migration).toContain('public.can_access_association(v_request.association_id)');
    expect(migration).toContain('service_request_id');
    expect(migration).toContain("set status = 'waiting'");
  });

  it('surfaces the queue in manager navigation and the action center', () => {
    expect(source('lib/navigation/modules.ts')).toContain("{ label: 'Service requests', href: '/service-requests' }");
    expect(source('lib/navigation/action-center-attention.ts')).toContain('service requests awaiting triage');
    expect(source('app/(app)/service-requests/page.tsx')).toContain('Create work order');
  });
});
