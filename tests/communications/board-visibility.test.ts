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

  it('fails visibly on query errors and verifies cross-association isolation', () => {
    expect(page).toContain('if (error) throw new Error');
    expect(page).not.toContain('catch { }');
    expect(roleVerifier).toContain("field === 'is_board'");
    expect(roleVerifier).toContain("row.association_id === '36900000-0000-4000-8000-000000000011'");
    expect(page).toContain("status === 'sent' || status === 'delivered'");
  });
});
