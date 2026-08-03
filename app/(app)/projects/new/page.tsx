import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Alert, Surface } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await requireStaff();
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const [{ data: associations }, { data: components }, { data: managers }] = await Promise.all([
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('reserve_components').select('id, name, association_id').order('name'),
    db.from('profiles').select('id, full_name, email').eq('portfolio_id', me.portfolio?.id).is('disabled_at', null).order('full_name'),
  ]);

  async function createProject(formData: FormData) {
    'use server';
    const current = await requireStaff();
    const supabase = await createClient();
    const name = String(formData.get('name') ?? '').trim();
    const associationId = String(formData.get('association_id') ?? '');
    if (!name || !associationId) redirect('/projects/new?error=' + encodeURIComponent('Project name and association are required.'));
    const numeric = (key: string) => {
      const value = Number(formData.get(key) ?? 0);
      return Number.isFinite(value) && value >= 0 ? value : 0;
    };
    const { data, error } = await (supabase as any).from('capital_projects').insert({
      portfolio_id: current.portfolio?.id,
      association_id: associationId,
      reserve_component_id: String(formData.get('reserve_component_id') ?? '') || null,
      name,
      description: String(formData.get('description') ?? '').trim() || null,
      status: String(formData.get('status') ?? 'planning'),
      priority: String(formData.get('priority') ?? 'standard'),
      start_date: String(formData.get('start_date') ?? '') || null,
      target_end_date: String(formData.get('target_end_date') ?? '') || null,
      budget_amount: numeric('budget_amount'),
      contingency_amount: numeric('contingency_amount'),
      board_approval_required: formData.get('board_approval_required') === 'on',
      manager_user_id: String(formData.get('manager_user_id') ?? '') || null,
      notes: String(formData.get('notes') ?? '').trim() || null,
      created_by: current.auth_user_id,
    }).select('id').single();
    if (error || !data) redirect('/projects/new?error=' + encodeURIComponent(error?.message ?? 'Could not create project.'));
    redirect(`/projects/${data.id}`);
  }

  return (
    <DataWorkspace title="New Capital Project" description="Create the durable project record before linking work orders and milestones." actions={<Link href="/projects"><Button variant="secondary">Back to projects</Button></Link>}>
      <Surface className="max-w-4xl">
        <form action={createProject} className="space-y-5">
          {sp.error && <Alert title="Could not create project">{sp.error}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Project name" htmlFor="name" required><Input id="name" name="name" required maxLength={200} /></Field>
            <Field label="Association" htmlFor="association_id" required>
              <Select id="association_id" name="association_id" required><option value="">Select association</option>{(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
            </Field>
          </div>
          <Field label="Scope and outcome" htmlFor="description"><Textarea id="description" name="description" rows={4} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Status" htmlFor="status"><Select id="status" name="status" defaultValue="planning"><option value="planning">Planning</option><option value="board_review">Board review</option><option value="approved">Approved</option><option value="active">Active</option><option value="on_hold">On hold</option></Select></Field>
            <Field label="Priority" htmlFor="priority"><Select id="priority" name="priority" defaultValue="standard"><option value="critical">Critical</option><option value="high">High</option><option value="standard">Standard</option><option value="deferred">Deferred</option></Select></Field>
            <Field label="Project manager" htmlFor="manager_user_id"><Select id="manager_user_id" name="manager_user_id"><option value="">Unassigned</option>{(managers ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>)}</Select></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date" htmlFor="start_date"><Input id="start_date" name="start_date" type="date" /></Field>
            <Field label="Target completion" htmlFor="target_end_date"><Input id="target_end_date" name="target_end_date" type="date" /></Field>
            <Field label="Working budget" htmlFor="budget_amount"><Input id="budget_amount" name="budget_amount" type="number" min="0" step="0.01" defaultValue="0" /></Field>
            <Field label="Contingency" htmlFor="contingency_amount"><Input id="contingency_amount" name="contingency_amount" type="number" min="0" step="0.01" defaultValue="0" /></Field>
          </div>
          <Field label="Reserve component" htmlFor="reserve_component_id" hint="Optional link back to the approved reserve study component."><Select id="reserve_component_id" name="reserve_component_id"><option value="">Not linked</option>{(components ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700"><input type="checkbox" name="board_approval_required" className="h-4 w-4 rounded border-gray-300" /> Require recorded board approval before activation</label>
          <Field label="Internal notes" htmlFor="notes"><Textarea id="notes" name="notes" /></Field>
          <div className="flex gap-3 border-t border-gray-100 pt-5"><Button type="submit">Create project</Button><Link href="/projects"><Button type="button" variant="secondary">Cancel</Button></Link></div>
        </form>
      </Surface>
    </DataWorkspace>
  );
}
