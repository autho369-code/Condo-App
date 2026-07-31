import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('company administrator manager lifecycle', () => {
  const actions = readFileSync(resolve(process.cwd(), 'app/company-admin/managers/actions.ts'), 'utf8');
  const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260731005000_atomic_manager_access_scope.sql'), 'utf8');

  it('queues activation email and rolls back an unusable invitation', () => {
    expect(actions).toContain('manager-invitation:');
    expect(actions).toContain('queueEmails(svc');
    expect(actions).toContain("from('user_invitations').delete().eq('id', invitationId)");
    expect(actions).toContain('scopeError');
  });

  it('keeps reassignment atomic and tenant-scoped', () => {
    expect(actions).toContain("rpc('set_manager_association_scope'");
    expect(migration).toContain("p.hoa_role = 'company_admin'");
    expect(migration).toContain("manager.hoa_role = 'manager'");
    expect(migration).toContain('association.portfolio_id = v_portfolio_id');
    expect(migration).toContain("raise exception 'One or more associations are outside your portfolio'");
    expect(migration).toContain("'manager_association_scope_updated'");
  });

  it('limits login disable/enable to managers in the administrator portfolio', () => {
    expect(actions).toContain(".eq('portfolio_id', me.portfolio.id)");
    expect(actions).toContain(".eq('hoa_role', 'manager')");
    expect(actions).toContain("ban_duration: disabling ? '876000h' : 'none'");
    expect(actions).toContain('rollbackError');
  });
});
