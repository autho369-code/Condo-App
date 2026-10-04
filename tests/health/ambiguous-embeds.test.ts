import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// gl_accounts <-> associations and bank_accounts <-> associations each have two
// foreign-key paths (e.g. associations.interest_income_gl_account_id), so an
// unhinted `associations(...)` embed fails in production with PGRST201 and the
// whole page section comes back empty. CI cannot reach the live API
// (`npm run check:queries` does that), so guard the known pairs statically.
const HINTED: Record<string, string> = {
  gl_accounts: 'associations!gl_accounts_association_id_fkey(',
  bank_accounts: 'associations!bank_accounts_association_id_fkey(',
};

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

describe('ambiguous PostgREST embeds', () => {
  const sources = ['app', 'lib', 'components'].flatMap((d) => files(d));

  for (const [table, hinted] of Object.entries(HINTED)) {
    it(`every ${table} -> associations embed names its foreign key`, () => {
      const offenders: string[] = [];
      for (const file of sources) {
        const src = readFileSync(file, 'utf8');
        const re = new RegExp(`from\\('${table}'\\)[\\s\\S]{0,80}?\\.select\\(\\s*(['"\`])([\\s\\S]*?)\\1`, 'g');
        for (const m of src.matchAll(re)) {
          const select = m[2];
          if (/(^|[\s,(])associations\s*\(/.test(select) && !select.includes(hinted)) {
            offenders.push(`${file}:${src.slice(0, m.index).split('\n').length}`);
          }
        }
      }
      expect(offenders).toEqual([]);
    });
  }
});
