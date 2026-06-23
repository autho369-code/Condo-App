/**
 * Portfolio snapshot builder — server-only.
 *
 * Gathers a compact, RLS-scoped snapshot of the logged-in manager's portfolio
 * so the AI assistant can answer questions GROUNDED ONLY in real data. It uses
 * the user's own Supabase session (`createClient()`), so every query is already
 * constrained by RLS — the manager can only ever see their own data.
 *
 * The queries mirror what the manager dashboard (`app/(app)/dashboard/page.tsx`)
 * and the list pages show, so the numbers the assistant reports match the UI.
 *
 * IMPORTANT: keep the output small (a few KB). Summaries + short lists only —
 * never dump whole tables.
 */
import 'server-only';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export interface PortfolioSnapshot {
  generatedAt: string;
  portfolio: { name: string | null };
  counts: {
    associations: number;
    units: number;
    owners: number;
    activeVendors: number;
  };
  receivables: {
    totalOutstanding: number;
    delinquentUnitCount: number;
    topDelinquentUnits: Array<{ unit: string | null; balance: number }>;
  };
  workOrders: {
    open: number;
    overdue: number;
    recent: Array<{ title: string | null; status: string | null; unit: string | null }>;
  };
  bills: {
    pendingApprovalCount: number;
    pendingApprovalTotal: number;
    awaitingPaymentCount: number;
    awaitingPaymentTotal: number;
  };
  banking: { unreconciledAccounts: number };
  violations: { open: number; overdue: number };
  upcomingEvents: Array<{ title: string | null; type: string | null; when: string | null; location: string | null }>;
  recentPayments: Array<{ owner: string | null; unit: string | null; amount: number; date: string | null }>;
}

export async function buildPortfolioSnapshot(): Promise<PortfolioSnapshot> {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const today = new Date();
  const todayIso = today.toISOString();
  const todayDate = todayIso.slice(0, 10);

  // End of this week (Sunday 23:59:59) — same logic as the dashboard.
  const dayOfWeek = today.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const endOfWeek = new Date(today);
  endOfWeek.setDate(endOfWeek.getDate() + daysUntilSunday);
  endOfWeek.setHours(23, 59, 59, 999);
  const endOfWeekIso = endOfWeek.toISOString();

  const [
    associationsCount,
    unitsCount,
    ownersCount,
    vendorsCount,
    arRows,
    openWorkOrders,
    overdueWorkOrders,
    recentWorkOrders,
    pendingBills,
    awaitingBills,
    unreconciledAccounts,
    openViolations,
    overdueViolations,
    events,
    payments,
  ] = await Promise.all([
    db.from('associations').select('id', { count: 'exact', head: true }).is('archived_at', null),
    db.from('units').select('id', { count: 'exact', head: true }).is('archived_at', null),
    db.from('owners').select('id', { count: 'exact', head: true }).is('archived_at', null),
    db.from('vendors').select('id', { count: 'exact', head: true }).is('archived_at', null),
    // AR: unit_balances with positive balance (matches dashboard arBalanceQuery).
    db.from('unit_balances').select('unit_number, balance').gt('balance', 0),
    db
      .from('work_orders')
      .select('id', { count: 'exact', head: true })
      .is('archived_at', null)
      .not('status', 'in', '("completed","closed","cancelled")'),
    db
      .from('work_orders')
      .select('id', { count: 'exact', head: true })
      .is('archived_at', null)
      .not('status', 'in', '("completed","closed","cancelled")')
      .lt('scheduled_date', todayDate),
    db
      .from('work_orders')
      .select('title, status, units(unit_number)')
      .is('archived_at', null)
      .not('status', 'in', '("completed","closed","cancelled")')
      .order('created_at', { ascending: false })
      .limit(5),
    db
      .from('payable_bills')
      .select('amount', { count: 'exact', head: false })
      .is('archived_at', null)
      .eq('status', 'pending_approval'),
    db
      .from('payable_bills')
      .select('amount', { count: 'exact', head: false })
      .is('archived_at', null)
      .eq('status', 'approved'),
    db
      .from('bank_accounts')
      .select('id', { count: 'exact', head: true })
      .is('archived_at', null)
      .is('last_reconciliation_date', null),
    db
      .from('violations')
      .select('id', { count: 'exact', head: true })
      .is('archived_at', null)
      .not('status', 'in', '("closed","cured")'),
    db
      .from('violations')
      .select('id', { count: 'exact', head: true })
      .is('archived_at', null)
      .not('status', 'in', '("closed","cured")')
      .lt('due_date', todayDate),
    db
      .from('calendar_events')
      .select('title, event_type, start_datetime, location')
      .is('archived_at', null)
      .gte('start_datetime', todayIso)
      .lte('start_datetime', endOfWeekIso)
      .order('start_datetime', { ascending: true })
      .limit(8),
    db
      .from('receivable_payments_ledger')
      .select('amount, owner_name, unit_number, payment_date, created_at')
      .order('created_at', { ascending: false, nullsFirst: false })
      .limit(5),
  ]);

  const arData = (arRows.data ?? []) as Array<{ unit_number: string | null; balance: number | null }>;
  const totalOutstanding = arData.reduce((sum, r) => sum + (r.balance ?? 0), 0);
  const topDelinquentUnits = [...arData]
    .sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0))
    .slice(0, 8)
    .map((r) => ({ unit: r.unit_number, balance: round2(r.balance ?? 0) }));

  const pendingTotal = ((pendingBills.data ?? []) as Array<{ amount: number | null }>).reduce(
    (sum, b) => sum + (b.amount ?? 0),
    0,
  );
  const awaitingTotal = ((awaitingBills.data ?? []) as Array<{ amount: number | null }>).reduce(
    (sum, b) => sum + (b.amount ?? 0),
    0,
  );

  return {
    generatedAt: todayIso,
    portfolio: { name: me.portfolio?.company_name ?? me.portfolio?.name ?? null },
    counts: {
      associations: associationsCount.count ?? 0,
      units: unitsCount.count ?? 0,
      owners: ownersCount.count ?? 0,
      activeVendors: vendorsCount.count ?? 0,
    },
    receivables: {
      totalOutstanding: round2(totalOutstanding),
      delinquentUnitCount: arData.length,
      topDelinquentUnits,
    },
    workOrders: {
      open: openWorkOrders.count ?? 0,
      overdue: overdueWorkOrders.count ?? 0,
      recent: ((recentWorkOrders.data ?? []) as any[]).map((w) => ({
        title: w.title ?? null,
        status: w.status ?? null,
        unit: w.units?.unit_number ?? null,
      })),
    },
    bills: {
      pendingApprovalCount: pendingBills.count ?? 0,
      pendingApprovalTotal: round2(pendingTotal),
      awaitingPaymentCount: awaitingBills.count ?? 0,
      awaitingPaymentTotal: round2(awaitingTotal),
    },
    banking: { unreconciledAccounts: unreconciledAccounts.count ?? 0 },
    violations: {
      open: openViolations.count ?? 0,
      overdue: overdueViolations.count ?? 0,
    },
    upcomingEvents: ((events.data ?? []) as any[]).map((e) => ({
      title: e.title ?? null,
      type: e.event_type ?? null,
      when: e.start_datetime ?? null,
      location: e.location ?? null,
    })),
    recentPayments: ((payments.data ?? []) as any[]).map((p) => ({
      owner: p.owner_name ?? null,
      unit: p.unit_number ?? null,
      amount: round2(p.amount ?? 0),
      date: p.payment_date ?? p.created_at ?? null,
    })),
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
