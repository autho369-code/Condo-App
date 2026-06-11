import Link from 'next/link';
import { FolderKanban, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// ── Types ──
type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';

const PROJECT_STATUSES: ProjectStatus[] = ['planning', 'active', 'on_hold', 'completed', 'cancelled'];

// ── Helpers ──
function projectStatusChip(s: ProjectStatus | string | null): { label: string; tone: Tone } {
  switch (s) {
    case 'planning':   return { label: 'Planning',   tone: 'info' };
    case 'active':     return { label: 'Active',     tone: 'success' };
    case 'on_hold':    return { label: 'On Hold',    tone: 'warning' };
    case 'completed':  return { label: 'Completed',  tone: 'success' };
    case 'cancelled':  return { label: 'Cancelled',  tone: 'neutral' };
    default:           return { label: s?.replace(/_/g, ' ') ?? '—', tone: 'neutral' };
  }
}

function deriveProjectStatus(statuses: string[]): ProjectStatus {
  const hasActive = statuses.some((s) => ['new', 'assigned', 'scheduled', 'in_progress'].includes(s));
  const allClosed = statuses.every((s) => ['completed', 'closed', 'cancelled'].includes(s));
  if (allClosed) return 'completed';
  if (hasActive) return 'active';
  return 'planning';
}

function formatCurrency(cents: number | null | undefined): string {
  if (cents == null) return '—';
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(dollars);
}

function formatLabel(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Project row type (derived from work_orders grouping) ──
interface ProjectRow {
  id: string;
  name: string;
  association_name: string;
  association_id: string;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  budget: number;
  spent: number;
  work_order_count: number;
  work_order_ids: string[];
}

// ── Page ──
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; association_id?: string }>;
}) {
  await requireStaff();
  const { q = '', status = '', association_id = '' } = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  // ── Fetch work orders + associations + estimates + bills ──
  const [
    { data: workOrders },
    { data: associations },
    { data: estimates },
    { data: bills },
  ] = await Promise.all([
    db.from('work_orders')
      .select('id, title, status, priority, scheduled_date, completed_date, created_at, association_id, associations(name)')
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(1000),
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('work_order_estimates')
      .select('work_order_id, total_amount')
      .is('archived_at', null)
      .limit(5000),
    db.from('payable_bills')
      .select('work_order_id, total_amount, status')
      .is('archived_at', null)
      .in('status', ['approved', 'paid'])
      .limit(5000),
  ]);

  const wos = (workOrders ?? []) as any[];
  const estRows = (estimates ?? []) as any[];
  const billRows = (bills ?? []) as any[];

  // ── Build estimate map: work_order_id → sum of total_amount ──
  const estimateMap: Record<string, number> = {};
  for (const e of estRows) {
    if (e.work_order_id) {
      estimateMap[e.work_order_id] = (estimateMap[e.work_order_id] ?? 0) + (e.total_amount ?? 0);
    }
  }

  // ── Build bill map: work_order_id → sum of total_amount ──
  const billMap: Record<string, number> = {};
  for (const b of billRows) {
    if (b.work_order_id) {
      billMap[b.work_order_id] = (billMap[b.work_order_id] ?? 0) + (b.total_amount ?? 0);
    }
  }

  // ── Group work orders by title + association_id → "projects" ──
  const projectMap = new Map<string, { wos: any[]; name: string; association_id: string; association_name: string }>();
  for (const wo of wos) {
    const key = `${wo.title ?? 'Untitled'}||${wo.association_id}`;
    if (!projectMap.has(key)) {
      projectMap.set(key, {
        wos: [],
        name: wo.title ?? 'Untitled',
        association_id: wo.association_id,
        association_name: wo.associations?.name ?? '—',
      });
    }
    projectMap.get(key)!.wos.push(wo);
  }

  // ── Build project rows ──
  let projects: ProjectRow[] = [];
  for (const [, group] of projectMap) {
    const wosGroup = group.wos;
    const statuses = wosGroup.map((w: any) => w.status);
    const woIds = wosGroup.map((w: any) => w.id);
    const budget = woIds.reduce((sum, id) => sum + (estimateMap[id] ?? 0), 0);
    const spent = woIds.reduce((sum, id) => sum + (billMap[id] ?? 0), 0);
    const startDate = wosGroup
      .map((w: any) => w.scheduled_date ?? w.created_at)
      .filter(Boolean)
      .sort()[0] ?? null;
    const endDate = wosGroup
      .map((w: any) => w.completed_date)
      .filter(Boolean)
      .sort()
      .reverse()[0] ?? null;

    projects.push({
      id: woIds[0],
      name: group.name,
      association_name: group.association_name,
      association_id: group.association_id,
      status: deriveProjectStatus(statuses),
      start_date: startDate,
      end_date: endDate,
      budget,
      spent,
      work_order_count: wosGroup.length,
      work_order_ids: woIds,
    });
  }

  // ── Filter ──
  if (q) {
    const ql = q.toLowerCase();
    projects = projects.filter(
      (p) =>
        p.name.toLowerCase().includes(ql) ||
        p.association_name.toLowerCase().includes(ql),
    );
  }
  if (status) projects = projects.filter((p) => p.status === status);
  if (association_id) projects = projects.filter((p) => p.association_id === association_id);

  // ── Metrics ──
  const activeCount = projects.filter((p) => p.status === 'active').length;
  const planningCount = projects.filter((p) => p.status === 'planning').length;
  const completedCount = projects.filter((p) => p.status === 'completed').length;
  const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0);
  const totalSpent = projects.reduce((sum, p) => sum + p.spent, 0);

  const metrics = [
    { label: 'Active', value: activeCount, sublabel: 'In progress' },
    { label: 'Planning', value: planningCount, sublabel: 'Not yet started' },
    { label: 'Completed', value: completedCount, sublabel: 'All time' },
    { label: 'Budget vs Spent', value: formatCurrency(totalSpent), sublabel: `of ${formatCurrency(totalBudget)} budgeted` },
  ];

  // ── Render ──
  return (
    <DataWorkspace
      title="Projects"
      description="Multi-work-order projects — roof replacements, pool renovations, repaving. Projects group related work orders under one budget and timeline."
      actions={
        <Link href="/projects/new">
          <Button><Plus className="h-4 w-4" /> New project</Button>
        </Link>
      }
    >
      <div className="space-y-6">
        <MetricStrip metrics={metrics} />

        {/* ── FILTER BAR ── */}
        <FilterBar
          action="/projects"
          searchDefault={q}
          searchPlaceholder="Search by project name, association..."
        >
          <FilterSelect label="Status" name="status" defaultValue={status}>
            <option value="">All statuses</option>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>{formatLabel(s)}</option>
            ))}
          </FilterSelect>

          <FilterSelect label="Association" name="association_id" defaultValue={association_id}>
            <option value="">All</option>
            {(associations ?? []).map((a: any) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </FilterSelect>
        </FilterBar>

        {/* ── TABLE ── */}
        {projects.length > 0 ? (
          <Table>
            <THead>
              <TR>
                <TH>Project Name</TH>
                <TH>Association</TH>
                <TH>Status</TH>
                <TH>Start Date</TH>
                <TH>End Date</TH>
                <TH className="text-right">Budget</TH>
                <TH className="text-right">Spent</TH>
              </TR>
            </THead>
            <tbody>
              {projects.map((p) => {
                const sc = projectStatusChip(p.status);
                return (
                  <TR key={p.id} className="cursor-pointer hover:bg-gray-50">
                    <TD>
                      <Link href={`/work-orders?q=${encodeURIComponent(p.name)}`} className="block text-gray-900">
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-gray-500">{p.work_order_count} work order{p.work_order_count !== 1 ? 's' : ''}</div>
                      </Link>
                    </TD>
                    <TD>
                      <Link href={`/associations/${p.association_id}`} className="text-gray-700 hover:text-gray-950 hover:underline">
                        {p.association_name}
                      </Link>
                    </TD>
                    <TD>
                      <StatusChip tone={sc.tone}>{sc.label}</StatusChip>
                    </TD>
                    <TD className="whitespace-nowrap text-sm text-gray-600">{date(p.start_date)}</TD>
                    <TD className="whitespace-nowrap text-sm text-gray-600">{date(p.end_date)}</TD>
                    <TD className="whitespace-nowrap text-right text-sm tabular-nums text-gray-700">{formatCurrency(p.budget)}</TD>
                    <TD className="whitespace-nowrap text-right text-sm tabular-nums text-gray-700">{formatCurrency(p.spent)}</TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={FolderKanban}
              title="No projects match this view"
              description="Create work orders with shared titles to group them into projects."
            />
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}
