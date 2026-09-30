import Link from 'next/link';
import { Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { date, money } from '@/lib/utils';
import { buildTeamScoreboard } from '@/lib/maintenance/team-performance';

export const dynamic = 'force-dynamic';

const WINDOWS = [30, 90, 365] as const;
const CLOSED = '("done","completed","billed","closed","cancelled")';

export default async function MaintenanceTeamPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const days = WINDOWS.find((d) => String(d) === sp.days) ?? 30;
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const db = (await createClient()) as any;

  // Open work orders (any age) + everything completed inside the window.
  const [{ data: staffRows }, { data: workOrders }, { data: labor }] = await Promise.all([
    db.rpc('mentionable_staff'),
    db.from('work_orders')
      .select('id, assignee_id, vendor_id, status, priority, created_at, scheduled_date, completed_date')
      .is('archived_at', null)
      .or(`status.not.in.${CLOSED},completed_date.gte.${since}`)
      .limit(10000),
    db.from('work_order_labor_entries')
      .select('tech_id, tech_name, date_worked, hours, labor_cost')
      .gte('date_worked', since)
      .limit(20000),
  ]);

  const board = buildTeamScoreboard({
    staff: (staffRows ?? []) as Array<{ id: string; name: string }>,
    workOrders: workOrders ?? [],
    labor: labor ?? [],
    since,
    today,
  });
  const totals = board.members.reduce(
    (t, m) => ({ open: t.open + m.open, overdue: t.overdue + m.overdue, completed: t.completed + m.completed, hours: t.hours + m.hours }),
    { open: 0, overdue: 0, completed: 0, hours: 0 },
  );

  return (
    <DataWorkspace
      title="Maintenance team"
      description="What each in-house team member has open, what they finished, how fast, and the labor they logged. Vendors have their own scorecards."
      actions={<Link href="/vendors"><Button variant="secondary">Vendor scorecards</Button></Link>}
    >
      <div className="space-y-6">
        <FilterBar action="/work-orders/team">
          <FilterSelect label="Period" name="days" defaultValue={String(days)}>
            {WINDOWS.map((d) => <option key={d} value={d}>Last {d} days</option>)}
          </FilterSelect>
        </FilterBar>

        <MetricStrip metrics={[
          { label: 'Open with the team', value: totals.open, sublabel: `${totals.overdue} past their scheduled date` },
          { label: `Completed · ${days}d`, value: totals.completed, sublabel: 'By in-house staff' },
          { label: `Hours logged · ${days}d`, value: Math.round(totals.hours * 10) / 10, sublabel: 'From labor entries' },
          { label: 'Nobody on it', value: board.unassignedOpen, sublabel: <Link href="/work-orders?tab=unassigned" className="hover:underline">Open, no staff or vendor →</Link> },
        ]} />

        {board.members.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/70 bg-white">
            <EmptyState icon={Users} title="No team activity yet"
              description="Assign work orders to a team member (In-house assignee on the work order) and log labor against them to see them here." />
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Team member</TH>
                <TH className="text-right">Open</TH>
                <TH className="text-right">Overdue</TH>
                <TH className="text-right">Completed</TH>
                <TH className="text-right">Avg days to complete</TH>
                <TH className="text-right">Hours</TH>
                <TH className="text-right">Labor cost</TH>
                <TH>Last worked</TH>
              </TR>
            </THead>
            <tbody>
              {board.members.map((m) => (
                <TR key={m.id}>
                  <TD>
                    <Link href={`/work-orders?assignee=${m.id}&tab=all`} className="font-medium text-gray-900 hover:underline">{m.name}</Link>
                    {m.emergenciesCompleted > 0 ? <div className="mt-0.5 text-xs text-gray-500">{m.emergenciesCompleted} emergenc{m.emergenciesCompleted === 1 ? 'y' : 'ies'} handled</div> : null}
                  </TD>
                  <TD className="text-right tabular-nums">{m.open}</TD>
                  <TD className="text-right">{m.overdue > 0 ? <StatusChip tone="danger">{m.overdue}</StatusChip> : <span className="tabular-nums text-gray-400">0</span>}</TD>
                  <TD className="text-right tabular-nums">{m.completed}</TD>
                  <TD className="text-right tabular-nums">{m.averageDaysToComplete ?? '—'}</TD>
                  <TD className="text-right tabular-nums">{m.hours}</TD>
                  <TD className="text-right tabular-nums">{m.laborCost ? money(m.laborCost) : '—'}</TD>
                  <TD className="text-sm text-gray-600">{m.lastWorked ? date(m.lastWorked) : '—'}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}

        {board.otherLabor.length > 0 ? (
          <section className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="border-b border-gray-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-gray-900">Other labor</h2>
              <p className="mt-0.5 text-xs text-gray-500">Hours logged under a typed name rather than a team member.</p>
            </div>
            <ul className="divide-y divide-gray-100">
              {board.otherLabor.map((o) => (
                <li key={o.name} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <span className="text-gray-900">{o.name}</span>
                  <span className="tabular-nums text-gray-600">{o.hours} h{o.laborCost ? ` · ${money(o.laborCost)}` : ''}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </DataWorkspace>
  );
}
