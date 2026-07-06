/**
 * Owner snapshot builder — server-only.
 *
 * Unit-scoped counterpart to portfolio-snapshot.ts: a compact, RLS-scoped
 * snapshot of the logged-in OWNER's account so the AI assistant answers
 * questions grounded only in data the owner can already see in their portal.
 * Uses the owner's own Supabase session — resident RLS applies to every query.
 */
import 'server-only';
import { requireOwner } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export interface OwnerSnapshot {
  generatedAt: string;
  owner: { name: string | null };
  units: Array<{ unit: string | null; association: string | null; occupancy: string | null; duesAmount: number | null; duesFrequency: string | null }>;
  account: {
    currentBalance: number;
    openCharges: Array<{ description: string | null; amount: number; dueDate: string | null }>;
    recentPayments: Array<{ amount: number; date: string | null; method: string | null }>;
    paymentInstructions: string | null;
  };
  maintenanceRequests: Array<{ title: string | null; status: string | null; created: string | null }>;
  violations: Array<{ title: string | null; status: string | null; observed: string | null }>;
  architecturalRequests: Array<{ title: string | null; status: string | null }>;
  insurance: Array<{ policyNumber: string | null; expires: string | null; status: string | null }>;
  upcomingEvents: Array<{ title: string | null; when: string | null; location: string | null }>;
  amenities: Array<{ name: string | null; reservable: boolean }>;
}

export async function buildOwnerSnapshot(): Promise<OwnerSnapshot> {
  const me = await requireOwner();
  const supabase = await createClient();
  const db = supabase as any;
  const ownerId = me.owner_id;

  const { data: occs } = await db
    .from('occupancies')
    .select('unit_id, association_id, occupancy_type, dues_amount, dues_frequency, units(unit_number), associations(name, payment_instructions, remit_payee, remit_address)')
    .eq('owner_id', ownerId)
    .eq('status', 'current');

  const unitIds = (occs ?? []).map((o: any) => o.unit_id).filter(Boolean);
  const assocIds = [...new Set((occs ?? []).map((o: any) => o.association_id).filter(Boolean))];

  const [
    { data: balances },
    { data: openCharges },
    { data: payments },
    { data: wos },
    { data: viols },
    { data: arcs },
    { data: policies },
    { data: events },
    { data: amenities },
  ] = await Promise.all([
    unitIds.length ? db.from('unit_balances').select('balance').in('unit_id', unitIds) : { data: [] },
    unitIds.length ? db.from('aged_receivables').select('description, balance_due, due_date').in('unit_id', unitIds).order('due_date') : { data: [] },
    unitIds.length ? db.from('payments').select('amount, payment_date, method').in('unit_id', unitIds).order('payment_date', { ascending: false }).limit(8) : { data: [] },
    unitIds.length ? db.from('work_orders').select('title, status, created_at').in('unit_id', unitIds).is('archived_at', null).order('created_at', { ascending: false }).limit(10) : { data: [] },
    db.from('violations').select('title, status, date_observed').eq('owner_id', ownerId).is('archived_at', null).order('date_observed', { ascending: false }).limit(10),
    db.from('architectural_requests').select('title, status').eq('owner_id', ownerId).order('created_at', { ascending: false }).limit(10),
    db.from('insurance_policies').select('policy_number, expiration_date, status').eq('owner_id', ownerId).is('archived_at', null),
    assocIds.length ? db.from('calendar_events').select('title, start_datetime, location').in('association_id', assocIds).is('archived_at', null).gte('start_datetime', new Date().toISOString()).order('start_datetime').limit(8) : { data: [] },
    assocIds.length ? db.from('association_amenities').select('name, allow_reservations').in('association_id', assocIds) : { data: [] },
  ]);

  const paymentInstructions = (occs ?? [])
    .map((o: any) => {
      const a = o.associations;
      if (!a) return null;
      const parts = [a.payment_instructions, a.remit_payee ? `Payable to: ${a.remit_payee}` : null, a.remit_address ? `Mail to: ${a.remit_address}` : null].filter(Boolean);
      return parts.length ? `${a.name}: ${parts.join(' — ')}` : null;
    })
    .filter(Boolean)
    .join(' | ') || null;

  return {
    generatedAt: new Date().toISOString(),
    owner: { name: me.profile?.full_name ?? null },
    units: (occs ?? []).map((o: any) => ({
      unit: o.units?.unit_number ?? null,
      association: o.associations?.name ?? null,
      occupancy: o.occupancy_type ?? null,
      duesAmount: o.dues_amount != null ? Number(o.dues_amount) : null,
      duesFrequency: o.dues_frequency ?? null,
    })),
    account: {
      currentBalance: (balances ?? []).reduce((s: number, b: any) => s + Number(b.balance ?? 0), 0),
      openCharges: (openCharges ?? []).slice(0, 10).map((c: any) => ({
        description: c.description ?? null,
        amount: Number(c.balance_due ?? 0),
        dueDate: c.due_date ?? null,
      })),
      recentPayments: (payments ?? []).map((p: any) => ({
        amount: Number(p.amount ?? 0),
        date: p.payment_date ?? null,
        method: p.method ?? null,
      })),
      paymentInstructions,
    },
    maintenanceRequests: (wos ?? []).map((w: any) => ({
      title: w.title ?? null,
      status: w.status ?? null,
      created: w.created_at ? w.created_at.slice(0, 10) : null,
    })),
    violations: (viols ?? []).map((v: any) => ({
      title: v.title ?? null,
      status: v.status ?? null,
      observed: v.date_observed ?? null,
    })),
    architecturalRequests: (arcs ?? []).map((a: any) => ({ title: a.title ?? null, status: a.status ?? null })),
    insurance: (policies ?? []).map((p: any) => ({
      policyNumber: p.policy_number ?? null,
      expires: p.expiration_date ?? null,
      status: p.status ?? null,
    })),
    upcomingEvents: (events ?? []).map((e: any) => ({
      title: e.title ?? null,
      when: e.start_datetime ?? null,
      location: e.location ?? null,
    })),
    amenities: (amenities ?? []).map((a: any) => ({ name: a.name ?? null, reservable: !!a.allow_reservations })),
  };
}
