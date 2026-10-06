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
import { todayInZone } from '@/lib/time/zoned';

// Open = new, assigned, scheduled, in_progress (as elsewhere in the app).
const OPEN_WO = '("done","completed","billed","closed","cancelled")';
const OPEN_VIOLATION = '("closed","cured")';

const ALL_PORTFOLIO_TOOLS: AITool[] = [
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
        building: { type: 'string', description: 'Optional building name, when one association has the same unit number in several buildings.' },
      },
      required: ['unit_number'],
    },
  },
  {
    name: 'list_delinquent_units',
    description: 'Delinquent units (an open charge past its due date), largest past-due amount first, with the owner name and oldest due date.',
    parameters: {
      type: 'object',
      properties: {
        min_balance: { type: 'number', description: 'Only units with at least this much past due. Default 0.01.' },
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

const FINANCE_TOOLS = new Set(['list_delinquent_units', 'list_bills']);

/**
 * The lookups this user may call. Finance lookups are left out for staff
 * without finance access: RLS hides charges, payments and bills from them, so
 * a balance would read as $0 instead of "not available".
 */
export function portfolioToolsFor(canSeeFinance: boolean): AITool[] {
  return canSeeFinance ? ALL_PORTFOLIO_TOOLS : ALL_PORTFOLIO_TOOLS.filter((t) => !FINANCE_TOOLS.has(t.name));
}

/** Trim, collapse spaces and cap length; punctuation is kept (names use it). */
export function cleanText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

/** Escape LIKE wildcards so the text matches literally (PostgREST treats `*` as `%`, so drop it). */
export function likeEscape(value: unknown): string {
  return cleanText(value).replace(/\*/g, '').replace(/[\\%_]/g, (m) => `\\${m}`);
}

/** A double-quoted value for a PostgREST logic tree (`or=(...)`): commas and parentheses stay literal. */
export function quotedFilterValue(likePattern: string): string {
  return `"${likePattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function clampLimit(value: unknown, fallback = 25): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(50, Math.max(1, Math.trunc(n)));
}

/** A capped list plus the true total, so "how many" is never answered from a truncated page. */
function listResult<T>(total: number | null, rows: T[]) {
  const count = total ?? rows.length;
  return { total: count, returned: rows.length, truncated: count > rows.length, rows };
}

const round2 = (n: unknown) => Math.round((Number(n ?? 0) + Number.EPSILON) * 100) / 100;

function fail(message: string): never {
  throw new Error(message);
}

export async function runPortfolioTool(
  name: string,
  input: Record<string, unknown>,
  canSeeFinance = false,
): Promise<unknown> {
  if (!canSeeFinance && FINANCE_TOOLS.has(name)) {
    return { error: 'Financial details are not available to your role.' };
  }
  const db = (await createClient()) as any;

  async function associationIds(nameFilter: unknown): Promise<string[] | null> {
    let raw = cleanText(nameFilter);
    // A trailing "[id:abcd1234]" (offered by the ambiguity message) picks one
    // association even when name and city are both shared.
    const idTag = raw.match(/\s*\[id:([0-9a-f-]{6,36})\]$/i);
    const idPrefix = idTag ? idTag[1].toLowerCase() : '';
    if (idTag) raw = raw.slice(0, idTag.index).trim();
    if (!raw) return null;
    // "Name (City)" picks between associations that share a name, unless a
    // name really ends in parentheses.
    const withCity = raw.match(/^(.+?)\s*\(([^()]+)\)$/);
    const namePart = withCity ? withCity[1].trim() : raw;
    type Assoc = { id: string; name: string; city: string | null };
    const byId = (list: Assoc[]) => list.filter((a) => !idPrefix || a.id.toLowerCase().startsWith(idPrefix));
    // Exact names first (uncapped by partial matches), then partial matches.
    const exactNames = [...new Set([raw, namePart])].map((n) => `name.ilike.${quotedFilterValue(likeEscape(n))}`).join(',');
    const { data: exactData, error: exactErr } = await db.from('associations').select('id, name, city')
      .is('archived_at', null).or(exactNames).limit(100);
    if (exactErr) fail(exactErr.message);
    let rows = byId((exactData ?? []) as Assoc[]);
    if (!rows.length) {
      const { data, error } = await db.from('associations').select('id, name, city')
        .ilike('name', `%${likeEscape(namePart)}%`).is('archived_at', null).order('name').limit(20);
      if (error) fail(error.message);
      rows = byId((data ?? []) as Assoc[]);
    }
    const lower = (v: string | null) => (v ?? '').trim().toLowerCase();
    // 1) the full text is an exact name; 2) "Name (City)"; 3) an exact name
    // part; 4) a single partial match. More than one candidate is ambiguous
    // (names aren't unique): never silently combine associations.
    let candidates = rows.filter((a) => lower(a.name) === lower(raw));
    if (!candidates.length && withCity) {
      candidates = rows.filter((a) => lower(a.name) === lower(namePart) && lower(a.city) === lower(withCity[2]));
    }
    if (!candidates.length) {
      const exact = rows.filter((a) => lower(a.name) === lower(namePart));
      candidates = exact.length ? exact : rows;
    }
    if (candidates.length > 1) {
      const label = (a: { id: string; name: string; city: string | null }) =>
        `${a.city ? `${a.name} (${a.city})` : a.name} [id:${a.id.slice(0, 8)}]`;
      fail(`Several associations match "${raw}": ${candidates.map(label).join(', ')}. Ask which one, then pass it exactly as listed.`);
    }
    return candidates.map((a) => a.id);
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
      const q = cleanText(input.query);
      if (q.length < 2) return { error: 'Give at least 2 characters of a name or email.' };
      const pattern = quotedFilterValue(`%${likeEscape(q)}%`);
      // Start from current owner occupancies the caller can see (association
      // scoping lives on occupancies; the owners table is company-wide), then
      // match the owner's name or email.
      const { data: occ, error } = await db.from('occupancies')
        .select('owner_id, unit_id, association_id, units(unit_number), owners!inner(id, full_name, email, phone, archived_at)')
        .eq('status', 'current').eq('occupancy_type', 'owner')
        .is('owners.archived_at', null)
        .or(`full_name.ilike.${pattern},email.ilike.${pattern}`, { referencedTable: 'owners' })
        .order('owner_id').limit(1000);
      if (error) fail(error.message);
      // Group into owners and cap first; only then look up balances and
      // association names for the owners actually returned.
      const grouped = new Map<string, { owner: any; occ: any[] }>();
      for (const row of (occ ?? []) as any[]) {
        const o = row.owners;
        if (!o) continue;
        const entry = grouped.get(o.id) ?? { owner: o, occ: [] as any[] };
        entry.occ.push(row);
        grouped.set(o.id, entry);
      }
      const picked = [...grouped.values()]
        .sort((a, b) => String(a.owner.full_name).localeCompare(String(b.owner.full_name)))
        .slice(0, 10);
      const pickedOcc = picked.flatMap((p) => p.occ);
      const unitIds = pickedOcc.map((o) => o.unit_id);
      let balance = new Map<string, number>();
      if (canSeeFinance && unitIds.length) {
        // Chunked: one owner can hold hundreds of units, and a single GET
        // with every id could exceed URL limits.
        for (let i = 0; i < unitIds.length; i += 100) {
          const { data: balances, error: balErr } = await db.from('unit_balances').select('unit_id, balance').in('unit_id', unitIds.slice(i, i + 100));
          if (balErr) fail(balErr.message);
          for (const b of (balances ?? []) as any[]) balance.set(b.unit_id, round2(b.balance));
        }
      }
      const names = await associationNames(pickedOcc.map((o) => o.association_id));
      return picked.map(({ owner: o, occ: rows }) => ({
        name: o.full_name,
        email: o.email,
        phone: o.phone,
        units: rows.map((row) => ({
          unit: row.units?.unit_number ?? null,
          association: names.get(row.association_id) ?? null,
          ...(canSeeFinance ? { balance_due: balance.get(row.unit_id) ?? 0 } : {}),
        })),
      }));
    }

    case 'unit_summary': {
      const unitNumber = cleanText(input.unit_number);
      if (!unitNumber) return { error: 'Give a unit number.' };
      const assocIds = await associationIds(input.association);
      const building = cleanText(input.building);
      const findUnits = async (buildingPattern: string | null) => {
        let query = db.from('units')
          .select('id, unit_number, buildings!inner(association_id, name)')
          .is('archived_at', null).ilike('unit_number', likeEscape(unitNumber)).limit(50);
        if (assocIds) query = query.in('buildings.association_id', assocIds.length ? assocIds : ['00000000-0000-0000-0000-000000000000']);
        if (buildingPattern) query = query.ilike('buildings.name', buildingPattern);
        const { data, error } = await query;
        if (error) fail(error.message);
        return (data ?? []) as any[];
      };
      // Building is filtered in the query: an exact name wins over partial
      // matches ("Tower" vs "Tower East").
      let units = await findUnits(building ? likeEscape(building) : null);
      if (building && !units.length) units = await findUnits(`%${likeEscape(building)}%`);
      if (!units?.length) return { error: `No unit ${unitNumber} found.` };
      const names = await associationNames(units.map((u: any) => u.buildings?.association_id));
      if (units.length > 1) {
        return {
          ambiguous: true,
          message: 'Several units have that number. Ask which association or building.',
          matches: units.map((u: any) => ({
            unit: u.unit_number,
            association: names.get(u.buildings?.association_id) ?? null,
            building: u.buildings?.name ?? null,
          })),
        };
      }
      const unit = units[0];
      const [occ, bal, charges, payments, violations, workOrders] = await Promise.all([
        db.from('occupancies').select('is_primary, dues_amount, dues_frequency, dues_paid_through, move_in_date, owners(full_name, email, phone)')
          .eq('unit_id', unit.id).eq('status', 'current').eq('occupancy_type', 'owner'),
        db.from('unit_balances').select('balance, total_charges, total_payments').eq('unit_id', unit.id).maybeSingle(),
        db.from('charges').select('description, amount, due_date').eq('unit_id', unit.id).order('due_date', { ascending: false }).limit(6),
        db.from('receivable_payments_ledger').select('amount, payment_date, method, reversed_at').eq('unit_id', unit.id).or('method.is.null,method.neq.credit').lte('payment_date', todayInZone()).order('payment_date', { ascending: false }).limit(6), // credits aren't payments; future-dated receipts aren't received yet
        db.from('violations').select('title, violation_type, status, due_date', { count: 'exact' }).eq('unit_id', unit.id).is('archived_at', null).not('status', 'in', OPEN_VIOLATION).limit(10),
        db.from('work_orders').select('number, title, status, priority, scheduled_date', { count: 'exact' }).eq('unit_id', unit.id).is('archived_at', null).not('status', 'in', OPEN_WO).limit(10),
      ]);
      for (const r of [occ, bal, charges, payments, violations, workOrders]) if (r.error) fail(r.error.message);
      return {
        unit: unit.unit_number,
        association: names.get(unit.buildings?.association_id) ?? null,
        building: unit.buildings?.name ?? null,
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
        ...(canSeeFinance
          ? {
              balance_due: round2(bal.data?.balance),
              total_charged: round2(bal.data?.total_charges),
              total_paid: round2(bal.data?.total_payments),
              recent_charges: (charges.data ?? []).map((c: any) => ({ description: c.description, amount: round2(c.amount), due: c.due_date })),
              recent_payments: (payments.data ?? []).map((p: any) => ({ amount: round2(p.amount), date: p.payment_date, method: p.method, reversed: !!p.reversed_at })),
            }
          : { financials: 'Not available to your role.' }),
        open_violations: listResult(violations.count ?? null, violations.data ?? []),
        open_work_orders: listResult(workOrders.count ?? null, workOrders.data ?? []),
      };
    }

    case 'list_delinquent_units': {
      const min = Number.isFinite(Number(input.min_balance)) ? Math.max(0.01, Number(input.min_balance)) : 0.01;
      const assocIds = await associationIds(input.association);
      if (assocIds && !assocIds.length) return { error: 'No association matches that name.' };
      // delinquent_units = units with an open charge already past due (the
      // balance is that past-due amount); a current or future charge is owed
      // but not delinquent.
      let query = db.from('delinquent_units').select('unit_id, unit_number, association_id, balance, oldest_due', { count: 'exact' })
        .gte('balance', min).order('balance', { ascending: false }).limit(clampLimit(input.limit));
      if (assocIds) query = query.in('association_id', assocIds);
      const { data, error, count } = await query;
      if (error) fail(error.message);
      const rows = data ?? [];
      const [names, owners] = await Promise.all([
        associationNames(rows.map((r: any) => r.association_id)),
        currentOwnersByUnit(rows.map((r: any) => r.unit_id)),
      ]);
      return listResult(count, rows.map((r: any) => ({
        unit: r.unit_number,
        association: names.get(r.association_id) ?? null,
        owners: owners.get(r.unit_id) ?? [],
        past_due: round2(r.balance),
        oldest_due: r.oldest_due,
      })));
    }

    case 'list_open_work_orders': {
      const assocIds = await associationIds(input.association);
      if (assocIds && !assocIds.length) return { error: 'No association matches that name.' };
      let query = db.from('work_orders')
        .select('number, title, status, priority, scheduled_date, created_at, association_id, units(unit_number)', { count: 'exact' })
        .is('archived_at', null).not('status', 'in', OPEN_WO)
        .order('created_at', { ascending: false }).limit(clampLimit(input.limit));
      if (assocIds) query = query.in('association_id', assocIds);
      const status = cleanText(input.status).toLowerCase().replace(/ /g, '_');
      if (status) query = query.eq('status', status);
      const { data, error, count } = await query;
      if (error) fail(error.message);
      const names = await associationNames((data ?? []).map((w: any) => w.association_id));
      return listResult(count, (data ?? []).map((w: any) => ({
        number: w.number,
        title: w.title,
        status: w.status,
        priority: w.priority,
        unit: w.units?.unit_number ?? null,
        association: names.get(w.association_id) ?? null,
        scheduled: w.scheduled_date,
        opened: w.created_at,
      })));
    }

    case 'list_open_violations': {
      const assocIds = await associationIds(input.association);
      if (assocIds && !assocIds.length) return { error: 'No association matches that name.' };
      let query = db.from('violations')
        .select('title, violation_type, status, due_date, date_observed, association_id, units(unit_number), owners(full_name)', { count: 'exact' })
        .is('archived_at', null).not('status', 'in', OPEN_VIOLATION)
        .order('due_date', { ascending: true, nullsFirst: false }).limit(clampLimit(input.limit));
      if (assocIds) query = query.in('association_id', assocIds);
      const { data, error, count } = await query;
      if (error) fail(error.message);
      const names = await associationNames((data ?? []).map((v: any) => v.association_id));
      return listResult(count, (data ?? []).map((v: any) => ({
        title: v.title,
        type: v.violation_type,
        status: v.status,
        due: v.due_date,
        observed: v.date_observed,
        unit: v.units?.unit_number ?? null,
        owner: v.owners?.full_name ?? null,
        association: names.get(v.association_id) ?? null,
      })));
    }

    case 'list_bills': {
      const status = input.status === 'approved' ? 'approved' : 'pending_approval';
      const assocIds = await associationIds(input.association);
      if (assocIds && !assocIds.length) return { error: 'No association matches that name.' };
      let query = db.from('payable_bills')
        .select('bill_number, bill_date, due_date, amount, credit_applied, memo, association_id, vendors(name)', { count: 'exact' })
        .is('archived_at', null).eq('status', status)
        .order('due_date', { ascending: true, nullsFirst: false }).limit(clampLimit(input.limit));
      if (assocIds) query = query.in('association_id', assocIds);
      const { data, error, count } = await query;
      if (error) fail(error.message);
      const names = await associationNames((data ?? []).map((b: any) => b.association_id));
      return listResult(count, (data ?? []).map((b: any) => ({
        vendor: b.vendors?.name ?? null,
        bill_number: b.bill_number,
        association: names.get(b.association_id) ?? null,
        amount_due: round2(Number(b.amount ?? 0) - Number(b.credit_applied ?? 0)),
        bill_date: b.bill_date,
        due: b.due_date,
        memo: b.memo,
      })));
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
