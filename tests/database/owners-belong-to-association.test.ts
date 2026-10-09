import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// A homeowner record (owners row) belongs to exactly one association.
// Migration 20261009010000_owners_belong_to_association.sql enforces it in the
// database; these checks keep every app writer and lookup in step.

const root = process.cwd();
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(resolve(root, dir))) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const rel = join(dir, name);
    const st = statSync(resolve(root, rel));
    if (st.isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.(ts|tsx|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
}

/** The text of a call's argument list starting at `open` (an index of "("). */
function callArgs(src: string, open: number): string {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') {
      depth--;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  return src.slice(open + 1);
}

/** Every `.from('owners')…insert(…)` / `upsert('owners', …)` payload in a file. */
function ownerWrites(src: string): string[] {
  const payloads: string[] = [];
  const fromRe = /\.from\(\s*['"`]owners['"`]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = fromRe.exec(src))) {
    const rest = src.slice(m.index + m[0].length);
    const chain = rest.match(/^\s*\.(insert|upsert)\(/);
    if (!chain) continue;
    payloads.push(callArgs(src, m.index + m[0].length + chain[0].length - 1));
  }
  const upsertRe = /upsert\(\s*['"`]owners['"`]\s*,/g;
  while ((m = upsertRe.exec(src))) payloads.push(callArgs(src, m.index + 'upsert'.length));
  return payloads;
}

describe('owners belong to exactly one association', () => {
  const migration = read('supabase/migrations/20261009010000_owners_belong_to_association.sql');

  it('adds a required association_id and backfills it before requiring it', () => {
    expect(migration).toContain('add column if not exists association_id uuid references public.associations(id) on delete restrict');
    expect(migration).toContain('create index if not exists idx_owners_association_id on public.owners(association_id)');
    const backfill = migration.indexOf('update public.owners ow');
    const guard = migration.indexOf('raise exception');
    const notNull = migration.indexOf('alter table public.owners alter column association_id set not null');
    expect(backfill).toBeGreaterThan(0);
    expect(guard).toBeGreaterThan(backfill);
    expect(notNull).toBeGreaterThan(guard);
    expect(migration).toContain('having count(distinct o.association_id) = 1');
  });

  it('derives portfolio_id from the association and guards occupancies, with locked-down trigger functions', () => {
    expect(migration).toMatch(/before insert or update of association_id, portfolio_id on public\.owners/);
    expect(migration).toContain('new.portfolio_id := v_portfolio_id;');
    expect(migration).toMatch(/before insert or update of owner_id, association_id, unit_id on public\.occupancies/);
    expect(migration).toContain("'This homeowner belongs to another association. Add them as a new homeowner of this association.'");
    expect(migration).toContain("errcode = '23514'");
    for (const fn of ['owners_set_portfolio_from_association', 'occupancies_owner_same_association', 'unit_owners_same_association', 'associations_move_owner_portfolio']) {
      expect(migration).toContain(`revoke all on function public.${fn}() from public, anon, authenticated;`);
      const body = migration.slice(migration.indexOf(`function public.${fn}()`));
      expect(body.slice(0, 400)).toContain('language plpgsql');
      expect(body.slice(0, 400)).toContain('security definer');
      expect(body.slice(0, 400)).toContain("set search_path to 'pg_catalog', 'public'");
    }
  });

  it('keeps one sign-in per homeowner record and links the oldest match', () => {
    expect(migration).not.toMatch(/drop index/i);
    expect(migration).toContain('create or replace function public.auto_link_portal_user()');
    expect(migration).toContain('create or replace function public.relink_all_portal_users()');
    expect(migration).toMatch(/order by candidate\.created_at, candidate\.id\s+limit 1/);
    expect(migration).not.toMatch(/^\s*drop\s/im);
  });

  it('never deletes homeowners with a plain association delete', () => {
    expect(migration).toContain('references public.associations(id) on delete restrict');
  });

  it('records the new column and foreign key in the schema snapshots', () => {
    const columns = JSON.parse(read('supabase/schema-columns.json'));
    expect(columns.owners).toContain('association_id');
    expect([...columns.owners].sort()).toEqual(columns.owners);
    const fks = JSON.parse(read('supabase/schema-foreign-keys.json'));
    expect(fks['owners.association_id']).toBe('associations');
  });

  it('sets association_id on every owners insert or upsert', () => {
    const files = ['app', 'lib', 'components', 'scripts'].flatMap(sourceFiles);
    const writers: string[] = [];
    for (const file of files) {
      const src = read(file);
      for (const payload of ownerWrites(src)) {
        writers.push(file);
        // A payload built elsewhere (e.g. `o.record`) must still be given one in that file.
        const scope = /association_id/.test(payload) ? payload : src;
        expect(scope, `${file}: owners insert without association_id`).toMatch(/association_id\s*:/);
      }
    }
    expect(new Set(writers)).toEqual(new Set([
      'app/(app)/owners/new/actions.ts',
      'app/(app)/owners/import/actions.ts',
      'app/(app)/owners/import/previous-system/homeowner-actions.ts',
      'app/(app)/owners/change/actions.ts',
      'lib/rpcs/entities.ts',
      'scripts/seed-real.ts',
      'scripts/seed-comprehensive.ts',
      'scripts/seed-staging-verification.mjs',
    ]));
  });

  it('matches and reuses owners only within the association', () => {
    const csv = read('app/(app)/owners/import/actions.ts');
    const importOwners = csv.slice(csv.indexOf('export async function importOwners'), csv.indexOf('export async function importOpeningBalances'));
    expect(importOwners).toContain(".eq('association_id', associationId)");
    expect(importOwners).not.toContain(".eq('portfolio_id', me.portfolio?.id)");

    const previous = read('app/(app)/owners/import/previous-system/homeowner-actions.ts');
    expect(previous).toMatch(/from\('owners'\)\s*\.select\('id, full_name, email, emails, phone, phone_numbers'\)\s*\.eq\('association_id', associationId\)/);
    expect(previous).toContain('association_id: associationId,');

    const change = read('app/(app)/owners/change/actions.ts');
    expect(change).toContain('owner.association_id !== associationId');
    const changePage = read('app/(app)/owners/change/page.tsx');
    expect(changePage).toContain(".eq('association_id', selectedAssociationId)");

    const entities = read('lib/rpcs/entities.ts');
    const link = entities.slice(entities.indexOf('export async function linkOccupancy'), entities.indexOf('export async function endOccupancy'));
    expect(link).toContain('ownerRow.association_id !== associationId');
    expect(link.indexOf('ownerRow.association_id !== associationId')).toBeLessThan(link.indexOf(".from('occupancies').insert"));

    const ownerPage = read('app/(app)/owners/[id]/page.tsx');
    expect(ownerPage).toContain(".eq('buildings.association_id', owner.association_id)");
  });

  it('does not assume one owners row per sign-in when sending a password reset', () => {
    const forgot = read('app/(auth)/forgot-password/page.tsx');
    expect(forgot).not.toMatch(/from\('owners'\)[^\n]*\.eq\('auth_user_id', userId\)\.maybeSingle\(\)/);
    expect(forgot).toMatch(/from\('owners'\)[^\n]*\.eq\('auth_user_id', userId\)[^\n]*\.limit\(1\)\.maybeSingle\(\)/);
  });
});
