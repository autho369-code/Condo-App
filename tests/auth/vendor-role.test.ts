import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const roleMigration = readFileSync(
  join(root, 'supabase/migrations/20260803040000_first_class_vendor_role.sql'),
  'utf8',
).toLowerCase();
const accessMigration = readFileSync(
  join(root, 'supabase/migrations/20260803050000_resident_portal_access.sql'),
  'utf8',
).toLowerCase();
const vendorActions = readFileSync(join(root, 'app/(app)/vendors/actions.ts'), 'utf8').toLowerCase();
const invitePage = readFileSync(join(root, 'app/invite/page.tsx'), 'utf8').toLowerCase();

describe('first-class vendor identity', () => {
  it('does not represent vendors as owners', () => {
    expect(roleMigration).toContain("alter type public.hoa_role add value if not exists 'vendor'");
    expect(vendorActions).toContain("hoa_role: 'vendor'");
    expect(vendorActions).not.toContain("hoa_role: 'owner'");
    expect(invitePage).toContain("vendor: 'vendor'");
  });

  it('links and resolves vendor records only for vendor profiles', () => {
    expect(accessMigration).toContain("p.hoa_role = 'vendor'");
    expect(accessMigration).toContain("set hoa_role = 'vendor'");
  });
});
