import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireStaff: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  scheduleOwnerDues: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient, createServiceClient: vi.fn() }));
vi.mock('@/lib/auth/me', () => ({
  requireStaff: mocks.requireStaff,
  requirePortfolioAdmin: vi.fn(),
  requireFinanceOrPortfolioAdmin: vi.fn(),
}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/billing/dues-subscription', () => ({ scheduleOwnerDues: mocks.scheduleOwnerDues }));
vi.mock('@/lib/auth/owner-invitation', () => ({ queueOwnerPortalInvitation: vi.fn() }));

import { changeHomeowner } from '@/app/(app)/owners/change/actions';
import { endOccupancy } from '@/lib/rpcs/entities';
import { ownershipWindowFilter, ownershipWindows, withinOwnershipWindow } from '@/lib/owners/ownership-window';
import { todayForAssociationZone } from '@/lib/time/association-today';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
const MIGRATION = 'supabase/migrations/20261016010000_ownership_fixes.sql';

const UNIT = '11111111-1111-4111-8111-111111111111';
const ASSOC = '22222222-2222-4222-8222-222222222222';
const PF = '33333333-3333-4333-8333-333333333333';
const OWNER = '44444444-4444-4444-8444-444444444444';
const OCC = '55555555-5555-4555-8555-555555555555';

/** A chainable query builder; maybeSingle/single return `row`. */
function builder(row: unknown, extra: Record<string, unknown> = {}) {
  const q: any = {};
  for (const m of ['select', 'eq', 'neq', 'is', 'order', 'limit', 'insert', 'update']) q[m] = vi.fn(() => q);
  q.maybeSingle = vi.fn(async () => ({ data: row, error: null }));
  q.single = vi.fn(async () => ({ data: row, error: null }));
  Object.assign(q, extra);
  return q;
}

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

// 08:00 UTC on 15 Oct 2026: already the 15th in Chicago, still the 14th in Honolulu.
const NOW = new Date('2026-10-15T08:00:00Z');

describe('changeHomeowner: transfer date in the association calendar', () => {
  let tables: Record<string, any>;
  let rpc: ReturnType<typeof vi.fn>;

  function setup(timezone: string | null) {
    tables = {
      units: builder({ id: UNIT, unit_number: '303', buildings: { association_id: ASSOC, associations: { id: ASSOC, portfolio_id: PF, timezone } } }),
      owners: builder({ id: OWNER, association_id: ASSOC, portfolio_id: PF }),
      occupancies: builder(null),
    };
    rpc = vi.fn(async (name: string) => (name === 'can_manage_association' ? { data: true, error: null } : { data: 1, error: null }));
    mocks.createClient.mockResolvedValue({ from: (t: string) => tables[t], rpc });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mocks.requireStaff.mockResolvedValue({ portfolio: { id: PF }, is_platform_operator: false, auth_user_id: 'u1' });
    mocks.redirect.mockImplementation((path: string) => { throw new Error(`REDIRECT:${path}`); });
  });
  afterEach(() => { vi.useRealTimers(); });

  it('refuses a future transfer date before creating the buyer or moving anyone', async () => {
    setup('Pacific/Honolulu');
    await expect(changeHomeowner(form({ unit_id: UNIT, transfer_date: '2026-10-15', first_name: 'Ann', last_name: 'Lee', email: 'ann@example.test' })))
      .rejects.toThrow(/REDIRECT:\/owners\/change\?unit=.*error=The%20transfer%20date%20can't%20be%20in%20the%20future/);
    expect(tables.owners.insert).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalledWith('change_unit_homeowner', expect.anything());
  });

  it('accepts the same date where the association has already reached it', async () => {
    setup('America/Chicago');
    await expect(changeHomeowner(form({ unit_id: UNIT, transfer_date: '2026-10-15', existing_owner_id: OWNER })))
      .rejects.toThrow(`REDIRECT:/owners/${OWNER}`);
    expect(rpc).toHaveBeenCalledWith('change_unit_homeowner', { p_unit_id: UNIT, p_new_owner_id: OWNER, p_transfer_date: '2026-10-15' });
  });

  it('defaults a blank date to today in the association time zone, not the display zone', async () => {
    setup('Pacific/Honolulu');
    await expect(changeHomeowner(form({ unit_id: UNIT, existing_owner_id: OWNER }))).rejects.toThrow(`REDIRECT:/owners/${OWNER}`);
    expect(rpc).toHaveBeenCalledWith('change_unit_homeowner', { p_unit_id: UNIT, p_new_owner_id: OWNER, p_transfer_date: '2026-10-14' });
  });

  it('refuses a date that is not a real calendar day', async () => {
    setup('America/Chicago');
    await expect(changeHomeowner(form({ unit_id: UNIT, transfer_date: '2026-02-30', existing_owner_id: OWNER })))
      .rejects.toThrow(/error=Enter%20a%20valid%20transfer%20date/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('checks the caller manages the association before the date', async () => {
    setup('America/Chicago');
    rpc.mockImplementation(async () => ({ data: false, error: null }));
    await expect(changeHomeowner(form({ unit_id: UNIT, transfer_date: '2999-01-01', existing_owner_id: OWNER })))
      .rejects.toThrow(/error=You%20do%20not%20manage/);
  });

  it('the form offers no date after the association today', () => {
    const page = read('app/(app)/owners/change/page.tsx');
    expect(page).toContain('associations!inner(name, archived_at, timezone)');
    expect(page).toContain('const associationToday = todayForAssociationZone(selectedUnit?.buildings?.associations?.timezone);');
    expect(page).toContain('max={associationToday} defaultValue={associationToday}');
    expect(page).not.toContain('todayInZone(');
  });
});

describe('endOccupancy: move-out day in the association calendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mocks.requireStaff.mockResolvedValue({});
    mocks.redirect.mockImplementation((path: string) => { throw new Error(`REDIRECT:${path}`); });
  });
  afterEach(() => { vi.useRealTimers(); });

  it("ends the occupancy on the association's today", async () => {
    const read1 = builder({ id: OCC, associations: { timezone: 'Pacific/Honolulu' } });
    const write = builder(null);
    write.select = vi.fn(async () => ({ data: [{ id: OCC }], error: null }));
    const occ = [read1, write];
    mocks.createClient.mockResolvedValue({ from: () => occ.shift() });
    await endOccupancy(OCC, OWNER);
    expect(read1.select).toHaveBeenCalledWith('id, associations(timezone)');
    expect(write.update).toHaveBeenCalledWith({ status: 'past', move_out_date: '2026-10-14' });
    expect(write.eq).toHaveBeenCalledWith('owner_id', OWNER);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/owners/${OWNER}`);
  });

  it('fails loudly when the occupancy is not found', async () => {
    mocks.createClient.mockResolvedValue({ from: () => builder(null) });
    await expect(endOccupancy(OCC, OWNER)).rejects.toThrow(`REDIRECT:/owners/${OWNER}?error=`);
  });
});

describe('ownership window helpers', () => {
  it('builds one window per unit from move-in to move-out', () => {
    const w = ownershipWindows([
      { units: { id: UNIT }, move_in_date: '2026-03-01', move_out_date: null },
      { units: { id: OCC }, move_in_date: '2025-01-01', move_out_date: '2026-06-01' },
    ]);
    expect(w.get(UNIT)).toEqual([{ since: '2026-03-01', until: null }]);
    expect(ownershipWindowFilter(w, 'due_date')).toBe(
      `and(unit_id.eq.${UNIT},due_date.gte.2026-03-01),and(unit_id.eq.${OCC},due_date.gte.2025-01-01,due_date.lt.2026-06-01)`,
    );
    expect(withinOwnershipWindow(w, UNIT, '2026-02-28')).toBe(false);
    expect(withinOwnershipWindow(w, UNIT, '2026-03-01')).toBe(true);
    expect(withinOwnershipWindow(w, OCC, '2026-06-01')).toBe(false);
    expect(withinOwnershipWindow(w, 'other', '2026-03-01')).toBe(false);
  });

  it('keeps the gap when an owner sold the unit and bought it back', () => {
    const w = ownershipWindows([
      { unit_id: UNIT, move_in_date: '2025-01-01', move_out_date: '2025-06-01' },
      { unit_id: UNIT, move_in_date: '2026-02-01', move_out_date: null },
      // Touching periods merge into one.
      { unit_id: OCC, move_in_date: '2024-01-01', move_out_date: '2024-05-01' },
      { unit_id: OCC, move_in_date: '2024-05-01', move_out_date: '2024-09-01' },
    ]);
    expect(w.get(UNIT)).toEqual([{ since: '2025-01-01', until: '2025-06-01' }, { since: '2026-02-01', until: null }]);
    expect(w.get(OCC)).toEqual([{ since: '2024-01-01', until: '2024-09-01' }]);
    expect(ownershipWindowFilter(new Map([[UNIT, w.get(UNIT)!]]), 'payment_date')).toBe(
      `and(unit_id.eq.${UNIT},payment_date.gte.2025-01-01,payment_date.lt.2025-06-01),and(unit_id.eq.${UNIT},payment_date.gte.2026-02-01)`,
    );
    expect(withinOwnershipWindow(w, UNIT, '2025-10-01')).toBe(false); // the other owner's time
    expect(withinOwnershipWindow(w, UNIT, '2025-03-01')).toBe(true);
    expect(withinOwnershipWindow(w, UNIT, '2026-03-01')).toBe(true);
  });

  it('no move-in date means no lower bound; no units means no filter', () => {
    const w = ownershipWindows([{ unit_id: UNIT, move_in_date: null }, { unit_id: UNIT, move_in_date: '2026-01-01' }]);
    expect(ownershipWindowFilter(w, 'payment_date')).toBe(`unit_id.eq.${UNIT}`);
    expect(ownershipWindowFilter(new Map(), 'payment_date')).toBeNull();
  });

  it('todayForAssociationZone falls back to the default zone', () => {
    expect(todayForAssociationZone('Pacific/Honolulu', NOW)).toBe('2026-10-14');
    expect(todayForAssociationZone('Not/AZone', NOW)).toBe('2026-10-15');
    expect(todayForAssociationZone(null, NOW)).toBe('2026-10-15');
  });

  it('the homeowner page bounds YTD figures and payment history to this owner', () => {
    const page = read('app/(app)/owners/[id]/page.tsx');
    expect(page).toContain('const windows = ownershipWindows(currentOccs);');
    expect(page).toContain(".or(chargeWindow)");
    expect(page).toContain(".or(paymentWindow)");
    // History and last payment: this owner's window per unit, not the ledger's
    // single owner_id (which would hide a co-owner's payments).
    expect(page).toContain(".select('*')\n        .or(historyWindow)");
    expect(page).toContain(".or(historyWindow).is('reversed_at', null)");
    expect(page).not.toContain(".eq('owner_id', id).is('reversed_at', null)");
    expect(page).toContain('withinOwnershipWindow(windows, r.unit_id, r.reversal_charge?.due_date)');
  });
});

describe('migration 20261016010000_ownership_fixes', () => {
  const sql = read(MIGRATION);
  const fn = (name: string) => {
    const start = sql.indexOf(`create or replace function ${name}(`);
    expect(start, name).toBeGreaterThan(-1);
    return sql.slice(start, sql.indexOf('$function$;', start));
  };

  it('is additive: no DROP, DELETE or TRUNCATE', () => {
    const code = sql.replace(/--.*$/gm, '');
    expect(code).not.toMatch(/\bdrop\b/i);
    expect(code).not.toMatch(/\bdelete\b/i);
    expect(code).not.toMatch(/\btruncate\b/i);
  });

  it('refuses a future transfer date in both sale functions', () => {
    for (const name of ['public.transfer_unit_ownership', 'public.change_unit_homeowner']) {
      const body = fn(name);
      expect(body).toContain('if p_transfer_date > public.association_local_date(v_association_id) then');
      expect(body).toContain("The transfer date can''t be in the future. Record the sale on or after its closing date.");
      expect(body).toContain('can_manage_association(v_association_id)');
    }
    // checked before the buyer's occupancy is created
    const change = fn('public.change_unit_homeowner');
    expect(change.indexOf('association_local_date')).toBeLessThan(change.indexOf('insert into public.occupancies'));
  });

  it('ends the outgoing owner parking, its charge and pets when an occupancy ends', () => {
    const body = fn('public.end_owner_unit_items_when_occupancy_ends');
    expect(body).toContain("old.status = 'current' and new.status = 'past'");
    expect(body).toContain("set status = 'ended'");
    expect(body).toContain('returning pa.recurring_charge_id');
    expect(body).toContain('where urc.id = any (v_charge_ids)');
    expect(body).toContain('set active = false');
    expect(body).toContain('update public.unit_pets p\n     set archived_at = now()');
    expect(body).toContain('coalesce(new.move_out_date, public.association_local_date(new.association_id))');
    expect(sql).toContain('revoke all on function public.end_owner_unit_items_when_occupancy_ends() from public, anon, authenticated;');
    expect(sql).toContain('create or replace trigger trg_occupancies_end_owner_unit_items\n  after update of status on public.occupancies');
  });

  it('picks statement owners by an ownership that overlaps the period', () => {
    const owner = fn('public.generate_owner_statements');
    expect(owner).toContain('(occ.move_in_date is null or occ.move_in_date <= p_period_end)');
    expect(owner).toContain('occ.move_out_date > p_period_start');
    expect(owner).not.toMatch(/occ\.status = 'current'\n\s+and occ\.occupancy_type/);
    const monthly = fn('public.generate_monthly_statements');
    expect(monthly).toContain('(o.move_in_date is null or o.move_in_date < period_end)');
    expect(monthly).toContain('order by o.is_primary desc');
    expect(monthly).not.toContain("occ.status = 'current' and occ.is_primary");
  });

  it('uses the association calendar, never current_date, in replaced functions', () => {
    for (const name of ['public.end_occupancies_past_move_out', 'public.sync_unit_owners_from_occupancy']) {
      const body = fn(name);
      expect(body).toContain('association_local_date');
      expect(body).not.toContain('current_date');
    }
  });

  it('residents read their own period of charges and only their own statements', () => {
    const ids = fn('rls_private.resident_visible_charge_ids');
    expect(ids).toContain('language plpgsql');
    expect(ids).toContain('security definer');
    expect(ids).toContain('join rls_private.resident_unit_tenure() t on t.unit_id = c.unit_id');
    expect(ids).toContain('c.due_date >= t.since');
    expect(ids).toContain('c.amount > coalesce((select sum(pa.amount_applied)');
    expect(sql).toContain('revoke all on function rls_private.resident_visible_charge_ids() from public, anon;');
    expect(sql).toContain('alter policy charges_resident_read on public.charges\n  using (( select public.is_portal_resident() )\n         and (id in ( select rls_private.resident_visible_charge_ids() )));');
    const stmts = fn('rls_private.resident_visible_statement_ids');
    expect(stmts).toContain('language plpgsql');
    expect(stmts).toContain('where s.owner_id in (select public.current_owner_ids())');
    expect(stmts).toContain(">= date_trunc('month', t.since)::date");
    expect(sql).toContain('revoke all on function rls_private.resident_visible_statement_ids() from public, anon;');
    expect(sql).toContain('alter policy statements_resident_read on public.statements\n  using (( select public.is_portal_resident() )\n         and (id in ( select rls_private.resident_visible_statement_ids() )));');
  });

  it("states an owner who left during the period as of their last day", () => {
    const owner = fn('public.generate_owner_statements');
    expect(owner).toContain("case when occ.move_out_date is not null and occ.move_out_date <= p_period_end\n                then occ.move_out_date - 1 else p_period_end end as cutoff");
    expect(owner).toContain('c.due_date <= v_owner.cutoff');
    expect(owner).toContain('p.payment_date <= v_owner.cutoff');
  });
});

describe('20261016020000_statement_visibility_co_owners migration', () => {
  it('a buyer never sees the seller’s sale-month statement; co-owners still share', () => {
    const m = read('supabase/migrations/20261016020000_statement_visibility_co_owners.sql');
    expect(m).toContain('and o.owner_id = s.owner_id');
    expect(m).toContain("and o.status = 'current'");
    expect(m).toContain('where s.owner_id in (select public.current_owner_ids())');
  });
});
