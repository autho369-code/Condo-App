import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('platform operator user lifecycle', () => {
  const actions = readFileSync(resolve(process.cwd(), 'app/platform-operator/users/actions.ts'), 'utf8');
  const page = readFileSync(resolve(process.cwd(), 'app/platform-operator/users/page.tsx'), 'utf8');
  const roles = readFileSync(resolve(process.cwd(), 'lib/auth/profile-roles.ts'), 'utf8');
  const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260731011000_platform_operator_user_role_lifecycle.sql'), 'utf8');

  it('only exposes database-supported profile roles', () => {
    for (const role of ['company_admin', 'manager', 'board', 'owner', 'tenant']) {
      expect(roles).toContain(`value: '${role}'`);
    }
    for (const invalidRole of ['assistant_manager', 'accounting_staff', 'board_member', 'vendor']) {
      expect(roles).not.toContain(`value: '${invalidRole}'`);
    }
    expect(actions).toContain('isProfileRole(newRole)');
    expect(page).toContain("db.from('vendors').select('auth_user_id')");
    expect(page).toContain('Role managed in Vendors');
    expect(page).toContain('<option value="" disabled>Select role</option>');
  });

  it('requires an active administrator and protects platform operator identities', () => {
    expect(actions).toContain("operator.role !== 'admin'");
    expect(actions).toContain("from('platform_operators').select('id')");
    expect(page).toContain('Managed in Operators');
    expect(migration).toContain("operator.role = 'admin'");
    expect(migration).toContain('Platform operator accounts must be managed separately');
  });

  it('keeps login state rollback-safe and role changes atomic', () => {
    expect(actions).toContain('restoreBanDuration(authUser.banned_until)');
    expect(actions).toContain('rollbackLogin(svc');
    expect(actions).toContain("rpc('platform_set_profile_role'");
    expect(migration).toContain("role.name = 'Property Manager'");
    expect(migration).toContain('delete from public.association_managers');
    expect(migration).toContain("'user_role_changed'");
  });
});
