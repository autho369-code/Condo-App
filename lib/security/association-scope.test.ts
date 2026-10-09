import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkLinkedRecords, managesAssociation } from './association-scope';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

/** Minimal PostgREST stand-in: `visible` maps table -> rows the caller can see. */
function fakeDb(visible: Record<string, Array<Record<string, unknown>>>, rpcResult: unknown = true) {
  return {
    rpc: async () => ({ data: rpcResult, error: null }),
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      const q: any = {
        select: () => q,
        eq: (col: string, val: unknown) => { filters.push([col, val]); return q; },
        maybeSingle: async () => {
          const row = (visible[table] ?? []).find((r) => filters.every(([c, v]) => r[c] === v));
          return { data: row ?? null, error: null };
        },
      };
      return q;
    },
  };
}

describe('managesAssociation', () => {
  it('rejects missing or malformed ids without asking the database', async () => {
    expect(await managesAssociation(fakeDb({}), null)).toBe(false);
    expect(await managesAssociation(fakeDb({}), 'not-a-uuid')).toBe(false);
  });

  it('follows can_manage_association', async () => {
    expect(await managesAssociation(fakeDb({}, true), A)).toBe(true);
    expect(await managesAssociation(fakeDb({}, false), A)).toBe(false);
    expect(await managesAssociation(fakeDb({}, null), A)).toBe(false);
  });
});

describe('checkLinkedRecords', () => {
  it('accepts records visible to the caller and inside the association', async () => {
    const db = fakeDb({ buildings: [{ id: B, association_id: A }], vendors: [{ id: B, portfolio_id: 'co' }], associations: [{ id: A, portfolio_id: 'co' }] });
    expect(await checkLinkedRecords(db, { associationId: A, buildingId: B, vendorId: B })).toBeNull();
  });

  it("rejects a vendor from another company even when the caller can see it (platform operators)", async () => {
    const db = fakeDb({ vendors: [{ id: B, portfolio_id: 'other-co' }], associations: [{ id: A, portfolio_id: 'co' }] });
    expect(await checkLinkedRecords(db, { associationId: A, vendorId: B })).toMatch(/company/);
  });

  it('rejects a building from another association', async () => {
    const db = fakeDb({ buildings: [{ id: B, association_id: 'other' }] });
    expect(await checkLinkedRecords(db, { associationId: A, buildingId: B })).toMatch(/not in this association/);
  });

  it('rejects vendors and owners the caller cannot see', async () => {
    expect(await checkLinkedRecords(fakeDb({}), { associationId: null, vendorId: B })).toMatch(/vendor/);
    expect(await checkLinkedRecords(fakeDb({}), { associationId: null, ownerId: B })).toMatch(/owner/);
  });

  it("rejects the same person's owner record from another association", async () => {
    const db = fakeDb({ owners: [{ id: B, association_id: 'other' }] });
    expect(await checkLinkedRecords(db, { associationId: A, ownerId: B })).toMatch(/not in this association/);
    expect(await checkLinkedRecords(fakeDb({ owners: [{ id: B, association_id: A }] }), { associationId: A, ownerId: B })).toBeNull();
  });

  it('requires an association for units and buildings, and valid ids', async () => {
    expect(await checkLinkedRecords(fakeDb({}), { associationId: null, unitId: B })).toMatch(/association/);
    expect(await checkLinkedRecords(fakeDb({}), { associationId: A, vendorId: 'x' })).toMatch(/not valid/);
  });
});

describe('association-in-company migration', () => {
  const sql = readFileSync(
    path.join(__dirname, '../../supabase/migrations/20261005040001_manager_comms_association_in_company.sql'),
    'utf8',
  );

  it('adds restrictive insert/update checks on the portfolio-only tables', () => {
    for (const table of ['communications_log', 'calendar_events', 'tenants', 'sms_conversations']) {
      expect(sql).toContain(`'${table}'`);
    }
    expect(sql).toMatch(/as restrictive for insert/);
    expect(sql).toMatch(/as restrictive for update/);
    expect(sql).toContain('public.can_access_association(association_id)');
  });

  it('is additive only', () => {
    expect(sql).not.toMatch(/\bdrop\b|\bdelete\b|\btruncate\b/i);
  });
});
