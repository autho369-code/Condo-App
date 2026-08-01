import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// associations carries several bank-account FKs (operating/primary/reserve/stripe
// settlement), so an unhinted associations(...) embed from bank_accounts is
// ambiguous (PGRST201) and PostgREST rejects the whole query. These pages then
// render zero accounts / 404 instead of failing loudly.
describe('bank account association embeds', () => {
  const listPage = readFileSync(resolve(process.cwd(), 'app/(app)/bank-accounts/page.tsx'), 'utf8');
  const detailPage = readFileSync(resolve(process.cwd(), 'app/(app)/bank-accounts/[id]/page.tsx'), 'utf8');

  it('list page disambiguates the associations embed', () => {
    expect(listPage).toContain('associations!bank_accounts_association_id_fkey(');
    expect(listPage).not.toMatch(/[^!_a-z]associations\(/);
  });

  it('detail page disambiguates the associations embed', () => {
    expect(detailPage).toContain('associations!bank_accounts_association_id_fkey(');
    expect(detailPage).not.toMatch(/[^!_a-z]associations\(/);
  });
});
