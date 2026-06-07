import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const FREQ: Record<string, string> = {
  weekly:'Weekly',monthly:'Monthly',bimonthly:'Every 2mo',quarterly:'Quarterly',semiannual:'Semi-annual',annual:'Annual',custom:'Custom'
};

export default async function MaintenancePage({ searchParams }: { searchParams: Promise<{ assoc?: string; cat?: string }> }) {
  await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;
  const sp = await searchParams;

  const [{ data: tasks }, { data: associations }, { data: templates }] = await Promise.all([
    db.from('v_upcoming_maintenance').select('*').order('next_due_date', { ascending: true, nullsFirst: false }),
    db.from('associations').select('id,name').is('archived_at', null).order('name'),
    db.from('maintenance_templates').select('id,name,category').order('category'),
  ]);

  let rows = (tasks ?? []) as any[];
  if (sp.assoc) rows = rows.filter((t) => t.association_id === sp.assoc);
  if (sp.cat) rows = rows.filter((t) => t.category === sp.cat);

  const overdue = rows.filter((t) => t.days_until_due < 0).length;
  const soon = rows.filter((t) => t.days_until_due >= 0 && t.days_until_due <= 14).length;
  const catSet = new Set(rows.map((t) => t.category));
  const categories = Array.from(catSet).sort();

  return (
    <div className="mx-auto h-full max-w-7xl overflow-y-auto px-8 py-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Preventive maintenance</h1>
          <p className="mt-1 text-sm text-ink-500">Template-driven recurring tasks. Fully editable per association.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/maintenance/templates"><Button variant="secondary">Templates ({(templates ?? []).length})</Button></Link>
          <Link href="/maintenance/new"><Button>+ Add task</Button></Link>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Metric label="Active" value={rows.length} tone="text-ink-700" />
        <Metric label="Due soon" value={soon} tone="text-amber-700" />
        <Metric label="Overdue" value={overdue} tone="text-bordeaux-700" />
        <Metric label="Templates" value={(templates ?? []).length} tone="text-emerald-700" />
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <form action="/maintenance" method="get" className="flex flex-wrap gap-3">
          <select name="assoc" defaultValue={sp.assoc ?? ''} className="h-9 rounded border border-ink-200 bg-white px-3 text-sm">
            <option value="">All associations</option>
            {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select name="cat" defaultValue={sp.cat ?? ''} className="h-9 rounded border border-ink-200 bg-white px-3 text-sm">
            <option value="">All categories</option>
            {categories.map((c: string) => <option key={c} value={c}>{c}</option>)}
          </select>
          <Button type="submit" size="sm" variant="secondary">Filter</Button>
          {(sp.assoc || sp.cat) ? <Link href="/maintenance" className="text-sm text-ink-500 self-center hover:text-ink-900">Clear</Link> : null}
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink-200 bg-white px-6 py-12 text-center">
          <h2 className="text-base font-semibold text-ink-900">No tasks yet</h2>
          <p className="mt-1 text-sm text-ink-500">Add tasks manually or apply a template.</p>
          <div className="mt-4 flex justify-center gap-3">
            <Link href="/maintenance/templates"><Button variant="secondary">Browse templates</Button></Link>
            <Link href="/maintenance/new"><Button>Add first task</Button></Link>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-ink-100 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-ink-100 bg-cream-50">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-ink-600">Task</th>
                <th className="px-4 py-2.5 text-left font-medium text-ink-600">Association</th>
                <th className="px-4 py-2.5 text-left font-medium text-ink-600">Category</th>
                <th className="px-4 py-2.5 text-left font-medium text-ink-600">Frequency</th>
                <th className="px-4 py-2.5 text-left font-medium text-ink-600">Due</th>
                <th className="px-4 py-2.5 text-left font-medium text-ink-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((t: any) => (
                <tr key={t.id} className="hover:bg-cream-50">
                  <td className="px-4 py-3 font-medium text-ink-900">{t.task_name}</td>
                  <td className="px-4 py-3 text-ink-600">{t.association_name}</td>
                  <td className="px-4 py-3 text-xs uppercase text-ink-500">{t.category}</td>
                  <td className="px-4 py-3 text-ink-600">{FREQ[t.frequency] ?? t.frequency}</td>
                  <td className="px-4 py-3">
                    <span className={t.days_until_due < 0 ? 'text-bordeaux-700 font-medium' : t.days_until_due <= 7 ? 'text-amber-700' : 'text-ink-700'}>
                      {date(t.next_due_date) || '—'}
                    </span>
                    {t.days_until_due != null && (
                      <span className="ml-2 text-xs text-ink-400">
                        {t.days_until_due < 0 ? `${Math.abs(t.days_until_due)}d late` : t.days_until_due === 0 ? 'today' : `${t.days_until_due}d`}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      t.status === 'paused' ? 'bg-slate-100 text-slate-700' : 'bg-blue-100 text-blue-700'
                    }`}>{t.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-ink-100 bg-white px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wider text-ink-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}
