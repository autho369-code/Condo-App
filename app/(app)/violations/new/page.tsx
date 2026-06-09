import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { createViolation } from './actions';

export const dynamic = 'force-dynamic';

const typeOptions = ['noise', 'parking', 'pets', 'exterior_modification', 'trash_debris', 'landscaping', 'common_area_misuse', 'lease_violation', 'assessment_delinquency', 'other'];

export default async function NewViolationPage() {
  await requireStaff();
  const supabase = await createClient();
  const [{ data: associations }, { data: units }, { data: owners }] = await Promise.all([
    (supabase as any).from('associations').select('id, name').order('name'),
    (supabase as any).from('units').select('id, unit_number').order('unit_number').limit(500),
    (supabase as any).from('owners').select('id, full_name').order('full_name').limit(500),
  ]);

  async function handleSubmit(formData: FormData) {
    'use server';
    await createViolation(formData);
    redirect('/violations');
  }

  return (
    <DataWorkspace
      title="New violation"
      description="Record a violation with association, unit, owner, rule reference, dates, and fine."
      actions={<Link href="/violations" className="text-sm font-medium text-gray-600 hover:text-gray-950">Cancel</Link>}
    >
      <form action={handleSubmit} className="space-y-5">
        <Section title="Association, unit, and owner">
          <div className="grid gap-4 md:grid-cols-3">
            <Select name="association_id" label="Association" options={(associations ?? []).map((row: any) => ({ value: row.id, label: row.name }))} />
            <Select name="unit_id" label="Unit" options={(units ?? []).map((row: any) => ({ value: row.id, label: row.unit_number }))} />
            <Select name="owner_id" label="Owner" options={(owners ?? []).map((row: any) => ({ value: row.id, label: row.full_name }))} />
          </div>
        </Section>
        <Section title="Rule and violation">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-gray-700">Rule/type
              <select name="violation_type" className="mt-1 h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm">
                {typeOptions.map((type) => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">Title
              <input name="title" className="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm" placeholder="Parking violation, noise complaint..." />
            </label>
          </div>
          <textarea name="description" className="mt-4 w-full rounded border border-gray-300 px-3 py-2 text-sm" rows={4} placeholder="Observation details and governing document reference" />
        </Section>
        <Section title="Dates and escalation">
          <div className="grid gap-4 md:grid-cols-4">
            <label className="text-sm font-medium text-gray-700">Observed
              <input name="observed_date" type="date" className="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm" />
            </label>
            <label className="text-sm font-medium text-gray-700">Due date
              <input name="due_date" type="date" className="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm" />
            </label>
            <label className="text-sm font-medium text-gray-700">Hearing date
              <input name="hearing_date" type="date" className="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm" />
            </label>
            <label className="text-sm font-medium text-gray-700">Status
              <select name="status" className="mt-1 h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm">
                <option value="open">Open</option>
                <option value="notice_sent">Notice Sent</option>
                <option value="hearing_pending">Hearing Pending</option>
                <option value="fined">Fined</option>
              </select>
            </label>
          </div>
        </Section>
        <Section title="Fine">
          <label className="text-sm font-medium text-gray-700">Fine amount
            <input name="fine_amount" type="number" step="0.01" min="0" className="mt-1 h-10 w-64 rounded border border-gray-300 px-3 text-sm" placeholder="$0.00" />
          </label>
        </Section>
        <div className="flex justify-end gap-2">
          <Link href="/violations" className="inline-flex items-center justify-center h-10 px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</Link>
          <Button type="submit">Create violation</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded border border-gray-200 bg-white p-5"><h2 className="text-sm font-semibold text-gray-950">{title}</h2><div className="mt-4">{children}</div></section>;
}

function Select({ name, label, options }: { name: string; label: string; options: Array<{ value: string; label: string }> }) {
  return <label className="text-sm font-medium text-gray-700">{label}
    <select name={name} className="mt-1 h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm">
      <option value="">Select {label.toLowerCase()}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>;
}
