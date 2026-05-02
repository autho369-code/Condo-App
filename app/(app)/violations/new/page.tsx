import Link from 'next/link';
import type { ReactNode } from 'react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/me';
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
      actions={<Link href="/violations" className="text-sm font-medium text-gray-600 hover:text-gray-950">Cancel</Link>}
      rail={<NoticePreview />}
    >
      <form className="space-y-5">
        <Section title="Association, unit, and owner">
          <div className="grid gap-4 md:grid-cols-3">
            <Select label="Association" options={(associations ?? []).map((row: any) => ({ value: row.id, label: row.name }))} />
            <Select label="Unit" options={(units ?? []).map((row: any) => ({ value: row.id, label: row.unit_number }))} />
            <Select label="Owner" options={(owners ?? []).map((row: any) => ({ value: row.id, label: row.full_name }))} />
          </div>
        </Section>
        <Section title="Rule and violation">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-gray-700">Rule/type<select className="mt-1 h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm">{typeOptions.map((type) => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}</select></label>
            <label className="text-sm font-medium text-gray-700">Title<input className="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm" placeholder="Parking violation, noise complaint..." /></label>
          </div>
          <textarea className="mt-4 w-full rounded border border-gray-300 px-3 py-2 text-sm" rows={4} placeholder="Observation details and governing document reference" />
        </Section>
        <Section title="Dates and escalation">
          <div className="grid gap-4 md:grid-cols-4">
            <label className="text-sm font-medium text-gray-700">Observed<input type="date" className="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm" /></label>
            <label className="text-sm font-medium text-gray-700">Due date<input type="date" className="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm" /></label>
            <label className="text-sm font-medium text-gray-700">Hearing date<input type="date" className="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm" /></label>
            <label className="text-sm font-medium text-gray-700">Status<select className="mt-1 h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm"><option>open</option><option>notice_sent</option><option>hearing_pending</option><option>fined</option></select></label>
          </div>
        </Section>
        <Section title="Fine and evidence">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-gray-700">Fine amount<input className="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm" placeholder="$0.00" /></label>
            <div className="rounded border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">Evidence and attachments will be added after the draft is saved.</div>
          </div>
        </Section>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary">Preview notice</Button><Button type="button">Save draft</Button></div>
      </form>
    </DataWorkspace>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded border border-gray-200 bg-white p-5"><h2 className="text-sm font-semibold text-gray-950">{title}</h2><div className="mt-4">{children}</div></section>;
}

function Select({ label, options }: { label: string; options: Array<{ value: string; label: string }> }) {
  return <label className="text-sm font-medium text-gray-700">{label}<select className="mt-1 h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm"><option>Select {label.toLowerCase()}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function NoticePreview() {
  return <div className="space-y-3 text-sm text-gray-600"><h2 className="text-sm font-semibold text-gray-950">Draft notice preview</h2><p>No email, letter, or owner communication is sent from this screen. Preview first, then confirm outbound delivery from the saved record.</p></div>;
}
