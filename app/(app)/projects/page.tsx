import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
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
        <Link href="/projects/new" className="rounded bg-gray-950 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
          + New project
        </Link>
      }
      rail={<ProjectsRail />}
    >
      <div className="space-y-6">
        <MetricStrip metrics={metrics} />

        {/* ── FILTER BAR ── */}
        <FilterBar
          action="/projects"
          searchDefault={q}
          searchPlaceholder="Search by project name, association..."
        >
          <label className="text-xs font-medium uppercase text-gray-500">
            Status
            <select
              name="status"
              defaultValue={status}
              className="mt-1 h-9 rounded border border-gray-300 bg-white px-3 text-sm normal-case text-gray-900"
            >
              <option value="">All statuses</option>
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>{formatLabel(s)}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium uppercase text-gray-500">
            Association
            <select
              name="association_id"
              defaultValue={association_id}
              className="mt-1 h-9 max-w-[200px] rounded border border-gray-300 bg-white px-3 text-sm normal-case text-gray-900"
            >
              <option value="">All</option>
              {(associations ?? []).map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
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
                      <Link href={`/work-orders?q=${encodeURIComponent(p.name)}`} className="block text-gray-900 hover:text-brand-700">
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-gray-500">{p.work_order_count} work order{p.work_order_count !== 1 ? 's' : ''}</div>
                      </Link>
                    </TD>
                    <TD className="text-sm text-gray-700">
                      <Link href={`/associations/${p.association_id}`} className="text-blue-700 hover:underline">
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
          <p className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
            No projects match this view. Create work orders with shared titles to group them into projects.
          </p>
        )}
      </div>
    </DataWorkspace>
  );
}

// ── DataWorkspace Rail ──
function ProjectsRail() {
  return (
    <div className="space-y-5">
      <section>
        <h2 className="text-sm font-semibold text-gray-950">Tasks</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href="/projects/new" label="New Project" />
          <RailLink href="/work-orders/new" label="New Work Order" />
          <RailLink href="/purchase-orders/new" label="New Purchase Order" />
        </div>
      </section>
      <section className="border-t border-gray-200 pt-5">
        <h2 className="text-sm font-semibold text-gray-950">Reports</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href="/reports?slug=project-status" label="Project Status" />
          <RailLink href="/reports?slug=project-directory" label="Project Directory" />
          <RailLink href="/reports?slug=work-order" label="Work Order Report" />
        </div>
      </section>
      <section className="border-t border-gray-200 pt-5">
        <h2 className="text-sm font-semibold text-gray-950">Quick Links</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href="/work-orders" label="Work Orders" />
          <RailLink href="/purchase-orders" label="Purchase Orders" />
          <RailLink href="/vendors" label="Vendors" />
          <RailLink href="/recurring-work-orders" label="Recurring Work Orders" />
        </div>
      </section>
    </div>
  );
}

function RailLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
    >
      {label}
    </Link>
  );
}
