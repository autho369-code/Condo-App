import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sanitizeSearchTerm, searchEverything } from '@/lib/search/global';

describe('global search', () => {
  it('strips PostgREST filter and LIKE metacharacters', () => {
    expect(sanitizeSearchTerm('a,b(c)*d%e_f\\g"h\'i')).toBe('a b c d e f g h i');
    expect(sanitizeSearchTerm('  lots   of   space ')).toBe('lots of space');
    expect(sanitizeSearchTerm('x'.repeat(200))).toHaveLength(80);
    expect(sanitizeSearchTerm(null)).toBe('');
  });

  it('does not query for terms shorter than two characters', async () => {
    const db = { from: () => { throw new Error('should not query'); } };
    await expect(searchEverything(db, ' a ', { finance: true })).resolves.toEqual([]);
    await expect(searchEverything(db, '%,', { finance: true })).resolves.toEqual([]);
  });

  it('skips bills for non-finance staff', async () => {
    const tables: string[] = [];
    const chain: any = new Proxy({}, {
      get: (_t, prop) => (prop === 'then' ? (r: any) => r({ data: [] }) : () => chain),
    });
    const db = { from: (t: string) => { tables.push(t); return chain; } };
    await searchEverything(db, 'lobby', { finance: false });
    expect(tables).not.toContain('payable_bills');
    await searchEverything(db, 'lobby', { finance: true });
    expect(tables).toContain('payable_bills');
  });

  it('API route requires an authenticated staff identity and uses the RLS client', () => {
    const route = readFileSync(resolve(process.cwd(), 'app/api/search/route.ts'), 'utf8');
    expect(route).toContain('requireAuth()');
    expect(route).toContain('!me.is_staff && !me.is_company_admin && !me.is_platform_operator');
    expect(route).toContain("from '@/lib/supabase/server'");
    expect(route).not.toContain('createServiceClient');
  });
});
