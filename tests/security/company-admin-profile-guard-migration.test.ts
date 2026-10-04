import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261004235000_company_admin_profile_guard.sql'),
  'utf8',
).toLowerCase();
const code = sql.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');

describe('company admin profile guard migration', () => {
  it('guards profile INSERT and DELETE, not only UPDATE', () => {
    expect(code).toContain('create or replace function public.guard_profile_insert_delete()');
    expect(code).toContain('before insert or delete on public.profiles');
    expect(code).toContain("tgname = 'trg_guard_profile_insert_delete'");
    expect(code).toMatch(/can_admin_portfolio\(old\.portfolio_id\)/);
    expect(code).toMatch(/can_admin_portfolio\(new\.portfolio_id\)/);
    expect(code).toContain('auth.uid() is null');
  });

  it('keeps invitation and assignment rows inside the admin portfolio', () => {
    expect(code).toContain('alter policy user_invitations_admin_all on public.user_invitations');
    expect(code).toContain('alter policy am_insert_admins on public.association_managers');
    expect(code).toContain('a.portfolio_id = association_managers.portfolio_id');
  });

  it('is additive (no drops or deletes)', () => {
    expect(code).not.toMatch(/\bdrop\s/);
    expect(code).not.toMatch(/\bdelete\s+from\b/);
    expect(code).not.toMatch(/\btruncate\b/);
  });
});
