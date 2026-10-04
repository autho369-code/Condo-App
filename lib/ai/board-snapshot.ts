/**
 * Board snapshot builder — server-only.
 *
 * Association-scoped counterpart to portfolio-snapshot.ts: gathers a compact,
 * RLS-scoped snapshot of the board member's OWN association(s) so the AI Board
 * Assistant answers questions grounded only in data the board is allowed to
 * see. Uses the board member's Supabase session, so every query is already
 * constrained by the board-read RLS policies.
 *
 * Keep the output small (a few KB) — summaries and short lists only.
 */
import { glDebitBalances, incomeExpenseTotals } from '@/lib/finance/totals';
import 'server-only';
import { requireBoard } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { ACTIVE_VIOLATION_STATUSES } from '@/lib/violations/queries';
import { fiscalWindow, fiscalYearFor } from '@/lib/budget/fiscal';
import { DEFAULT_TIME_ZONE, todayInZone } from '@/lib/time/zoned';

const OPEN_WO_STATUSES = ['new', 'assigned', 'scheduled', 'in_progress'];

// A section whose query failed is sent as null and named in `unavailable`, so
// the assistant says it lacks the data instead of reporting zeros.
export interface BoardSnapshot {
  generatedAt: string;
  associations: string[];
  unavailable: string[];
  financials: {
    fiscalYear: number;
    fiscalYearStart: string;
    ytdIncome: number | null;
    ytdExpenses: number | null;
    netOperatingIncome: number | null;
    operatingBalance: number | null;
    reserveBalance: number | null;
  };
  receivables: {
    /** Past-due balances only (charges whose due date has passed). */
    totalPastDue: number;
    delinquentUnitCount: number;
    delinquentUnits: Array<{ unit: string | null; owner: string | null; pastDue: number; oldestDue: string | null; daysPastDue: number | null }>;
  } | null;
  vendorBills: Array<{ vendor: string | null; amount: number; status: string | null; dueDate: string | null }> | null;
  workOrders: {
    open: number;
    overdue: number;
    emergencies: number;
    recent: Array<{ title: string | null; status: string | null; priority: string | null; created: string | null }>;
  } | null;
  violations: { open: number } | null;
  pendingApprovals: Array<{ title: string | null; amount: number | null }> | null;
  upcomingMeetings: Array<{ title: string | null; type: string | null; when: string | null }> | null;
  statutoryMaintenance: Array<{ task: string | null; nextDue: string | null; overdue: boolean }> | null;
}

async function settle<T>(p: Promise<T>): Promise<{ value: T | null; failed: boolean }> {
  try {
    return { value: await p, failed: false };
  } catch (e) {
    console.error('[board-snapshot] query failed:', e instanceof Error ? e.message : e);
    return { value: null, failed: true };
  }
}

export async function buildBoardSnapshot(associationId: string): Promise<BoardSnapshot> {
  const me = await requireBoard();
  const supabase = await createClient();
  const db = supabase as any;
  const allowedIds: string[] = me.board_association_ids ?? [];
  if (!associationId || !allowedIds.includes(associationId)) {
    throw new Error('Association is not linked to this board account.');
  }
  const ids = [associationId];
  const unavailable: string[] = [];

  const { data: assoc, error: assocError } = await db
    .from('associations').select('id, name, fiscal_year_start, timezone').eq('id', associationId).maybeSingle();
  if (assocError) throw new Error(`Association could not be loaded: ${assocError.message}`);

  const timeZone = assoc?.timezone || DEFAULT_TIME_ZONE;
  const todayDate = todayInZone(timeZone);
  const fiscalYear = fiscalYearFor(new Date(`${todayDate}T12:00:00Z`), assoc?.fiscal_year_start);
  const yearStart = fiscalWindow(fiscalYear, assoc?.fiscal_year_start).start;

  const [
    ytd,
    bankAccounts,
    pastDue,
    bills,
    openWOs,
    viols,
    approvals,
    meetings,
    tasks,
    occupancies,
  ] = await Promise.all([
    // Summed in the database (lists of journal lines stop at 1,000 rows).
    settle(incomeExpenseTotals(db, { associationIds: ids, from: yearStart, to: todayDate })),
    db.from('bank_accounts').select('gl_account_id, purpose, fund_type').in('association_id', ids).is('archived_at', null),
    db.from('delinquent_units').select('unit_id, unit_number, balance, oldest_due').in('association_id', ids).order('balance', { ascending: false }),
    db.from('payable_bills').select('amount, credit_applied, status, due_date, vendors(name)').in('association_id', ids).is('archived_at', null).not('status', 'in', '("paid","void")'),
    db.from('work_orders').select('title, status, priority, scheduled_date, created_at').in('association_id', ids).is('archived_at', null).in('status', OPEN_WO_STATUSES).order('created_at', { ascending: false }),
    db.from('violations').select('id', { count: 'exact', head: true }).in('association_id', ids).is('archived_at', null).in('status', [...ACTIVE_VIOLATION_STATUSES]),
    db.from('approval_requests').select('title, amount').in('association_id', ids).eq('status', 'pending').limit(10),
    db.from('meetings').select('title, meeting_type, start_time').in('association_id', ids).is('archived_at', null).in('status', ['scheduled', 'in_progress']).gte('start_time', new Date().toISOString()).order('start_time').limit(5),
    db.from('maintenance_tasks').select('task_name, next_due_date').in('association_id', ids).is('archived_at', null).order('next_due_date').limit(15),
    db.from('occupancies').select('unit_id, owners(full_name)').in('association_id', ids).eq('status', 'current').eq('occupancy_type', 'owner'),
  ]);

  const failed = (section: string, res: { error?: unknown }) => {
    if (!res.error) return false;
    console.error(`[board-snapshot] ${section} failed:`, (res.error as any)?.message ?? res.error);
    unavailable.push(section);
    return true;
  };

  if (ytd.failed) unavailable.push('ytd income and expenses');
  const ytdIncome = ytd.value?.income ?? null;
  const ytdExpenses = ytd.value?.expense ?? null;

  let operatingBalance: number | null = null;
  let reserveBalance: number | null = null;
  if (!failed('bank balances', bankAccounts)) {
    const balByGl = await settle(glDebitBalances(db, {
      glAccountIds: [...new Set((bankAccounts.data ?? []).map((b: any) => b.gl_account_id).filter(Boolean))] as string[],
      associationIds: ids,
    }));
    if (balByGl.failed || !balByGl.value) unavailable.push('bank balances');
    else {
      operatingBalance = 0;
      reserveBalance = 0;
      for (const b of bankAccounts.data ?? []) {
        const bal = b.gl_account_id ? (balByGl.value.get(b.gl_account_id) ?? 0) : 0;
        if (b.fund_type === 'reserve' || (b.purpose ?? '').toLowerCase().includes('reserve')) reserveBalance += bal;
        else operatingBalance += bal;
      }
    }
  }

  // Owner names are a nicety; a failed lookup leaves them null rather than
  // dropping the receivables section.
  if (occupancies.error) console.error('[board-snapshot] occupancies failed:', occupancies.error.message);
  const ownerByUnit = new Map<string, string | null>(
    (occupancies.data ?? []).map((o: any) => [o.unit_id, o.owners?.full_name ?? null]),
  );
  const todayMs = Date.parse(`${todayDate}T00:00:00Z`);
  const delinquent = failed('receivables', pastDue) ? null : (pastDue.data ?? []) as any[];

  const open = failed('work orders', openWOs) ? null : (openWOs.data ?? []) as any[];

  return {
    generatedAt: new Date().toISOString(),
    associations: assoc?.name ? [assoc.name] : [],
    unavailable,
    financials: {
      fiscalYear,
      fiscalYearStart: yearStart,
      ytdIncome,
      ytdExpenses,
      netOperatingIncome: ytdIncome != null && ytdExpenses != null ? ytdIncome - ytdExpenses : null,
      operatingBalance,
      reserveBalance,
    },
    receivables: delinquent && {
      totalPastDue: delinquent.reduce((s: number, b: any) => s + Number(b.balance ?? 0), 0),
      delinquentUnitCount: delinquent.length,
      delinquentUnits: delinquent.slice(0, 10).map((b: any) => ({
        unit: b.unit_number ?? null,
        owner: ownerByUnit.get(b.unit_id) ?? null,
        pastDue: Number(b.balance ?? 0),
        oldestDue: b.oldest_due ?? null,
        daysPastDue: b.oldest_due ? Math.max(0, Math.round((todayMs - Date.parse(`${b.oldest_due}T00:00:00Z`)) / 86400000)) : null,
      })),
    },
    vendorBills: failed('vendor bills', bills) ? null : (bills.data ?? []).slice(0, 10).map((b: any) => ({
      vendor: b.vendors?.name ?? null,
      amount: Number(b.amount ?? 0) - Number(b.credit_applied ?? 0),
      status: b.status ?? null,
      dueDate: b.due_date ?? null,
    })),
    workOrders: open && {
      open: open.length,
      overdue: open.filter((wo: any) => wo.scheduled_date && wo.scheduled_date < todayDate).length,
      emergencies: open.filter((wo: any) => wo.priority === 'emergency').length,
      recent: open.slice(0, 10).map((wo: any) => ({
        title: wo.title ?? null,
        status: wo.status ?? null,
        priority: wo.priority ?? null,
        created: wo.created_at ? wo.created_at.slice(0, 10) : null,
      })),
    },
    violations: failed('violations', viols) ? null : { open: viols.count ?? 0 },
    pendingApprovals: failed('pending approvals', approvals) ? null : (approvals.data ?? []).map((a: any) => ({
      title: a.title ?? null,
      amount: a.amount != null ? Number(a.amount) : null,
    })),
    upcomingMeetings: failed('upcoming meetings', meetings) ? null : (meetings.data ?? []).map((m: any) => ({
      title: m.title ?? null,
      type: m.meeting_type ?? null,
      when: m.start_time ?? null,
    })),
    statutoryMaintenance: failed('statutory maintenance', tasks) ? null : (tasks.data ?? []).map((t: any) => ({
      task: t.task_name ?? null,
      nextDue: t.next_due_date ?? null,
      overdue: !!(t.next_due_date && t.next_due_date < todayDate),
    })),
  };
}
