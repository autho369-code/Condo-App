import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { hasPortfolioAdminAccess, requirePortfolioAdmin, requireStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { Alert, Badge } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function currency(value: unknown) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value ?? 0));
}

function queryMessage(id: string, key: 'error' | 'saved', value: string) {
  redirect(`/projects/${id}?${key}=${encodeURIComponent(value)}`);
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const me = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const db = (await createClient()) as any;

  const [{ data: project }, { data: milestones }, { data: links }, { data: allWorkOrders }] = await Promise.all([
    db.from('capital_projects').select('*, associations(name), profiles:manager_user_id(full_name, email), reserve_components(name)').eq('id', id).maybeSingle(),
    db.from('capital_project_milestones').select('*').eq('project_id', id).order('sort_order').order('due_date'),
    db.from('capital_project_work_orders').select('work_order_id, work_orders(id, number, title, status, priority, scheduled_date, completed_date)').eq('project_id', id),
    db.from('work_orders').select('id, number, title, status, association_id').is('archived_at', null).order('created_at', { ascending: false }).limit(500),
  ]);
  if (!project) notFound();

  const linkedIds = new Set((links ?? []).map((link: any) => link.work_order_id));
  const availableWorkOrders = (allWorkOrders ?? []).filter((wo: any) => wo.association_id === project.association_id && !linkedIds.has(wo.id));
  const { data: financials } = await db.from('capital_project_financials').select('committed_spend').eq('project_id', id).maybeSingle();
  const spent = Number(financials?.committed_spend ?? 0);
  const budget = Number(project.approved_budget_amount ?? project.budget_amount ?? 0);

  async function updateProject(formData: FormData) {
    'use server';
    const current = await requireStaff();
    const supabase = await createClient();
    const projectId = String(formData.get('project_id') ?? '');
    const number = (key: string) => {
      const value = Number(formData.get(key) ?? 0);
      return Number.isFinite(value) && value >= 0 ? value : 0;
    };
    const updates: Record<string, unknown> = {
      status: String(formData.get('status') ?? 'planning'),
      priority: String(formData.get('priority') ?? 'standard'),
      start_date: String(formData.get('start_date') ?? '') || null,
      target_end_date: String(formData.get('target_end_date') ?? '') || null,
      budget_amount: number('budget_amount'),
      contingency_amount: number('contingency_amount'),
      notes: String(formData.get('notes') ?? '').trim() || null,
    };
    if (hasPortfolioAdminAccess(current) && formData.has('approved_budget_amount')) {
      updates.approved_budget_amount = String(formData.get('approved_budget_amount') ?? '') ? number('approved_budget_amount') : null;
    }
    const { error } = await (supabase as any).from('capital_projects').update(updates).eq('id', projectId);
    if (error) queryMessage(projectId, 'error', error.message);
    revalidatePath(`/projects/${projectId}`);
    queryMessage(projectId, 'saved', 'Project controls updated.');
  }

  async function recordBoardApproval(formData: FormData) {
    'use server';
    const current = await requirePortfolioAdmin();
    const supabase = await createClient();
    const projectId = String(formData.get('project_id') ?? '');
    const approvedBudget = Number(formData.get('approved_budget_amount') ?? 0);
    if (!Number.isFinite(approvedBudget) || approvedBudget < 0) queryMessage(projectId, 'error', 'Enter a valid approved budget.');
    const { error } = await (supabase as any).from('capital_projects').update({
      board_approved_at: new Date().toISOString(),
      board_approved_by: current.auth_user_id,
      approved_budget_amount: approvedBudget,
      status: 'approved',
    }).eq('id', projectId);
    if (error) queryMessage(projectId, 'error', error.message);
    revalidatePath(`/projects/${projectId}`);
    queryMessage(projectId, 'saved', 'Board approval recorded.');
  }

  async function addMilestone(formData: FormData) {
    'use server';
    await requireStaff();
    const supabase = await createClient();
    const projectId = String(formData.get('project_id') ?? '');
    const title = String(formData.get('title') ?? '').trim();
    if (!title) queryMessage(projectId, 'error', 'Milestone title is required.');
    const { error } = await (supabase as any).from('capital_project_milestones').insert({
      project_id: projectId,
      title,
      due_date: String(formData.get('due_date') ?? '') || null,
      notes: String(formData.get('notes') ?? '').trim() || null,
    });
    if (error) queryMessage(projectId, 'error', error.message);
    revalidatePath(`/projects/${projectId}`);
    queryMessage(projectId, 'saved', 'Milestone added.');
  }

  async function setMilestoneStatus(formData: FormData) {
    'use server';
    await requireStaff();
    const supabase = await createClient();
    const projectId = String(formData.get('project_id') ?? '');
    const milestoneId = String(formData.get('milestone_id') ?? '');
    const status = String(formData.get('status') ?? 'pending');
    const { error } = await (supabase as any).from('capital_project_milestones').update({
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
    }).eq('id', milestoneId).eq('project_id', projectId);
    if (error) queryMessage(projectId, 'error', error.message);
    revalidatePath(`/projects/${projectId}`);
    redirect(`/projects/${projectId}`);
  }

  async function linkWorkOrder(formData: FormData) {
    'use server';
    await requireStaff();
    const supabase = await createClient();
    const projectId = String(formData.get('project_id') ?? '');
    const workOrderId = String(formData.get('work_order_id') ?? '');
    if (!workOrderId) queryMessage(projectId, 'error', 'Select a work order to link.');
    const { error } = await (supabase as any).from('capital_project_work_orders').insert({ project_id: projectId, work_order_id: workOrderId });
    if (error) queryMessage(projectId, 'error', error.message);
    revalidatePath(`/projects/${projectId}`);
    queryMessage(projectId, 'saved', 'Work order linked.');
  }

  async function unlinkWorkOrder(formData: FormData) {
    'use server';
    await requireStaff();
    const supabase = await createClient();
    const projectId = String(formData.get('project_id') ?? '');
    const workOrderId = String(formData.get('work_order_id') ?? '');
    const { error } = await (supabase as any).from('capital_project_work_orders').delete().eq('project_id', projectId).eq('work_order_id', workOrderId);
    if (error) queryMessage(projectId, 'error', error.message);
    revalidatePath(`/projects/${projectId}`);
    redirect(`/projects/${projectId}`);
  }

  return (
    <Workspace header={<WorkspaceHeader eyebrow={<><Link href="/projects" className="hover:text-gray-700">Capital projects</Link> · {project.associations?.name}</>} title={project.name} subtitle={project.description ?? 'No project scope recorded.'} actions={<Badge status={project.status}>{project.status.replace(/_/g, ' ')}</Badge>} />}>
      {sp.error && <Alert className="mb-5" title="Could not update project">{sp.error}</Alert>}
      {sp.saved && <Alert className="mb-5" tone="success">{sp.saved}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-200/70 bg-white p-4"><div className="text-xs text-gray-500">Approved budget</div><div className="mt-1 text-xl font-semibold tabular-nums">{currency(budget)}</div></div>
        <div className="rounded-2xl border border-gray-200/70 bg-white p-4"><div className="text-xs text-gray-500">Committed spend</div><div className="mt-1 text-xl font-semibold tabular-nums">{currency(spent)}</div></div>
        <div className="rounded-2xl border border-gray-200/70 bg-white p-4"><div className="text-xs text-gray-500">Remaining</div><div className="mt-1 text-xl font-semibold tabular-nums">{currency(budget - spent)}</div></div>
        <div className="rounded-2xl border border-gray-200/70 bg-white p-4"><div className="text-xs text-gray-500">Milestones</div><div className="mt-1 text-xl font-semibold tabular-nums">{(milestones ?? []).filter((m: any) => m.status === 'completed').length}/{(milestones ?? []).length}</div></div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div>
          <Section title="Milestones" subtitle="Sequence, deadline, and blocker visibility for every project phase." padded>
            {(milestones ?? []).length ? <div className="space-y-3">{(milestones ?? []).map((milestone: any) => (
              <form action={setMilestoneStatus} key={milestone.id} className="flex flex-col gap-3 rounded-xl border border-gray-200 p-3 sm:flex-row sm:items-center">
                <input type="hidden" name="project_id" value={id} /><input type="hidden" name="milestone_id" value={milestone.id} />
                <div className="min-w-0 flex-1"><div className="font-medium text-gray-900">{milestone.title}</div><div className="text-xs text-gray-500">Due {date(milestone.due_date)}{milestone.notes ? ` · ${milestone.notes}` : ''}</div></div>
                <Select name="status" defaultValue={milestone.status} className="sm:w-40"><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></Select>
                <Button type="submit" variant="secondary">Save</Button>
              </form>
            ))}</div> : <p className="text-sm text-gray-500">No milestones yet.</p>}
            <form action={addMilestone} className="mt-5 grid gap-3 border-t border-gray-100 pt-5 sm:grid-cols-[minmax(0,1fr)_180px_auto]">
              <input type="hidden" name="project_id" value={id} /><Input name="title" required placeholder="New milestone" /><Input name="due_date" type="date" /><Button type="submit">Add</Button><Textarea name="notes" placeholder="Acceptance criteria or dependency" className="sm:col-span-3" />
            </form>
          </Section>

          <Section title="Linked work orders" subtitle="Project spend is derived from approved and paid bills on these work orders." padded>
            {(links ?? []).length ? <Table><THead><TR><TH>Work order</TH><TH>Status</TH><TH>Priority</TH><TH className="w-24"></TH></TR></THead><tbody>{(links ?? []).map((link: any) => {
              const wo = Array.isArray(link.work_orders) ? link.work_orders[0] : link.work_orders;
              return <TR key={link.work_order_id}><TD><Link href={`/work-orders/${link.work_order_id}`} className="font-medium text-gray-900 hover:text-blue-700">#{wo?.number ?? link.work_order_id.slice(0, 8)} · {wo?.title}</Link></TD><TD><Badge status={wo?.status} /></TD><TD className="capitalize">{wo?.priority ?? '—'}</TD><TD><form action={unlinkWorkOrder}><input type="hidden" name="project_id" value={id} /><input type="hidden" name="work_order_id" value={link.work_order_id} /><Button type="submit" variant="ghost">Unlink</Button></form></TD></TR>;
            })}</tbody></Table> : <p className="text-sm text-gray-500">No work orders linked yet.</p>}
            <form action={linkWorkOrder} className="mt-5 flex flex-col gap-3 border-t border-gray-100 pt-5 sm:flex-row">
              <input type="hidden" name="project_id" value={id} /><Select name="work_order_id" className="flex-1"><option value="">Select an existing association work order</option>{availableWorkOrders.map((wo: any) => <option key={wo.id} value={wo.id}>#{wo.number ?? wo.id.slice(0, 8)} · {wo.title}</option>)}</Select><Button type="submit">Link work order</Button><Link href={`/work-orders/new?association=${project.association_id}`}><Button type="button" variant="secondary">Create work order</Button></Link>
            </form>
          </Section>
        </div>

        <div>
          <Section title="Project controls" padded>
            <form action={updateProject} className="space-y-4">
              <input type="hidden" name="project_id" value={id} />
              <Field label="Status"><Select name="status" defaultValue={project.status}><option value="planning">Planning</option><option value="board_review">Board review</option><option value="approved">Approved</option><option value="active">Active</option><option value="on_hold">On hold</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></Select></Field>
              <Field label="Priority"><Select name="priority" defaultValue={project.priority}><option value="critical">Critical</option><option value="high">High</option><option value="standard">Standard</option><option value="deferred">Deferred</option></Select></Field>
              <div className="grid grid-cols-2 gap-3"><Field label="Start"><Input name="start_date" type="date" defaultValue={project.start_date ?? ''} /></Field><Field label="Target"><Input name="target_end_date" type="date" defaultValue={project.target_end_date ?? ''} /></Field></div>
              <Field label="Working budget"><Input name="budget_amount" type="number" min="0" step="0.01" defaultValue={project.budget_amount} /></Field>
              <Field label="Contingency"><Input name="contingency_amount" type="number" min="0" step="0.01" defaultValue={project.contingency_amount} /></Field>
              {hasPortfolioAdminAccess(me) && <Field label="Approved budget"><Input name="approved_budget_amount" type="number" min="0" step="0.01" defaultValue={project.approved_budget_amount ?? ''} /></Field>}
              <Field label="Notes"><Textarea name="notes" defaultValue={project.notes ?? ''} /></Field>
              <Button type="submit">Save controls</Button>
            </form>
          </Section>

          {project.board_approval_required && !project.board_approved_at && <Section title="Board approval gate" subtitle="Activation is blocked in the database until approval is recorded." padded>{hasPortfolioAdminAccess(me) ? <form action={recordBoardApproval} className="space-y-3"><input type="hidden" name="project_id" value={id} /><Field label="Approved budget"><Input name="approved_budget_amount" type="number" min="0" step="0.01" defaultValue={project.budget_amount} required /></Field><Button type="submit">Record board approval</Button></form> : <Alert title="Administrator approval required">A portfolio administrator must verify the board record and approved budget.</Alert>}</Section>}
          {project.board_approved_at && <Section title="Governance record" padded><dl className="space-y-2 text-sm"><div><dt className="text-gray-500">Approved</dt><dd>{date(project.board_approved_at)}</dd></div><div><dt className="text-gray-500">Reserve component</dt><dd>{project.reserve_components?.name ?? 'Not linked'}</dd></div><div><dt className="text-gray-500">Project manager</dt><dd>{project.profiles?.full_name ?? project.profiles?.email ?? 'Unassigned'}</dd></div></dl></Section>}
        </div>
      </div>
    </Workspace>
  );
}
