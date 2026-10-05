import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(resolve('supabase/migrations/20260731015000_board_communications_visibility.sql'), 'utf8');
const page = readFileSync(resolve('app/board/communications/page.tsx'), 'utf8');
const roleVerifier = readFileSync(resolve('scripts/verify-staging-roles.mjs'), 'utf8');

describe('board communications visibility', () => {
  it('grants read-only access for active board associations', () => {
    expect(migration).toContain('for select');
    expect(migration).toContain('public.is_board_user()');
    expect(migration).toContain('association_id in (select public.current_board_association_ids())');
    expect(migration).not.toContain('for insert');
    expect(migration).not.toContain('for update');
    expect(migration).not.toContain('for delete');
  });

  it('is no longer part of the read-only board portal', () => {
    // Board scope is basic financials, minutes and governing documents only.
    const lockdown = readFileSync(resolve('supabase/migrations/20261005111000_board_read_only_scope.sql'), 'utf8');
    expect(page).toContain("redirect('/board')");
    expect(page).not.toContain("from('communications_log')");
    expect(lockdown).toContain('alter policy communications_board_read on public.communications_log using (false)');
    expect(roleVerifier).toContain("field === 'is_board'");
  });
});
