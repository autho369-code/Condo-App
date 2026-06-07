import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Weekly', monthly: 'Monthly', bimonthly: 'Every 2 months',
  quarterly: 'Quarterly', semiannual: 'Semi-annual', annual: 'Annual', custom: 'Custom',
};

export default async function MaintenancePage({ searchParams }: { searchParams: Promise<{ assoc?: string; category?: string }> }) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;
  const sp = await searchParams;

  // Filters
  const [{ data: tasks }, { data: associations }, { data: templates }] = await Promise.all([
    db.from('v_upcoming_maintenance').select('*').order('next_due_date', { ascending: true, nullsFirst: false }),
    db.from('associations').select('id,name').is('archived_at', null).order('name'),
    db.from('maintenance_templates').select('*').order('category'),
  ]);

  let rows = tasks ?? [];
  if (sp.assoc) rows = rows.filter((t: any) => t.association_id === sp.assoc);
  if (sp.category) rows = rows.filter((t: any) => t.category === sp.category);

  const overdue = rows.filter((t: any) => t.days_until_due < 0).length;
  const upcoming = rows.filter((t: any) => t.days_until_due >= 0 && t.days_until_due <= 14).length;
  const categories: string[] = [...new Set(rows.map((t: any) => t.category as string))].sort();

  return (
    <div className="mx-auto h-full max-w-7xl overflow-y-auto px-8 py-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Preventive maintenance</h1>
          <p className="mt-1 text-sm text-ink-500">Template-driven recurring maintenance. Fully editable per association.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/maintenance/templates"><Button variant="secondary">Template library</Button></Link>
          <Link href="/maintenance/new"><Button>+ Add task</Button></Link>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Metric label="Active tasks" value={rows.length} tone="text-ink-700" />
        <Metric label="Due within 14 days" value={upcoming} tone="text-amber-700" />
        <Metric label="Overdue" value={overdue} tone="text-bordeaux-700" />
        <Metric label="Templates" value={(templates ?? []).length} tone="text-emerald-700" />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <form action="/maintenance" method="get" className="flex flex-wrap gap-3">
          <select name="assoc" defaultValue={sp.assoc ?? ''} className="h-9 rounded border border-ink-200 bg-white px-3 text-sm">
            <option value="">All associations</option>
            {(associations ?? []).map((a: any) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <select name="category" defaultValue={sp.category ?? ''} className="h-9 rounded border border-ink-200 bg-white px-3 text-sm">
            <option value="">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <Button type="submit" size="sm" variant="secondary">Filter</Button>
          {(sp.assoc || sp.category) && <Link href="/maintenance" className="text-sm text-ink-500 self-center hover:text-ink-900">Clear</Link>}
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink-200 bg-white px-6 py-12 text-center">
          <h2 className="text-base font-semibold text-ink-900">No maintenance tasks yet</h2>
          <p className="mt-1 text-sm text-ink-500">Add tasks manually or apply a template from the library.</p>
          <div className="mt-4 flex justify-center gap-3">
            <Link href="/maintenance/templates"><Button variant="secondary">Browse templates</Button></Link>
            <Link href="/maintenance/new"><Button>Add first task</Button></Link>
          </div>
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Task</TH>
              <TH>Association</TH>
              <TH>Category</TH>
              <TH>Frequency</TH>
              <TH>Vendor</TH>
              <TH>Next due</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <tbody>
            {rows.map((t: any) => (
              <TR key={t.id} className="hover:bg-cream-50">
                <TD>
                  <Link href={`/maintenance/${t.id}`} className="font-medium text-champagne-700 hover:underline">{t.task_name}</Link>
                  {t.priority === 'critical' && <span className="ml-2 text-xs text-bordeaux-600">⚠ Critical</span>}
                </TD>
                <TD className="text-ink-600">{t.association_name}</TD>
                <TD className="text-xs uppercase text-ink-500">{t.category}</TD>
                <TD className="text-ink-600">{FREQUENCY_LABELS[t.frequency] ?? t.frequency}</TD>
                <TD className="text-ink-600">{t.vendor_name ?? '—'}</TD>
                <TD>
                  <span className={t.days_until_due < 0 ? 'text-bordeaux-700 font-medium' : t.days_until_due <= 7 ? 'text-amber-700 font-medium' : 'text-ink-700'}>
                    {date(t.next_due_date) || 'Not set'}
                  </span>
                  {t.days_until_due != null && (
                    <div className="text-xs text-ink-500">
                      {t.days_until_due < 0 ? `${Math.abs(t.days_until_due)}d overdue` : t.days_until_due === 0 ? 'Today' : `${t.days_until_due}d`}
                    </div>
                  )}
                </TD>
                <TD>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    t.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                    t.status === 'paused' ? 'bg-slate-100 text-slate-700' : 'bg-blue-100 text-blue-700'
                  }`}>{t.status}</span>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
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
