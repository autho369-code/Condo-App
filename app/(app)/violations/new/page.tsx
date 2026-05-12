import Link from 'next/link';
import type { ReactNode } from 'react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/me';
import { createViolation } from '@/lib/rpcs/violations';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const typeOptions = ['noise', 'parking', 'pets', 'exterior_modification', 'trash_debris', 'landscaping', 'common_area_misuse', 'lease_violation', 'assessment_delinquency', 'other'];

export default async function NewViolationPage() {
  await requireStaff();
  const supabase = await createClient();
  const [{ data: associations }, { data: units }, { data: owners }] = await Promise.all([
    (supabase as any).from('associations').select('id, name').is('archived_at', null).order('name'),
    (supabase as any).from('units').select('id, unit_number').is('archived_at', null).order('unit_number').limit(500),
    (supabase as any).from('owners').select('id, full_name').is('archived_at', null).order('full_name').limit(500),
  ]);

  return (
    <DataWorkspace
      title="New violation"
      description="Draft a violation record with scope, rule, cure deadline, fine, and evidence preview before sending any notice."
      actions={<Link href="/violations" className="text-sm font-medium text-ink-600 hover:text-ink-900">Cancel</Link>}
      rail={<NoticePreview />}
    >
      <form action={createViolation} className="space-y-5">
        <Section title="Association, unit, and owner">
          <div className="grid gap-4 md:grid-cols-3">
            <Select name="association_id" label="Association" required options={(associations ?? []).map((row: any) => ({ value: row.id, label: row.name }))} />
            <Select name="unit_id" label="Unit" options={(units ?? []).map((row: any) => ({ value: row.id, label: row.unit_number }))} />
            <Select name="owner_id" label="Owner" options={(owners ?? []).map((row: any) => ({ value: row.id, label: row.full_name }))} />
          </div>
        </Section>
        <Section title="Rule and violation">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-ink-700">Rule/type<select name="violation_type" className="mt-1 h-10 w-full rounded border border-ink-200 bg-white px-3 text-sm">{typeOptions.map((type) => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}</select></label>
            <label className="text-sm font-medium text-ink-700">Title<input name="title" required className="mt-1 h-10 w-full rounded border border-ink-200 px-3 text-sm" placeholder="Parking violation, noise complaint..." /></label>
          </div>
          <textarea name="description" className="mt-4 w-full rounded border border-ink-200 px-3 py-2 text-sm" rows={4} placeholder="Observation details and governing document reference" />
          <input name="governing_document_reference" className="mt-4 h-10 w-full rounded border border-ink-200 px-3 text-sm" placeholder="Governing document reference" />
        </Section>
        <Section title="Dates and escalation">
          <div className="grid gap-4 md:grid-cols-4">
            <label className="text-sm font-medium text-ink-700">Observed<input name="date_observed" type="date" className="mt-1 h-10 w-full rounded border border-ink-200 px-3 text-sm" /></label>
            <label className="text-sm font-medium text-ink-700">Due date<input name="due_date" type="date" className="mt-1 h-10 w-full rounded border border-ink-200 px-3 text-sm" /></label>
            <label className="text-sm font-medium text-ink-700">Hearing date<input name="hearing_date" type="date" className="mt-1 h-10 w-full rounded border border-ink-200 px-3 text-sm" /></label>
            <label className="text-sm font-medium text-ink-700">Status<select name="status" className="mt-1 h-10 w-full rounded border border-ink-200 bg-white px-3 text-sm"><option>open</option><option>notice_sent</option><option>hearing_pending</option><option>fined</option></select></label>
          </div>
        </Section>
        <Section title="Fine and evidence">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-ink-700">Fine amount<input name="fine_amount" className="mt-1 h-10 w-full rounded border border-ink-200 px-3 text-sm" placeholder="$0.00" /></label>
            <div className="rounded border border-dashed border-ink-200 bg-cream-50 px-4 py-6 text-center text-sm text-ink-500">Evidence and attachments will be added after the draft is saved.</div>
          </div>
        </Section>
        <div className="flex justify-end gap-2"><Link href="/violations" className="rounded border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-cream-50">Cancel</Link><Button type="submit">Save draft</Button></div>
      </form>
    </DataWorkspace>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded border border-ink-100 bg-white p-5"><h2 className="text-sm font-semibold text-ink-900">{title}</h2><div className="mt-4">{children}</div></section>;
}

function Select({ name, label, required, options }: { name: string; label: string; required?: boolean; options: Array<{ value: string; label: string }> }) {
  return <label className="text-sm font-medium text-ink-700">{label}<select name={name} required={required} className="mt-1 h-10 w-full rounded border border-ink-200 bg-white px-3 text-sm"><option value="">Select {label.toLowerCase()}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function NoticePreview() {
  return <div className="space-y-3 text-sm text-ink-600"><h2 className="text-sm font-semibold text-ink-900">Draft notice preview</h2><p>No email, letter, or owner communication is sent from this screen. Preview first, then confirm outbound delivery from the saved record.</p></div>;
}
