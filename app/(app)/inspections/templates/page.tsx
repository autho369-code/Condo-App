import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Alert, EmptyState, SectionTitle, Surface } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { archiveInspectionTemplate, saveInspectionTemplate } from '@/lib/rpcs/inspection-templates';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const asLines = (items: any[]) => (items ?? []).map((i) => (i.area ? `${i.area}: ${i.item}` : i.item)).join('\n');

export default async function InspectionTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; edit?: string }>;
}) {
  const me = await requireStaff();
  if (!me.is_staff) {
    // Templates belong to a management company; platform-operator accounts have none.
    return (
      <DataWorkspace title="Inspection templates" description="Inspection templates are managed inside a management company's workspace.">
        <Alert tone="info" title="Open this from a company account">Platform operator accounts are not tied to a management company, so they have no inspection templates.</Alert>
      </DataWorkspace>
    );
  }
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const { data, error } = await db.from('inspection_templates').select('id, name, inspection_type, items, updated_at').is('archived_at', null).order('name');
  if (error) throw new Error(`Could not load inspection templates: ${error.message}`);
  const templates = (data ?? []) as any[];
  const editing = templates.find((t) => t.id === sp.edit);

  return (
    <DataWorkspace
      title="Inspection templates"
      description="Reusable checklists. Schedule inspections from a template and each one gets the full checklist to rate item by item."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href="/inspections"><Button variant="secondary">All inspections</Button></Link>
          <Link href="/inspections/bulk"><Button>Schedule from a template</Button></Link>
        </div>
      }
    >
      <div className="space-y-4">
        {sp.error && <Alert tone="danger" title="Could not save">{sp.error}</Alert>}
        {sp.saved && <Alert tone="success" title="Template saved" />}

        <Surface>
          <SectionTitle title={editing ? `Edit “${editing.name}”` : 'New template'} description="One checklist item per line. Write “Area: item” to group items, e.g. “Kitchen: Smoke detector works”." />
          <form action={saveInspectionTemplate} className="grid grid-cols-1 gap-4 sm:grid-cols-2" key={editing?.id ?? 'new'}>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <Field label="Name" htmlFor="name"><Input id="name" name="name" required maxLength={200} defaultValue={editing?.name ?? ''} placeholder="Annual unit inspection" /></Field>
            <Field label="Inspection type (optional)" htmlFor="inspection_type"><Input id="inspection_type" name="inspection_type" maxLength={100} defaultValue={editing?.inspection_type ?? ''} placeholder="Annual, Move-in, Common area" /></Field>
            <Field label="Checklist" htmlFor="items" className="sm:col-span-2">
              <Textarea id="items" name="items" required rows={10} defaultValue={editing ? asLines(editing.items) : ''} placeholder={'Kitchen: Sink and faucet — no leaks\nKitchen: Smoke detector works\nBathroom: Caulking intact\nBalcony: Railing secure'} />
            </Field>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit">{editing ? 'Save changes' : 'Create template'}</Button>
              {editing && <Link href="/inspections/templates"><Button type="button" variant="ghost">Cancel</Button></Link>}
            </div>
          </form>
        </Surface>

        {templates.length === 0 ? (
          <Surface padded={false}>
            <EmptyState icon={ClipboardList} title="No templates yet" description="Create your first checklist above — annual unit walk-throughs, common-area safety checks, move-in condition reports." />
          </Surface>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Template</TH>
                <TH>Type</TH>
                <TH className="text-right">Items</TH>
                <TH><span className="sr-only">Actions</span></TH>
              </tr>
            </THead>
            <tbody>
              {templates.map((t) => (
                <TR key={t.id}>
                  <TD className="font-medium text-gray-950">{t.name}</TD>
                  <TD className="text-gray-600">{t.inspection_type ?? '—'}</TD>
                  <TD className="text-right tabular-nums">{(t.items ?? []).length}</TD>
                  <TD className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Link href={`/inspections/templates?edit=${t.id}`}><Button variant="ghost" size="sm">Edit</Button></Link>
                      <form action={archiveInspectionTemplate}>
                        <input type="hidden" name="id" value={t.id} />
                        <Button type="submit" variant="ghost" size="sm">Archive</Button>
                      </form>
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </DataWorkspace>
  );
}
