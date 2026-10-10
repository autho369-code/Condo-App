import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// "Unlink login" on an owner record: one confirm-first button cuts off the
// record's own sign-in and every sign-in it was added to.
const read = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');

describe('unlink owner logins', () => {
  const sql = read('supabase/migrations/20261010050000_unlink_owner_logins.sql');

  it('checks the caller manages the owner association and may write, inside the function', () => {
    expect(sql).toContain('security definer');
    expect(sql).toContain("set search_path to 'pg_catalog', 'public'");
    expect(sql).toContain('public.can_manage_association(v_owner.association_id)');
    expect(sql).toContain('public.operator_may_write(false)');
    expect(sql).toContain('revoke all on function public.unlink_owner_logins(uuid) from public, anon;');
  });

  it('revokes added logins, clears the original one, and logs it', () => {
    expect(sql).toMatch(/update public\.owner_portal_logins\s+set revoked_at = now\(\)/);
    expect(sql).toContain('set auth_user_id = null, portal_activated = false');
    expect(sql).toContain("'owner_logins_unlinked'");
  });

  it('is a confirm-first button that authenticates in the action', () => {
    const actions = read('app/(app)/owners/[id]/occupancy-actions.ts');
    const action = actions.slice(actions.indexOf('export async function unlinkOwnerLogins'));
    expect(action.slice(0, 400)).toContain('await requireStaff();');
    expect(action).toContain("rpc('unlink_owner_logins', { p_owner_id: ownerId })");
    const page = read('app/(app)/owners/[id]/page.tsx');
    expect(page).toMatch(/unlinkOwnerLogins\.bind\(null, id\)[\s\S]{0,200}confirm="Unlink every login/);
  });
});
