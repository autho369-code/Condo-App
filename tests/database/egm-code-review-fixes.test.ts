import { beforeEach, describe, expect, it, vi } from 'vitest';

// 2026-10-31 code review fixes, tested by running the real server actions
// against an in-memory client:
//   - a company admin cannot disable or reset the MFA of a manager profile
//     that belongs to an active platform operator;
//   - the CSV owner import finds an existing unit in any building of the
//     association, matching unit numbers the way the previous-system import
//     does, under the shared import lock, with one primary owner per unit.

vi.mock('server-only', () => ({}));
const redirects: string[] = [];
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { redirects.push(url); throw new Error(`REDIRECT ${url}`); },
}));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

const mocks = vi.hoisted(() => ({
  service: null as any,
  session: null as any,
  resetUserMfa: vi.fn(async () => ({ error: null })),
  scheduleOwnerDues: vi.fn(async () => null),
}));
vi.mock('@/lib/auth/me', () => ({
  requirePortfolioAdmin: vi.fn(async () => ({ auth_user_id: 'admin-1', email: 'admin@example.test', portfolio: { id: 'p1' } })),
  requireStaff: vi.fn(async () => ({ auth_user_id: 'staff-1', is_staff: true, portfolio: { id: 'p1' } })),
}));
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => mocks.service,
  createClient: async () => mocks.session,
}));
vi.mock('@/lib/auth/mfa-admin', () => ({ resetUserMfa: mocks.resetUserMfa }));
vi.mock('@/lib/email/queue', () => ({ queueEmails: vi.fn() }));
vi.mock('@/lib/billing/dues-subscription', () => ({ scheduleOwnerDues: mocks.scheduleOwnerDues }));

type Row = Record<string, any>;

/** Minimal chainable stand-in for a Supabase client over in-memory tables. */
function fakeDb(tables: Record<string, Row[]>, rpc: (name: string, args: any) => any = () => ({ data: null, error: null })) {
  let nextId = 1;
  function builder(table: string) {
    const state: { op: string; payload?: any; filters: Array<(r: Row) => boolean> } = { op: 'select', filters: [] };
    const rows = () => (tables[table] ?? []).filter((r) => state.filters.every((f) => f(r)));
    const run = () => {
      if (state.op === 'insert') {
        const list = (Array.isArray(state.payload) ? state.payload : [state.payload]).map((p: Row) => ({ id: `${table}-${nextId++}`, ...p }));
        (tables[table] ??= []).push(...list);
        return { data: list, error: null };
      }
      if (state.op === 'update') {
        const hit = rows();
        hit.forEach((r) => Object.assign(r, state.payload));
        return { data: hit, error: null };
      }
      if (state.op === 'delete') {
        const hit = rows();
        tables[table] = (tables[table] ?? []).filter((r) => !hit.includes(r));
        return { data: hit, error: null };
      }
      return { data: rows(), error: null };
    };
    const col = (r: Row, c: string) => c.split('.').reduce((v: any, k) => v?.[k], r);
    const b: any = {
      select() { return b; },
      insert(p: any) { state.op = 'insert'; state.payload = p; return b; },
      update(p: any) { state.op = 'update'; state.payload = p; return b; },
      delete() { state.op = 'delete'; return b; },
      eq(c: string, v: any) { state.filters.push((r) => col(r, c) === v); return b; },
      ilike(c: string, v: any) { state.filters.push((r) => String(col(r, c) ?? '').toLowerCase() === String(v).toLowerCase()); return b; },
      is(c: string, v: any) { state.filters.push((r) => (col(r, c) ?? null) === v); return b; },
      order() { return b; },
      limit() { return b; },
      range() { return b; },
      async maybeSingle() { const r = run(); return { data: r.data?.[0] ?? null, error: null }; },
      async single() { const r = run(); return { data: r.data?.[0] ?? null, error: r.data?.[0] ? null : { message: 'no row' } }; },
      then(resolve: any, reject: any) { try { resolve(run()); } catch (e) { reject(e); } },
    };
    return b;
  }
  return { from: (t: string) => builder(t), rpc: async (name: string, args: any) => rpc(name, args) };
}

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

beforeEach(() => {
  redirects.length = 0;
  vi.clearAllMocks();
});

describe('company admin manager actions refuse platform operator accounts', () => {
  const MANAGER = 'manager-op-1';
  function service(operatorActive: boolean) {
    const db: any = fakeDb({
      profiles: [{ id: MANAGER, email: 'op@example.test', disabled_at: null, portfolio_id: 'p1', hoa_role: 'manager' }],
      platform_operators: [{ id: 'po-1', auth_user_id: MANAGER, active: operatorActive }],
      audit_logs: [],
    });
    db.auth = { admin: { updateUserById: vi.fn(async () => ({ error: null })) } };
    return db;
  }

  it('does not disable an active platform operator', async () => {
    mocks.service = service(true);
    const { setManagerLoginStatus } = await import('@/app/company-admin/managers/actions');
    await expect(setManagerLoginStatus(form({ manager_id: MANAGER, action: 'disable' }))).rejects.toThrow('REDIRECT');
    expect(redirects[0]).toMatch(/\?error=.*platform%20operator/);
    expect(mocks.service.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it('does not reset the MFA of an active platform operator', async () => {
    mocks.service = service(true);
    const { resetManagerMfa } = await import('@/app/company-admin/managers/actions');
    await expect(resetManagerMfa(form({ manager_id: MANAGER }))).rejects.toThrow('REDIRECT');
    expect(redirects[0]).toMatch(/\?error=.*platform%20operator/);
    expect(mocks.resetUserMfa).not.toHaveBeenCalled();
  });

  it('still manages a manager whose operator access was ended', async () => {
    mocks.service = service(false);
    const { setManagerLoginStatus } = await import('@/app/company-admin/managers/actions');
    await expect(setManagerLoginStatus(form({ manager_id: MANAGER, action: 'disable' }))).rejects.toThrow('REDIRECT');
    expect(redirects[0]).toContain('?disabled=1');
    expect(mocks.service.auth.admin.updateUserById).toHaveBeenCalledOnce();
  });
});

describe('CSV owner import', () => {
  const ASSOC = 'assoc-1';
  function tables(): Record<string, Row[]> {
    return {
      associations: [{ id: ASSOC, portfolio_id: 'p1', archived_at: null }],
      buildings: [
        { id: 'b-main', association_id: ASSOC, archived_at: null, created_at: '2026-01-01' },
        { id: 'b-east', association_id: ASSOC, archived_at: null, created_at: '2026-02-01' },
      ],
      // Unit "3817-1" lives in the association's SECOND building.
      units: [{ id: 'u-east', unit_number: '3817-1', ownership_pct: 0, archived_at: null, buildings: { association_id: ASSOC } }],
      occupancies: [],
      owners: [],
    };
  }

  it('links owners to an existing unit in any building, matched like the previous-system import, under the import lock', async () => {
    const t = tables();
    const rpcCalls: Array<{ name: string; args: any }> = [];
    mocks.session = fakeDb(t, (name, args) => {
      rpcCalls.push({ name, args });
      return { data: name === 'claim_import_lock' ? '2026-10-31T00:00:00Z' : null, error: null };
    });
    const { importOwners } = await import('@/app/(app)/owners/import/actions');
    const result = await importOwners(ASSOC, [
      { unit_number: '3817 - 1', owner_first_name: 'Jane', owner_last_name: 'Doe', owner_email: 'jane@example.test', ownership_pct: '1.25', monthly_dues: '350' },
      { unit_number: '3817-1', owner_first_name: 'John', owner_last_name: 'Doe', owner_email: 'john@example.test', ownership_pct: '', monthly_dues: '' },
    ]);

    expect(result.imported).toBe(2);
    // No second unit was created: both owners are on the existing one.
    expect(t.units).toHaveLength(1);
    expect(t.occupancies.map((o) => [o.unit_id, o.is_primary, o.dues_amount, o.share_pct])).toEqual([
      ['u-east', true, 350, 100],
      ['u-east', false, 0, 100],
    ]);
    expect(mocks.scheduleOwnerDues).toHaveBeenCalledOnce();
    // The unit's share of the association was filled in (it was still 0).
    expect(t.units[0].ownership_pct).toBe(1.25);
    expect(rpcCalls.find((c) => c.name === 'claim_import_lock')?.args).toEqual({ p_scope_id: 'p1', p_kind: 'appfolio_homeowners' });
  });

  it('a new owner on a unit that already has a primary owner is not primary and carries no dues', async () => {
    const t = tables();
    t.occupancies = [{ id: 'occ-existing', unit_id: 'u-east', association_id: ASSOC, occupancy_type: 'owner', status: 'current', dues_amount: 300, is_primary: true }];
    mocks.session = fakeDb(t, (name) => ({ data: name === 'claim_import_lock' ? '2026-10-31T00:00:00Z' : null, error: null }));
    const { importOwners } = await import('@/app/(app)/owners/import/actions');
    const result = await importOwners(ASSOC, [
      { unit_number: '3817-1', owner_first_name: 'Ann', owner_last_name: 'Lee', owner_email: 'ann@example.test', monthly_dues: '300' },
    ]);
    expect(result.imported).toBe(1);
    expect(t.occupancies[1]).toMatchObject({ unit_id: 'u-east', is_primary: false, dues_amount: 0 });
    expect(mocks.scheduleOwnerDues).not.toHaveBeenCalled();
  });

  it('does not run while another owner import holds the lock', async () => {
    const t = tables();
    mocks.session = fakeDb(t, () => ({ data: null, error: null }));
    const { importOwners } = await import('@/app/(app)/owners/import/actions');
    const result = await importOwners(ASSOC, [
      { unit_number: '101', owner_first_name: 'Jane', owner_last_name: 'Doe', owner_email: 'jane@example.test' },
    ]);
    expect(result.imported).toBe(0);
    expect(result.errors?.[0]).toMatch(/already running/);
    expect(t.owners).toHaveLength(0);
  });
});
