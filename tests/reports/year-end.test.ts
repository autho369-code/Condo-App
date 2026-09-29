import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const m = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260929160000_year_end_packages.sql'), 'utf8').toLowerCase();
const fn = (name: string) => m.slice(m.indexOf(`create or replace function public.${name}`), m.indexOf('\n$$;', m.indexOf(`create or replace function public.${name}`)));

describe('year-end close package', () => {
  it('fingerprints the snapshot and makes finalized packages immutable', () => {
    expect(fn('generate_year_end_package')).toContain("encode(sha256(convert_to(v_snapshot::text, 'utf8')), 'hex')");
    expect(fn('guard_year_end_package')).toContain('a finalized year-end package cannot be changed');
    expect(m).toContain('finalized year-end packages cannot be deleted');
    expect(m).toContain('revoke all on public.year_end_packages from anon, authenticated');
  });

  it('refuses to finalize unless required checks pass and the books are unchanged', () => {
    const f = fn('finalize_year_end_package');
    expect(f).toContain("(v_readiness ->> 'ready')::boolean");
    expect(f).toContain('the books changed after this draft was prepared');
  });

  it('builds a deterministic snapshot (stable ordering for re-hashing)', () => {
    const b = fn('build_year_end_snapshot');
    expect(b).toContain('order by number, name, gl_id');
    expect(b).toContain('order by bal desc, unit_number, unit_id');
    expect(b).toContain('order by ba.name, ba.id');
  });

  it('limits supersede to portfolio admins with a reason, and board reads to finalized packages', () => {
    expect(fn('supersede_year_end_package')).toContain('public.can_admin_portfolio(pkg.portfolio_id)');
    expect(m).toMatch(/year_end_packages_board_read[\s\S]*status = 'finalized'/);
  });
});
