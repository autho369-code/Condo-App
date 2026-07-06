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
import 'server-only';
import { requireBoard } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

const OPEN_WO_STATUSES = ['new', 'assigned', 'scheduled', 'in_progress'];

export interface BoardSnapshot {
  generatedAt: string;
  associations: string[];
  financials: {
    ytdIncome: number;
    ytdExpenses: number;
    netOperatingIncome: number;
    operatingBalance: number;
    reserveBalance: number;
  };
  receivables: {
    totalOutstanding: number;
    delinquentUnitCount: number;
    delinquentUnits: Array<{ unit: string | null; owner: string | null; balance: number }>;
  };
  vendorBills: Array<{ vendor: string | null; amount: number; status: string | null; dueDate: string | null }>;
  workOrders: {
    open: number;
    overdue: number;
    emergencies: number;
    recent: Array<{ title: string | null; status: string | null; priority: string | null; created: string | null }>;
  };
  violations: { open: number };
  pendingApprovals: Array<{ title: string | null; amount: number | null }>;
  upcomingMeetings: Array<{ title: string | null; type: string | null; when: string | null }>;
  statutoryMaintenance: Array<{ task: string | null; nextDue: string | null; overdue: boolean }>;
}

export async function buildBoardSnapshot(): Promise<BoardSnapshot> {
  const me = await requireBoard();
  const supabase = await createClient();
  const db = supabase as any;
  const ids: string[] = me.board_association_ids ?? [];
  const today = new Date();
  const todayDate = today.toISOString().slice(0, 10);
  const yearStart = `${today.getFullYear()}-01-01`;

  const [
    { data: assocs },
    { data: pnlLines },
    { data: bankAccounts },
    { data: bankLines },
    { data: balances },
    { data: bills },
    { data: openWOs },
    { data: viols },
    { data: approvals },
    { data: meetings },
    { data: tasks },
    { data: occupancies },
  ] = await Promise.all([
    db.from('associations').select('id, name').in('id', ids),
    db.from('journal_lines')
      .select('debit_amount, credit_amount, gl_accounts!inner(account_type), journal_entries!inner(entry_date, posted)')
      .in('association_id', ids)
      .in('gl_accounts.account_type', ['income', 'other_income', 'expense', 'other_expense'])
      .eq('journal_entries.posted', true)
      .gte('journal_entries.entry_date', yearStart),
    db.from('bank_accounts').select('gl_account_id, purpose').in('association_id', ids).is('archived_at', null),
    db.from('journal_lines')
      .select('gl_account_id, debit_amount, credit_amount, journal_entries!inner(posted)')
      .in('association_id', ids)
      .eq('journal_entries.posted', true),
    db.from('unit_balances').select('unit_id, unit_number, balance').in('association_id', ids),
    db.from('payable_bills').select('amount, status, due_date, vendors(name)').in('association_id', ids).is('archived_at', null).not('status', 'in', '("paid","void")'),
    db.from('work_orders').select('title, status, priority, scheduled_date, created_at').in('association_id', ids).is('archived_at', null).in('status', OPEN_WO_STATUSES).order('created_at', { ascending: false }),
    db.from('violations').select('id').in('association_id', ids).is('archived_at', null).not('status', 'in', '("closed","cured","violation_dismissed")'),
    db.from('approval_requests').select('title, amount').in('association_id', ids).eq('status', 'pending').limit(10),
    db.from('meetings').select('title, meeting_type, start_time').in('association_id', ids).is('archived_at', null).gte('start_time', today.toISOString()).order('start_time').limit(5),
    db.from('maintenance_tasks').select('task_name, next_due_date').in('association_id', ids).is('archived_at', null).order('next_due_date').limit(15),
    db.from('occupancies').select('unit_id, owners(full_name)').in('association_id', ids).eq('status', 'current'),
  ]);

  let ytdIncome = 0;
  let ytdExpenses = 0;
  for (const l of pnlLines ?? []) {
    const t = l.gl_accounts?.account_type;
    const debit = Number(l.debit_amount ?? 0);
    const credit = Number(l.credit_amount ?? 0);
    if (t === 'income' || t === 'other_income') ytdIncome += credit - debit;
    else ytdExpenses += debit - credit;
  }

  const balByGl = new Map<string, number>();
  for (const l of bankLines ?? []) {
    balByGl.set(l.gl_account_id, (balByGl.get(l.gl_account_id) ?? 0) + Number(l.debit_amount ?? 0) - Number(l.credit_amount ?? 0));
  }
  let operatingBalance = 0;
  let reserveBalance = 0;
  for (const b of bankAccounts ?? []) {
    const bal = b.gl_account_id ? (balByGl.get(b.gl_account_id) ?? 0) : 0;
    if ((b.purpose ?? '').toLowerCase().includes('reserve')) reserveBalance += bal;
    else operatingBalance += bal;
  }

  const ownerByUnit = new Map<string, string | null>(
    (occupancies ?? []).map((o: any) => [o.unit_id, o.owners?.full_name ?? null]),
  );
  const delinquent = (balances ?? [])
    .filter((b: any) => Number(b.balance ?? 0) > 0)
    .sort((a: any, b: any) => Number(b.balance) - Number(a.balance));

  const open = openWOs ?? [];

  return {
    generatedAt: new Date().toISOString(),
    associations: (assocs ?? []).map((a: any) => a.name),
    financials: {
      ytdIncome,
      ytdExpenses,
      netOperatingIncome: ytdIncome - ytdExpenses,
      operatingBalance,
      reserveBalance,
    },
    receivables: {
      totalOutstanding: delinquent.reduce((s: number, b: any) => s + Number(b.balance), 0),
      delinquentUnitCount: delinquent.length,
      delinquentUnits: delinquent.slice(0, 10).map((b: any) => ({
        unit: b.unit_number ?? null,
        owner: ownerByUnit.get(b.unit_id) ?? null,
        balance: Number(b.balance),
      })),
    },
    vendorBills: (bills ?? []).slice(0, 10).map((b: any) => ({
      vendor: b.vendors?.name ?? null,
      amount: Number(b.amount ?? 0),
      status: b.status ?? null,
      dueDate: b.due_date ?? null,
    })),
    workOrders: {
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
    violations: { open: (viols ?? []).length },
    pendingApprovals: (approvals ?? []).map((a: any) => ({
      title: a.title ?? null,
      amount: a.amount != null ? Number(a.amount) : null,
    })),
    upcomingMeetings: (meetings ?? []).map((m: any) => ({
      title: m.title ?? null,
      type: m.meeting_type ?? null,
      when: m.start_time ?? null,
    })),
    statutoryMaintenance: (tasks ?? []).map((t: any) => ({
      task: t.task_name ?? null,
      nextDue: t.next_due_date ?? null,
      overdue: !!(t.next_due_date && t.next_due_date < todayDate),
    })),
  };
}
