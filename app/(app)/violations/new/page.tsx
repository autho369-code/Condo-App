import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Alert } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const typeOptions = ['noise', 'parking', 'pets', 'exterior_modification', 'trash_debris', 'landscaping', 'common_area_misuse', 'lease_violation', 'assessment_delinquency', 'other'];

export default async function NewViolationPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: associations }, { data: units }, { data: owners }] = await Promise.all([
    (supabase as any).from('associations').select('id, name').order('name'),
    (supabase as any).from('units').select('id, unit_number').order('unit_number').limit(500),
    (supabase as any).from('owners').select('id, full_name').order('full_name').limit(500),
  ]);

  async function handleSubmit(formData: FormData) {
    'use server';
    const me = await requireStaff();
    const supabase = await createClient();
    const db = supabase as any;
    const failTo = (msg: string) => redirect(`/violations/new?error=${encodeURIComponent(msg)}`);

    const unitId = (formData.get('unit_id') as string) || null;
    let associationId = (formData.get('association_id') as string) || null;

    // Resolve association_id from the unit when not provided directly.
    if (!associationId && unitId) {
      const { data: unit } = await db
        .from('units')
        .select('buildings!inner(association_id)')
        .eq('id', unitId)
        .maybeSingle();
      associationId = (unit?.buildings as any)?.association_id ?? null;
    }
    if (!associationId) failTo('Select an association (or a unit so we can resolve one).');

    const title = (formData.get('title') as string)?.trim();
    if (!title) failTo('Enter a title.');

    const violation = {
      association_id: associationId,
      unit_id: unitId,
      owner_id: (formData.get('owner_id') as string) || null,
      violation_type: (formData.get('violation_type') as string) || 'other',
      title,
      description: (formData.get('description') as string) || null,
      date_observed: (formData.get('observed_date') as string) || new Date().toISOString().slice(0, 10),
      due_date: (formData.get('due_date') as string) || null,
      hearing_date: (formData.get('hearing_date') as string) || null,
      status: (formData.get('status') as string) || 'open',
      fine_amount: formData.get('fine_amount') ? parseFloat(formData.get('fine_amount') as string) : null,
      created_by: me.auth_user_id,
    };
    const { error } = await db.from('violations').insert(violation);
    if (error) failTo(error.message);
    redirect('/violations');
  }

  return (
    <DataWorkspace
      title="New violation"
      description="Record a violation with association, unit, owner, rule reference, dates, and fine."
      actions={<Link href="/violations" className="text-sm font-medium text-gray-600 hover:text-gray-950">Cancel</Link>}
    >
      <form action={handleSubmit} className="space-y-5">
        {sp.error && <Alert tone="danger" title="Could not create violation">{sp.error}</Alert>}
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
              <select name="violation_type" className="mt-1 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                {typeOptions.map((type) => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">Title
              <input name="title" className="mt-1 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Parking violation, noise complaint..." />
            </label>
          </div>
          <textarea name="description" className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" rows={4} placeholder="Observation details and governing document reference" />
        </Section>
        <Section title="Dates and escalation">
          <div className="grid gap-4 md:grid-cols-4">
            <label className="text-sm font-medium text-gray-700">Observed
              <input name="observed_date" type="date" className="mt-1 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
            </label>
            <label className="text-sm font-medium text-gray-700">Due date
              <input name="due_date" type="date" className="mt-1 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
            </label>
            <label className="text-sm font-medium text-gray-700">Hearing date
              <input name="hearing_date" type="date" className="mt-1 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
            </label>
            <label className="text-sm font-medium text-gray-700">Status
              <select name="status" className="mt-1 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
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
            <input name="fine_amount" type="number" step="0.01" min="0" className="mt-1 h-10 w-64 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="$0.00" />
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
  return <section className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"><h2 className="text-sm font-semibold text-gray-950">{title}</h2><div className="mt-4">{children}</div></section>;
}

function Select({ name, label, options }: { name: string; label: string; options: Array<{ value: string; label: string }> }) {
  return <label className="text-sm font-medium text-gray-700">{label}
    <select name={name} className="mt-1 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
      <option value="">Select {label.toLowerCase()}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>;
}
