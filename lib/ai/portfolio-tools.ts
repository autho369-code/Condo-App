/**
 * Live, read-only lookups the Portfolio Assistant may call (tool calling).
 *
 * SAFETY MODEL: the model never writes SQL. It can only call these fixed
 * lookups, with typed arguments, and every query runs on the signed-in
 * manager's own Supabase session (`createClient()`), so RLS limits each result
 * to data that manager can already see in the app. Every lookup is read-only
 * and capped in size.
 */
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { AITool } from '@/lib/ai/service';

// Open = new, assigned, scheduled, in_progress (as elsewhere in the app).
const OPEN_WO = '("done","completed","billed","closed","cancelled")';
const OPEN_VIOLATION = '("closed","cured")';

export const PORTFOLIO_TOOLS: AITool[] = [
  {
    name: 'find_owners',
    description: 'Find homeowners by name or email. Returns contact details, their current units and each unit\'s balance.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Part of the owner\'s name or email.' } },
      required: ['query'],
    },
  },
  {
    name: 'unit_summary',
    description: 'Everything about one unit: current owners, balance due, dues, recent charges and payments, open violations and open work orders.',
    parameters: {
      type: 'object',
      properties: {
        unit_number: { type: 'string', description: 'The unit number, e.g. "301".' },
        association: { type: 'string', description: 'Optional association name, to pick between units with the same number.' },
      },
      required: ['unit_number'],
    },
  },
  {
    name: 'list_delinquent_units',
    description: 'Units that owe money, largest balance first, with the owner name.',
    parameters: {
      type: 'object',
      properties: {
        min_balance: { type: 'number', description: 'Only units owing at least this much. Default 0.01.' },
        association: { type: 'string', description: 'Optional association name.' },
        limit: { type: 'integer', description: 'Max rows (default 25, max 50).' },
      },
    },
  },
  {
    name: 'list_open_work_orders',
    description: 'Open work orders (not completed, closed or cancelled), newest first.',
    parameters: {
      type: 'object',
      properties: {
        association: { type: 'string', description: 'Optional association name.' },
        status: { type: 'string', description: 'Optional exact status, e.g. "new" or "in_progress".' },
        limit: { type: 'integer', description: 'Max rows (default 25, max 50).' },
      },
    },
  },
  {
    name: 'list_open_violations',
    description: 'Open violations (not cured or closed), with unit, owner, status and due date.',
    parameters: {
      type: 'object',
      properties: {
        association: { type: 'string', description: 'Optional association name.' },
        limit: { type: 'integer', description: 'Max rows (default 25, max 50).' },
      },
    },
  },
  {
    name: 'list_bills',
    description: 'Vendor bills waiting for approval or waiting to be paid.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pending_approval', 'approved'], description: '"pending_approval" (needs approval) or "approved" (awaiting payment).' },
        association: { type: 'string', description: 'Optional association name.' },
        limit: { type: 'integer', description: 'Max rows (default 25, max 50).' },
      },
      required: ['status'],
    },
  },
];

/** Strip characters that would change a PostgREST filter, and cap length. */
export function sanitizeSearch(value: unknown): string {
  return String(value ?? '').replace(/[%_,()*\\"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

export function clampLimit(value: unknown, fallback = 25): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(50, Math.max(1, Math.trunc(n)));
}

const round2 = (n: unknown) => Math.round((Number(n ?? 0) + Number.EPSILON) * 100) / 100;

function fail(message: string): never {
  throw new Error(message);
}

export async function runPortfolioTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  const db = (await createClient()) as any;

  async function associationIds(nameFilter: unknown): Promise<string[] | null> {
    const q = sanitizeSearch(nameFilter);
    if (!q) return null;
    const { data, error } = await db.from('associations').select('id').ilike('name', `%${q}%`).is('archived_at', null).limit(20);
    if (error) fail(error.message);
    return (data ?? []).map((a: { id: string }) => a.id);
  }

  async function associationNames(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return new Map();
    const { data, error } = await db.from('associations').select('id, name').in('id', unique);
    if (error) fail(error.message);
    return new Map((data ?? []).map((a: { id: string; name: string }) => [a.id, a.name]));
  }

  async function currentOwnersByUnit(unitIds: string[]): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (!unitIds.length) return map;
    const { data, error } = await db.from('occupancies')
      .select('unit_id, is_primary, owners(full_name)')
      .in('unit_id', unitIds).eq('status', 'current').eq('occupancy_type', 'owner');
    if (error) fail(error.message);
    for (const row of data ?? []) {
      const list = map.get(row.unit_id) ?? [];
      if (row.owners?.full_name) list.push(row.owners.full_name);
      map.set(row.unit_id, list);
    }
    return map;
  }

  switch (name) {
    case 'find_owners': {
      const q = sanitizeSearch(input.query);
      if (q.length < 2) return { error: 'Give at least 2 characters of a name or email.' };
      const { data: owners, error } = await db.from('owners')
        .select('id, full_name, email, phone')
        .is('archived_at', null)
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
        .order('full_name').limit(10);
      if (error) fail(error.message);
      const ownerIds = (owners ?? []).map((o: { id: string }) => o.id);
      const { data: occ, error: occErr } = ownerIds.length
        ? await db.from('occupancies').select('owner_id, unit_id, association_id, units(unit_number)')
            .in('owner_id', ownerIds).eq('status', 'current').eq('occupancy_type', 'owner')
        : { data: [], error: null };
      if (occErr) fail(occErr.message);
      const unitIds = (occ ?? []).map((o: any) => o.unit_id);
      const { data: balances, error: balErr } = unitIds.length
        ? await db.from('unit_balances').select('unit_id, balance').in('unit_id', unitIds)
        : { data: [], error: null };
      if (balErr) fail(balErr.message);
      const balance = new Map((balances ?? []).map((b: any) => [b.unit_id, round2(b.balance)]));
      const names = await associationNames((occ ?? []).map((o: any) => o.association_id));
      return (owners ?? []).map((o: any) => ({
        name: o.full_name,
        email: o.email,
        phone: o.phone,
        units: (occ ?? []).filter((x: any) => x.owner_id === o.id).map((x: any) => ({
          unit: x.units?.unit_number ?? null,
          association: names.get(x.association_id) ?? null,
          balance_due: balance.get(x.unit_id) ?? 0,
        })),
      }));
    }

    case 'unit_summary': {
      const unitNumber = sanitizeSearch(input.unit_number);
      if (!unitNumber) return { error: 'Give a unit number.' };
      const assocIds = await associationIds(input.association);
      let query = db.from('units')
        .select('id, unit_number, buildings!inner(association_id)')
        .is('archived_at', null).ilike('unit_number', unitNumber).limit(10);
      if (assocIds) query = query.in('buildings.association_id', assocIds.length ? assocIds : ['00000000-0000-0000-0000-000000000000']);
      const { data: units, error } = await query;
      if (error) fail(error.message);
      if (!units?.length) return { error: `No unit ${unitNumber} found.` };
      const names = await associationNames(units.map((u: any) => u.buildings?.association_id));
      if (units.length > 1) {
        return {
          ambiguous: true,
          message: 'Several units have that number. Ask which association.',
          matches: units.map((u: any) => ({ unit: u.unit_number, association: names.get(u.buildings?.association_id) ?? null })),
        };
      }
      const unit = units[0];
      const [occ, bal, charges, payments, violations, workOrders] = await Promise.all([
        db.from('occupancies').select('is_primary, dues_amount, dues_frequency, dues_paid_through, move_in_date, owners(full_name, email, phone)')
          .eq('unit_id', unit.id).eq('status', 'current').eq('occupancy_type', 'owner'),
        db.from('unit_balances').select('balance, total_charges, total_payments').eq('unit_id', unit.id).maybeSingle(),
        db.from('charges').select('description, amount, due_date').eq('unit_id', unit.id).order('due_date', { ascending: false }).limit(6),
        db.from('receivable_payments_ledger').select('amount, payment_date, method, reversed_at').eq('unit_id', unit.id).order('payment_date', { ascending: false }).limit(6),
        db.from('violations').select('title, violation_type, status, due_date').eq('unit_id', unit.id).is('archived_at', null).not('status', 'in', OPEN_VIOLATION).limit(10),
        db.from('work_orders').select('number, title, status, priority, scheduled_date').eq('unit_id', unit.id).is('archived_at', null).not('status', 'in', OPEN_WO).limit(10),
      ]);
      for (const r of [occ, bal, charges, payments, violations, workOrders]) if (r.error) fail(r.error.message);
      return {
        unit: unit.unit_number,
        association: names.get(unit.buildings?.association_id) ?? null,
        owners: (occ.data ?? []).map((o: any) => ({
          name: o.owners?.full_name ?? null,
          email: o.owners?.email ?? null,
          phone: o.owners?.phone ?? null,
          primary: !!o.is_primary,
          dues: round2(o.dues_amount),
          dues_frequency: o.dues_frequency,
          dues_paid_through: o.dues_paid_through,
          owner_since: o.move_in_date,
        })),
        balance_due: round2(bal.data?.balance),
        total_charged: round2(bal.data?.total_charges),
        total_paid: round2(bal.data?.total_payments),
        recent_charges: (charges.data ?? []).map((c: any) => ({ description: c.description, amount: round2(c.amount), due: c.due_date })),
        recent_payments: (payments.data ?? []).map((p: any) => ({ amount: round2(p.amount), date: p.payment_date, method: p.method, reversed: !!p.reversed_at })),
        open_violations: violations.data ?? [],
        open_work_orders: workOrders.data ?? [],
      };
    }

    case 'list_delinquent_units': {
      const min = Number.isFinite(Number(input.min_balance)) ? Math.max(0.01, Number(input.min_balance)) : 0.01;
      const assocIds = await associationIds(input.association);
      if (assocIds && !assocIds.length) return { error: 'No association matches that name.' };
      let query = db.from('unit_balances').select('unit_id, unit_number, association_id, balance')
        .gte('balance', min).order('balance', { ascending: false }).limit(clampLimit(input.limit));
      if (assocIds) query = query.in('association_id', assocIds);
      const { data, error } = await query;
      if (error) fail(error.message);
      const rows = data ?? [];
      const [names, owners] = await Promise.all([
        associationNames(rows.map((r: any) => r.association_id)),
        currentOwnersByUnit(rows.map((r: any) => r.unit_id)),
      ]);
      return rows.map((r: any) => ({
        unit: r.unit_number,
        association: names.get(r.association_id) ?? null,
        owners: owners.get(r.unit_id) ?? [],
        balance_due: round2(r.balance),
      }));
    }

    case 'list_open_work_orders': {
      const assocIds = await associationIds(input.association);
      if (assocIds && !assocIds.length) return { error: 'No association matches that name.' };
      let query = db.from('work_orders')
        .select('number, title, status, priority, scheduled_date, created_at, association_id, units(unit_number)')
        .is('archived_at', null).not('status', 'in', OPEN_WO)
        .order('created_at', { ascending: false }).limit(clampLimit(input.limit));
      if (assocIds) query = query.in('association_id', assocIds);
      const status = sanitizeSearch(input.status).replace(/ /g, '_');
      if (status) query = query.eq('status', status);
      const { data, error } = await query;
      if (error) fail(error.message);
      const names = await associationNames((data ?? []).map((w: any) => w.association_id));
      return (data ?? []).map((w: any) => ({
        number: w.number,
        title: w.title,
        status: w.status,
        priority: w.priority,
        unit: w.units?.unit_number ?? null,
        association: names.get(w.association_id) ?? null,
        scheduled: w.scheduled_date,
        opened: w.created_at,
      }));
    }

    case 'list_open_violations': {
      const assocIds = await associationIds(input.association);
      if (assocIds && !assocIds.length) return { error: 'No association matches that name.' };
      let query = db.from('violations')
        .select('title, violation_type, status, due_date, date_observed, association_id, units(unit_number), owners(full_name)')
        .is('archived_at', null).not('status', 'in', OPEN_VIOLATION)
        .order('due_date', { ascending: true, nullsFirst: false }).limit(clampLimit(input.limit));
      if (assocIds) query = query.in('association_id', assocIds);
      const { data, error } = await query;
      if (error) fail(error.message);
      const names = await associationNames((data ?? []).map((v: any) => v.association_id));
      return (data ?? []).map((v: any) => ({
        title: v.title,
        type: v.violation_type,
        status: v.status,
        due: v.due_date,
        observed: v.date_observed,
        unit: v.units?.unit_number ?? null,
        owner: v.owners?.full_name ?? null,
        association: names.get(v.association_id) ?? null,
      }));
    }

    case 'list_bills': {
      const status = input.status === 'approved' ? 'approved' : 'pending_approval';
      const assocIds = await associationIds(input.association);
      if (assocIds && !assocIds.length) return { error: 'No association matches that name.' };
      let query = db.from('payable_bills')
        .select('bill_number, bill_date, due_date, amount, credit_applied, memo, association_id, vendors(name)')
        .is('archived_at', null).eq('status', status)
        .order('due_date', { ascending: true, nullsFirst: false }).limit(clampLimit(input.limit));
      if (assocIds) query = query.in('association_id', assocIds);
      const { data, error } = await query;
      if (error) fail(error.message);
      const names = await associationNames((data ?? []).map((b: any) => b.association_id));
      return (data ?? []).map((b: any) => ({
        vendor: b.vendors?.name ?? null,
        bill_number: b.bill_number,
        association: names.get(b.association_id) ?? null,
        amount_due: round2(Number(b.amount ?? 0) - Number(b.credit_applied ?? 0)),
        bill_date: b.bill_date,
        due: b.due_date,
        memo: b.memo,
      }));
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
