import Link from 'next/link';
import { FolderKanban, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STATUSES = ['planning', 'board_review', 'approved', 'active', 'on_hold', 'completed', 'cancelled'];

function currency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function projectTone(status: string): Tone {
  if (['approved', 'active', 'completed'].includes(status)) return 'success';
  if (['board_review', 'on_hold'].includes(status)) return 'warning';
  if (status === 'cancelled') return 'neutral';
  return 'info';
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; association_id?: string }>;
}) {
  await requireStaff();
  const { q = '', status = '', association_id = '' } = await searchParams;
  const db = (await createClient()) as any;

  const [{ data: projectRows }, { data: associations }, { data: financialRows }] = await Promise.all([
    db.from('capital_projects')
      .select('id, name, description, status, priority, start_date, target_end_date, budget_amount, contingency_amount, approved_budget_amount, board_approval_required, updated_at, association_id, associations(name)')
      .is('archived_at', null)
      .order('updated_at', { ascending: false })
      .limit(500),
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('capital_project_financials').select('project_id, work_order_count, committed_spend').limit(500),
  ]);

  const financials = new Map((financialRows ?? []).map((row: any) => [row.project_id, row]));

  let projects = (projectRows ?? []).map((project: any) => {
    const totals: any = financials.get(project.id);
    return {
      ...project,
      work_order_count: Number(totals?.work_order_count ?? 0),
      spent: Number(totals?.committed_spend ?? 0),
    };
  });

  if (q) {
    const needle = q.toLowerCase();
    projects = projects.filter((project: any) =>
      project.name.toLowerCase().includes(needle)
      || (project.description ?? '').toLowerCase().includes(needle)
      || (project.associations?.name ?? '').toLowerCase().includes(needle));
  }
  if (status) projects = projects.filter((project: any) => project.status === status);
  if (association_id) projects = projects.filter((project: any) => project.association_id === association_id);

  const totalBudget = projects.reduce((sum: number, project: any) => sum + Number(project.approved_budget_amount ?? project.budget_amount ?? 0), 0);
  const totalSpent = projects.reduce((sum: number, project: any) => sum + project.spent, 0);

  return (
    <DataWorkspace
      title="Capital Projects"
      description="Control multi-work-order projects with independent budgets, milestones, board approval, and cost visibility."
      actions={<Link href="/projects/new"><Button><Plus className="h-4 w-4" /> New project</Button></Link>}
    >
      <div className="space-y-6">
        <MetricStrip metrics={[
          { label: 'Active', value: projects.filter((p: any) => p.status === 'active').length, sublabel: 'In execution' },
          { label: 'Awaiting approval', value: projects.filter((p: any) => ['board_review', 'approved'].includes(p.status)).length, sublabel: 'Governance queue' },
          { label: 'Approved budget', value: currency(totalBudget), sublabel: 'Current view' },
          { label: 'Committed spend', value: currency(totalSpent), sublabel: totalBudget ? `${Math.round((totalSpent / totalBudget) * 100)}% of budget` : 'No budget set' },
        ]} />

        <FilterBar action="/projects" searchDefault={q} searchPlaceholder="Search projects and associations">
          <FilterSelect label="Status" name="status" defaultValue={status}>
            <option value="">All statuses</option>
            {STATUSES.map((value) => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}
          </FilterSelect>
          <FilterSelect label="Association" name="association_id" defaultValue={association_id}>
            <option value="">All associations</option>
            {(associations ?? []).map((association: any) => <option key={association.id} value={association.id}>{association.name}</option>)}
          </FilterSelect>
        </FilterBar>

        {projects.length ? (
          <Table>
            <THead><TR><TH>Project</TH><TH>Association</TH><TH>Status</TH><TH>Timeline</TH><TH className="text-right">Budget</TH><TH className="text-right">Spent</TH></TR></THead>
            <tbody>
              {projects.map((project: any) => (
                <TR key={project.id}>
                  <TD>
                    <Link href={`/projects/${project.id}`} className="block text-gray-900">
                      <div className="font-medium">{project.name}</div>
                      <div className="text-xs text-gray-500">{project.work_order_count} linked work order{project.work_order_count === 1 ? '' : 's'}</div>
                    </Link>
                  </TD>
                  <TD className="text-sm text-gray-700">{project.associations?.name ?? '—'}</TD>
                  <TD><StatusChip tone={projectTone(project.status)}>{project.status.replace(/_/g, ' ')}</StatusChip></TD>
                  <TD className="whitespace-nowrap text-sm text-gray-600">{date(project.start_date)} – {date(project.target_end_date)}</TD>
                  <TD className="text-right tabular-nums">{currency(Number(project.approved_budget_amount ?? project.budget_amount ?? 0))}</TD>
                  <TD className="text-right tabular-nums">{currency(project.spent)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState icon={FolderKanban} title="No capital projects match this view" description="Create a project to coordinate its budget, milestones, approvals, and work orders." />
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}
