/**
 * Vendor snapshot builder — server-only.
 *
 * A compact, RLS-scoped snapshot of the logged-in VENDOR's world: their
 * assigned jobs, schedule, bills/payment status, and compliance dates.
 * Uses the vendor's own Supabase session — vendor RLS applies everywhere.
 */
import 'server-only';
import { requireVendor } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { todayInZone } from '@/lib/time/zoned';

const OPEN_STATUSES = ['new', 'assigned', 'scheduled', 'in_progress'];
const DONE_STATUSES = ['done', 'completed', 'billed', 'closed'];

export interface VendorSnapshot {
  generatedAt: string;
  vendor: { name: string | null; trade: string | null };
  workOrders: {
    open: Array<{ number: string | null; title: string | null; status: string | null; priority: string | null; scheduledDate: string | null; property: string | null; unit: string | null }>;
    overdueCount: number;
    emergencies: Array<{ number: string | null; title: string | null; property: string | null }>;
    recentlyCompleted: Array<{ title: string | null; completed: string | null }>;
  };
  bills: Array<{ billNumber: string | null; amount: number; status: string | null; dueDate: string | null; paidAt: string | null; property: string | null }>;
  compliance: Array<{ item: string; expires: string | null; expired: boolean }>;
  upcomingAppointments: Array<{ title: string | null; when: string | null; property: string | null }>;
}

export async function buildVendorSnapshot(): Promise<VendorSnapshot> {
  const me = await requireVendor();
  const supabase = await createClient();
  const db = supabase as any;
  // Local calendar day (the UTC date flipped to tomorrow every evening in US zones).
  const todayDate = todayInZone();

  const [
    { data: vendor, error: vendorError },
    { data: wos, error: wosError },
    { data: bills, error: billsError },
    { data: events, error: eventsError },
  ] = await Promise.all([
    db.from('vendors').select('name, trade, workers_comp_expiration, general_liability_expiration, auto_insurance_expiration, epa_certification_expiration, state_license_expiration, contract_expiration').eq('id', me.vendor_id).maybeSingle(),
    db.from('work_orders')
      .select('number, title, status, priority, scheduled_date, completed_date, associations(name), units(unit_number)')
      .in('vendor_id', me.vendor_ids)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(50),
    db.from('payable_bills')
      .select('bill_number, amount, credit_applied, status, due_date, paid_at, associations(name)')
      .in('vendor_id', me.vendor_ids)
      .is('archived_at', null)
      .order('bill_date', { ascending: false })
      .limit(20),
    db.from('calendar_events')
      .select('title, start_datetime, associations(name)')
      .in('vendor_id', me.vendor_ids)
      .is('archived_at', null)
      .gte('start_datetime', new Date().toISOString())
      .order('start_datetime')
      .limit(10),
  ]);

  // Fail loudly: an assistant answering from a silently empty snapshot would
  // tell the vendor they have no jobs or bills.
  const failed = [
    vendorError && `vendor profile: ${vendorError.message}`,
    wosError && `work orders: ${wosError.message}`,
    billsError && `bills: ${billsError.message}`,
    eventsError && `appointments: ${eventsError.message}`,
  ].filter(Boolean);
  if (failed.length) throw new Error(`Vendor snapshot could not be loaded (${failed.join('; ')})`);

  const rows = wos ?? [];
  const open = rows.filter((w: any) => OPEN_STATUSES.includes((w.status ?? '').toLowerCase()));
  const done = rows.filter((w: any) => DONE_STATUSES.includes((w.status ?? '').toLowerCase()));

  const compliance: VendorSnapshot['compliance'] = [
    ['General liability (COI)', vendor?.general_liability_expiration],
    ['Workers comp', vendor?.workers_comp_expiration],
    ['Auto insurance', vendor?.auto_insurance_expiration],
    ['EPA certification', vendor?.epa_certification_expiration],
    ['State license', vendor?.state_license_expiration],
    ['Contract', vendor?.contract_expiration],
  ]
    .filter(([, d]) => !!d)
    .map(([item, d]) => ({ item: item as string, expires: d as string, expired: (d as string) < todayDate }));

  return {
    generatedAt: new Date().toISOString(),
    vendor: { name: vendor?.name ?? null, trade: vendor?.trade ?? null },
    workOrders: {
      open: open.map((w: any) => ({
        number: w.number ?? null,
        title: w.title ?? null,
        status: w.status ?? null,
        priority: w.priority ?? null,
        scheduledDate: w.scheduled_date ?? null,
        property: w.associations?.name ?? null,
        unit: w.units?.unit_number ?? null,
      })),
      overdueCount: open.filter((w: any) => w.scheduled_date && w.scheduled_date < todayDate).length,
      emergencies: open
        .filter((w: any) => (w.priority ?? '').toLowerCase() === 'emergency')
        .map((w: any) => ({ number: w.number ?? null, title: w.title ?? null, property: w.associations?.name ?? null })),
      recentlyCompleted: done.slice(0, 8).map((w: any) => ({ title: w.title ?? null, completed: w.completed_date ?? null })),
    },
    bills: (bills ?? []).map((b: any) => ({
      billNumber: b.bill_number ?? null,
      // Net of vendor credits, matching the vendor Payments page.
      amount: Number(b.amount ?? 0) - Number(b.credit_applied ?? 0),
      status: b.status ?? null,
      dueDate: b.due_date ?? null,
      paidAt: b.paid_at ?? null,
      property: b.associations?.name ?? null,
    })),
    compliance,
    upcomingAppointments: (events ?? []).map((e: any) => ({
      title: e.title ?? null,
      when: e.start_datetime ?? null,
      property: e.associations?.name ?? null,
    })),
  };
}
