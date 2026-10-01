import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Alert, Surface } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { scheduleInspectionsFromTemplate } from '@/lib/rpcs/inspection-templates';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ScheduleFromTemplatePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const [{ data: associations }, { data: templates }] = await Promise.all([
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('inspection_templates').select('id, name, items').is('archived_at', null).order('name'),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const list = (templates ?? []) as any[];

  return (
    <DataWorkspace
      title="Schedule from a template"
      description="Create one property-wide inspection, or one inspection for every unit in the association, each with the template's checklist."
      actions={<Link href="/inspections/templates"><Button variant="secondary">Manage templates</Button></Link>}
    >
      <div className="max-w-2xl space-y-4">
        {sp.error && <Alert tone="danger" title="Could not schedule">{sp.error}</Alert>}
        {list.length === 0 ? (
          <Alert tone="info" title="No templates yet">
            <Link href="/inspections/templates" className="font-medium underline">Create a template</Link> first, then come back to schedule inspections from it.
          </Alert>
        ) : (
          <Surface>
            <form action={scheduleInspectionsFromTemplate} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Template" htmlFor="template_id">
                <Select id="template_id" name="template_id" required defaultValue="">
                  <option value="">Choose a template</option>
                  {list.map((t) => <option key={t.id} value={t.id}>{t.name} ({(t.items ?? []).length} items)</option>)}
                </Select>
              </Field>
              <Field label="Association" htmlFor="association_id">
                <Select id="association_id" name="association_id" required defaultValue="">
                  <option value="">Choose an association</option>
                  {((associations ?? []) as any[]).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </Field>
              <Field label="Inspect" htmlFor="scope">
                <Select id="scope" name="scope" defaultValue="property">
                  <option value="property">The property (one inspection)</option>
                  <option value="units">Every unit (one inspection per unit)</option>
                </Select>
              </Field>
              <Field label="Scheduled date" htmlFor="scheduled_date"><Input id="scheduled_date" name="scheduled_date" type="date" defaultValue={today} /></Field>
              <Field label="Inspection type (optional)" htmlFor="inspection_type" className="sm:col-span-2"><Input id="inspection_type" name="inspection_type" maxLength={100} placeholder="Defaults to the template's type" /></Field>
              <Field label="Notes (optional)" htmlFor="notes" className="sm:col-span-2"><Textarea id="notes" name="notes" rows={3} /></Field>
              <div className="sm:col-span-2"><Button type="submit">Schedule inspections</Button></div>
            </form>
          </Surface>
        )}
      </div>
    </DataWorkspace>
  );
}
