import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('company administrator manager lifecycle', () => {
  const actions = readFileSync(resolve(process.cwd(), 'app/company-admin/managers/actions.ts'), 'utf8');
  const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260731005000_atomic_manager_access_scope.sql'), 'utf8');
  const invitationMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260731010000_secure_manager_invitations.sql'), 'utf8');
  const roleCatalogMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260731012000_canonicalize_system_user_roles.sql'), 'utf8');
  const roleBoundaryMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260731013000_deactivate_out_of_scope_system_roles.sql'), 'utf8');

  it('queues activation email and rolls back an unusable invitation', () => {
    expect(actions).toContain('manager-invitation:');
    expect(actions).toContain('queueEmails(svc');
    expect(actions).toContain("from('user_invitations').delete().eq('id', invitationId)");
    expect(actions).toContain("rpc('create_manager_invitation'");
    expect(actions).toContain('p_association_ids: associationIds');
    expect(invitationMigration).toContain("jsonb_build_object('email_delivery', 'application')");
    expect(invitationMigration).toContain("new.metadata ->> 'email_delivery' = 'application'");
    expect(invitationMigration).toContain("role.name = 'Property Manager'");
    expect(invitationMigration).toContain("raise exception 'One or more associations are outside your portfolio'");
  });

  it('keeps reassignment atomic and tenant-scoped', () => {
    expect(actions).toContain("rpc('set_manager_association_scope'");
    expect(migration).toContain("p.hoa_role = 'company_admin'");
    expect(migration).toContain("manager.hoa_role = 'manager'");
    expect(migration).toContain('association.portfolio_id = v_portfolio_id');
    expect(migration).toContain("raise exception 'One or more associations are outside your portfolio'");
    expect(migration).toContain("'manager_association_scope_updated'");
  });

  it('canonicalizes legacy role metadata while preserving the condo-only role boundary', () => {
    expect(roleCatalogMigration).toContain("(null, 'Leasing Agent'");
    expect(roleCatalogMigration).toContain("(null, 'Accounts Payable'");
    expect(roleCatalogMigration).toContain('on conflict (portfolio_id, name) do update');
    expect(roleCatalogMigration).toContain('is_system = excluded.is_system');
    expect(roleBoundaryMigration).toContain("name in ('Leasing Agent', 'Accounts Payable')");
    expect(roleBoundaryMigration).toContain('set is_system = false');
    expect(roleBoundaryMigration).toContain('is_system is distinct from false');
  });

  it('limits login disable/enable to managers in the administrator portfolio', () => {
    expect(actions).toContain(".eq('portfolio_id', me.portfolio.id)");
    expect(actions).toContain(".eq('hoa_role', 'manager')");
    expect(actions).toContain("ban_duration: disabling ? '876000h' : 'none'");
    expect(actions).toContain('rollbackError');
  });
});
