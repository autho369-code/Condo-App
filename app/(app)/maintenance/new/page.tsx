import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Section } from '@/components/workspace/shell';

export const dynamic = 'force-dynamic';

const CATEGORIES = ['Safety','Plumbing','Exterior','Interior','Grounds','HVAC','Mechanical','Electrical','Operations','Pest Control','Other'];
const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'bimonthly', label: 'Every 2 months' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semiannual', label: 'Semi-annual' },
  { value: 'annual', label: 'Annual' },
  { value: 'custom', label: 'Custom interval' },
];
const REMINDER_OPTIONS = [30, 14, 10, 7, 5, 3, 1];

async function createTask(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const db = supabase as any;

  const frequency = formData.get('frequency') as string;
  const reminders = formData.getAll('reminder_days').map(Number).filter(n => n > 0);
  const startDate = formData.get('start_date') as string;

  const { error } = await db.from('maintenance_tasks').insert({
    association_id: formData.get('association_id') as string,
    task_name: formData.get('task_name') as string,
    category: formData.get('category') as string,
    frequency,
    custom_interval_days: frequency === 'custom' ? parseInt(formData.get('custom_interval_days') as string) || null : null,
    vendor_id: (formData.get('vendor_id') as string) || null,
    assigned_staff_id: (formData.get('assigned_staff_id') as string) || null,
    reminder_days: reminders.length > 0 ? reminders : [30, 14, 7, 3, 1],
    priority: (formData.get('priority') as string) || 'normal',
    start_date: startDate,
    end_date: (formData.get('end_date') as string) || null,
    next_due_date: startDate,
    notes: (formData.get('notes') as string) || null,
  });

  if (error) return { error: error.message };
  revalidatePath('/maintenance');
  redirect('/maintenance');
}

export default async function NewMaintenancePage({ searchParams }: { searchParams: Promise<{ template?: string; assoc?: string }> }) {
  await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;
  const sp = await searchParams;

  const [{ data: associations }, { data: vendors }, { data: staff }, { data: template }] = await Promise.all([
    db.from('associations').select('id,name').is('archived_at', null).order('name'),
    db.from('vendors').select('id,name,trade').is('archived_at', null).order('name'),
    db.from('profiles').select('id,full_name,email').eq('hoa_role','manager').order('full_name'),
    sp.template ? db.from('maintenance_templates').select('*').eq('id', sp.template).single() : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-8 py-6">
      <div>
        <nav className="text-xs font-semibold uppercase tracking-wider text-ink-500">
          <Link href="/maintenance" className="hover:text-ink-700">Maintenance</Link>
          <span className="mx-2">/</span>
          New task
        </nav>
        <h1 className="mt-2 text-2xl font-semibold text-ink-900">Add maintenance task</h1>
        <p className="mt-1 text-sm text-ink-500">Tasks auto-recur based on frequency and appear on the association calendar.</p>
      </div>

      <form action={createTask as any} className="space-y-6">
        <Section title="Task details" padded>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="task_name">Task name <span className="text-red-500">*</span></Label>
              <Input id="task_name" name="task_name" required defaultValue={template?.name ?? ''} placeholder="e.g. Elevator Inspection" />
            </div>

            <div>
              <Label htmlFor="association_id">Association <span className="text-red-500">*</span></Label>
              <select id="association_id" name="association_id" required defaultValue={sp.assoc ?? ''} className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                <option value="">Select association</option>
                {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            <div>
              <Label htmlFor="category">Category <span className="text-red-500">*</span></Label>
              <select id="category" name="category" required defaultValue={template?.category ?? ''} className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                <option value="">Select category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <Label htmlFor="frequency">Frequency <span className="text-red-500">*</span></Label>
              <select id="frequency" name="frequency" required defaultValue="annual" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>

            <div>
              <Label htmlFor="custom_interval_days">Custom interval (days)</Label>
              <Input id="custom_interval_days" name="custom_interval_days" type="number" min="1" placeholder="e.g. 45, 90, 120" />
              <p className="mt-1 text-xs text-ink-400">Only used when frequency is &quot;Custom interval&quot;</p>
            </div>

            <div>
              <Label htmlFor="priority">Priority</Label>
              <select id="priority" name="priority" defaultValue="normal" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div>
              <Label htmlFor="start_date">Start date <span className="text-red-500">*</span></Label>
              <Input id="start_date" name="start_date" type="date" required />
            </div>

            <div>
              <Label htmlFor="end_date">End date (optional)</Label>
              <Input id="end_date" name="end_date" type="date" />
            </div>
          </div>
        </Section>

        <Section title="Assignment" padded>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="vendor_id">Vendor</Label>
              <select id="vendor_id" name="vendor_id" defaultValue="" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                <option value="">No vendor assigned</option>
                {(vendors ?? []).map((v: any) => <option key={v.id} value={v.id}>{v.name} ({v.trade})</option>)}
              </select>
            </div>

            <div>
              <Label htmlFor="assigned_staff_id">Assigned manager</Label>
              <select id="assigned_staff_id" name="assigned_staff_id" defaultValue="" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                <option value="">Unassigned</option>
                {(staff ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
              </select>
            </div>
          </div>
        </Section>

        <Section title="Reminders" padded>
          <p className="mb-3 text-sm text-ink-500">Select when to send reminders before the due date. Multiple allowed.</p>
          <div className="flex flex-wrap gap-3">
            {REMINDER_OPTIONS.map(d => (
              <label key={d} className="flex items-center gap-2 rounded border border-ink-200 px-3 py-2 text-sm hover:bg-cream-50 cursor-pointer">
                <input type="checkbox" name="reminder_days" value={d} defaultChecked={[30,14,7].includes(d)} />
                {d} days before
              </label>
            ))}
          </div>
        </Section>

        <Section title="Notes" padded>
          <div>
            <Label htmlFor="notes">Internal notes</Label>
            <textarea id="notes" name="notes" rows={3} className="w-full rounded-md border border-ink-200 px-3 py-2 text-sm" placeholder="Special instructions, access codes, equipment details..." />
          </div>
        </Section>

        <div className="flex items-center gap-3">
          <Button type="submit" size="lg">Create task</Button>
          <Link href="/maintenance" className="text-sm text-ink-500 hover:text-ink-900">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
